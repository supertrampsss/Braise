# BRAIZ Full Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task by task, with independent review. Do not spawn your own subagents as an implementer or reviewer.

**Goal:** Implement and publish all 44 approved review items, qualifying existing capabilities and adding the requested bounded features.
**Architecture:** Keep the canonical V1 engine unchanged. Extract focused client presentation and personal-data helpers from the Game orchestration. Extend existing authenticated D1 services for optional synchronization and cooperative circles. Offline training uses a finite verified V1 pack distinct from daily play. Advanced routes become public only after integrated qualification.
**Tech Stack:** React 19, TypeScript, Vite/Vinext, Cloudflare Worker, D1/Drizzle, R2, existing shadcn/Radix, node:test.
**Spec:** `docs/superpowers/specs/2026-10-12-full-review.md`; exact criteria `docs/superpowers/specs/backlog-approved.json`.

## Global Constraints

Read the spec and AGENTS.md. Preserve V1 IDs, seeds including leading zeroes, calendar, oracle, scoring and storage keys. Never import semantic server data/modules in client code. Preserve the approved flame and silent restore semantics. No invented score, player, contribution, timestamps or commercial config. No automatic opt-in for sync/reminders/offline. Use existing session/origin/CSRF guards and bounded validation. Append-only DB migrations. No secrets in files/logs. Keep advanced release flag false until Task 8. Work only on the dedicated feature branch; do not publish or push yourself. You are not alone in the codebase: preserve others' changes and adapt to established interfaces. Read your own diff, run targeted meaningful tests and one full suite/typecheck before committing; report exact commands, exit codes and relevant output.

## Review Focus

1. Accepted answer admitted into the wrong puzzle after navigation: existing epoch/abort/ref guards, Game regression tests (Tasks 2/8).
2. Imported data overwrite or duplicate personal facts: revision-aware preview, non-destructive union and corruption/conflict tests (Tasks 2/3/4).
3. Unauthorized shared mutation or fabricated social totals: existing session/CSRF/origin guards, owner checks, D1 uniqueness and server tests (Task 4).
4. Offline/V2 scores falsely presented as production daily: verified finite pack separation, untouched oracle, source manifest and activation gates (Tasks 6/7/8).
5. Hidden/inaccessible controls or false delivery claims: common navigation, keyboard/mobile proof, release matrix and exact published version (Tasks 1/5/8 and controller publication).

### Task 1: Foundations, navigation and reproducible delivery

**IDs:** D01, D02 (environment), D10 (shared shell), D24, D25, D27, D28; D26 shared primitives. Later tasks finish local surfaces and QA.
**Ownership:** `components/app-navigation.tsx` (new), `lib/format-fr.ts` (new), `lib/product-events.ts` (new), `components/ad-placement.tsx`, `app/layout.tsx`, `app/globals.css` shared tokens only, `app/integration/**`, `app/embed/**`, `lib/distribution.ts`, `scripts/run-site.mjs`/`scripts/build-verified.mjs` (new), `package.json`, associated targeted tests/docs. Additional adjacent files only for necessary integration; coordinate changes to Game by reporting exact hooks for Task 2.
**Steps:**
- Record source/release matrix and active bindings without claiming live advanced availability. Make dev/build/start/check scripts portable to Windows and Linux using Node wrappers; preserve semantic shard verification and official Sites builder compatibility, lockfile when needed.
- Reproducibility finding: baseline corpus EOF test exceeded seven minutes with 50,001 rows due per-row SQLite autocommit. Additional ownership: `scripts/build-semantic-corpus-v2.mjs`, `scripts/verify-semantic-corpus-v2.mjs` and their focused tests for bounded transactions on disposable reconstruction/dedup indexes. Preserve durable outputs, checksums, lock/checkpoint recovery, numeric configuration and verifier independence; no global durability weakening. Prove exact manifests and interrupted resume remain unchanged. Baseline TypeScript passed; suite was boundedly terminated after 89 passes, not claimed complete.
- Immutable V1 portability finding: Windows gzip generation differs from frozen Linux compressed bytes. Additional ownership `scripts/build-semantic-shards.mjs`: add a non-mutating `--verify` mode validating frozen source/index/object/raw hashes and use it in production build. Restore only this task's accidental regenerated assets; never commit changed canonical V1 assets as a build side effect. Prove verification leaves assets unchanged and rejects corruption.
- Exact byte comparison isolates gzip OS header byte9 (canonical Linux3 vs Windows10). Additional ownership `scripts/canonical-gzip.mjs`, `scripts/build-semantic-index-v2.mjs`, `scripts/build-semantic-target-v2.mjs`: shared canonical gzip normalizes header to frozen Linux encoding before hashing/installing generated output. Golden proof uses actual frozen V1 shard full bytes, plus independent V2 verifier. Never change pinned manifests/numeric configuration. Fresh full restore must use new staging after this fix; prior unpinned Windows candidate remains quarantined, its abandoned lock is untouched.
- Common accessible navigation component with Jouer (`/`), Explorer (`/?surface=explore`), Profil (`/?surface=profile`), active state and back-to-game; intended for all advanced pages. No release enabling yet. Use approved dark brown/orange tokens; no competing purple theme for new shared surfaces.
- French score/number/date formatting helper, consistent explicit action vocabulary. Hide empty ad footprint when decision is skip; preserve legitimate site verification script and privacy accuracy.
- Support/measurement instrumentation is a versioned local, bounded, anonymous event ledger with explicit diagnostic export action. No external transmission, words, solutions, pseudonyms or fabricated audience. Game consumers added later. Measure only actual events, document what isn't observed.
- Embed compact accessible variant and distribution metadata use current PUBLIC_ORIGIN. Preserve allowed-origin validation/frame headers, do not introduce wildcard permissions. Document integration setup; qualification on controlled separate origin in Task 8.
- Exact controlled secondary origin from successful native deployment: `https://braise-mots.yellow-drake-7186.chatgpt.site`, same existing public Site. Allow embedding only between this verified alias and `https://braiz.io`, with exact source-window/origin/version validation and no words transmitted. Additional ownership `worker/index.ts` for explicit CSP allowlist and appropriate X-Frame-Options; no wildcard/arbitrary partner origin. Demo on alias can load primary domain to qualify real separate-origin operation. Release stays false until Task 8.
- Tests: portable runner errors propagated; event cap/no sensitive fields, format comma, origin allow/deny. Existing engine suite and typecheck. Commit and report.

