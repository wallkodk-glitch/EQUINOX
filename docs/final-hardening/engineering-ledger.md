# Final-hardening engineering ledger

Plan: `docs/superpowers/plans/2026-10-11-final-hardening.md`

- Baseline ZIP SHA-256: c3965e1d93224fab1d23e68c0c9fdd7207c5b9598c63940d811e195639028231.
- Baseline manifest: 210 fully matching file hashes/byte sizes, 211 entries including manifest, CRC PASS.
- Version baseline: App 1.3.1; Engine 1.0.1; MarketDataModel 1.1.2.
- `pages.yml` embedded == standalone. Importer differs; standalone `--checksum` version reconciled as explicitly requested.
- Baseline runtime: Node 24.19.0; npm ci PASS; 237/237 Vitest PASS; typecheck/production build PASS.
- Chromium package download returned 195 bytes of text/html instead of a ZIP; normal installer failed. Separate WebKit/headless-shell availability is being checked. No browser PASS claim yet.
- Ruling: execute autonomously as requested without a separate plan-approval pause. Preserve dependency versions and run a fresh final reviewer; no implementation delegation.
- Pre-flight: tests depend on product lifecycle; packaging depends on finalized workflows, docs and current validation evidence. Final artifacts must be generated last.

## Reproduced and corrected

- Default 1.3.1 baseline: 237/237 unit/integration PASS. Prior browser failures were supplied CI evidence, not locally reproduced assertions.
- Save/restore: injected synchronous `QuotaExceededError` after an earlier queued write committed partial state; both RED, now transaction abort and GREEN (12 persistence tests).
- Aborted reads: request rejected before a separate transaction promise; unhandled rejection reproduced in financial and market cache stores, now observed immediately while operation rejection is preserved.
- Snapshot validation returned a sanitized clone, but save wrote the original wrapper; raw recovery retained unknown fields. RED/GREEN confirms sanitized storage.
- Network body limit: 32 MiB stream was fully consumed (33 pulls); bounded implementation cancels after 17th 1 MiB chunk. RED/GREEN; 24 targeted network/refresh tests PASS.
- SW installation: generated Requests previously had no cache reload/integrity, approval event did not extend lifetime; new VM tests RED/GREEN. Actual worker lifecycle remains browser-blocked.
- Import validator: source Engine/model and missing app metadata, NUL names, counts/JSON types hardened with adversarial fixtures. 31 import tests PASS including real rsync same-size/same-mtime replacement.
- UI static fixes: invalid-draft save label, focused external updates, immediate calculation/file-operation exclusion, disabled/null-safe recovery actions. Browser regressions added; runtime evidence pending.
- All legacy interaction flows now wait for `.app` non-inert and intro removal, without sleeps or changed expected values. Removed WebKit early-return offline bypasses.
- Approved dependency exception: Playwright 1.63.0 -> 1.64.0, official WebKit offline/SW regression fix #42894. Production dependencies unchanged. App patch 1.3.2 is warranted by shipped fixes.
- Chromium normal downloads returned HTML instead of ZIP. WebKit 1.64 binary downloaded, but host libraries are unavailable; normal install-deps fails seteuid permissions. No bypass attempted. Both full browser gates remain mandatory in GitHub.
- Validation tooling now uses default test command/timeouts, records BLOCKED explicitly, checks both browsers and compares frozen source to this actual ZIP. Unique no-clobber packaging reopens the archive and runs the delivered importer on it.

## Fresh adversarial review corrections

- R01: reviewer reproduced an unlisted vite.config.js bypass of the first source gate. Added three RED cases, then exact source inventory with explicit exclusions; four GREEN controls/regressions. Extra preserved repository-owned workflows are an explicit scope exception.
- R02: reviewer executed the first hosted-smoke script with current release.json but stale HTML/SW; it passed incorrectly. Final gate uses independently carried build SHA/byte proof and rejects stale HTML/SW/JS fixtures (four GREEN). Actual hosted test remains NOT TESTED.
- SW failure cleanup: new cache remained after install rejection (RED). Cleanup now deletes only a newly created cache; two tests verify fresh cleanup and existing-cache preservation, all four SW tests GREEN.
- Expanded import security suite: 38 PASS including CRC corruption, encrypted flags, declared oversized entry, compression ratio, nonfinite/nonobject JSON and lock mismatch.

- R01 follow-up reproduced public/dist/stale.js bypass via actual Vite copy; also reproduced public/test-results variant locally (2 RED). Scoped exclusions to repository root in checker and packager, 6 source cases GREEN.
- Final review closure performed by primary agent after incomplete independent follow-up; no claim of a second completed independent review. Combined source/hosted/SW closure: 14/14 PASS.

## Final clean validation

- Clean npm ci, default lint/typecheck/Python references, 276/276 unit/integration (31 files), accepted synchronized history, independent raw-data Python reference, immutable snapshot replay, frozen audit, all three build paths, generated PWA static/VM and credential scan: PASS.
- Browser inventory: 43 cases per project / 86 total. Both runtime probes BLOCKED; no browser assertion PASS. Validator exits nonzero (1) for BLOCKED by design.
- Final source frozen: 24 byte-identical financial/model files; three narrowly documented operational files changed for reproduced defects.
- GitHub workflow execution, actual hosted smoke, live provider/CORS and physical iPhone NOT TESTED. Final status remains BLOCKED.
