# Task 7A — producer report

Status: PHASE A IMPLEMENTED, ready for independent review. Task 7 overall remains OPEN for phase B.

Base: `0886549b3231ee0026764d0ac2c9fd67f822bf85`.
Producer commit: `70145326a4016eb4f7ea82814f35547f3522dde1` (`fix(semantic): preserve verified runtime archives in portable bounded batches`).

## Scope and self-review

- Safe Windows identity: walk/lstat every directory component, rejecting real junctions and symlinks; obtain canonical realpath without treating legitimate case/8.3 spelling differences as links. Existing eviction journal, locks, recovery ownership, quota default 8 and ceiling 64 remain intact.
- Full UUID entropy preserved in shorter disposable SQLite names for index generation and target verifier; fixture reproduces the former 261-character verifier filename. No corpus, float, scoring, gzip, oracle or V1 asset changes.
- Reader-lock regression uses explicit acquired/release synchronization and awaits cleanup even on failure. POSIX-only fixture root made portable. Directory junction security tests execute here. Exactly three file-symlink cases skip only Windows `EPERM`, accurately reported as unavailable privilege.
- Capture accepts optional runtime archive and opt-in capture/archive/evict transition. Independent numerical verification actually executes inside eviction's exclusive guard; callback receives a clone of that current in-process result. Original verifier result is retained privately and cannot be replaced by serialized data. Before deletion, reread active pointer and SHA every manifest/page; callback failure or mutation aborts deletion. Direct capture still performs its original exhaustive validation and corruption checks.
- Complete runtime archive: canonical active pointer, exact manifest, all value and order pages, BEE2; excludes temporary scores, SQLite and locks from its inventory. Immutable SHA inventory/pointer checked before official eviction; previous completed archives survive failures. No editor approval is created.
- Serial bounded driver accepts 1–400 distinct target IDs, exposes no quota override, locks checkpoint scope, refuses checkpoints within staging, records immutable identity receipts after archive+eviction. Restart independently verifies archived scores/ranks/order against actual corpus and BEE2 before using any saved receipt, and resumes official eviction journals. A fully self-consistent forged archive/hash/receipt test still fails numerical verification.
- Four authentic backup inventories and cleanup proof persisted in `docs/program/qualification-2026-10-12/`; stale transfer blocker explicitly superseded. Tar structures independently inspected, active manifest pins checked. JSON inventories retain LF with scoped Git attributes; Git blob hashes for both target runtime inventories equal actual local inventory hashes.
- No secret, live production config, push, deployment, preview server, V1 modification or speculative activation. Optional production Node transfer helper deliberately not introduced: existing controller scratch is documented as a prototype, not newly qualified code.

## Exact checks

1. Targeted esbuild bundles: `editorial-batch`, `editorial-pipeline`, `semantic-batch-v2`, `semantic-index-v2`, `semantic-target-v2`, `semantic-v2-restore`; `node --test --test-concurrency=1 work/task7a-tests/*.js` — exit 0, 43 tests, 40 pass, 0 fail, 3 skips, 35.276 s. Log `work/task7a-targeted.log`. This preceded the additional forged-receipt regression, which is covered in full suite below. Initial targeted run caught one remaining direct Windows file-symlink call (26 pass, 1 fail, 2 skips); fixed before successful run.
2. `npm test` — exit 0, 264 tests, **261 pass, 0 fail, 3 skipped**, 78.827 s. Log `work/task7a-full-tests.log`. Includes all source changes and added forged-receipt regression. Complete baseline now repaired; no per-row transaction change made.
3. `npm run typecheck` — exit 0; final log `work/task7a-typecheck.log` contains no diagnostics.
4. `npm run build` — exit 0; log `work/task7a-build.log`. Controller confirmed exact Wrangler PID19888 tree stopped and port5198 free before build. Existing Vinext route-classification notice remains informational.
5. `node scripts/build-semantic-shards.mjs --verify` — exit 0, verified frozen source SHA `7bfcdbe58d335f191b1c72f9764b563e47d0035d45227603300db12428d64e16`, 120 targets, 20 039 248 compressed bytes, 21 607 680 raw bytes. Log `work/task7a-v1-verify.log`.
6. `git diff --check` and frozen V1 path diff — exit 0. Final tracked tree clean after commit.
7. Real official batch below — exit 0, two complete runtime archives followed by official eviction. Archive integrity checked again after completion, 35 objects each, 7 309 665 bytes (91), 7 282 301 bytes (240).

