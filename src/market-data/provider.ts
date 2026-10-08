import { z } from "zod";
import { ASSETS, requireThat } from "../domain/core";
import { CALENDAR_POLICY, sessionWindow } from "./calendar";
import { RETROSPECTIVE_FX_POLICY, historicalFXPointSchema, validateFXHistory, retrospectiveFXAsOf } from './retrospective-fx';
import { riskProvenanceSchema, validateRiskProvenance } from './live/risk-provenance';
const pos = z.number().finite().positive();
const iso = z.iso.datetime();
export const EQUITY_SEMANTICS =
  "RAW_CLOSE_GROSS_DIVIDEND_REINVESTED_POST_SPLIT_V1";
export const FX_POLICY = "ASOF_PUBLISHED_DKK_PER_USD_MAX_120H_V1";
export const legacyDatasetSchema = z
  .object({
    schemaVersion: z.literal(1),
    classification: z.enum(["synthetic-demo", "user-supplied"]),
    assetOrder: z.tuple(
      ASSETS.map((a) => z.literal(a)) as [
        z.ZodLiteral<"GOOGL">,
        z.ZodLiteral<"ISRG">,
        z.ZodLiteral<"TSM">,
        z.ZodLiteral<"BTC">,
        z.ZodLiteral<"ETH">,
      ],
    ),
    provider: z.string().min(1).max(200),
    sourceURLs: z.array(z.url()).min(1).max(20),
    symbols: z.array(z.string().min(1)).length(5),
    acquiredAt: iso,
    equitySemantics: z.literal(EQUITY_SEMANTICS),
    cryptoSemantics: z.literal(
      "USD_SPOT_LAST_TRADE_IN_CLOSE_ENDING_60S_BUCKET",
    ),
    fxPolicy: z.literal(FX_POLICY),
    calendarPolicy: z.literal(CALENDAR_POLICY),
    corporateActionsComplete: z.literal(true),
    rows: z
      .array(
        z
          .object({
            date: z.iso.date(),
            closeAt: iso,
            closeUSD: z.array(pos).length(5),
            splitRatio: z.array(pos).length(3),
            dividendUSD: z.array(z.number().finite().nonnegative()).length(3),
            cryptoBucketStart: iso,
            cryptoBucketEnd: iso,
            fx: z.object({ rate: pos, observedAt: iso, publishedAt: iso }),
          })
          .strict(),
      )
      .min(1)
      .max(1500),
  })
  .strict();