### Task 2: Core game, tutorial, archives and resumption

**IDs:** D03–D09, D14, D15, D29; A01–A05, A09, A12; D10 Game surface integration and D26 gameplay.
**Ownership:** `components/game.tsx`, `components/collection-picker.tsx`, `components/expedition-picker.tsx`, new focused `components/game-*/` or `components/play-*.tsx` modules as required, `lib/play-hub.ts` (new), `lib/free-discovery.ts` (new), `app/api/game/route.ts` additive free/discovery/report helpers only, new `app/api/lexicon-report/route.ts` if voluntary server report appropriate, tests and focused docs. Do not rewrite engine or public identities.
**Steps:**
- Integrate Task 1 shell and URL surfaces with focus/back context. Keep first paint playable. Preserve the approved flame, reduce empty layout space and bring semantic explanation by input.
- Explicit Envoyer/loading/error labels, inline hint-unlock progress and count; label Dernier essai/Meilleure piste, explain proximity/rank, latest row and active sort, named keyboard pins. Preserve input edits and current-puzzle admission guards.
- Permanent archive date/context and return-to-today, native date input plus keyboard month calendar with started/solved/unplayed and resume filter; refuse future/before-launch server as before. Free replacement explains started-game preservation.
- Optional tutorial with 2–3 separately identified steps using actual V1 API results, never counts toward daily/history/rewards and no compulsory gate. Win summary derives trials/hints/milestones from real guesses and has contextual next/share without answer or revealing words.
- A shared resume hub lists actual unfinished local games, collection/journey step and links to authenticated spaces (server resume from Task 4). Store explicit non-sensitive route context separately when needed; don't guess lost journey identity. Cards and single next suggestion explain reason from personal facts.
- Free discovery avoids actual previously encountered target identities until pool depleted, using server-resolved opaque target IDs rather than seed uniqueness, preserving explicit seeded URLs and V1 mappings. Bound excluded IDs, expose no answer. Explain exhaustion and allow replay.
- Unknown-word errors preserve input, distinguish network; opt-in lexicon feedback download/export or bounded authenticated report, no third-party send. Suggestions only from known lexicon, no guessed scores.
- Tests: actual free target selection/exhaustion and fixed seed invariants; resume date/context/corrupt input; tutorial exclusion, summary/share privacy; stale response/input handling. Full suite/typecheck, commit report with IDs evidence.

### Task 3: Personal progression, statistics and reminders

