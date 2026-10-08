import { ASSETS } from "../domain/core";
import { CALENDAR_POLICY, sessionWindow } from "./calendar";
import { EQUITY_SEMANTICS, FX_POLICY, type Dataset } from "./provider";
// Explicit synthetic fixture. No market provider is impersonated, no randomness.
export function demoDataset(now: string): Dataset {
  const grid = sessionWindow(now, 504);
  let levels = [100, 200, 150, 30000, 2000];
  return {
    schemaVersion: 1,
    classification: "synthetic-demo",
    assetOrder: [...ASSETS],
    provider: "EQUINOX deterministic sine fixture",
    sourceURLs: ["https://example.invalid/equinox-synthetic-fixture"],
    symbols: [...ASSETS],
    acquiredAt: now,
    equitySemantics: EQUITY_SEMANTICS,
    cryptoSemantics: "USD_SPOT_LAST_TRADE_IN_CLOSE_ENDING_60S_BUCKET",
    fxPolicy: FX_POLICY,
    calendarPolicy: CALENDAR_POLICY,
    corporateActionsComplete: true,
    rows: grid.map((s, t) => {
      levels = levels.map(
        (p, i) =>
          p *
          (1 +
            0.0002 +
            (0.006 + i * 0.002) * Math.sin(t * (0.31 + i * 0.17)) +
            0.002 * Math.cos(t * 0.077)),
      );
      return {
        date: s.date,
        closeAt: s.close,
        closeUSD: [...levels],
        splitRatio: [1, 1, 1],
        dividendUSD: [0, 0, 0],
        cryptoBucketStart: new Date(Date.parse(s.close) - 60000).toISOString(),
        cryptoBucketEnd: s.close,
        fx: {
          rate: 6.8 + 0.15 * Math.sin(t * 0.021),
          observedAt: new Date(Date.parse(s.close) - 5 * 3600e3).toISOString(),
          publishedAt: new Date(Date.parse(s.close) - 4 * 3600e3).toISOString(),
        },
      };
    }),
  };
}