// V1 stays byte/semantically compatible. V2 is an explicit different FX
// availability contract; timestamps cannot be substituted for economic dates.
export const retrospectiveDatasetSchema = legacyDatasetSchema.extend({
  schemaVersion:z.literal(2),fxPolicy:z.literal(RETROSPECTIVE_FX_POLICY),
  fxHistory:z.array(historicalFXPointSchema).min(1).max(1500),
  provenance:riskProvenanceSchema.optional(),
  rows:z.array(legacyDatasetSchema.shape.rows.element.extend({
    fx:z.object({rate:pos,observationDate:z.iso.date()}).strict(),
  })).min(1).max(1500),
});
export const datasetSchema = z.discriminatedUnion('schemaVersion',[legacyDatasetSchema,retrospectiveDatasetSchema]);
export type Dataset = z.infer<typeof legacyDatasetSchema>;
export type RetrospectiveDataset = z.infer<typeof retrospectiveDatasetSchema>;
export type RiskDataset = z.infer<typeof datasetSchema>;
export interface ValuationQuote {
  symbol: (typeof ASSETS)[number];
  priceDKK: number;
  asOf: string;
  provider: string;
  sourceURL: string;
  status: "manual" | "provider";
}
export interface MarketDataProvider {
  id: string;
  readHistory(input: unknown): RiskDataset;
  currentPrices(): Promise<ValuationQuote[]>;
}
export class ImportProvider implements MarketDataProvider {
  id = "USER_IMPORT_RAW_V1";
  readHistory(input: unknown): RiskDataset {
    const r = datasetSchema.safeParse(input);
    requireThat(
      r.success,
      "DATA_SCHEMA_INVALID",
      r.success
        ? ""
        : r.error.issues
            .map((x) => `${x.path.join(".")}: ${x.message}`)
            .slice(0, 3)
            .join("; "),
    );
    return r.data;
  }
  async currentPrices(): Promise<never> {
    throw new Error("MANUAL_CURRENT_PRICE_REQUIRED");
  }
}
export function equityFactor(
  previous: number,
  current: number,
  split: number,
  dividend: number,
) {
  requireThat(
    [previous, current, split].every((x) => Number.isFinite(x) && x > 0) &&
      Number.isFinite(dividend) &&
      dividend >= 0,
    "CORPORATE_ACTION_INVALID",
  );
  return (split * (current + dividend)) / previous;
}
export function prepareRisk(input: unknown, now: string, lookback: number) {
  requireThat(
    input &&
      typeof input === "object" &&
      "equitySemantics" in input &&
      input.equitySemantics === EQUITY_SEMANTICS,
    "CORPORATE_ACTION_SEMANTICS_UNKNOWN",
  );
  const data = new ImportProvider().readHistory(input),
    grid = sessionWindow(now, lookback),
    nowMs = Date.parse(now);
  requireThat(Date.parse(data.acquiredAt) <= nowMs, "FUTURE_DATA_TIMESTAMP");
  if(data.schemaVersion===2&&data.provider==='MASSIVE_NATIONALBANK_SYNCHRONIZED_RETROSPECTIVE_V1')requireThat(data.provenance,'PROVENANCE_MISMATCH');
  if(data.schemaVersion===2) validateFXHistory(data.fxHistory,data.acquiredAt);
  if(data.schemaVersion===2&&data.provenance)validateRiskProvenance(data.provenance,data.rows,data.acquiredAt);
  let previous = "";
  const seen = new Set<string>();
  const fxObservations = new Map<string, number>();
  const acquired = Date.parse(data.acquiredAt);
  for (const row of data.rows) {
    requireThat(!seen.has(row.date), "DUPLICATE_TIMESTAMP");
    requireThat(row.date > previous, "NON_MONOTONIC_TIMESTAMPS");
    previous = row.date;
    seen.add(row.date);
    requireThat(Date.parse(row.closeAt)<=acquired&&Date.parse(row.cryptoBucketEnd)<=acquired,'DATA_ACQUISITION_BEFORE_OBSERVATION',row.date);
    if('observedAt' in row.fx) {
    const observed = Date.parse(row.fx.observedAt),
      published = Date.parse(row.fx.publishedAt);
    requireThat(
      Date.parse(row.closeAt) <= acquired &&
        Date.parse(row.cryptoBucketEnd) <= acquired &&
        observed <= acquired && published <= acquired,
      "DATA_ACQUISITION_BEFORE_OBSERVATION",
      row.date,
    );
    // One published observation cannot carry two rates. Compare instants rather
    // than ISO spellings; a later publication can legitimately be a revision.
    const fxKey = `${observed}:${published}`;
    requireThat(
      !fxObservations.has(fxKey) || fxObservations.get(fxKey) === row.fx.rate,
      "FX_OBSERVATION_CONFLICT",
      row.date,
    );
    fxObservations.set(fxKey, row.fx.rate);
    }
  }
  const byDate = new Map(data.rows.map((r) => [r.date, r]));
  const missingDates = grid
    .filter((s) => !byDate.has(s.date))
    .map((s) => s.date);
  requireThat(byDate.has(grid.at(-1)!.date), "STALE_MARKET_DATA");
  const returns: number[][] = [],
    returnDates: string[] = [];
  const levelsDKK: number[][] = [];
  for (let i = 0; i < grid.length; i++) {
    const s = grid[i],
      row = byDate.get(s.date);
    if (!row) continue;
    requireThat(
      row.closeAt === s.close &&
        row.cryptoBucketEnd === s.close &&
        Date.parse(row.cryptoBucketStart) === Date.parse(s.close) - 60000,
      "CALENDAR_ALIGNMENT_FAILED",
      s.date,
    );
    if('observedAt' in row.fx) {
    const close = Date.parse(s.close),
      observed = Date.parse(row.fx.observedAt),
      published = Date.parse(row.fx.publishedAt);
    requireThat(
      observed <= published &&
        published <= close &&
        close - observed <= 120 * 3600e3,
      "FX_DATA_MISSING",
      s.date,
    );
    } else {
      requireThat(data.schemaVersion===2,'DATA_SCHEMA_INVALID');
      const selected=retrospectiveFXAsOf(data.fxHistory,s.close);
      requireThat(row.fx.observationDate===selected.observationDate&&row.fx.rate===selected.rate,'FX_ASOF_MISMATCH',s.date);
    }
    levelsDKK.push(row.closeUSD.map((x) => x * row.fx.rate));
    if (i === 0) continue;
    const prev = byDate.get(grid[i - 1].date);
    if (!prev) continue;
    const r = row.closeUSD.map(
      (x, j) =>
        (j < 3
          ? equityFactor(
              prev.closeUSD[j],
              x,
              row.splitRatio[j],
              row.dividendUSD[j],
            )
          : x / prev.closeUSD[j]) *
          (row.fx.rate / prev.fx.rate) -
        1,
    );
    requireThat(r.every(Number.isFinite), "DATA_QUALITY_FAILED");
    requireThat(
      r.every((x) => Math.abs(x) <= 0.5),
      "UNEXPECTED_DISCONTINUITY",
      `${s.date}; absolute one-session DKK return > 50% needs source review`,
    );
    returns.push(r);
    returnDates.push(s.date);
  }
  const coverage = returns.length / lookback;
  requireThat(
    coverage >= 0.95,
    "DATA_QUALITY_FAILED",
    `daily pair coverage ${(coverage * 100).toFixed(2)}%`,
  );
  requireThat(
    returns.length >= 252,
    "INSUFFICIENT_HISTORY",
    `${returns.length} daily aligned returns`,
  );
  return {
    returns,
    returnDates,
    levelsDKK,
    coverage,
    missingDates,
    alignedObservations: grid.length - missingDates.length,
    expectedReturns: lookback,
    windowStart: grid[0].date,
    windowEnd: grid.at(-1)!.date,
    latestClose: grid.at(-1)!.close,
    classification: data.classification,
    provider: data.provider,
    symbols: data.symbols,
    sourceURLs: data.sourceURLs,
    calendarPolicy: CALENDAR_POLICY,
    fxPolicy: data.fxPolicy,
    equitySemantics: EQUITY_SEMANTICS,
    returnConvention: "simple" as const,
    annualization: 252,
    warnings: [
      data.classification === "synthetic-demo"
        ? "DEMO_NOT_MARKET_DATA"
        : "USER_SUPPLIED_NOT_INDEPENDENTLY_VERIFIED",
      ...(missingDates.length ? ["MISSING_PAIRS_EXCLUDED_NO_FILL"] : []),
      ...(data.schemaVersion===2?['RETROSPECTIVE_FX_NOT_POINT_IN_TIME']:[]),
    ],
  };
}