**IDs:** D11, D12, D13, A10, A13; D26 profile.
**Ownership:** `components/profile-panel.tsx` (new), `components/profile-transfer.tsx`, `components/weekly-ritual.tsx`, `lib/personal-statistics.ts` (new), `lib/calendar-reminder.ts` (new), profile section wiring in `components/game.tsx`, targeted tests/docs. Do not change profile migration/event credit contracts.
**Steps:**
- Separate short progression summary, detailed achievements, preferences and data actions with clear local/verified-server scope. Existing immutable weekly goals/styles visible and readable; no added reward credit or effects on reread.
- Real wins by mode, median trials/hints, time trend only dated observations, daily streak and archive distinct. Label V1 facts with missing completion dates; avoid fabricated history and misleading denominator.
- Existing profile export/import remains profile-only, preview/confirm/revision checks, exact warning about ongoing games. Full device sync in Task 4 gets separate UI action/format.
- Optional reminder offered after actual repeated engagement, never enabled by default. Download bounded RFC5545 recurring local-time calendar event, explicit selected timezone/time, cancellation guidance and download cancellation event with same UID; don't pretend browser toggle removes external calendar event. No push permission request.
- Tests: median empty/incomplete data, archive/daily separation, DST/timezone-safe calendar encoding and cancellation UID, preserved transfer checks. Full suite/typecheck, commit report.

### Task 4: Optional device synchronization, social onboarding and cooperation

**IDs:** D16, D17, D18, A06, A08; A02 verified server resume; D03/D10/D26 social.
**Ownership:** `components/circles.tsx`, `components/duels.tsx`, `components/server-game.tsx`, `components/device-sync.tsx` (new), `lib/device-sync.ts` (new), `lib/server-store.ts`, `lib/server-schema.ts`/existing actual schema, `app/api/sync/**` (new), `app/api/circles/**`, `app/api/duels/**`, append migrations after current 0004, social/sync tests, app social pages, Profile component integration.
**Steps:**
- Reuse guest/session/recovery identity, show invited context vs generic create/join accurately, progress/errors and explicit storage scope. Same common navigation and visible Envoyer; circle current challenge/participation/results/members; duels actual states, rounds, deadlines, outcomes and invite expiry.
- Optional authenticated sync uploads personal profile and actual ongoing game snapshots only after confirmation. Strict bounded version envelope, preview before download merge, union preserve local trials/pins/context, refusal on incompatible V1 baseline/future/corrupt data. Server snapshots versioned and optimistic-revision guarded, guest ownership/CSRF/origin; imported results explicitly personal/unverified. No reward effects on import.
- Clear revocation and delete-own-cloud-copy actions; no destructive local overwrite. Recovery transfers same identity without exposing tokens in URLs/logs. Resume shared server games through IDs owned by authenticated guest; don't fabricate peers.
- Optional owner-enabled circle weekly cooperative goal; real distinct completed circleGame IDs and member contributions only, dedup enforced/server-derived. Show accomplished state, no words, no mandatory daily pressure. Bound goal and test transitions/ownership.
- Generate append-only migration with real Drizzle metadata, preserving old files. Tests for guest ownership/auth/CSRF, stale revisions, conflicting/corrupt sync/preserving local data, coop dedup and week boundary, duel deadline. Full suite/typecheck and local D1 qualification if possible; commit report.

### Task 5: Studio, projection and laboratory completion

**IDs:** D19–D22, A11; D03/D10/D26 variants.
**Ownership:** `components/studio.tsx`, `components/streamer.tsx`/actual projection component, `components/laboratory.tsx`, `lib/studio*.ts`, `lib/laboratory*.ts`, corresponding API routes/pages and focused components, next append-only schema migration if needed, tests/docs. Read prior schema changes, don't overwrite them.
**Steps:**
- Studio: bounded editable title/description, approved visual preset enum, participant-like preview rather than text list, own draft duplication, stable published edition metadata, clear link audience and withdrawal effects. Catalogue-only target selection, no arbitrary unsafe content or uploads. Preserve ownership, publication immutability and anti-repetition.
- Projection: current refresh timestamp, freshness and disconnected/error states, optional bounded poll with visibility stop/manual refresh. No target/guesses leaked. Public display only already authorized sanitized projection.
- Intrus: distinct choice/result states, explanation, next action and actual finite session summary. Two braises: independently labeled target A/B scores and solved states; accessible compact mobile layout. Never combine or invent temperatures.
- Shared nav/verbal action labels/French formatting in all relevant screens, focus/error announcements. Tests actual summary counts, studio validation/immutable version/duplicate ownership, projection privacy and stale timestamps. Full suite/typecheck; commit report.

