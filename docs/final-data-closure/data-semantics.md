# Date-only retrospective data contract — schema 2

## Separate clocks

`observationDate` is the date an economic observation applies to. `observationTimestamp` is a defined market bucket end only when such a clock exists. `providerTimestamp` is the provider's actual bucket start for minute aggregates. `acquiredAt` is the actual acquisition time. They are not interchangeable.

For Nationalbank historical daily FX, `observationTimestamp` and `providerTimestamp` are **null** in normalized cache observations. The dataset stores a date/rate FX book and actual acquisition time. No RSS `pubDate`, table-update time or invented midnight/noon becomes `publishedAt`/`observedAt`. There is no historical `publishedAt` in this contract.

## FX units and selection

Official source: Danmarks Nationalbank's Statistikbank table **DNVALD**, `VALUTA=USD`, `KURSTYPE=KBH`; metadata states **DKK per 100 units of foreign currency**. Source identity/unit/currency/schema are validated before parsing rates. Thus `665,80` → numeric 665.80 → **6.6580 DKK/USD**. Decimal unit shifting is deterministic and tested; malformed/localization-ambiguous, nonfinite, zero/negative or impossible rates fail.

Policy identifier:

`NATIONALBANK_RETROSPECTIVE_DATE_ONLY_PREVIOUS_COPENHAGEN_DATE_MAX_6D_V1`

For each canonical equity session close `C`:

1. Find the date of `C` in **Europe/Copenhagen**.
2. Select the greatest official `observationDate` **strictly less** than that date.
3. Require age **<=6 calendar days**, on date arithmetic, not invented publication-hour arithmetic.
4. Require source/unit/rate and acquisition validation; no future observation date relative to actual acquisition, duplicate dates (even equal), conflicting values, unordered dates or missing predecessor.

The original official observations remain in `fxHistory`; each row references its selected date/rate. Reusing a reference does not invent an observation on a weekend or closed publication day. Exact book-to-row comparison rejects conflicting reuse and preserves the Engine 1.0.1 FX audit protection.

Six days is a **new, explicit date-only contract**, not a relaxation of old schema 1. Actual official Christmas/Easter gaps require it under the strict-prior-date policy: 2025-12-29 selects 2025-12-23 and 2026-04-07 selects 2026-04-01. Both are six calendar days; seven fails. The full official raw history and independently calculated selected-date map are in the final FX/reference evidence.

This is **retrospective risk estimation**. It does not claim that a rate was historically published/available at a particular intraday instant, that later corrections were absent, or that a strategy could have traded with these observations then. Same-day FX is deliberately not presumed available. Schema 1 retains its separate timestamp-qualified <=120-hour FX policy, byte-identical historical calculation behavior and snapshot compatibility.

## Market close and corporate actions

All five prices use unadjusted Massive **1-minute** bars. The immutable existing US session calendar supplies `C`, including DST, holidays and early closes. Select exactly `[C−60s,C)`; Massive's `t` is the bar **start**, and `c` is its last eligible trade, not a proven trade at `C`. Missing bars fail; daily stock `c`, later minutes, calendar gaps and weekend fills cannot substitute. Provenance retains bucket start/end, provider timestamp, canonical close and real per-page acquisition time.

All three stock books must be complete and compatible with raw prices and original gross USD cash per listed share. TSM cash is **per ADR**, not per ordinary share and not net-after-withholding. The final 2026-09-16 **gross 1.0962510** matches Massive and official TSMC-linked depositary evidence. Split-adjusted dividends cannot replace the original basis; unsupported or ambiguous split/dividend combinations fail. Unknown/future TSM events remain blocked.

The existing total-return construction is unchanged:

`USD stock factor = splitRatio[t] × (rawClose[t] + grossDividendPostSplit[t]) / rawClose[t−1]`

`DKK return = USD factor × FX[t]/FX[t−1] − 1`

This is theoretical gross ex-date reinvestment. Actual taxes, withholding, ADR fees and investor payment-date cash are not modelled. Final USD conversion after ex-date is explicitly retrospective.

## Gate, snapshot and cache boundaries

The synchronized builder requires all 253 observations/252 returns for this verified window, complete actions and FX, then calls the **existing** `prepareRisk` quality gate with **100% coverage**. No partially valid result/cache write. The mathematical kernel receives only normalized, provider-agnostic data, never provider response objects or credentials.

New automatically labelled schema-2 datasets require checked provenance. It cross-checks all minute prices/timestamps, actions and FX against normalized rows. A user can still supply a manual schema-2 file without automatic-provider proof, but it remains unverified and requires the existing acknowledgement. Schema-1 free-form provider labels are not automatic certification and retain old replay semantics.

Snapshots store normalized inputs, date-only FX book, selected references, provenance, observation/acquisition times and model/freshness/cache metadata. Dataset schema 2 creates snapshot schema/version 2; schema-1/null datasets keep schema/version 1. Sealed calculation inputs/outputs are immutable. No migration rewrites old economic results or hashes, and the financial DB/backup schema is unchanged.

Credential persistence and financial/cache/snapshot persistence remain distinct. Historical cache can be reused only at the exact canonical bucket and after the full gate; cached status remains explicit. Offline display/replay is not permission to silently calculate a current risk window from stale/incomplete data. Current manual/crypto valuation remains a separate clock and never replaces the risk observations.
