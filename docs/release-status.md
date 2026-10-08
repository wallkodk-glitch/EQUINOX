# EQUINOX v1 — release evidence, 2026-10-02

> Historical baseline evidence. Current release status: [v1.1.2 final data closure](final-data-closure/release-status.md). Prior PASS does not certify the current provider/runtime integration.

> **Critical audit patch — 2026-10-03, Engine 1.0.1.** One HIGH Data Truth defect is fixed: a reused published FX observation could carry contradictory rates and change a buy plan while validation passed. Acquisition predating included observations is now also rejected. Numerical allocation/risk models are unchanged; an actual valid sealed 1.0.0 snapshot replays with its original hash and output. Current patch evidence: 69 tests (including 1,000 L2 KKT cases, 500 literal-greedy comparisons, ERC acceptance/refusal and data/replay regressions), independent references, lint, typecheck and production build pass. See `validation/critical-audit.json` for counterexamples, root causes and actual command results. The sections below, including the 59-test/6-browser-flow and clean-install reproducibility records, are evidence for the submitted 1.0.0 baseline, not new runs of those full release gates. Live-data authenticity, hosted deployment and physical iPhone acceptance remain unverified.

## 1. Result

EQUINOX Engine and EQUINOX App are implemented, with a reproducible static build. This is **not full acceptance / not DONE** under the user's criteria: automatic verified market data, hosted deployment and physical iPhone acceptance remain open. The app can calculate from manually confirmed DKK prices using Equal Weight, demonstrate all models with explicitly synthetic data, and calculate conditionally from acknowledged user-supplied histories.

No personal holdings were supplied. The package contains empty defaults and clearly synthetic examples only. No broker orders were submitted, no external accounts were created and no fees/subscriptions incurred by the implementation.

## 2. Architecture

| Boundary | Modules | Proof of separation |
|---|---|---|
| A — Data Truth | `domain`, `market-data`, `portfolio` | Versioned asset order, raw-input schema, explicit FX/action/calendar semantics, fail-closed gates, units-based valuation |
| B — Mathematical Target | `risk`, `optimization` | Pure functions; raw EW/IV/ERC before human constraints; feasibility before constrained optimization |
| C — Executable Target | `execution` | Continuous L2 simplex optimum retained; quantity increments/minimums, explicit zero fees and separate residual |
| D — Proof | `snapshots`, `persistence` | Immutable full-input snapshot, versioned numerical replay, SHA-256, invariants, atomic IDB storage and recovery |
| EQUINOX App | `ui`, `main.tsx`, PWA scripts | Formatting and locale output never enter mathematical state; no React import in mathematical kernels |

## 3. Mathematical audit findings

- The capital invariant's missing equals sign is restored: buys + fees + residual = NewCapital.
- BUY-01 rounded targets sum to 0.99999999, not 1. Explicit normalization corrects the fixture; production was not changed to fit rounded expectations.
- Continuous buy-only L2 is the unique Euclidean projection onto the nonnegative capital simplex when V+C>0. L1 and RC distance remain diagnostics.
- Constrained ERC minimizes the specified RC-share objective, with deterministic starts and checked projected first-order stationarity. No general global-optimality proof is claimed. Binding policy can legitimately prevent exact risk parity.
- Singular PSD matrices are not inherently invalid risk arithmetic. V1 nevertheless rejects singular/condition>1e12 covariance in volatility-dependent target solvers as an explicit stability rule; no hidden ridge regularization.
- Reporting risk/weights excludes residual cash. The execution objective retains V+C in its denominator and uses only five risky-asset deviations, with no new cash penalty.
- Empty risky portfolios have undefined weights/risk, represented as null; V=C=0 fails explicitly. C=0 with existing value is valid.
- Node/Chromium replay found an approximately 1.7e-18 eigenvalue difference. A versioned 1e-12 absolute + 64 machine-epsilon relative tolerance now applies to derived analytics, not inputs/executable orders/cash. Original historical values and hash remain unchanged.
- Discrete execution follows the requested greedy-increment algorithm, not a purported global mixed-integer optimum. Exact internal monetary reconciliation uses integer arithmetic; eight-decimal inputs produce a 10^-16 DKK cost lattice. Broker settlement and actual fees remain outside the zero-fee model.

Full decisions and equations: `audit.md`, `reference-audit.md`.

## 4. Independent references