### Task 6: Guided training and verified offline pack

**IDs:** D23, A07, A14; D26 training.
**Ownership:** new `lib/training.ts`, `components/training.tsx`, `app/entrainement/**`, `app/api/training/**` if needed, `scripts/build-training-pack.mjs`, approved finite pack in `public/training/`, `public/sw.js` and offline page, Game Explorer card integration, targeted tests/docs.
**Steps:**
- Editorially define Facile/Standard/Exploration by actual reviewed target/hint characteristics, no unexplained numeric difficulty/popularity. Use V1 existing approved targets and prevalidated progressive hints. Daily rules unchanged.
- Finite dedicated offline pack generated from exact real V1 oracle with checksum/schema, bounded known words, actual precomputed scores/ranks, specific training IDs. Independent comparison against V1 reference on every pack entry before publication. No full semantic corpus in client bundle.
- Explicit pack download after size/scope consent; actual offline runnable training with persistence and separate personal state, no daily/streak/competitive rewards. Service worker caches only explicitly selected immutable pack plus needed training shell; never API daily/auth responses. Clear availability/cache removal and honest network fallback.
- Preserve no score-on-error semantics. Tests corrupt pack/future schema/unknown word/checksums/real score identity, offline progress restore, daily isolation; full suite/typecheck, browser cut-network test in Task 8. Commit report.

### Task 7: Corpus and editorial durable qualification

**IDs:** D30; D01/D02 source qualification.
**Ownership:** `docs/program/*` relevant delivery/qualification notes, `docs/review/corpus-qualification.md` (new), scripts only necessary safe portability/qualification fixes, data editorial manifests ONLY if genuine reviewed/verifiable additions. Do not change V1 engine or activate V2 speculatively.
**Steps:**
- Inventory canonical V1 data/segments by pinned hashes and qualify actual server score path. Document actual available 120-target scope and published storage backend; no stale architecture claim about unprovisioned R2/brand.
- Restore V2 only official pinned `semantic:v2:restore --download`; independently verify corpus/index/catalogue. Observe quotas/locks/immutable proof revision chains. Controller may begin safe source restore earlier outside implementation files to save time. Do not adopt partial files or invent approvals.
- Qualify real R2 via authorized project tooling/current configured bindings, immutable SHA inventory and authenticated transfer; no Cloudflare anti-bot evasion or global security weakening. Previously documented 403/1010 is a concrete external dependency, recheck safely where possible.
- Complete genuinely possible editorial/durable checks. If external transfer unavailable or full source blocked, record exact fresh evidence and activation withheld, not a fake completion. Existing V1 stays fully functional. Long-term approved365 calendar needs all real target proof/decisions, cannot be manufactured from synthetic fixtures.
- Tests/commands appropriate to actual affected pipeline, source hashes and reports. Commit traceable proof/limitations, report completed parts vs dependencies precisely.

### Task 8: Integrated release, accessibility and availability qualification

**IDs:** D01/D02/D10/D24/D26/D27/D28/D29 final verification; all 44 acceptance criteria traced.
**Ownership:** `lib/release.ts`, integrated fixes only when concrete failures observed, `docs/review/implementation-status.json`/`.md` (new), final qualification scripts/tests, app metadata/docs. Do not publish or push; controller performs authorized existing-Site deployment.
**Steps:**
- Inspect all prior task reports. Reconcile each backlog ID with actual implementation/proof, pending only exact external dependency. No claimed route or feature without actual entry point and usable state.
- Enable advanced modes only after authenticated/D1 routes work locally and tests qualify them. Qualify tutorial→daily, guess/hint/win/reload, archive/free/collection/journey resume, stats/transfer/sync, invite/circle/duel, Studio publication/participant/projection, lab and actual offline training, iframe controlled origin.
- Mobile/desktop accessibility: keyboard/labels/focus/error/loading/reduced-motion, color-independent feedback, no horizontal overflow. Preserve original flame artwork/performance pause invariants.
- Run full suite once for final changed source, TypeScript, complete verified build and local D1 migrations. Provide exact logs/commit/hash and status matrix; state external hosting-only validation to controller. Commit and self-review.

## Controller completion

Perform independent whole-branch review on most capable model, fix concrete findings, verify final build. Official Sites helper packages and pushes validated canonical source, save/deploy existing public Site, verify hosted routes and real API (no modification of user's personal data). Export final user-facing status and screenshots to parent `outputs/Braise-realisation/`, with link to site and any one-sentence material dependency. Do not claim completion of external-blocked D30; complete every other authorized deliverable first.
