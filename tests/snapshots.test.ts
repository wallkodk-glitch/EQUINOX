import { it, expect } from "vitest";
import { initialState } from "../src/persistence/schema";
import {
  calculate,
  regenerate,
  inputFromState,
} from "../src/snapshots/calculate";
import { seal, verifySeal, validateSeal } from "../src/snapshots/integrity";
import { demoDataset } from "../src/market-data/demo";
const now = "2026-10-02T06:00:00.000Z";
export function sampleInput() {
  const s = initialState();
  s.model = "erc";
  s.capital = 2500;
  s.holdings = s.holdings.map((h, i) => ({
    ...h,
    units: [2, 3, 4, 0.01, 0.5][i],
    priceDKK: [1000, 2000, 1500, 500000, 20000][i],
    priceAsOf: now,
  }));
  s.dataset = demoDataset(now);
  return inputFromState(s, now);
}
it("snapshot is immutable and repeated generation identical", () => {
  const i = sampleInput(),
    a = calculate(i),
    b = calculate(i);
  expect(a).toEqual(b);
  expect(Object.isFrozen(a.output.execution.orders)).toBe(true);
  expect(regenerate(a)).toEqual(a);
});
it("equal model produces valid plan without covariance or historical data", () => {
  const i = sampleInput();
  i.model = "equal";
  i.dataset = null;
  const s = calculate(i);
  expect(s.output.rawTarget).toEqual(Array(5).fill(0.2));
  expect(s.output.risk).toBe(null);
});
it("missing risk data never silently switches model", () => {
  const i = sampleInput();
  i.dataset = null;
  expect(() => calculate(i)).toThrow("RISK_DATA_REQUIRED");
});
it("old valuation price fails and future quote fails", () => {
  for (const date of ["2020-01-01T00:00:00.000Z", "2030-01-01T00:00:00.000Z"]) {
    const i = sampleInput();
    i.holdings[0].priceAsOf = date;
    expect(() => calculate(i)).toThrow("STALE_VALUATION_PRICE");
  }
});
it("snapshot integrity detects edits to both inputs and outputs", async () => {
  const s = await seal(calculate(sampleInput()));
  expect(await verifySeal(s)).toBe(true);
  const altered = structuredClone(s);
  altered.snapshot.output.execution.residual += 1;
  expect(await verifySeal(altered)).toBe(false);
});
it("version mismatch and fake stored plan cannot regenerate successfully", () => {
  const s = structuredClone(calculate(sampleInput()));
  s.versions.engine = "999";
  expect(() => regenerate(s)).toThrow("UNSUPPORTED_MODEL_VERSION");
  const b = structuredClone(calculate(sampleInput()));
  b.output.execution.residual += 1;
  expect(() => regenerate(b)).toThrow("SNAPSHOT_REGENERATION_MISMATCH");
});
it("cross-runtime last-bit risk differences retain the immutable original and its hash", async () => {
  const snapshot = structuredClone(calculate(sampleInput()));
  snapshot.output.diagnostics!.eigenvalues[2] += 1e-18;
  const original = await seal(snapshot),
    restored = await validateSeal(original);
  expect(restored).toEqual(original);
  expect(await verifySeal(restored)).toBe(true);
});
it("replay tolerance never allows changed executable quantities or material weight changes", async () => {
  for (const mutate of [
    (s: ReturnType<typeof calculate>) => {
      s.output.execution.orders[0].quantity += 1e-12;
    },
    (s: ReturnType<typeof calculate>) => {
      s.output.rawTarget[0] += 1e-5;
    },
  ]) {
    const snapshot = structuredClone(calculate(sampleInput()));
    mutate(snapshot);
    await expect(validateSeal(await seal(snapshot))).rejects.toThrow(
      "SNAPSHOT_REGENERATION_MISMATCH",
    );
  }
});
