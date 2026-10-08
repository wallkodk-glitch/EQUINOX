# Remaining blocker records

## TSM latest ADR event

- Blocking condition: current lookback contains 2026-09-16 ex-dividend cash without an exact final official issuer/depositary gross USD/ADR confirmation.
- Observed evidence: six final TSMC figures match authenticated Massive data; latest issuer page states only approximately USD 1.11, Massive original USD cash is 1.096251. The local validator explicitly rejects ranges beyond June 11.
- Bounded recovery performed: issuer dividend history, seven quarterly event pages, a final depositary notice hosted by TSMC, and official-domain exact-amount searches. Gross/net/ADR basis was resolved for six events.
- Alternatives exhausted/rejected: approximate preliminary amount, net cash, TWD per ordinary share, blindly using split_adjusted_cash_amount, or a fixture as proof of the pending event.
- Missing input: final exact gross/net ADR notice for September 16 and any additional actions in the chosen complete lookback. Extend pinned evidence only after exact comparison.

## FX dataset availability contract

- Blocking condition: the existing frozen input contract requires economic observedAt/publishedAt timestamps; the verified official historical source supplies observation dates, not precise historical publication instants.
- Observed evidence: actual adapter retrieved 252 official DNVALD USD/KBH observations; normalized timestamps remain null. Gate regression rejects date-only FX without invented clocks.
- Bounded recovery performed: official Nationalbank exchange-rate documentation, official StatBank metadata/API documentation, small and full history retrieval, combined interval query after diagnosing an oversized-URL 404, and deterministic preceding-date as-of tests.
- Alternatives exhausted/rejected: RSS clock, table updated, acquisition time or midnight as publishedAt; same-day assumed availability; silently weakening or bypassing the current gate. The new date-label selector is useful but is not a timestamp bridge.
- Missing input/decision: real historical availability evidence, or a precisely versioned date-only retrospective Dataset/gate/snapshot contract. This is a data-contract issue, not a mathematical kernel defect. A partial bridge is deliberately not activated while the complete dataset remains unverified.

## Browser execution and direct-provider CORS/auth

- Blocking condition: no permitted browser can execute the local app/provider probe from the intended origin in this environment.
- Observed evidence: actual existing Chromium suite launch failed EACCES in 15 cases; zero app test bodies ran. The cloud browser also rejected local app tab creation with net::ERR_BLOCKED_BY_CLIENT. Massive authenticated plugin and CG/FX Node successes are distinct evidence.
- Bounded recovery performed: existing local runtime launch and the permitted cloud browser's normal local-origin tab creation. Read-only executable mode check confirms non-executable mode 644.
- Alternatives exhausted/rejected: permission changes or binary relocation to bypass EACCES, disabled browser security/TLS, unsafe proxy, extracting plugin credentials, or an unsolicited backend/deployment. No provider CORS failure is inferred.
- Missing resource: an authorized normal browser/runtime that can reach the intended app origin, with keys entered locally in the app. Then run actual stock/crypto/public-or-keyed CG/FX requests, preflight/auth/schema/entitlement, immutable replay and offline PWA flows. Safari and physical iPhone remain separately untested.
