# EQUINOX v1.3.1 — validation

**RESULT: RELEASE CANDIDATE — PASS WITH LIMITATIONS. Not hosted/device PASS.**

App 1.3.1; Engine 1.0.1, MarketDataModel 1.1.2 and snapshot schemas unchanged. Authoritative GitHub baseline independently re-indexed to the supplied tree; both standalone workflow blob hashes matched before the v1.3.0 work. This patch changes only the explicitly approved TSM evidence coverage boundary, its disclosure, focused regressions, app version and validation/release documentation. The delivered v1.3.0 workflows, dependencies and UI design are unchanged.

| Gate | Actual result |
|---|---|
| STATIC / source boundary | PASS — 24 frozen Engine/data/persistence files byte-identical; strict exact-source check permits only the TSM upper-date guard and audit-date comment renewal; two previously documented operational cache/progress/abort edits |
| Workflow static/import execution | PASS locally — YAML/embedded Python parsed; 20 archive/import tests, including real rsync and Git push to an isolated local fixture repository. NOT an Actions run |
| INSTALL / LINT / TYPECHECK | PASS |
| UNIT / INTEGRATION | PASS — 237/237, 29 files, using one worker and an explicit 30,000 ms per-test budget; all prior 232 tests retained |
| Default npm test / 5,000 ms budget | FAIL in this runtime — existing cache/restore timeouts; the cache timeout was also reproduced on the unchanged delivered v1.3.0. Default-deadline/CI reliability is not claimed |
| PYTHON / REFERENCE | PASS — original independent references and independent raw-provider-row/official FX reference |
| ACCEPTED MARKET DATA replay | PASS — 253 observations, 252 returns, 100% coverage, accepted historical window; not new live acquisition |
| SNAPSHOT / ENGINE regression | PASS — five Engine 1.0.0/1.0.1 seals replay with identical results/hashes; same normalized input → same output |
| PRODUCTION BUILD | PASS — Vite single-chunk >500 kB warning retained, not suppressed |
| PAGES-PATH BUILD | PASS — /EQUINOX/, /, /equinox-v13-path-check/; compiled assets/manifest/SW checked |
| CREDENTIAL / SW boundaries | PASS in unit/integration + static scan; no real provider key supplied; browser runtime exclusion NOT TESTED |
| CHROMIUM | NOT TESTED — actual launch attempt failed before assertions because executable is missing |
| WEBKIT | NOT TESTED — actual launch attempt failed before assertions because executable is missing |
| Browser suite discovery | 38 cases per project prepared/discovered; discovery is NOT execution |
| Live provider auth/entitlement/CORS | NOT TESTED — fixture transport tests are not account/deployed-origin evidence |
| GitHub Actions deploy / hosted smoke | PENDING — upload/run on real GitHub required |
| Physical Safari / iPhone / standalone / VoiceOver | PENDING — actual device evidence required |

Commands, exit codes and output: validation/v1.3-checks.json. Frozen-file hashes/change list, build paths/artifact hashes, snapshot replay and structural credential scan are separate validation/v1.3-* reports. Original historical evidence remains explicitly historical.

The final pipeline has 14 PASS and two browser NOT TESTED gates. This does not supersede the separate default-budget failure. `npm test -- --maxWorkers=1 --testTimeout=30000` runs the complete suite without dropped files, assertions, retries or skips. No application/provider deadline, Vitest configuration or GitHub workflow was changed. The intended RED boundary failures, initial timeout failures, immutable v1.3.0 control and full bounded-budget PASS are retained in validation/v1.3-tsm-renewal-checks.json.

## Proven behavior and limits

Real adapters, synchronization, existing data gates, cache and financial Store were exercised together against sanitized controlled envelopes from retained public projections. Success preserves holdings/manual prices, existing snapshots and consent. 401/403/429/503/network/timeout/empty/partial/schema/dividend/FX/cancel failures preserve prior financial state and never cache partial acceptance. Save conflicts, changed lookback/dataset and explicit corrupt-cache recovery also have regression coverage.

The RC2 freshness-clock fastForward regression is retained. Intro/reduced-motion/no-replay, narrow/large text, credential/focus, offline/reload/cache/update and provider UI browser cases are prepared, not executed here. Normal browser installation attempted system dependencies but lacked OS package permissions; no permission/security bypass. Known WebKit 1.63 offline-navigation/service-worker emulation exception remains distinct from physical offline behavior.

## Approved TSM evidence renewal

Fresh official TSMC and Citi evidence was reviewed on 2026-10-09 for the explicitly approved boundary **2025-01-01–2026-10-08**. The seven accepted final gross USD-per-ADR amounts and ex-dividend dates are unchanged. The 2026-09-16 event remains gross USD 1.096251 per ADR; its 2026-10-08 payment date does not create a second return event. Net/withholding amounts, missing/extra events and unverified future preliminary distributions remain rejected. Source URLs, independently reviewed dates/amounts and limitations are recorded in validation/v1.3-tsm-evidence-renewal.json. No historical publication timestamp was invented.

**2026-10-09 onward, pre-2025 and wider requested windows still FAIL CLOSED.** The new complete October-8 synchronization/gate regression uses explicitly synthetic prices and FX; it is not live provider evidence. Accepted real-data replay still covers **2025-10-03–2026-10-06**, with 253 observations and 252 returns. Actual authenticated refresh, current account entitlement and deployed-origin CORS remain NOT TESTED. No new accepted live dataset is claimed.

Corporate-action construction, historical date-only FX/as-of policy, calendar/timestamp semantics, financial persistence, Data Quality Gate and Engine mathematics are unchanged. Browser-local key storage is not cryptographically secure; use private backups and provider-scoped read-only keys where available.

The first complete validation attempt correctly rejected a new evidence-report field named `authorization`, whose value described user approval rather than a credential. It was renamed to `userApproval`; the scanner was not relaxed. The incident and correction are retained in validation/v1.3-tsm-validation-incident.json. A fresh structural scan and the complete pipeline then passed their respective executable gates. No actual provider key was supplied or exposed.

Runtime performance, rendered visual polish, physical safe areas/keyboard/200%/VoiceOver, real offline launch/update/force-close and current provider CORS cannot be inferred from build/unit PASS. These gates remain pending. Production source ZIP omits dist/dependencies/traces and rebuilds in Pages.

## Exact next step

Follow docs/mobile-release.md: use the unchanged final importer, upload the single updated EQUINOX-v1.3-GitHub-ready.zip (App 1.3.1), run import on main; then use the unchanged final pages.yml and run/confirm validated release. Require the workflow's default npm test, both actual browser gates and hosted smoke green before deployment is accepted. Complete docs/v1.3/device-gate.md on physical iPhone. Test authenticated risk acquisition only inside the evidenced range; separately review and authorize any later TSM evidence renewal before requesting 2026-10-09 or newer history.