Skipped security cases: symbolic source file, symbolic downloader partial, partial-path swap to symbolic file during fetch. No skip on other error codes; directory junction and ancestry refusal actually pass.

## Real corpus golden and timings

Corpus pin `e1c07accdc55196c180968d710030e938b861bd7b6c7bf2c0f764e030f365cf7`; semantic pin `8440d4e963ae309c5761818a58bcf752d1aa5750b6b6876d94a055ca177f732d`; index pin `77178f6fc85de9d5523db3f13141b751abdeb1c6b2d3ad6a4d020346a795c426`; 1 013 881 words, 248 segments, 300 dimensions.

Target 91 (existing pays): manifest unchanged `ee333e66d388b407487e931a1ac38555ced5e2e183b4e0c882a036f1f7a3b155`; BEE2 unchanged `0288d29ce92900f8fce1de464162c6b82e4e3e74b335a3e6571554086350492e`; archive inventory `f70669925a98c8b0f3fc1d3de269b536fb2bcd5bccb70439a8e086bdbcb552c1`. Capture numerical verification 29.803 s; BEE2 independent scoring 17.845 s; archive 0.143 s; fresh source hash checks and official eviction 0.029 s; total 47.846 s.

Target 240 (new école): build+independent activation verification 60.141 s; capture numerical verification 31.757 s; BEE2 18.353 s; archive 0.130 s; fresh hash checks+eviction 0.034 s; total 110.427 s. Manifest `40266092dbeabcaab6dcd7d99be9971e36e1ed480ea74f67ff60dfd684d21a28`; BEE2 `71455dad10d7f6f654a3bfda3d5d8d3265152d6103e9fbc5dc4bec2069fe397a`; inventory `e103a2f03f0a3e98693eecec42f334237ffe188aff5fbb697cde9107b7ad3508`.

Reproducible measurement log `work/qualification/task7a-real-batch.log`, durable compact proof `docs/program/qualification-2026-10-12/task7a-real-batch.json` and both full target inventories alongside. Every target retains all 16 values + 16 order pages, not only its 64-neighbor dossier.

Initial real CPU profile took 645.679 s including a single 562.676 s sampling gap; this is not a reliable total bottleneck benchmark. Profile evidence retained; bounded three-segment decompression experiment proved exact raw bytes, but no speculative numerical/decompression optimization was adopted. Safe transition optimization removes only the unnecessary additional full numerical pass between guarded capture and eviction, preserving independent evidence scoring and fresh object hashes.

## Launch interface after independent approval

From canonical checkout:

```sh
node scripts/qualify-semantic-batch-v2.mjs --corpus work/semantic-v2-canonical --targets ../t --evidence work/e7 --archive work/a7 --checkpoints work/p7 --target-ids 140,199,389,648,656,1562
```

This archives the six still-live original columns. Then invoke the same driver with remaining real catalogue IDs (one serial process; no quota bypass). Supply a comma-separated list of up to 400 distinct IDs; invalid/out-of-corpus IDs fail before generation. `npm run semantic:v2:batch -- ...` is equivalent. Do not unnecessarily rerun completed IDs91/240: a restarted request containing them correctly performs independent archive verification again.

Files/interfaces:
- `scripts/qualify-semantic-batch-v2.mjs`: exported `qualifySemanticBatch`, strict `parseBatchArgs`; bounded progress JSON, no manifest/histogram dump.
- `captureEditorialEvidence({..., archiveDir, evictAfterArchive:true})`: complete archive required for fused transition. CLI `semantic:v2:evidence:capture ... --archive DIR` archives without implicit eviction.
- `checkRuntimeArchive`: integrity and binding only, explicitly not a numerical attestation; always pair with independent verifier before any activation.
- `work/a7/<corpusId>/targets/<10-digit-id>`: immutable runtime archive with `archive.json` -> `inventory-<sha>.json`.
- `work/p7/<id>.json`: immutable completed identity checkpoint; `work/e7` remains the evidence store.
- Real source still `work/semantic-v2-canonical`; index and earlier partial91 under `work/b2` untouched. Six remaining original live targets under `../t`; 91 and240 archived/officially evicted. No numerical process left running.

## Phase B remains

No new editorial approval. Root’s six genuine recommendation trios and university rejection notes remain recommendations only. Complete real editorial inspection/decisions to 400 approved targets (replace rejected candidates), immutable 365-day calendar, proof-chain integration, runtime R2 provisioning and independent reader/Worker verification are pending phase B. Four durable blob backups alone do not qualify runtime keys or activate V2. Phase A neither declares D30 complete nor treats cost/time as an external user-approval gate.
