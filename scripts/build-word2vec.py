#!/usr/bin/env python3
"""Build the complete, pinned French Word2Vec corpus. Requires only NumPy."""
import argparse
import gzip
import hashlib
import json
from pathlib import Path
import struct
import time
import unicodedata

import numpy as np

SOURCE_NAME = "frWac_non_lem_no_postag_no_phrase_500_skip_cut100.bin"
SOURCE_BYTES = 312726847
SOURCE_MD5 = "af38908c244dce973e289c70a4ce7242"
SOURCE_SHA256 = "d617b3a27db256c5fdf39483ed9caa07424b3446813503d936e7fd972592790a"
COUNT, DIMENSIONS = 155562, 500
CORPUS = "frwac-word2vec-155562-d617b3a27db2-v1"
ROOT = Path(__file__).resolve().parent.parent


def canonical(word):
    return unicodedata.normalize("NFC", word.strip().lower()).replace("’", "'")


def read_source(path):
    if path.stat().st_size != SOURCE_BYTES:
        raise ValueError("Source size does not match the pinned model")
    raw = path.read_bytes()
    if hashlib.md5(raw).hexdigest() != SOURCE_MD5 or hashlib.sha256(raw).hexdigest() != SOURCE_SHA256:
        raise ValueError("Source fingerprint does not match the pinned model")
    end = raw.index(b"\n")
    if raw[:end] != b"155562 500":
        raise ValueError("Unexpected Word2Vec header")
    vectors = np.empty((COUNT, DIMENSIONS), dtype=np.float32)
    words, source_words, pos = [], [], end + 1
    for row in range(COUNT):
        while pos < len(raw) and raw[pos] == 10:
            pos += 1
        end = raw.index(b" ", pos)
        word = raw[pos:end].decode("utf-8", errors="strict")
        if not word:
            raise ValueError(f"Invalid source token at row {row}")
        pos = end + 1
        if pos + DIMENSIONS * 4 > len(raw):
            raise ValueError(f"Truncated source vector at row {row}")
        vectors[row] = np.frombuffer(raw, dtype="<f4", count=DIMENSIONS, offset=pos)
        source_words.append(word)
        words.append(canonical(word))
        pos += DIMENSIONS * 4
    if raw[pos:] not in (b"", b"\n"):
        raise ValueError("Unexpected bytes after the last source vector")
    if not np.isfinite(vectors).all():
        raise ValueError("Source contains non-finite components")
    values = vectors.astype(np.float64)
    norms = np.sqrt(np.einsum("ij,ij->i", values, values, optimize=False))
    if not np.isfinite(norms).all() or np.any(norms <= 0):
        raise ValueError("Source contains invalid or zero norms")
    return words, source_words, values, norms


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=ROOT / "work/word2vec-source" / SOURCE_NAME)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--report", type=Path, default=ROOT / "work/word2vec-build-report.json")
    args = parser.parse_args()
    started = time.perf_counter()
    words, source_words, values, norms = read_source(args.source)
    first_ids, duplicates = {}, {}
    for word_id, word in enumerate(words):
        if word in first_ids:
            duplicates.setdefault(word, [first_ids[word]]).append(word_id)
        else:
            first_ids[word] = word_id
    collisions = [{"word": word, "ids": ids, "sourceForms": [source_words[i] for i in ids], "lookupId": ids[0]}
                  for word, ids in sorted(duplicates.items())]
    legacy = json.loads((args.root / "data/legacy-v1.json").read_text(encoding="utf-8"))["targets"]
    editorial = [entry["word"] for entry in json.loads((args.root / "data/editorial-v2-runtime.json").read_text(encoding="utf-8"))["entries"]]
    requested = list(dict.fromkeys(canonical(word) for word in legacy + editorial))
    missing = [word for word in requested if word not in first_ids]
    missing_legacy = [word for word in legacy if canonical(word) not in first_ids]
    # New editions use the source spelling. Historical data and input lookup
    # remain exact; this is a secret-selection correspondence, not an alias.
    correspondences = {"œuf": "oeuf", "sœur": "soeur", "cœur": "coeur"}
    if any(word not in first_ids for word in correspondences.values()):
        raise ValueError("A secret spelling correspondence is absent from the source")
    legacy_words = [correspondences.get(word, canonical(word)) for word in legacy]
    if any(word not in first_ids for word in legacy_words):
        raise ValueError("A new historical-slot secret is absent from the source")
    if len(legacy) != 120 or len(editorial) != 406 or len(requested) != 475:
        raise ValueError("Unexpected target catalogue sizes")
    target_words = list(dict.fromkeys(correspondences.get(word, word) for word in requested))
    if any(word not in first_ids for word in target_words):
        raise ValueError("A new-edition secret is absent from the source")
    summary = {"sourceEntries": COUNT, "dimensions": DIMENSIONS, "targets": len(target_words),
               "missingTargets": missing, "missingLegacyTargets": missing_legacy,
               "canonicalCollisions": collisions, "zeroNorms": 0,
               "normRange": [float(norms.min()), float(norms.max())]}
    print(json.dumps(summary, ensure_ascii=False), flush=True)
    out = args.root / "public/semantic/word2vec"
    out.mkdir(parents=True, exist_ok=True)
    segments, ids = [], np.arange(COUNT, dtype=np.uint32)
    # Float32 source values are promoted before multiplication and accumulation.
    # Columns are batched to avoid a dictionary-sized quadratic allocation.
    batch_size = 16
    for start in range(0, len(target_words), batch_size):
        batch = target_words[start:start + batch_size]
        target_ids = [first_ids[word] for word in batch]
        cosines = (values @ values[target_ids].T) / (norms[:, None] * norms[target_ids][None, :])
        np.clip(cosines, -1.0, 1.0, out=cosines)
        for column, (word, target_id) in enumerate(zip(batch, target_ids)):
            similarities = cosines[:, column]
            similarities[target_id] = 1.0
            # Identity leads even if another source entry has the same vector.
            order = np.lexsort((ids, -similarities, ids != target_id))
            ranks = np.empty(COUNT, dtype="<u4")
            ranks[order] = np.arange(1, COUNT + 1, dtype=np.uint32)
            scores = np.clip(np.floor(similarities * 10000 + 0.5), -10000, 9999).astype("<i2")
            scores[target_id] = 10000
            raw = struct.pack("<4s7I", b"BWS1", 1, COUNT, target_id, 32, 32 + COUNT * 2, 32 + COUNT * 6, 0) + scores.tobytes() + ranks.tobytes()
            compressed = gzip.compress(raw, compresslevel=9, mtime=0)
            # Freeze the OS byte as well (Python 3.11/3.12 delegated it to zlib).
            compressed = compressed[:9] + b"\xff" + compressed[10:]
            if len(compressed) >= 25 * 1024 * 1024:
                raise ValueError(f"Asset exceeds the hosting object limit: {word}")
            key = f"semantic/word2vec/{target_id:06d}.bws.gz"
            path = args.root / "public" / key
            temporary = path.with_suffix(path.suffix + ".tmp")
            temporary.write_bytes(compressed)
            temporary.replace(path)
            segments.append({"word": word, "wordId": target_id, "key": key, "rawBytes": len(raw),
                             "compressedBytes": len(compressed), "rawSha256": hashlib.sha256(raw).hexdigest(),
                             "objectSha256": hashlib.sha256(compressed).hexdigest()})
        print(f"Generated {min(start + batch_size, len(target_words))}/{len(target_words)} columns", flush=True)
    manifest = {"schemaVersion": 1, "format": "BWS1", "corpusVersion": CORPUS,
                "vocabularySize": COUNT, "dimensions": DIMENSIONS,
                "normalization": "NFC-lowercase-trim-apostrophe-v1", "lookupCollisionPolicy": "first-source-id; all rows retained in ranking",
                "numericalContract": "float32-source/float64-cosine; floor(x*10000+0.5); ordinal rank before rounding; identity first then cosine descending then source id",
                "source": {"file": SOURCE_NAME, "bytes": SOURCE_BYTES, "md5": SOURCE_MD5, "sha256": SOURCE_SHA256,
                           "url": "https://embeddings.net/embeddings/" + SOURCE_NAME,
                           "author": "Jean-Philippe Fauconnier", "attributionUrl": "https://fauconnier.github.io/#data",
                           "license": "CC BY 3.0", "licenseUrl": "https://creativecommons.org/licenses/by/3.0/"},
                "words": words, "canonicalCollisions": collisions,
                "legacyTargets": legacy_words, "secretSpellingCorrespondences": [{"requested": source, "word2vec": target, "scope": "new-secret-selection-only"} for source, target in correspondences.items()],
                "requestedTargets": {"legacy": 120, "editorial": 406, "union": 475, "missing": missing, "missingLegacy": missing_legacy}, "targets": segments}
    manifest_path = args.root / "data/word2vec-index.json"
    temporary = manifest_path.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(manifest, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8", newline="\n")
    temporary.replace(manifest_path)
    summary.update({"elapsedSeconds": round(time.perf_counter() - started, 3), "compressedBytes": sum(item["compressedBytes"] for item in segments),
                    "rawBytes": sum(item["rawBytes"] for item in segments), "largestAssetBytes": max(item["compressedBytes"] for item in segments),
                    "manifestBytes": manifest_path.stat().st_size, "manifestSha256": hashlib.sha256(manifest_path.read_bytes()).hexdigest()})
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in summary.items() if key != "canonicalCollisions"}, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
