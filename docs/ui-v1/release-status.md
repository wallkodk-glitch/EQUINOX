# EQUINOX 1.2.0 — UI v1 release status

**Result: UI v1 — PASS WITH LIMITATIONS. Browser/device visual and PWA release gates remain NOT TESTED.**

App **1.2.0**, frozen Engine **1.0.1**, accepted MarketDataModel **1.1.2**, snapshot schema **1/2**, financial backup schema **1**. This is a presentation release over the supplied accepted v1.1.2 ZIP. No new mathematical defect was found, no frozen subsystem changed, no provider or automatic import behavior was activated.

| Requested area | Result / evidence |
|---|---|
| 1. Result | Requested UI screens/components implemented; full runtime/device acceptance pending. |
| 2. Research | Official WebKit/MDN/web.dev material guided safe areas, viewport fallback, native dialog, numerals, reduced motion and restrained effects. [Sources and decisions](visual-strategy.md). |
| 3. Visual strategy | Blue-black matte canvas, a single quiet hero wash, strong numbers, section rules, 8 px rhythm and symmetric geometry; locked palette/anchors retained. |
| 4. Main UI | Four bottom tabs; Overview decision loop; compact sealed buy plan; dedicated snapshot Risk; compact provider/settings drill-downs; historical proof/history retained. |
| 5. Signature | Equilibrium Axis, signed common-scale Balance Rail, genuine-operation Infinity Motion, restrained Mineral Wash. Supplied primary JPEG remains byte-identical; icon simplifies the same mark. |
| 6. Files changed | Five existing UI files, six new UI files; version/theme/icon assets; presentation selectors in two browser files; UI tests/docs/check scripts; version-matched mobile ZIP filename/manifest check. Exact lists/hashes: `ui-frozen-audit.json`. |
| 7. Dependencies | NONE added, removed or upgraded. Package/lock match baseline apart from App version. |
| 8. Accessibility | Semantic labels/headings/table scopes, skip link, page focus, native sheet/focus return, error association, shape/underline selections, declared touch targets, zoom/reduced motion and bounded charts. 29 declared color checks PASS; worst selected text pair >5.56:1. This is static evidence, not whole-screen WCAG/VoiceOver/device certification. |
| 9. Performance | No remote fonts, chart/icon library, canvas/WebGL or permanent JS frame loop. CSS/JS gzip approximately 6.01/134.76 kB; primary JPEG 130.19 kB. Source maps are not in shell cache. Real frame time, battery and scrolling NOT TESTED. |
| 10. Tests | **172/172 PASS** in 24 files: all 152 original tests unchanged, plus 20 presentation regressions. Both Python references PASS. 24 browser cases per project prepared (48 discovered); discovery is not execution. |
| 11. Math regression | PASS: frozen byte comparison, original golden references, existing regression suite, deterministic Engine output and five exact snapshot replays. Engine remains 1.0.1. |
| 12. Data regression | PASS: provider/calendar/FX/corporate-action/DQGate/persistence source unchanged; accepted normalized input, returns, levels, covariance/correlation and all three model hashes match v1.1.2. This is replay, not fresh provider acquisition. |
| 13. Build | Production build PASS; separate npm-ci clean rebuild required byte-identical files; package guards verify the exact source/build/report hashes. Manifest/icons and Node worker guard smoke PASS in their stated scope. |
| 14. Browser | **NOT TESTED**: fresh smoke launch failed EACCES before app assertions/provider requests. No screenshot approval or executed browser UI assertion is claimed. |
| 15. Safari/iPhone/PWA | **NOT TESTED**: WebKit/Safari, physical iPhone, Add to Home Screen, standalone/real safe areas/keyboard, installed offline/update, Pages deployment and deployed provider CORS. |
| 16. Limits | Native provider/local-key/browser CORS and automatic risk-refresh UI state remain the accepted baseline limitations. Retrospective FX/final ADR and bounded TSM issuer evidence retain their original meaning. Local credentials remain a client-side storage tradeoff. |
| 17. Next step | Run the version-matched GitHub Pages verification, then physical iPhone and actual deployed-provider checks in [device release gate](device-release-gate.md). |

## Evidence index

- `validation/ui-release-checks.json`: actual final lint/typecheck/tests/Python/data replay/build/static checks and exits.
- `validation/ui-frozen-audit.json`: 67 protected source/reference/test files, dependency and original UI handler/effect/form preservation, original browser cases, changed/added files and source hashes.
- `validation/ui-snapshot-compatibility.json`: Engine 1.0.0/1.0.1 schema 1 and three schema 2 exact baseline results/hashes.
- `validation/ui-accessibility.json`: independent declared color calculations and source contracts; no runtime claim.
- `validation/ui-pwa.json`: static manifest/asset sizes, no stale bundles and generated worker exercise in Node.
- `validation/ui-browser-evidence.json`: actual launch failure, zero application tests/requests; separate browser/CORS/device statuses.
- `validation/ui-clean-build.json`, `validation/reproducibility.json`: separate installation/build output and complete production checksum comparison.
- `validation/credential-scan.json`, `validation/ui-secret-scan.json`: source/build/fixture checks and release-report structural checks; actual provider keys were not supplied.
- `validation/ui-release-status.json` and ZIP `RELEASE-MANIFEST.json`: guarded current release status and per-file SHA-256/byte counts.

Historical `closure-*`, `release-checks.json`, prior audit/docs and old data-only packager are retained for provenance. They are not the current UI acceptance result. The prior accepted data window is 2025-10-03–2026-10-06 with 253 synchronized observations/252 returns; it is not presented as current valuation. No old PASS report is substituted for a new UI runtime result.

## Credential boundaries

The UI never loads a saved key into an edit sheet. Inputs remain password-masked, drafts clear on save/close and edited drafts invalidate connection verification. Storage/probes/cache/backup/snapshot logic remain identical to the accepted baseline. Keys remain outside financial backup, recovery and snapshots. Browser storage is not cryptographically secure secret storage. Auth header names in source/bundle are public protocol identifiers; absence of actual credential values is the relevant scan. Browser key/log/cache assertions are prepared but not executed here.

No GitHub deployment or messages to third parties were performed for this release. See [review/corrections](review.md) for the limited independent-review scope and root verification.