Python Decimal/NumPy/SciPy code does not call the production Engine. `--check` recalculates assertions and compares committed goldens without overwriting them.

| Reference | Verified result |
|---|---|
| FX-01 | DKK `[680,703.8,691.85,728]`; supplied rounded returns correct |
| COV-01 | Supplied 3×3 annual covariance correct; vol 0.20493901531919195 |
| ERC-01 | Exact weights `[60,30,20,15,12]/137`; all risk shares 0.2 |
| BUY-01 | `[1174.4549454945502,719.4094409440943,0,323.09980998099786,283.0358035803579]` DKK; sum 2500 |
| ERC-02 constrained | Objective 0.03725300222769519; independent KKT stationarity 2.220446049250313e-16; production agrees within test tolerance |
| Other buy fixtures | Eight buy cases, including zero/tiny cash, exact target, multiple overweights and sparse target; production comparison passes |

## 5. Data provider and semantics

**Verified live/history provider: NOT CONNECTED.** The implemented provider-independent import contract accepts raw equity closes, split ratios, post-split gross cash dividends, USD spot crypto close-ending minute buckets and as-of DKK/USD FX. It rejects generic unknown `adjusted_close` semantics. A manual current DKK price is a separate timestamped valuation input.

The calendar is bundled for 2024–2027, with DST, designated early closes and the 2025-01-09 closure. Only adjacent canonical return pairs count. Coverage>=95% AND at least252 daily returns are required; latest expected observation must exist. No hidden weekend prices or gap bridging. FX is explicitly asynchronous, published before the close, observed<=120h earlier. Quotes expire at24h. Real >50% one-session DKK moves also stop calculation for review under the conservative discontinuity rule.

Research did not establish an end-to-end authorized, stable, keyless provider pipeline. It did establish why candidate adjusted fields, candle boundaries, FX timing, history entitlement, CORS and usage rights need verification. No API credential is embedded in the app. Imported corporate-action completeness and authenticity remain user-supplied assertions, never upgraded to VERIFIED by a checkbox or hash. See `data-provider-research.md` and `data-contract.md`.

## 6. Files created/changed

All implementation files are in the delivered `EQUINOX/` directory. `RELEASE-MANIFEST.json` lists each file's size and SHA-256. Main groups:

- Pure Engine: `src/domain/core.ts`, `src/portfolio/accounting.ts`, `src/risk/math.ts`, `src/optimization/targets.ts`, `src/execution/allocator.ts`.
- Data/proof/storage: `src/market-data/*`, `src/snapshots/*`, `src/persistence/*`.
- App: `src/ui/*`, `src/main.tsx`, `index.html`, `public/*`.
- Validation: `tests/*`, `tests/browser/*`, `reference/*`, `validation/*`.
- Release: `.github/workflows/pages.yml`, `release/mobile-pages.yml`, `scripts/*`, pinned package/lock/config files, `README.md`, `docs/*`, `dist/*`. `docs/mobile-release.md` describes ZIP-only GitHub deployment from iPhone; its hosted workflow is not yet run.

The Superpowers test/review workflow led to regressions being tested and fixed: excessive fractional-increment looping, large-history backup refusal, corrupt-revision recovery, async demo-state contamination, and overly strict cross-runtime replay. Browser verification used Playwright because the suggested browser CLI was unavailable. The detailed technical review was not an independent financial-data certification.

## 7. Test matrix

| Area | Evidence | Status |
|---|---|---|
| Mathematical kernel | FX, simple returns, sample covariance252, corr/vol, MRC/RC/RCShare Euler identities, EW/IV/ERC | PASS for tested fixtures |
| Reference validation | Independent Python assertions plus production comparisons | PASS |
| Constraints | Infeasible bounds/cap rejected; constrained objective, active constraints and stationarity checked | PASS |
| Allocation/execution | Overweights, exact target, all-positive gaps, multiple blocked assets, tiny/zero capital, whole/fractional units, minimums, cash, exact ties, zero fees | PASS |
| Execution batching | Default crypto-precision decimal-quote regression +120 bounded comparisons with literal greedy reference | PASS |
| Numeric/data failures | Constant/zero variance, singular/near singular, nonfinite/asymmetric/indefinite, tiny eigen repair, missing/duplicate/stale/calendar/FX/action failures | PASS |
| Snapshots | Freeze, repeat determinism, tamper/version rejection, replay tolerance, unchanged quantities/cash; Node→Chromium replay | PASS |
| Persistence | IDB reopen/revision conflicts, valid/corrupt backups,201 snapshots, >50MB valid input, recovery copy, corrupt revision, async calculation races | PASS |
| Unit/integration suite | 59 tests in8 files | PASS |
| Chromium mobile browser | 6 passing flows: demo isolation, input invalidation, details/matrices, Node replay, offline shell and saved history, backup restore, approved update/cache cleanup/persistence, narrow layout/themes/error states | PASS |
| Known runtime dependency vulnerabilities | npm audit --omit=dev: zero reported | PASS on audit date only |
| Real imported data authenticity/action completeness | No independent source dataset validation performed | NOT VERIFIED |
| Nonzero fees | Fee machinery deliberately not implemented | NOT APPLICABLE |

