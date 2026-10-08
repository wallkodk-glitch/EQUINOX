import { z } from "zod";
import { ASSETS, requireThat } from "../domain/core";
import { datasetSchema } from "../market-data/provider";
export const number = z.number().finite().min(0).max(1e12);
export const holdingSchema = z
  .object({
    symbol: z.enum(ASSETS),
    units: number,
    costBasisDKK: number,
    priceDKK: number,
    priceAsOf: z.union([z.iso.datetime(), z.literal("")]),
  })
  .strict();
export const policySchema = z
  .object({
    lower: z.array(z.number().finite().min(0).max(1)).length(5),
    upper: z.array(z.number().finite().min(0).max(1)).length(5),
    cryptoCap: z.number().finite().min(0).max(1),
  })
  .strict();
export const executionSchema = z
  .array(
    z
      .object({
        increment: z.number().finite().positive().max(1e12),
        minimumDKK: number,
      })
      .strict(),
  )
  .length(5);
export const stateSchema = z
  .object({
    schemaVersion: z.literal(1),
    revision: z.number().int().nonnegative(),
    holdings: z.array(holdingSchema).length(5),
    capital: number,
    model: z.enum(["equal", "inverse", "erc"]),
    lookback: z.union([z.literal(252), z.literal(504), z.literal(756)]),
    policy: policySchema,
    executionRules: executionSchema,
    theme: z.enum(["system", "light", "dark"]),
    dataset: datasetSchema.nullable(),
    acknowledgeUserData: z.boolean(),
  })
  .strict()
  .refine(
    (s) => s.holdings.every((h, i) => h.symbol === ASSETS[i]),
    "COMPUTATIONAL_ASSET_ORDER_MISMATCH",
  );
export type AppState = z.infer<typeof stateSchema>;
export function initialState(): AppState {
  return {
    schemaVersion: 1,
    revision: 0,
    holdings: ASSETS.map((symbol) => ({
      symbol,
      units: 0,
      costBasisDKK: 0,
      priceDKK: 0,
      priceAsOf: "",
    })),
    capital: 2500,
    model: "equal",
    lookback: 504,
    policy: { lower: Array(5).fill(0), upper: Array(5).fill(1), cryptoCap: 1 },
    executionRules: [1, 1, 1, 0.00000001, 0.00000001].map((increment) => ({
      increment,
      minimumDKK: 0,
    })),
    theme: "system",
    dataset: null,
    acknowledgeUserData: false,
  };
}
export function migrateState(input: unknown): AppState {
  const r = stateSchema.safeParse(input);
  requireThat(
    r.success,
    "CORRUPTED_OR_UNSUPPORTED_STATE",
    r.success
      ? ""
      : r.error.issues
          .map((x) => x.path.join("."))
          .slice(0, 3)
          .join(", "),
  );
  return r.data;
}
