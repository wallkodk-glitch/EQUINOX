# Market data import contract v1

This is the **unchanged legacy schema-1 contract**, preserved for old snapshots. The separate, versioned schema-2 date-only retrospective contract is documented in [v1.1.2 data semantics](final-data-closure/data-semantics.md). Do not translate a date-only historical FX rate into the timestamps required below. The existing UI remains manual; the new all-or-nothing data import API is not yet UI-activated or browser-certified.

The import adapter is provider-independent. Manual DKK valuation is separate from historical USD risk inputs. An imported file remains USER-SUPPLIED, never VERIFIED. Using it requires explicit acknowledgement; numerics and known transformation semantics are checked, market authenticity and event completeness are not independently established for arbitrary user files. Synthetic mode is isolated from personal state. Neither source URLs nor a SHA-256 prove authenticity. The bounded actual-provider evidence for the new data layer is separately recorded in the v1.1.2 release report.

## Exact input

Download the synthetic JSON example from the Data view to see the complete schema. Its classification must remain `synthetic-demo` while it contains synthetic observations. For actual user-supplied observations use `user-supplied`; no `verified` value is accepted. Supply the actual provider, source URLs, symbols, acquisition timestamp, and every observation. The versioned schema lives in `src/market-data/provider.ts`.

- `assetOrder`: GOOGL, ISRG, TSM, BTC, ETH. Symbol order is never inferred from UI.
- `closeUSD`: raw, unadjusted closing prices for the three US equity instruments; USD spot crypto, no stablecoin substitutes. Equity observation time is scheduled US regular close.
- `splitRatio`: three new-shares/old-share ratios on ex date (1 without a split). `dividendUSD`: three cash dividends per POST-SPLIT share, effective ex date. The importer explicitly requires a declaration that corporate-action data are complete. A declaration is an assumption, not verification.
- `cryptoBucketStart` and `cryptoBucketEnd`: exact minute ending at that session's actual close, including early closes. Crypto close is the last trade in this bucket, NOT a trade proven to occur at its end.
- `fx.rate`: DKK per USD. `observedAt <= publishedAt <= equity close`; observed age <=120 hours. This as-of reference policy is asynchronous and is disclosed. An older still-valid reference remains the SAME observation timestamp; it is not invented daily FX. Missing FX rows fail; no automatic forward filling occurs.
- Explicit constants for corporate actions, calendar, FX and crypto semantics must match the schema. A generic `adjusted_close` column cannot be substituted.

## Return construction

For each adjacent valid pair of canonical sessions:

`stock USD gross factor = splitRatio[t] * (rawClose[t] + dividendPostSplit[t]) / rawClose[t-1]`.

This is theoretical gross cash-dividend reinvestment at the ex-date close; tax, ADR fees, distributions other than cash dividends/splits, and the investor's actual cash handling are outside v1. Instruments with unsupported actions require an adapter/model revision, not a guessed correction.

`crypto USD gross factor = close[t] / close[t-1]`.

`DKK simple return = USD gross factor * fx[t]/fx[t-1] - 1`.

No dividend term is added to an already adjusted provider series. Mixing adjusted data with this raw-input contract would double count adjustments and is invalid.

The snapshot stores the full original input, transformed aligned daily return matrix, dates, estimator, raw/adjusted covariance, diagnostics and warnings. These are sufficient to reproduce the calculation, conditional on the supplied observations.

## Quality gate

The fixed lookback ends at the latest canonical close at least two hours before calculation time. It requires >=95% of expected daily RETURN PAIRS AND >=252 aligned returns. Missing endpoints remove both incident pairs. No gap bridging or synthetic weekends. Duplicate/unordered dates, bad/NaN/Infinity/negative values, unknown semantics, future acquisition, invalid FX timestamps, incorrect crypto bucket, absent latest session, or a one-session absolute DKK return >50% fail closed. The discontinuity threshold is deliberately conservative; a real exceptional market move needs review/versioned policy change.

Current manual valuation prices have their own confirmed timestamp and expire after 24 hours. You must enter true current DKK prices, including FX conversion if your broker quote is USD. Current quote data never become the historical risk series.

## Calendar sources

The immutable bundled 2024–2027 grid uses `America/New_York`; regular close16:00 and designated early close13:00. Python `zoneinfo` produces exact UTC values in `scripts/calendar.py`; production uses the saved UTC calendar. Outside the supported range, calculation fails. Newly announced extraordinary future closures require a calendar/Engine update.

- https://www.nyse.com/trade/hours-calendars
- https://ir.theice.com/press/news-details/2023/NYSE-Group-Announces-2024-2025-and-2026-Holiday-and-Early-Closings-Calendar/default.aspx
- https://www.nasdaqtrader.com/TraderNews.aspx?id=ETA2024-87 (2025-01-09 closure)
- https://www.nasdaqtrader.com/TraderNews.aspx?id=ETA2024-36 (2024-07-03 early close)
- https://www.nasdaqtrader.com/TraderNews.aspx?id=ETA2024-77 (2024-11-29 early close)
- https://www.nasdaqtrader.com/TraderNews.aspx?id=ETA2024-84 (2024-12-24 early close)

Provider feasibility, timing and documentation audit: `data-provider-research.md`.
