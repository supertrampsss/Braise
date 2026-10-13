### Task 3: Personal progression, statistics and reminders

**IDs:** D11, D12, D13, A10, A13; D26 profile.
**Ownership:** `components/profile-panel.tsx` (new), `components/profile-transfer.tsx`, `components/weekly-ritual.tsx`, `lib/personal-statistics.ts` (new), `lib/calendar-reminder.ts` (new), profile section wiring in `components/game.tsx`, targeted tests/docs. Do not change profile migration/event credit contracts.
**Steps:**
- Separate short progression summary, detailed achievements, preferences and data actions with clear local/verified-server scope. Existing immutable weekly goals/styles visible and readable; no added reward credit or effects on reread.
- Real wins by mode, median trials/hints, time trend only dated observations, daily streak and archive distinct. Label V1 facts with missing completion dates; avoid fabricated history and misleading denominator.
- Existing profile export/import remains profile-only, preview/confirm/revision checks, exact warning about ongoing games. Full device sync in Task 4 gets separate UI action/format.
- Optional reminder offered after actual repeated engagement, never enabled by default. Download bounded RFC5545 recurring local-time calendar event, explicit selected timezone/time, cancellation guidance and download cancellation event with same UID; don't pretend browser toggle removes external calendar event. No push permission request.
- Tests: median empty/incomplete data, archive/daily separation, DST/timezone-safe calendar encoding and cancellation UID, preserved transfer checks. Full suite/typecheck, commit report.


Normes calendriers vérifiées auprès des sources primaires : https://www.rfc-editor.org/info/rfc5545/ et https://www.rfc-editor.org/info/rfc5546/. Préserver heurelocale/DST : ne pas promettre un rappel19hParis avec RRULE basée sur UTCfixe. TZID exige définitionVTIMEZONE cohérente, ou choisir événementsUTC individuels pour horizon explicite borné en les calculant depuis fuseauIANA réel. CRLF, texteéchappé, repli de lignes UTF8 par octets, UIDstable, génération sans effets ni permissionautomatique. Une annulation téléchargée ne retire pas elle-même un événement chezApple/Google : guidance et portéeexacte visibles, jamais prétendre que togglelocal supprime le calendrierexterne. Aucun envoi d'invitations à des tiers.
Controller testscope ruling: focused newbehavior and affectedcore/server invariant suites,typecheck,verifiedimmutablebuild are required. Do not rerun unchangedheavyV2pipelines per UI task (known11Windows failuresTask7); one finalfullsuiteTask8. Explicitly report unqualifiedfullsuite, neverdeclareallgreen. This overrides plan redundantfullsuite step, not behavior requirements.
