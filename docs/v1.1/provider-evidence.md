# Official provider evidence

Primary documentation reviewed October 5; key auth/dividend/FX sources rechecked October 6, 2026. User-reported earlier live probes are not new live tests performed by this run.

## Massive

[Quickstart](https://massive.com/docs/rest/quickstart) documents Authorization Bearer headers; query auth is not used. [Stock bars](https://massive.com/docs/rest/stocks/aggregates/custom-bars) and [crypto bars](https://massive.com/docs/rest/crypto/aggregates/custom-bars) define window-start timestamps. [Split/dividend adjustment](https://massive.com/knowledge-base/article/is-massives-stock-data-adjusted-for-splits-or-dividends) distinguishes split adjustment from dividends: raw or split-adjusted prices are not total returns.

[Splits](https://massive.com/docs/rest/stocks/corporate-actions/splits): execution date and split_to/split_from. [Dividends](https://massive.com/docs/rest/stocks/corporate-actions/dividends): original per-share cash_amount in specified currency; split_adjusted_cash_amount is restated on current share basis. [Historic dividend adjustment](https://massive.com/knowledge-base/article/does-massive-adjust-historic-dividends-for-splits) further distinguishes those bases. [Ticker changes](https://massive.com/knowledge-base/article/how-does-massive-handle-ticker-changes-and-acquisitions) cannot be blindly stitched into one history.

[Regular-hours windows](https://massive.com/knowledge-base/article/how-does-massive-treat-hourly-bars-when-querying-regular-trading-hours) documents midnight Eastern daily anchoring and session figures from minute bars. The reviewed material does not establish that this daily `c` always equals the required regular-session close. No TSM-specific official clarification plus authenticated payload establishes USD gross ADR-per-share cash excluding withholding and depositary fees. General field names do not prove that basis. This is unverified, not asserted impossible.

Decision: `adjusted=false`, retain raw closes, parse original cash amounts and split ratios, return verifiedForRisk:false. Do NOT produce a total-return series until close, action completeness and share/currency/gross ADR mapping are proven. The existing Engine already constructs its explicit total-return convention; no new math is needed or changed.

## CoinGecko

[Demo simple price](https://docs.coingecko.com/demo/reference/simple-price): bitcoin/ethereum, USD, include_last_updated_at and x-cg-demo-api-key. [Official public tutorial](https://www.coingecko.com/learn/stream-real-time-crypto-prices-python) supports trying public access without a key; this is optional, not guaranteed robust availability. Pro mode is not supported. Both assets and finite positive/fresh prices are required. These are current references, never primary risk history or automatically applied DKK holdings prices.

## Nationalbank

[Official exchange-rate page](https://www.nationalbanken.dk/en/what-we-do/stable-prices-monetary-policy-and-the-danish-economy/exchange-rates) defines DKK per 100 foreign units, historical Statbank versus latest XML feeds, rate setting at 14:10 and publication after ECB at 16:00. “Shortly after” is not a precise historical publishedAt.

Preferred [XML](https://www.nationalbanken.dk/api/currencyratesxml?lang=en); compatibility [USD RSS](https://www.nationalbanken.dk/api/currencyrates?format=rss&isocodes=usd&lang=en). Observed XML refamt=1 does not override official per-100 semantics. 665.80 / 100 = 6.658 DKK/USD. RSS date label is accepted by compatibility parsing; its clock is discarded and must not prove economic availability. Operational requests use XML. [Historical Statbank](https://nationalbanken.statistikbank.dk/909) needs separate validated retrieval and a defensible as-of policy before satisfying the original observedAt≤publishedAt≤close contract. Neither noon nor acquisition time is invented as historic publication.

## Calendar and browser

[NYSE calendar](https://www.nyse.com/trade/hours-calendars): unchanged audited 2024–2027 sessions, DST/holidays/exceptional closure/early closes; outside-range dates reject. Crypto requires exact [C−60s,C) canonical-close bucket, never weekend fill or future point.

The current October 6 Chromium executable was denied execution (`EACCES`). All 15 browser cases failed at launch, before any application assertion, and the unmocked probe likewise never issued a request. `validation/cors-probe.json` records this from the actual command/log evidence: browser integration and provider CORS are **NOT TESTED — BLOCKED**, not provider rejections. Earlier outputs do not establish this reconstructed candidate's browser acceptance. Valid keys/entitlements remain NOT TESTED. Earlier public Nationalbank server-side retrieval succeeded, but browser transport is a separate gate. No permission, TLS or CORS bypass or public proxy was used. Repeat from intended HTTPS PWA origin with an authorized normally trusted browser; enter keys only locally in the modal.
