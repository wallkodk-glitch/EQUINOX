# EQUINOX final hardening implementation plan

> Execution: autonomous, inline, task by task. The user's complete final-completion specification in this session is authoritative. A fresh whole-change reviewer is required at the end (executing-plans skill).

**Goal:** Correct concrete defects in the supplied source, tests, workflows and packaging, preserving the accepted financial contracts and documenting real validation evidence.

**Architecture:** Preserve React/TypeScript/Vite, local financial IndexedDB, separate credentials/cache and user-approved service worker updates. Reproduce defects before applying minimal fixes. No new backend or production dependencies; Playwright-only exception is documented for the upstream WebKit fix.

**Baseline:** Actual attached files are `EQUINOX-v1.3.1-GitHub-ready(3).zip`, `pages(4).yml`, `import-release(3).yml`. Their upload suffixes differ from the request but content is authoritative. The standalone importer supersedes the embedded importer.

## Global constraints

- Engine 1.0.1 and MarketDataModel 1.1.2 stay byte-identical absent a reproduced correctness defect.
- GOOGL, ISRG, TSM, BTC, ETH; DKK; Equal Weight/Inverse Volatility/ERC; buy-only; Buy + Fees + Residual = NewCapital.
- Preserve TSM coverage through 2026-10-08 and reject later/wider unverified inputs.
- Preserve `rsync -a --checksum --delete` and repository-owned workflow policy.
- No secrets, test skips, weakened assertions, arbitrary sleeps or fabricated PASS results.
- Product changes justify a patch bump. New archive filename must be unique; reopen and verify every file after creation.

## Review focus

- Calculation completion racing with restore or other writes must never overwrite restored state.
- Invalid numeric drafts must not claim to be saved; externally changed values must reconcile on blur.
- Storage failures must preserve old data and produce a usable error/recovery path.
- Waiting-worker approval must await writes and preserve credentials; offline tests must actually exercise offline behavior.
- Import must reject unsafe archives and inconsistent source versions before mutation, including same-size/same-mtime replacement.

## Task 1 — Reconciliation and baseline

- [x] Inspect all inputs, verify 210 manifest entries and CRC; compare workflows and versions.
- [x] Save original source in a local audit commit, reconcile standalone importer.
- [x] Run unchanged default unit suite and build (237 tests passed).
- [x] Attempt browser validation and retain precise environment evidence: both runtimes BLOCKED, supplied three CI assertion failures not locally reproduced.

## Task 2 — Product lifecycle, data and persistence

Files: `src/ui/App.tsx`, `src/ui/MarketDataSettings.tsx`, `src/persistence/store.ts`, calculation/risk helpers, provider code and their consumers. Tests: existing `tests/*`, `tests/browser/*` plus focused regressions as findings warrant.

- [x] Read dependency contracts and consumers across startup, numeric inputs, demo, persistence, restore/calculation, credentials, providers, service worker and offline.
- [x] For each concrete defect, record observation/root cause, add a reproducer, run it, patch the owning boundary and rerun targeted checks.
- [x] Synchronize browser interaction against `.app:not([inert])` and completed intro, preserving all financial assertions.
- [x] Run unit/integration, independent Python and immutable snapshot checks after subsystem changes.

## Task 3 — CI, import and packaging

Files: both `.github/workflows/*.yml`, `tests/release-import.test.ts`, `scripts/package-v13.py`, validation scripts, version metadata and release documentation.

- [x] Extend malicious archive and real rsync/git tests for uncovered importer defects; fix only evidenced failures.
- [x] Make browser outcomes independently visible and mandatory for deploy. Verify actual action references against primary sources.
- [x] Replace stale packaging assertions with current evidence, source/version/hash checks and a unique no-clobber artifact.
- [x] Make standalone workflow bytes equal to embedded copies, with regenerated manifest.

## Task 4 — Final validation and delivery

- [x] Perform independent adversarial review of all changes; reproduce and resolve material findings.
- [x] Run clean install/lint/typecheck/references/tests/replay/builds/browser gates: 276 tests PASS; browser runtime BLOCKED.
- [ ] Reopen final ZIP; verify versions, frozen files, changed bytes, hashes/sizes, entry count, paths, CRC and standalone workflow equality.
- [ ] Deliver a full defect/file ledger, honest test matrix, physical iPhone PASS/FAIL checklist, ZIP, workflows and SHA-256.

Final archive/hash/workflow-equality evidence is generated after this source document is packaged; consult the delivered ARCHIVE-VERIFICATION.json. Browser and physical device approval remain explicitly outstanding.
