import { it, expect } from "vitest";
import { prepareRisk, equityFactor } from "../src/market-data/provider";
import { demoDataset } from "../src/market-data/demo";
import { sessionWindow } from "../src/market-data/calendar";
const now = "2026-10-02T06:00:00.000Z";
it("canonical grid knows DST early close and mourning closure", () => {
  const s = sessionWindow("2025-07-04T06:00:00.000Z", 252);
  expect(s.at(-1)?.close).toBe("2025-07-03T17:00:00.000Z");
  expect(s.some((x) => x.date === "2025-01-09")).toBe(false);
});
it("split and gross cash dividend formula correct on ex date", () => {
  expect(equityFactor(100, 50, 2, 0)).toBe(1);
  expect(equityFactor(100, 98, 1, 2)).toBe(1);
  expect(equityFactor(100, 49, 2, 1)).toBe(1);
});
it("explicit sample dataset has 504 aligned simple DKK returns and known semantics", () => {
  const d = demoDataset(now),
    r = prepareRisk(d, now, 504);
  expect(r.returns.length).toBe(504);
  expect(r.coverage).toBe(1);
  expect(r.classification).toBe("synthetic-demo");
});
it("missing observation excludes BOTH adjacent returns and never bridges gap", () => {
  const d = demoDataset(now);
  d.rows.splice(100, 1);
  const r = prepareRisk(d, now, 504);
  expect(r.returns.length).toBe(502);
  expect(r.missingDates.length).toBe(1);
});
it("252 lookback with even one missing row fails minimum aligned returns", () => {
  const d = demoDataset(now);
  d.rows.splice(d.rows.length - 100, 1);
  expect(() => prepareRisk(d, now, 252)).toThrow("INSUFFICIENT_HISTORY");
});
it("duplicate and nonmonotonic timestamps fail closed", () => {
  const d = demoDataset(now);
  d.rows[1] = d.rows[0];
  expect(() => prepareRisk(d, now, 504)).toThrow("DUPLICATE_TIMESTAMP");
  const d2 = demoDataset(now);
  [d2.rows[1], d2.rows[2]] = [d2.rows[2], d2.rows[1]];
  expect(() => prepareRisk(d2, now, 504)).toThrow("NON_MONOTONIC_TIMESTAMPS");
});
it("invalid future missing or stale FX fail closed", () => {
  for (const mutate of [
    (d: ReturnType<typeof demoDataset>) => (d.rows[100].fx.rate = 0),
    (d: ReturnType<typeof demoDataset>) =>
      (d.rows[100].fx.observedAt = "2030-01-01T00:00:00.000Z"),
    (d: ReturnType<typeof demoDataset>) =>
      (d.rows[100].fx.publishedAt = "2020-01-01T00:00:00.000Z"),
  ]) {
    const d = demoDataset(now);
    mutate(d);
    expect(() => prepareRisk(d, now, 504)).toThrow();
  }
});
it("stale market data and insufficient coverage fail", () => {
  const d = demoDataset(now);
  d.rows.pop();
  expect(() => prepareRisk(d, now, 504)).toThrow("STALE_MARKET_DATA");
  const d2 = demoDataset(now);
  d2.rows.splice(20, 50);
  expect(() => prepareRisk(d2, now, 504)).toThrow("DATA_QUALITY_FAILED");
});
it("unknown corporate action semantics are rejected", () => {
  const d = demoDataset(now);
  expect(() =>
    prepareRisk({ ...d, equitySemantics: "adjusted_close" }, now, 504),
  ).toThrow("CORPORATE_ACTION_SEMANTICS_UNKNOWN");
});
it("crypto bucket starting at close is future data and fails", () => {
  const d = demoDataset(now);
  d.rows[20].cryptoBucketStart = d.rows[20].closeAt;
  expect(() => prepareRisk(d, now, 504)).toThrow("CALENDAR_ALIGNMENT_FAILED");
});
it("unadjusted split discontinuity is detected", () => {
  const d = demoDataset(now);
  d.rows[50].closeUSD[0] /= 4;
  expect(() => prepareRisk(d, now, 504)).toThrow("UNEXPECTED_DISCONTINUITY");
});
