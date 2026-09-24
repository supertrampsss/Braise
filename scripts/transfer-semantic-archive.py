#!/usr/bin/env python3
"""Upload an immutable archive in bounded chunks; verify every remote byte.
Credential is read with getpass, never from argv or persistent configuration.
The output inventory belongs in the source repository for disaster recovery.
"""
import argparse, getpass, hashlib, json, os, urllib.request, urllib.error
from pathlib import Path

ORIGIN = 'https://braiz.io/api/semantic-transfer'
CHUNK = 8 * 1024 * 1024
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise RuntimeError('Transfer redirects are forbidden')

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('archive')
    parser.add_argument('inventory')
    args = parser.parse_args()
    token = getpass.getpass('Transfer credential (hidden): ')
    opener = urllib.request.build_opener(NoRedirect)
    path = Path(args.archive)
    if path.is_symlink() or not path.is_file():
        raise RuntimeError('Archive must be a regular file')
    def request(method, digest, data=None):
        req = urllib.request.Request(ORIGIN + '?sha256=' + digest, data=data, method=method,
            headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/octet-stream'})
        return opener.open(req, timeout=120)
    inventory = {'format': 'braiz-r2-archive-v1', 'filename': path.name, 'bytes': path.stat().st_size, 'chunks': [], 'complete': False}
    output = Path(args.inventory)
    output.parent.mkdir(parents=True, exist_ok=True)
    def checkpoint():
        temp = output.with_suffix('.tmp')
        temp.write_text(json.dumps(inventory, indent=2) + '\n')
        os.replace(temp, output)
    full = hashlib.sha256()
    with path.open('rb') as source:
        while chunk := source.read(CHUNK):
            full.update(chunk)
            digest = hashlib.sha256(chunk).hexdigest()
            present = False
            try:
                with request('HEAD', digest) as response:
                    present = int(response.headers.get('Content-Length', '-1')) == len(chunk) and response.headers.get('X-Content-SHA256') == digest
            except urllib.error.HTTPError as error:
                if error.code != 404: raise
            if not present:
                with request('PUT', digest, chunk) as response:
                    if response.status != 201: raise RuntimeError('Upload failed')
            with request('GET', digest) as response:
                remote = response.read(CHUNK + 1)
            if len(remote) != len(chunk) or hashlib.sha256(remote).hexdigest() != digest:
                raise RuntimeError('Remote integrity failure')
            inventory['chunks'].append({'sha256': digest, 'bytes': len(chunk)})
            checkpoint()
            print(json.dumps({'verified_chunks':len(inventory['chunks']), 'verified_bytes':sum(c['bytes'] for c in inventory['chunks'])}), flush=True)
    if path.stat().st_size != inventory['bytes'] or sum(c['bytes'] for c in inventory['chunks']) != inventory['bytes']:
        raise RuntimeError('Archive changed during transfer')
    inventory['sha256'] = full.hexdigest()
    inventory['complete'] = True
    checkpoint()
    print(json.dumps({'complete':True, 'sha256':inventory['sha256'], 'bytes':inventory['bytes']}), flush=True)
if __name__ == '__main__': main()
