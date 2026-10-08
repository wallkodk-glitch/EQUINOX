# EQUINOX 1.1.1 — blocker closure candidate

**VERDICT: BLOCKED. Release acceptance: false. Automatic synchronized risk import remains disabled.**

App 1.1.1; Market Data Model 1.1.1; Engine **1.0.1**; Calculation Snapshot schema **1**, unchanged. Existing 1.1.0 reference-cache rows are accepted without rewriting them. New minute-stock/history-source roles require model 1.1.1. There are no dependency, UI, kernel, financial persistence or snapshot schema changes.

## Blocker status

| Requirement | Actual status | Evidence and remaining scope |
|---|---|---|
| Canonical stock close | Adapter/selection PASS; authenticated plugin sample PASS | GOOGL, ISRG and TSM final 1-minute bars returned for 2026-10-02. Exact `[C−60s,C)` selection; no daily `c` substitution. Full real lookback/native browser transport not verified. |
| TSM ADR actions | Six exact issuer/provider matches; current window BLOCKED | Gross USD per ADR, withholding/net distinction, ex-date and payment date verified for March 2025–June 2026. September 16, 2026 amount lacks final exact issuer confirmation. |
| Historical USD/DKK | Official retrieval/normalization/as-of selection PASS in Node | 252 official observations fetched for 2025-09-30–2026-10-05. Date-only contract is deliberately incompatible with the old timestamp-qualified gate. |
| Authenticated/browser probe | Authenticated Massive plugin PASS; public CG/FX Node PASS; BROWSER NOT TESTED | Chromium executable denied with EACCES; cloud browser cannot open local app origin (ERR_BLOCKED_BY_CLIENT). Zero provider requests ran in a browser. |
| Automatic synchronized import | BLOCKED, no partial activation | No complete real dataset passed corporate-action, FX availability, full-window alignment and the existing gate together. |

## Fixes and policies

Stock minute parsing now accepts the three existing equities. The adapter's connection test retrieves the final complete minute for all five assets with `adjusted=false`; stocks and crypto use the unchanged deterministic US calendar. Missing/duplicate minutes, daily bars, incompatible normalized roles, future points and non-sessions reject. DST and early closes select the calendar's actual UTC close. Observation timestamp is the bucket boundary; provider timestamp is the bucket start. This is the declared risk observation policy, not proof of an official auction print exactly at C. The policy does not forward-fill missing bars or weekends. A connection test is not complete risk-window validation.

Nationalbank history uses its official StatBank DNVALD table, `VALUTA=USD`, `KURTYP=KBH`. The payload identifies Danmarks Nationalbank and explicitly states DKK per 100 foreign-currency units. `665.80 → 6.658 DKK/USD`; other currency, index/forward rate types, missing/non-finite/non-positive values, mismatched selected dates, duplicate indexes, conflicting date rates and future dates reject. Metadata supplies actual Danish observation dates. Two bounded requests use the official combined time-range syntax rather than an oversized URL listing every date. No key is sent to StatBank.

Date-only as-of policy `NATIONALBANK_PREVIOUS_COPENHAGEN_DATE_MAX_4_CALENDAR_DAYS_V1` selects the latest observation date strictly before the US session's Copenhagen date, at most four calendar dates old. This excludes same-date observations without assuming a publication hour. `observationTimestamp` and `providerTimestamp` remain null; `acquiredAt` is assigned after the response arrives. RSS pubDate, table updated and midnight are never mapped to economic publishedAt. This is a retrospective date-label rule, **not archived point-in-time availability/revision evidence**. The old Engine data contract still requires `observedAt ≤ publishedAt ≤ close` and a 120-hour limit. It is unchanged and rejects date-only FX. No publishedAt is fabricated to bridge it.

TSM validation is deliberately bounded to 2025-01-01–2026-06-11. It matches original USD ADR cash and ex/payment dates against pinned final issuer facts, rejecting net cash, ordinary-share/TWD cash, incompatible split-adjusted substitutions, missing/duplicate/unexpected events and all later unaudited ranges. `verifiedForRisk` remains false: dividend proof alone does not certify splits, all equities, history completeness or the entire dataset. No total-return arithmetic is changed.

## Verification

Fresh outputs are in `validation/release-checks.json`: **126/126 tests PASS (99 preserved + 27 new)**, lint PASS, typecheck PASS, independent Python reference recalculation PASS, Node snapshot replay PASS, and production build PASS. Clean npm-ci rebuild produced **11/11 identical production files**, including source map, manifest and service worker. Structural credential scan PASS, zero findings. Tests include exact stock-minute selection, early close/DST/weekend/holiday rejection, date-only FX as-of/cache/conflicts, TSM gross/net basis, the unchanged gate, exact Engine output for identical normalized synthetic inputs, and original 1.0.0/1.0.1 snapshot output/hash replay. Synthetic gate fixtures retain explicitly synthetic publication clocks; none are assigned to real rates.

`validation/v1.1-audit.json` compares frozen UI/kernel/contracts/references and all prior tests/fixtures byte for byte with the attached 1.1.0 ZIP. `validation/closure-frozen-engine.json` also compares kernel/contracts/reference files with audited Engine 1.0.1. Dependency versions are unchanged. Clean install/build comparison and structural credential scan are recorded separately. Runtime credentials, browser headers, backups and service-worker cache exclusion remain browser NOT TESTED where launch is blocked; deterministic security tests and structural scans have their narrower scope.

The browser suite was actually invoked; all 15 Chromium cases were stopped by executable EACCES before application execution. These are environment launch failures, not provider or app test failures. The permitted cloud browser independently rejected `http://127.0.0.1:4173/EQUINOX/` at tab creation with ERR_BLOCKED_BY_CLIENT. No permission, origin, TLS or CORS bypass was attempted. **Browser CORS/auth/native response envelope/entitlement from the app origin: NOT TESTED. Node→Chromium replay, offline PWA flows, Safari/WebKit, physical iPhone and hosted deployment: NOT TESTED.** Static PWA build and deterministic offline cache/service-worker tests do not establish physical-device behavior.

## Remaining blockers and exact next step

1. Obtain the final official TSMC/Citibank announcement for the 2026-09-16 ADR ex-date and compare exact gross USD per ADR with Massive's 1.096251. TSMC 1Q26 IR presently says only approximately USD 1.11. Do not substitute a rounded amount or net cash. Audit any additional events in the complete chosen window.
2. Resolve the FX availability contract explicitly: obtain historical publication/availability evidence, or approve and version a precise date-only retrospective data contract with gate/snapshot compatibility tests. The preceding-date selector alone cannot satisfy the old contract. No kernel math change is required.
3. Use an authorized browser able to reach the intended app origin. Enter provider credentials locally in the existing sheet, then execute unmocked stock/crypto/CG/FX probes with normal browser CORS/TLS and the existing PWA/replay suite. The plugin's protected credentials were never available to or extracted by the agent; its successful calls do not prove local-key browser access.
4. Only after all prerequisites pass, implement/enable the narrow existing Dataset bridge and verify a complete real synchronized lookback through the existing Data Quality Gate and immutable snapshots. Until then keep BLOCKED. No UI work belongs to this closure phase.

This ZIP is a checksummed **blocked candidate** containing source, unchanged prior tests plus new tests, production build, documentation and honest evidence. It is not DATA-INTEGRATION PASS.
