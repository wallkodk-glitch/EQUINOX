# EQUINOX 1.3.4 — adversarial red team, 2026-10-14

Input: exact v1.3.3 ZIP, SHA-256 `f481df7c1fa7d6ba404dddf406c6e2f3d10269309038833999b7dd7d273994db`.

- Distinguish a missing financial-state record from an existing corrupt `undefined` value. Load/save fail closed, raw JSON export rejects, explicit restore keeps the original field in IndexedDB recovery.
- Treat unsafe corrupt revisions as recovery metadata, not valid write authority. Refuse a next revision outside the schema's existing safe-integer range before any write; preserve the old state instead of counter wrap or invalid save success.
- Bind asynchronous history-file commit and imported snapshot publication to the existing editing-session counter. Same-session real/demo imports retain their semantics. An already-entered restore is not a cancellable transaction.
- Clear a stale update banner only when an unapproved client has no waiting worker; preserve approved reload and a newer waiting worker.
- Add 16 persistence and 9 Node production-closure cases plus two native-browser regressions. Original tests retained; browser cases NOT EXECUTED.
- Preserve original Astra report/matrix as byte-identical historical copies. Current claim overlay distinguishes Astra, input red-team status and corrected scoped status. One synthetic/manual classification wording ambiguity remains explicit; data semantics are not changed to resolve wording.
- App root metadata advances to 1.3.4. Exact workingBaseline points to v1.3.3, with v1.3.2 parent and 1.3.1 frozen ancestry preserved. No dependency, workflow, Engine, MarketDataModel, schema, TSM-window or allocation-model change.

Fresh full gates: 314/314 tests, lint/typecheck/references/replay/frozen audit/three-path builds/static PWA PASS. Chromium and WebKit launch BLOCKED; GitHub/remote import/deploy/actual hosted/iPhone/installed PWA NOT TESTED. ReleaseStatus stays BLOCKED.

## Historical Astra 1.3.3 claim parity, 2026-10-13

Working baseline: `EQUINOX-v1.3.2-hardened-96fee561cdd34a92.zip`, SHA-256 `30e5ba825b00e1f16f531c945d668148ecca3ca1864559fb40f10f0f991eba3d`.

- Raw recovery JSON export now rejects values/graphs that JSON would silently alter, drop or flatten. Original IndexedDB records and recovery copies remain untouched. Valid normal backups and JSON-safe raw exports retain their formats. Fresh-state absence is not stored as an invented undefined record.
- Automatic selection of a completed calculation is tied to its originating real/demo editing session. Entering or exiting demo invalidates the old selection; completed real calculations still enter history, and demo calculations never persist.
- Release packaging distinguishes the actual 1.3.2 working ZIP from the preserved 1.3.1 frozen-source ancestry. App/package/lock/current docs now identify 1.3.3.
- AI guidance scopes recovery credential exclusion and update guards accurately, and routes directly to the added race regressions. Canonical README accounting ownership and legacy/current documentation routes are corrected.
- Added deterministic recovery and concurrent-writer tests, an actual delayed calculation factory test, stronger worker activation assertions, and two browser race cases. Browser case existence is not browser execution evidence.

Engine **1.0.1**, MarketDataModel **1.1.2**, financial/data semantics, state/snapshot schemas, asset set, DKK, workflows and dependencies are unchanged. No new live provider or TSM-window evidence is claimed.

Release status remains **BLOCKED**: 289/289 local unit/integration tests and runnable non-browser gates pass; Chromium/WebKit application tests, actual deployment/hosted validation and physical iPhone/installed-PWA validation have not run. See [report](report.md), [claim matrix](claim-matrix.csv) and `validation/final-checks.json`.