No blanket claim is made over all covariance matrices, all possible policies or all devices. Failure remains explicit; there is no silent fallback model.

## 8. Build and reproducibility

Lint, typecheck, production build and a separately installed clean `npm ci` build passed. All11 output files, including source map, manifest and service worker, were byte-identical. `validation/reproducibility.json` records their hashes. `validation/release-checks.json` records actual command outputs, exits and timestamps; it is the authority for the final test count/status. Root-base paths were additionally built and inspected; bundled `dist` is `/EQUINOX/`.

Compatible exact dependency versions and official sources are recorded in `dependencies.md`. Reproducibility here is within the tested Node/OS toolchain, not a claim that different compilers/minifiers/platforms produce identical bytes.

## 9. Deploy

**DEPLOY — NOT PERFORMED.** There is no external git remote and no repository was returned by the configured GitHub connector. Source and Pages workflow are prepared, not executed in GitHub Actions. No live URL or hosted smoke result exists. Build PASS is not Deploy PASS.

## 10. iPhone/PWA

**CHROMIUM PWA — tested subset; SAFARI/WEBKIT — NOT TESTED; IPHONE PHYSICAL TEST — NOT TESTED.**

Actual Chromium153 runs used Playwright's iPhone13 viewport, not an Apple device. Normal Playwright downloads returned an HTML failure page instead of browser archives; an npm-packaged Chromium allowed the independent browser work to proceed. No WebKit or physical iPhone was available. HTTPS-hosted installability, iOS standalone behavior, real mobile keyboard, Safari memory/storage limits and browser-to-PWA container behavior remain unverified. Follow `iphone-checklist.md`.

## 11. Known limitations

Zero fees/spread/slippage; manual indicative quotes; no live feed; bounded calendar; eight-decimal execution inputs; conservative conditioning/discontinuity gates; no global constrained-ERC/integer proof. Current model versions only: a future model update must preserve replay support or use old release+backup. Very large archives still require browser memory/storage; parsing/validation finishes before restore writes, but no unlimited mobile capacity is promised. Browser storage may be evicted; backup remains necessary. No sell/trading/tax/prediction capability.

## 12. Blockers and minimal resolution

| Blocker | Root cause / affected component | Verified | Not verified | Minimal resolution |
|---|---|---|---|---|
| Market Data Truth | No audited end-to-end live/history feed with aligned observations and confirmed rights | Contract, transformations, quality gate and documented candidate semantics | Actual observations, action completeness, entitlement, runtime acquisition | Supply a licensed/exportable dataset/provider path; validate a real fixture and implement its adapter. Add a secure proxy only if an actual secret requirement makes it necessary. |
| Hosted deploy | No accessible destination repository/remote | Static build, source, workflow configuration, local browser | Actions execution, Pages deployment, hosted smoke | Provide/connect the intended GitHub repository; enable Pages/Actions and run the included workflow. |
| Safari/iPhone acceptance | No WebKit binary or physical device in this environment | Chromium-only test evidence | Actual Safari/standalone/keyboard/storage/install | Run WebKit CI on a suitable runner, then the physical checklist on Jakob's iPhone at the hosted HTTPS URL. |

## 13. Exact next step

Connect the intended GitHub repository and grant the normal code/workflow access needed to publish this source and execute its Pages workflow, or use the iPhone-only ZIP instructions in `mobile-release.md`. After hosted smoke succeeds, run the supplied iPhone checklist. Before accepting real **risk-based** buy plans, separately validate the actual historical data pipeline; a successful deploy does not remove that blocker.
