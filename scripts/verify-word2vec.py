#!/usr/bin/env python3
"""Independent exhaustive oracle for BWS2; never imports the generator."""
import argparse
from collections import defaultdict
import gzip
import hashlib
import json
from pathlib import Path
import struct
import time
import unicodedata

import numpy as np

ROOT = Path(__file__).resolve().parent.parent


def require(condition, message):
    if not condition:
        raise ValueError(message)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=ROOT / "work/word2vec-source/frWac_non_lem_no_postag_no_phrase_500_skip_cut100.bin")
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--report", type=Path, default=ROOT / "work/word2vec-verification.json")
    args = parser.parse_args()
    started = time.perf_counter()
    manifest_bytes = (args.root / "data/word2vec-index.json").read_bytes()
    manifest = json.loads(manifest_bytes)
    require(manifest["corpusVersion"] == "frwac-word2vec-155562-d617b3a27db2-v1", "Wrong corpus identity")
    require(manifest["format"] == "BWS2" and manifest["schemaVersion"] == 1, "Wrong manifest schema")
    require(args.source.stat().st_size == 312726847, "Wrong source size")
    md5, sha = hashlib.md5(), hashlib.sha256()
    with args.source.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            md5.update(chunk)
            sha.update(chunk)
    require(md5.hexdigest() == "af38908c244dce973e289c70a4ce7242", "Wrong source MD5")
    require(sha.hexdigest() == "d617b3a27db256c5fdf39483ed9caa07424b3446813503d936e7fd972592790a", "Wrong source SHA-256")
    require(manifest["source"]["bytes"] == 312726847 and manifest["source"]["md5"] == md5.hexdigest() and manifest["source"]["sha256"] == sha.hexdigest(), "Source provenance mismatch")
    # Stream parsing is intentionally distinct from the generator's byte offsets.
    words, forms, vectors = [], [], np.empty((155562, 500), dtype=np.float64)
    with args.source.open("rb") as source:
        require(source.readline() == b"155562 500\n", "Wrong source header")
        for row in range(155562):
            token = bytearray()
            char = source.read(1)
            while char == b"\n":
                char = source.read(1)
            while char not in (b" ", b""):
                token.extend(char)
                char = source.read(1)
            require(char == b" " and bool(token), f"Invalid token {row}")
            word = token.decode("utf-8", errors="strict")
            forms.append(word)
            words.append(unicodedata.normalize("NFC", word.strip().lower()).replace("\u2019", "'"))
            encoded = source.read(2000)
            require(len(encoded) == 2000, f"Truncated vector {row}")
            vectors[row, :] = np.frombuffer(encoded, dtype="<f4").astype(np.float64)
        require(source.read() in (b"", b"\n"), "Unexpected source tail")
    require(np.isfinite(vectors).all(), "Non-finite source component")
    norms = np.sqrt(np.sum(vectors * vectors, axis=1, dtype=np.float64))
    require(np.isfinite(norms).all() and np.all(norms > 0), "Invalid source norms")
    require(manifest["words"] == words and manifest["vocabularySize"] == len(words) and manifest["dimensions"] == 500, "Full vocabulary differs from source")
    groups = defaultdict(list)
    for word_id, word in enumerate(words):
        groups[word].append(word_id)
    collisions = [{"word": word, "ids": ids, "sourceForms": [forms[i] for i in ids], "lookupId": ids[0]}
                  for word, ids in sorted(groups.items()) if len(ids) > 1]
    require(manifest["canonicalCollisions"] == collisions, "Undocumented canonical collision")
    spelling = {"œuf": "oeuf", "sœur": "soeur", "cœur": "coeur"}
    require(manifest["secretSpellingCorrespondences"] == [{"requested": word, "word2vec": replacement, "scope": "new-secret-selection-only"} for word, replacement in spelling.items()], "Secret correspondences differ")
    legacy = json.loads((args.root / "data/legacy-v1.json").read_text(encoding="utf-8"))["targets"]
    editorial = json.loads((args.root / "data/editorial-v2-runtime.json").read_text(encoding="utf-8"))["entries"]
    requested = list(dict.fromkeys(legacy + [entry["word"] for entry in editorial]))
    expected_words = list(dict.fromkeys(spelling.get(word, word) for word in requested))
    require(len(legacy) == 120 and len(expected_words) == 475, "Wrong target catalogue coverage")
    require(manifest["legacyTargets"] == [spelling.get(word, word) for word in legacy], "Historical slot order differs")
    require(all(word in groups for word in manifest["legacyTargets"]), "Historical slot secret missing")
    missing = [word for word in requested if word not in groups]
    require(manifest["requestedTargets"] == {"legacy": 120, "editorial": 406, "union": 475, "missing": missing, "missingLegacy": [word for word in legacy if word not in groups]}, "Requested absence report differs")
    require([entry["word"] for entry in manifest["targets"]] == expected_words, "Columns differ from the full requested union")
    expected_files, samples, raw_total, compressed_total = set(), {}, 0, 0
    ids = np.arange(155562, dtype=np.uint32)
    for number, entry in enumerate(manifest["targets"], 1):
        target_id = groups[entry["word"]][0]
        require(entry["wordId"] == target_id, "Target source identity differs")
        key = f"semantic/word2vec/{target_id:06d}.bws"
        require(entry["key"] == key, "Unexpected asset path")
        expected_files.add(Path(key).name)
        compressed = (args.root / "public" / key).read_bytes()
        require(len(compressed) == entry["compressedBytes"] and len(compressed) < 25 * 1024 * 1024, "Compressed size mismatch")
        require(hashlib.sha256(compressed).hexdigest() == entry["objectSha256"], "Compressed hash mismatch")
        require(compressed[:10] == b"\x1f\x8b\x08\x00\x00\x00\x00\x00\x02\xff", "Non-deterministic gzip header")
        raw = gzip.decompress(compressed)
        require(len(raw) == 933404 == entry["rawBytes"], "Raw size mismatch")
        require(hashlib.sha256(raw).hexdigest() == entry["rawSha256"], "Raw hash mismatch")
        require(struct.unpack_from("<4s7I", raw) == (b"BWS2", 2, 155562, target_id, 32, 311156, 933404, 0), "Binary header mismatch")
        ranked_scores = np.frombuffer(raw, dtype="<i2", count=155562, offset=32)
        ranked_ids = np.frombuffer(raw, dtype="<u4", count=155562, offset=311156)
        require(np.array_equal(np.sort(ranked_ids), ids), "Invalid source-id permutation")
        require(np.all(ranked_scores[:-1] >= ranked_scores[1:]), "Temperatures are not rank-ordered")
        require(ranked_ids[0] == target_id and ranked_scores[0] == 10000, "Rank-one target identity differs")
        actual_scores = np.empty(155562, dtype=np.int16)
        actual_ranks = np.empty(155562, dtype=np.uint32)
        actual_scores[ranked_ids] = ranked_scores
        actual_ranks[ranked_ids] = np.arange(1, 155563, dtype=np.uint32)
        # No BLAS matmul and no persisted scores: independent float64 reduction.
        cosine = np.einsum("ij,j->i", vectors, vectors[target_id], optimize=False)
        cosine /= norms * norms[target_id]
        cosine = np.maximum(-1, np.minimum(1, cosine))
        cosine[target_id] = 1
        expected_scores = np.maximum(-10000, np.minimum(9999, np.floor(cosine * 10000 + 0.5))).astype(np.int16)
        expected_scores[target_id] = 10000
        require(np.array_equal(actual_scores, expected_scores), f"Temperature mismatch: {entry['word']}")
        # Stable sort starts with source ids, independently of lexsort in builder.
        order = np.argsort(-cosine, kind="stable")
        order = np.concatenate((np.array([target_id], dtype=np.uint32), order[order != target_id]))
        expected_ranks = np.empty(155562, dtype=np.uint32)
        expected_ranks[order] = np.arange(1, 155563, dtype=np.uint32)
        if not np.array_equal(actual_ranks, expected_ranks):
            wrong = np.flatnonzero(actual_ranks != expected_ranks)
            raise ValueError(f"Rank mismatch: {entry['word']}, ids {wrong[:10].tolist()}")
        require(actual_scores[target_id] == 10000 and actual_ranks[target_id] == 1, "Exact identity differs")
        require(np.all(np.delete(actual_scores, target_id) < 10000), "Non-identity has winning temperature")
        if entry["word"] == "assiette":
            for word in ["taxe", "impôts", "bol", "institut", "roti", "rôti"]:
                sample_id = groups.get(word, [None])[0]
                samples[word] = None if sample_id is None else {"sourceId": sample_id, "cosine": float(cosine[sample_id]), "score": int(actual_scores[sample_id]), "rank": int(actual_ranks[sample_id])}
        raw_total += len(raw)
        compressed_total += len(compressed)
        if number % 16 == 0 or number == len(manifest["targets"]):
            print(f"Verified every score/rank of {number}/{len(manifest['targets'])} columns", flush=True)
    require({path.name for path in (args.root / "public/semantic/word2vec").iterdir()} == expected_files, "Unlisted or missing Word2Vec objects")
    report = {"status": "verified", "format": "BWS2", "sourceEntries": 155562, "dimensions": 500, "historicalSlots": 120,
              "targets": len(manifest["targets"]), "scoresChecked": 155562 * len(manifest["targets"]), "ranksChecked": 155562 * len(manifest["targets"]),
              "canonicalCollisions": len(collisions), "zeroNorms": 0, "originalMissingSecrets": missing,
              "rawBytes": raw_total, "compressedBytes": compressed_total, "manifestSha256": hashlib.sha256(manifest_bytes).hexdigest(),
              "elapsedSeconds": round(time.perf_counter() - started, 3), "assiette": samples}
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
