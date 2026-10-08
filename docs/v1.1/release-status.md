# EQUINOX v1.1.0 — BLOCKED candidate

## 1. RESULT

**BLOCKED — NOT DATA-INTEGRATION PASS.** Independent credential/reference acquisition/cache/UI work is implemented; complete synchronized provider risk history and provider-backed calculations are unavailable. No rewrite, new assets or mathematical model. The audited v1.0.1 ZIP is the sole application baseline.

## 2. VERSION STATUS

App 1.1.0 candidate; Engine **1.0.1 unchanged**; MarketDataModel 1.1.0; Calculation Snapshot schema **1 unchanged**. Financial state/backup version unchanged, no migration. Separate provider reference cache schema 1.

## 3. PROVIDER ARCHITECTURE

Massive: header-authenticated daily original-price GOOGL/ISRG/TSM retrieval, BTC/ETH minute buckets, split/dividend pagination, schema/entitlement checks, bounded requests and per-tab pacing. CoinGecko: optional public or Demo-header BTC/ETH current USD references/update timestamps, never risk history. Nationalbank: keyless official current XML reference, additional RSS parser.

Raw response → typed validation → explicit provenance/time/price semantics → isolated normalized cache → reference UI. The final normalized Dataset bridge is **closed** pending the semantic blockers below. No provider object reaches the Engine. Connection tests check schema/data/entitlement, not HTTP 200 alone; real account credentials were not provided.

## 4. CREDENTIAL SECURITY MODEL

Simple dedicated localStorage, plaintext-at-rest client-side limitation explicitly documented. Password modal, save/test/cancel/replace/remove, no reveal or startup popup. Stored key is not proof of valid access. Header-only auth with origin/path allowlists, no redirects/cookies/HTTP cache/referrer. Secrets excluded from financial state, exports, recovery, snapshots, errors/logs and service-worker cache. [Threat model](security-and-data-model.md) explains same-origin/device/extension exposure and provider-side revocation.

## 5. DATA SEMANTICS

Observation date, observation boundary, provider timestamp and actual acquiredAt remain distinct. Unknown close/publication timestamps stay null. DKK/100 USD conversion is explicit: 665.80 or 665,80 becomes 6.658 DKK/USD. Current valuation references never mutate manual DKK prices, risk dataset, covariance/ERC or saved calculations. Freshness CURRENT/EOD/CACHED/STALE/OFFLINE is computed with visible timestamps; no mixed-timestamp LIVE valuation.

## 6. CORPORATE-ACTION DECISION

**FAIL CLOSED.** Raw prices are not total return. Original cash_amount is not mixed with split_adjusted_cash_amount; split ratio is to/from. No series is constructed until gross USD TSM ADR share basis/fees/tax treatment, relevant action completeness and canonical stock close are established. Parser returns verifiedForRisk:false. No risk override checkbox or guessed publishedAt. [Official sources and unresolved evidence](provider-evidence.md).

## 7. TIMESTAMP/CALENDAR POLICY

Unchanged deterministic 2024–2027 US session table, with holidays, DST, early/exceptional closures. For canonical close C, require crypto minute [C−60s,C), exactly, without weekend fill or future point. Stock timestamp remains daily-window start; verified close is not fabricated from it. FX date-only XML/RSS does not satisfy the frozen observedAt≤publishedAt≤close contract by invention. Outside calendar coverage rejects.

## 8. FILES CHANGED

New `src/market-data/live/` modules; new MarketDataSettings; scoped App/Details/CSS changes; app package metadata; service-worker auth/query exclusions; provider/credential/cache/browser tests and independent raw/expected fixtures; probe/audit scripts and v1.1 documentation. Exact changed/added list and frozen SHA-256 checks: `validation/v1.1-audit.json`. Archive per-file checksums: `RELEASE-MANIFEST.json`. Dependencies unchanged.

## 9. TEST RESULTS

Fresh current-source command output and exit codes: `validation/release-checks.json`. **99/99 Vitest tests PASS, lint PASS, typecheck PASS, independent Python references PASS, production build PASS.** Existing 69 tests are byte-preserved and rerun. Added deterministic tests exercise credentials/backup/recovery/snapshot exclusion, provider parsing, network failure/pagination handling, calendar alignment, cache validation/freshness and service-worker request exclusions.

**Browser execution BLOCKED: 15 launch failures (`EACCES`), zero browser test bodies executed.** The implemented browser tests cover sheet save/replace/remove/reload/masking, logs/errors/cache/bundle/export exclusion, XML/RSS DOMParser behavior, offline persistence, existing UI and Node→Chromium replay. Their coverage is present but NOT TESTED for this reconstructed candidate. No old screenshot or old browser success is packaged as current evidence.

`validation/credential-scan.json` records the executed static structural scan of production/source, sanitized fixtures and stored synthetic snapshots. This does not prove current browser log/cache/UI exclusion. No real provider key was supplied or scanned; deterministic credential tests generate their temporary canaries in memory, never in fixtures or output.

