# Final evidence index — 2026-10-07

## Official primary sources

- TSMC issuer dividend page, 1Q26: https://investor.tsmc.com/english/dividends/1q26
- Its linked **FINAL Citibank ADR announcement**, dated 02-Oct-2026 11:54 AM, timezone unspecified: https://investor.tsmc.com/system/files/2026-10/Final%20Dividend%20Announcement_1Q26.pdf
- The PDF was retrieved from the issuer link and visually inspected. It explicitly gives ADR ratio 5:1, ex-date 16-Sep-2026, pay-date 08-Oct-2026, gross USD 1.0962510, withholding USD 0.2302130 / 21%, net USD 0.8660380, rounded to six decimal places. No amount/date inference or fabricated publication timestamp.
- Massive official stock/crypto custom bars, dividends and splits documentation was retrieved through the configured documentation connector. Published web entry points: https://massive.com/docs/rest/stocks/aggregates/custom-bars and https://massive.com/docs/rest/crypto/aggregates/custom-bars . Minute `t` is bucket start; adjustment is split-related; missing eligible-trade bars are not synthesized. Dividend `cash_amount` is original per-share USD cash; `split_adjusted_cash_amount` is distinct. The application explicitly requests unadjusted minute prices and validates original cash/split basis.
- Official historical FX API and table: https://api.statbank.dk/tableinfo/DNVALD and https://api.statbank.dk/data . The actual metadata identifies Danmarks Nationalbank, USD/KBH and DKK per 100 foreign-currency units. Historical daily observation dates are not publication timestamps.

## Sanitized evidence versus normalized output

| File under `validation/` | Meaning |
|---|---|
| `closure-final-provider-rows.json` | Actual authenticated connector **full-precision typed row projections**; all-page quality/counts and retained raw OHLC/times/actions. Not a native HTTP envelope. No provider secrets, private account IDs, workspace handles or request/cursor IDs. |
| `closure-final-fx.json` | Actual public Node retrieval: official raw metadata/JSON-stat, normalized date-only FX and as-of diagnostics. |
| `closure-final-tsm.json` | Explicit inspected issuer/depositary facts and actual matching Massive fields; final/gross/net/date distinction. |
| `closure-final-synchronized.json` | Builder/gate output, complete normalized schema-2 input, actual return matrix/levels/covariance/correlation and replay/determinism diagnostics. |
| `closure-final-snapshots.json` | Three actual sealed Engine 1.0.1 calculations on actual risk data with **synthetic** validation holdings, not the user's portfolio. |
| `closure-final-independent-reference.json` | Independent Python result, using raw provider price/action projections and original official FX, not production expected output. |
| `closure-final-checks.json` | Current executed lint/typecheck/152 tests/original Python/new raw-data reference/Node snapshot replay/build/frozen audit command outputs and exits. |
| `closure-final-audit.json` | Exact audited source hashes, frozen file comparisons, narrow schema-only snapshot dispatch and unchanged mathematical fragments. |
| `closure-final-status.json` | Current machine-readable release scope/status, derived only after all packaging gates pass. |
| `credential-scan.json` | Fresh structural scan, with explicit non-browser/no-real-key limitation. |
| `reproducibility.json` | Fresh clean `npm ci` rebuild comparison, lockfile and all 11 production files. |
| `cors-probe.json`, `release-checks.json` | Actual **EACCES launch limitation**: 15 launches failed before app assertions or CORS calls. NOT TESTED, not provider failure. |

The original supplied v1.1.1 ZIP SHA-256 is `c158793d743f82d22ec17aaab62d4697e789724eb4f2495fd24de3f167f74279`. Previous audited Engine 1.0.1 is the frozen numerical reference. No baseline was replaced and no private portfolio state was included.

## Validation incidents resolved, not hidden

The connector's large plain-CSV rendering could round an OHLC field inconsistently. That projection was rejected. All five full histories were re-acquired using typed Float64 tables with full-row validation and exact canonical projections; production schema/price gates were **not relaxed** to fit bad data.

An initial Python harness placed alongside `scripts/calendar.py` shadowed Python's standard-library `calendar` import. The generated calendar was only whitespace-compacted: all 1,004 dates/closes were semantically identical. It was restored **byte-for-byte** before the final tests/audit; the new harness lives in `reference/final-risk.py`. Calendar SHA-256 remains `fa3a619610636b29c02eacf04a5ce44be38a8ba8170f5530ac6e6d3695789b5f`.

The independent FX reference initially divided a binary float by 100 before exact comparison, causing one-ULP differences. It now performs the independent **decimal** unit transformation with Python Decimal before conversion to Float64. Actual returns match exactly; sample covariance differs by at most 2.7755575615628914e-17. No production mathematics or acceptance tolerance was changed.

The independent read-only review identified the provenance-deletion counterexample; a failing regression was observed, the minimal schema-2 gate fix applied, and the focused seven tests and full 152-test suite then passed. Old schema-1 labels and numerical replay remain compatible.

The first clean-build comparison correctly rejected two orphaned older bundle artifacts in the working `dist/`. An explicit Vite clean rebuild regenerated only the current production output; no source or baseline was removed. The comparison then passed for the lockfile and all 11 files, including source map, manifest and service worker. The release packager now refuses stale/unmatched assets.

Native Massive/CoinGecko header authentication/envelopes, real browser CORS, Safari, physical iPhone, deployment and offline PWA runtime are **not certified** by connector, Node, fixture or build evidence.
