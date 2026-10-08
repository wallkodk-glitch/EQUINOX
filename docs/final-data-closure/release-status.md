# EQUINOX v1.1.2 — final data blocker closure

## Result and scope

**DATA-INTEGRATION PASS** for the verified data-layer window: 253 synchronized observations, **252 return pairs**, **2025-10-03–2026-10-06**, acquired 2026-10-07. **BROWSER RUNTIME / CORS — NOT TESTED.** This is not UI activation, browser authentication acceptance, hosted deployment or physical iPhone acceptance. There are no UI, design, asset, mathematical-model or dependency changes.

| Version | Value |
|---|---|
| App | 1.1.2 |
| Engine | **1.0.1, frozen** |
| Market Data Model | 1.1.2 |
| Snapshot schema | 1 retained; 2 only for date-only retrospective FX datasets |
| Financial DB / backup schema | 1, unchanged |

## Fixes

1. The TSM **2026-09-16** event is now matched against the **FINAL Citibank announcement linked by TSMC IR**: **gross USD 1.0962510 per ADR**, 5 ordinary shares/ADR, pay date 2026-10-08. Withholding is USD 0.2302130 (21%); net USD 0.8660380 is explicitly **not** the gross return input. Massive's original `cash_amount` and its split-adjusted field both match the gross amount for this unsplit ADR. Final conversion was announced after ex-date: this is retrospective risk history, not information available on ex-date. Primary links and inspection facts: [evidence index](evidence-index.md).
2. A separate **schema-2 date-only retrospective FX contract** resolves the historical feed/timestamp mismatch without inventing clocks. Strictly prior Copenhagen date, maximum **6 calendar days**, official DNVALD USD/KBH divided by 100. Old schema-1 publication-clock policy and Engine FX conflict fix remain unchanged. See [data semantics](data-semantics.md).
3. The importer returns/caches a dataset only when **all five canonical minute series, all three complete corporate-action books, FX, calendar and the existing Data Quality Gate pass**. No partial import, same-day FX assumption, weekend fill, daily-stock-close substitute or CoinGecko risk-history substitution.
4. Independent review reproduced an important **data/provenance defect**, not a mathematical-kernel defect: deleting provenance from the new automatically labelled schema-2 dataset could admit a net TSM dividend. A narrow schema-2 provenance requirement now rejects it. The failing counterexample, price-tampering regression, preserved legacy free-form schema-1 labels and subsequent passing tests are in `tests/synchronized-import.test.ts`. No numerical formula or replay tolerance changed.

The original obsolete TSM assertion that the September event was still pending has been replaced by rejection of an **unaudited future** range. All other original assertions are preserved. No existing mathematical test was changed.

## Actual validation

| Check | Actual result / evidence |
|---|---|
| Lint, typecheck | PASS, full recorded commands |
| Full regression suite | **152/152**, 23 files; baseline had 126 |
| Original independent Python goldens | PASS, no golden overwrite |
| New independent raw-provider / official raw-FX reference | PASS; exact return agreement; max covariance difference **2.7755575615628914e-17** |
| Frozen Engine / UI / calendar / persistence | PASS; 56 frozen baseline files and 13 audited Engine/reference files identical; snapshot and data numerical fragments unchanged |
| Real synchronized dataset | PASS; 253 observations, 252 returns, coverage 1, no missing dates |
| Equal / inverse-volatility / ERC | PASS on actual risk data and synthetic validation holdings; deterministic repeated output; all three schema-2 seals replay |
| Legacy snapshot replay | PASS with unchanged SHA-256 `e491090dd7e2cf8a81bd33c23d67460158aab62bac455d2f177de25038c50891` |
| Production build | PASS; `/EQUINOX/` base; shell/manifest/SW generated |
| Separately installed clean rebuild | PASS when `validation/reproducibility.json` records identical lockfile and all 11 output files |
| Credential exclusion / leak scan | Existing regression tests PASS; fresh structural source/build/fixture/final-data/snapshot scan PASS; no actual provider key was supplied or scanned |
| Browser application tests / browser replay | **NOT TESTED**; 15 attempted launches failed at executable EACCES, zero app assertions |
| Native local-key Massive / CoinGecko HTTP auth, preflight and CORS | **NOT TESTED**; configured authenticated connector evidence is separate |
| Nationalbank historical public Node HTTP | PASS; actual metadata/schema/unit/observations validated |
| Safari/WebKit / physical iPhone | **NOT TESTED** |
| Hosted deployment / offline PWA runtime | **NOT TESTED** |

Current evidence authority: `validation/closure-final-checks.json`, `closure-final-status.json`, `closure-final-audit.json`, `credential-scan.json`, `reproducibility.json` and `cors-probe.json`. Older `closure-*`, `v1.1-audit.json`, `critical-audit.json` and prior release reports are historical evidence, not new final PASS results. `release-checks.json` preserves the actual failed browser launch run; the later non-browser final checks include the review regression and both Python references.

Real authenticated Massive acquisition validated **33 pages / 1,556,366 rows**, retaining exactly 253 close-ending observations for each of GOOGL, ISRG, TSM, BTC and ETH. Raw pages were schema/numeric/ordering/duplicate/range checked through full-precision typed table projections. The connector does **not** expose the original native HTTP envelope or authentication headers: the package does not fabricate them. Native adapter JSON/schema/timeout/pagination/error paths are deterministic tests, not a live browser HTTP claim.

## Security and retained behavior

Credentials remain in their isolated local credential store, never in financial backups, normalized data or calculation snapshots. Browser storage is **not cryptographically secure secret storage**; scripts with origin access and someone with device/storage access can read it. No fake encryption or new backend. No keys were extracted from the configured connector, provider logs were not persisted, and only public numeric row/action projections were saved. Header-based provider auth remains in the existing native adapter; external credential-bearing responses are excluded from the service-worker shell cache by existing tests. Runtime browser exclusion remains untested here.

Risk observations remain separate from current valuation. CoinGecko's newer BTC/ETH reference prices cannot change this risk history. The validation holdings are synthetic and use the last synchronized close only; no personal financial state was imported or modified.

## Remaining limits and exact next step

- TSM official evidence is bounded to **2025-01-01–2026-10-07**. Future dates, unverified ADR actions and wider 504/756-return ranges fail closed; this release is not an ongoing certification of unknown future dividends.
- FX is retrospective date-only, not historical publication-time/revision availability evidence. A 7-day gap fails. The canonical minute close is the last eligible trade in `[C−60s,C)`, not a certified closing-auction print.
- The all-or-nothing data API is implemented and the actual normalized builder/gate is verified. **The existing automatic-risk UI button remains disabled**, as required by this pre-UI scope. A real unmocked native local-key refresh has not run.
- Browser launch EACCES is an **environment limitation**, not evidence of a provider CORS failure. No permission/security bypass, public proxy, deployment or unsafe fallback was attempted.

**Next:** run `npm run verify` on a permitted Chromium/WebKit runner, then verify real header-authenticated stock/crypto/current-quote requests and official FX from the intended GitHub Pages HTTPS origin. Supply keys only through the existing local credential workflow; distinguish authenticated/schema/entitlement/freshness results from HTTP 200. Test normal browser errors, actual CORS/preflight and a physical iPhone/offline PWA. Extending the bounded TSM evidence and activating the existing UI import control are explicit subsequent work, not changes in this release.

The release packager refuses nonpassing current data/build/reference/audit/security gates. The checksum manifest seals the included files; it proves archive integrity, not independent market authenticity or browser acceptance.
