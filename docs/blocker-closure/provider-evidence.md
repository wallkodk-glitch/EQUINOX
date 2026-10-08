# Primary source and probe evidence — 2026-10-06

## Massive and canonical minutes

[Stock custom bars](https://massive.com/docs/rest/stocks/aggregates/custom-bars), [crypto custom bars](https://massive.com/docs/rest/crypto/aggregates/custom-bars) and [regular-hours minute-bar policy](https://massive.com/knowledge-base/article/how-does-massive-treat-hourly-bars-when-querying-regular-trading-hours) define aggregate windows and their start timestamps. [Bearer authentication](https://massive.com/docs/rest/quickstart) remains header based. The user-specified risk observation window is `[canonicalClose−60000, canonicalClose)`; query end is C−1 millisecond, and a result is eligible only if its timestamp is C−60000 and its computed bucket end equals C.

Authenticated Massive plugin calls for all five tickers requested `/v2/aggs/ticker/{ticker}/range/1/minute/1790971140000/1790971199999`, adjusted=false. Each returned one finite plausible OHLC row at t=1790971140000, the October 2 final session minute. Tickers are GOOGL, ISRG, TSM, X:BTCUSD and X:ETHUSD. Sanitized public rows and exact scope are in `validation/closure-authenticated-massive.json`. The plugin emits CSV and does not expose the native HTTP JSON envelope or its protected credentials. Authenticated plugin access is verified; standalone local-key Node transport and direct app-origin browser transport are not.

## TSM ADR corporate actions

[Massive dividends](https://massive.com/docs/rest/stocks/corporate-actions/dividends) distinguishes original cash_amount from split_adjusted_cash_amount. [Dividend adjustment](https://massive.com/knowledge-base/article/does-massive-adjust-historic-dividends-for-splits) and [splits](https://massive.com/docs/rest/stocks/corporate-actions/splits) must not be used to double-adjust the raw adjusted=false prices.

The authenticated `/stocks/v1/dividends` query for TSM and ex-date 2025-01-01–2026-10-05 returned seven USD recurring events. Public fields only, with provider IDs omitted, are projected separately in the raw test fixture. The following exact official facts are independent of adapter code:

| TSMC quarter | US ADR ex-date | Gross USD/ADR | Net USD/ADR | ADR payment | Official source |
|---|---|---:|---:|---|---|
| 3Q24 | 2025-03-18 | 0.677693 | 0.535377 | 2025-04-10 | [TSMC](https://investor.tsmc.com/english/dividends/3q24) |
| 4Q24 | 2025-06-12 | 0.780305 | 0.616441 | 2025-07-10 | [TSMC](https://investor.tsmc.com/english/dividends/4q24) |
| 1Q25 | 2025-09-16 | 0.821965 | 0.649352 | 2025-10-09 | [TSMC](https://investor.tsmc.com/english/dividends/1q25) |
| 2Q25 | 2025-12-11 | 0.795420 | 0.628382 | 2026-01-08 | [TSMC](https://investor.tsmc.com/english/dividends/2q25) |
| 3Q25 | 2026-03-17 | 0.938972 | 0.741788 | 2026-04-09 | [TSMC](https://investor.tsmc.com/english/dividends/3q25) |
| 4Q25 | 2026-06-11 | 0.939325 | 0.742067 | 2026-07-09 | [TSMC](https://investor.tsmc.com/english/dividends/4q25) |

All six original Massive cash amounts and ex/payment dates match these final issuer amounts; split_adjusted_cash_amount equals original cash in these returned events. [TSMC-hosted final Citibank 3Q25 announcement](https://investor.tsmc.com/system/files/2026-04/Final%20Dividend%20Announcement_3Q25.pdf) explicitly states 5 ordinary shares per ADR, gross USD 0.938972, 21% withholding USD 0.197184, net USD 0.741788, and zero listed dividend/tax-relief fees for that event. USD conversion at the depositary's stated 31.950 rate produces the issuer's gross USD per ADR; ordinary-share NT-dollar cash must not be treated as USD/ADR. Converted gross excludes withholding and the listed cash fees; the depositary conversion can include its disclosed FX spread. This validates the gross USD basis for these events, not a universal fee or tax treatment for every future event.

The frozen Engine reinvests gross per-unit USD cash on the US ex-date according to its existing convention. It excludes personal withholding/tax/ADR fee effects. Cash belongs to the per-ADR basis compatible with raw USD ADR prices; payment date is provenance, not the return event date. No mathematical formula is modified.

**Open:** [1Q26 issuer announcement](https://investor.tsmc.com/english/dividends/1q26) lists 2026-09-16 ex-date, 2026-10-08 payment and approximately USD 1.11 per ADR, while Massive returns original USD 1.096251. The exact issuer gross/net statement is absent from that page at this review. Official-domain exact-amount searches did not supply a final confirmation. A plausible difference from a preliminary FX estimate is an inference, not evidence. The event lies in the current risk window and is rejected. No whole-window corporate-action completeness is asserted.

## Nationalbank historical FX

[Nationalbank exchange-rate documentation](https://www.nationalbanken.dk/en/what-we-do/stable-prices-monetary-policy-and-the-danish-economy/exchange-rates) points to official historical StatBank data, specifies rates per 100 foreign currency units and distinguishes rate-setting and publication. [StatBank official API documentation](https://www.dst.dk/en/Statistik/hjaelp-til-statistikbanken/api) documents JSON-stat, TABLEINFO, variable selection and combined before/after conditions. DNVALD data identifies its source as Danmarks Nationalbank, USD currency, and KBH type labelled DKK per 100 units of foreign currency. Index and forward-premium series are rejected. The table's generic unit '-' is not used to infer the actual currency unit.

`GET https://api.statbank.dk/v1/tableinfo/DNVALD?format=JSON&lang=en` provides actual valid dates and KBH unit metadata. `GET https://api.statbank.dk/v1/data/DNVALD/JSONSTAT?lang=en&valuePresentation=Code&VALUTA=USD&KURTYP=KBH&Tid=%3E%3D2025M09D30%3C%3D2026M10D05` provides the bounded history. Node execution of the actual adapter returned 252 normalized observations, first 2025-09-30=6.358, last 2026-10-05=6.6713. As-of for the October 5 US session selects October 2=6.658. Evidence is in `validation/closure-historical-fx-live.json`. Those are FX observation counts, not a claim of 252 synchronized portfolio returns.

Earlier diagnostic attempts remain recorded: unsupported JSONSTAT2 produced 400; a 3331-character date-list query produced 404; official combined-range syntax returned the complete bounded history. No infinite retries, public proxy, different source or guessed publication clock was used.

Current Nationalbank XML also returned HTTP 200 and the October 6 USD row 663.30. Independent Python XML validation confirms its unit normalization; browser DOMParser execution is NOT TESTED. Current CoinGecko's actual adapter returned positive BTC/ETH USD quotes with documented last_updated_at metadata in public Node mode; see `validation/closure-node-provider-probes.json`. Neither current quote modifies covariance/ERC or manual DKK valuation.

## Fixture provenance

The new Nationalbank historical raw fixture is the public unmodified three-date JSON-stat response, separate from literal expected normalized rates. TSM raw fixtures project public fields from authenticated plugin rows, omit IDs, and are separate from hand-authored TSMC facts/net amounts/source links. Stock minute and synchronized-gate tests are explicit synthetic schema fixtures with independently stated UTC close expectations. No real credential or private account identifier is present. A fixture or Node probe is not browser evidence.