Valid **real** credential/entitlement test: NOT TESTED. Deterministic authenticated fixtures do not establish live account access. Browser provider fixtures are intercepted except the separate unmocked probe. Cross-tab credential changes during a pending request and abort during the specific pacing wait remain NOT DIRECTLY TESTED, as recorded in [review](review.md).

## 10. MATHEMATICAL REGRESSION STATUS

Kernel, original Data Quality Gate, financial persistence, snapshots, calendar and original test/reference files are byte-compared with baseline. No new mathematical defect or kernel fix is claimed. Independent references, original 1.0.0 replay fixture and deterministic input/hash unit tests PASS. The 1.0.1 Node snapshot was generated; its current Chromium replay is NOT TESTED because launch was blocked. Snapshot schema/hash contract is unchanged.

## 11. BROWSER/CORS STATUS

**BROWSER INTEGRATION — BLOCKED / NOT TESTED. CORS — BLOCKED / NOT TESTED.** Chromium was denied execution (`EACCES`); all 15 test bodies and all external probe requests were unexecuted. The actual failure is preserved in `validation/release-checks.json` and `validation/probe-cors.log`; `validation/cors-probe.json` gives the explicit status. This is an environment execution failure, not evidence of provider CORS incompatibility. Node/OPTIONS headers, earlier runs and intercepted fixtures are not current BROWSER PASS. Valid authenticated browser access remains NOT TESTED. No permission/CORS/certificate bypass, unsafe proxy or backend was added.

## 12. BUILD STATUS

Included production build defaults to `/EQUINOX/`; it must be served from an origin, not file://. Build command status is in the actual verification report. Clean locked-dependency rebuild comparison is in `validation/reproducibility.json`; do not infer it from an old baseline report. Build success is not deployment or data-integration acceptance.

The separate clean directory was installed with `npm ci --ignore-scripts --fetch-retries=0 --fetch-timeout=15000` (141 packages) and built successfully. All 11 current production files and the lockfile match byte-for-byte. Five unreferenced historical hashed JS/map/CSS artifacts were removed from the working build; baseline copies remain recoverable. No application source or kernel change was needed for this cleanup.

## 13. PWA STATUS

Static PWA build and service-worker exclusion unit test PASS. Current runtime manifest/offline/local-history/update flows **NOT TESTED — browser launch blocked**. **SAFARI/WEBKIT — NOT TESTED. IPHONE PHYSICAL TEST — NOT TESTED.** No hosted deploy or physical keyboard/safe-area evidence. iPhone-first native dialog/CSS is implemented but is not physical-device acceptance.

## 14. KNOWN LIMITATIONS

Automatic synchronized risk history, certified total returns and provider-backed calculation provenance are absent; refresh is visibly disabled. Current USD/FX references do not replace manual DKK valuation. Cache is disposable/separate from financial backup, no raw payload archive or correction/eviction workflow. Browser storage can be lost/exposed. Rate coordination is per tab, not account-wide. Calendar ends in 2027; provider history depth must be checked against lookback. [Full security/data policy](security-and-data-model.md).

## 15. BLOCKERS

| Blocker | Root cause | Minimal secure resolution |
|---|---|---|
| TSM total-return basis | Gross USD ADR cash/share/fees/tax behavior unproven | Official provider clarification, sanitized authenticated action samples and independent known cases |
| Stock canonical close | Aggregate window start does not establish exact regular-session `c` | Confirm documented endpoint semantics; validate session-specific source if necessary and within entitlement |
| Historical FX/as-of | Current feeds lack complete history and exact availability evidence required by old gate | Validate official historical retrieval plus explicit defensible availability policy, never fabricate RSS noon |
| Browser/PWA execution and CORS | Current executable launch denied (`EACCES`); zero test/probe requests executed | Obtain an authorized browser runtime and repeat from intended HTTPS origin with normal trusted browser; no permission or security bypass |
| Auth/entitlements | No real account key available | Enter key locally and test; capture sanitized status only, never key in chat/source |

No backend is proposed unless a direct-browser incompatibility is actually established and a new secure architecture is explicitly approved.

## 16. EXACT NEXT STEP

First obtain an authorized browser runtime for the current-source browser/PWA suite and unmocked probe. Resolve the three data-semantic prerequisites with official evidence/sanitized samples, then test real entitlements with credentials entered **locally in the app**, never in chat. Only then implement the narrow normalized Dataset bridge, validate a complete synchronized window and provider-backed reproducible snapshots, rerun all gates and execute WebKit/physical-iPhone acceptance. Until then retain BLOCKED and disabled risk refresh. The ZIP is an explicitly flagged partial handoff, not an accepted release; failed gates remain recorded.

## Decisions and verification record

One fresh review produced two fixes in reference/credential code, not math. User mandate superseded extra approval ceremony; ZIP-local work had no merge/publish/backend. Those decisions and their costs, deferred coverage and declined-to-judge items are in review.md. Workspace rolled back during interruption; current candidate was reconstructed and freshly checked, with prior output excluded as acceptance evidence.
