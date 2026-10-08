import { z } from "zod";
import { ASSETS, VERSIONS, deepFreeze, requireThat, sum } from "../domain/core";
import { portfolio } from "../portfolio/accounting";
import { covariance, correlation, diagnose, risk } from "../risk/math";
import {
  constrainedTarget,
  equalWeight,
  erc,
  inverseVol,
} from "../optimization/targets";
import { allocate, execute, deviation } from "../execution/allocator";
import { prepareRisk, datasetSchema } from "../market-data/provider";
import {
  executionSchema,
  holdingSchema,
  number,
  policySchema,
  type AppState,
} from "../persistence/schema";
export const inputSchema = z
  .object({
    timestamp: z.iso.datetime(),
    holdings: z.array(holdingSchema).length(5),
    capital: number,
    model: z.enum(["equal", "inverse", "erc"]),
    lookback: z.union([z.literal(252), z.literal(504), z.literal(756)]),
    policy: policySchema,
    executionRules: executionSchema,
    dataset: datasetSchema.nullable(),
    acknowledgeUserData: z.boolean(),
  })
  .strict();
export type CalculationInput = z.infer<typeof inputSchema>;
const REPRODUCTION = {
  version: "FLOAT64_REPLAY_V1",
  absoluteTolerance: 1e-12,
  relativeTolerance: 64 * Number.EPSILON,
  exact:
    "inputs, versions, structure, solver/configuration integers, executable orders, fees, spend, residual",
};
export const inputFromState = (
  s: AppState,
  timestamp: string,
): CalculationInput =>
  structuredClone({
    timestamp,
    holdings: s.holdings,
    capital: s.capital,
    model: s.model,
    lookback: s.lookback,
    policy: s.policy,
    executionRules: s.executionRules,
    dataset: s.dataset,
    acknowledgeUserData: s.acknowledgeUserData,
  });
export function calculate(untrusted: CalculationInput) {
  const input = inputSchema.parse(untrusted);
  requireThat(
    input.holdings.every((h, i) => h.symbol === ASSETS[i]),
    "COMPUTATIONAL_ASSET_ORDER_MISMATCH",
  );
  const { holdings, capital, model, dataset, policy } = input;
  const now = Date.parse(input.timestamp);
  requireThat(
    holdings.every((h) => h.priceDKK > 0),
    "MANUAL_CURRENT_PRICE_REQUIRED",
  );
  requireThat(
    holdings.every(
      (h) =>
        h.priceAsOf !== "" &&
        Date.parse(h.priceAsOf) <= now &&
        now - Date.parse(h.priceAsOf) <= 24 * 3600e3,
    ),
    "STALE_VALUATION_PRICE",
    "manual quotes must be <=24 hours old",
  );
  if (dataset?.classification === "user-supplied")
    requireThat(
      input.acknowledgeUserData,
      "UNVERIFIED_DATA_ACKNOWLEDGEMENT_REQUIRED",
    );
  const p = portfolio(
    holdings.map((h) => h.units),
    holdings.map((h) => h.priceDKK),
    holdings.map((h) => h.costBasisDKK),
  );
  requireThat(model === "equal" || dataset, "RISK_DATA_REQUIRED");
  const prepared = dataset
    ? prepareRisk(dataset, input.timestamp, input.lookback)
    : null;
  const diagnostics = prepared
      ? diagnose(covariance(prepared.returns, 252))
      : null,
    s = diagnostics?.matrix ?? null;
  if (model !== "equal" && s) {
    inverseVol(s);
    requireThat(diagnostics?.stable, "COVARIANCE_NUMERICALLY_UNSTABLE");
  }
  const raw =
    model === "equal"
      ? { weights: equalWeight(5), solver: null }
      : model === "inverse"
        ? { weights: inverseVol(s!), solver: null }
        : erc(s!);
  const constrained = constrainedTarget(model, s, raw.weights, policy),
    target = constrained.weights;
  const continuous = allocate(p.values, capital, target),
    execution = execute(
      p.values,
      capital,
      target,
      continuous,
      holdings.map((h) => h.priceDKK),
      input.executionRules,
    );
  const warnings = [
    ...(prepared?.warnings ?? ["RISK_ANALYTICS_UNAVAILABLE_NO_DATA"]),
    "ZERO_FEES_NO_SPREAD_OR_SLIPPAGE",
    "MANUAL_DKK_VALUATION_NOT_LIVE",
  ];
  let analytics = null;
  if (s) {
    const safeRisk = (w: number[] | null) => {
      if (!w) return null;
      try {
        return risk(w, s);
      } catch (e) {
        if (e instanceof Error && e.message === "ZERO_PORTFOLIO_RISK") {
          warnings.push("ZERO_PORTFOLIO_RISK");
          return null;
        }
        throw e;
      }
    };
    let corr = null;
    try {
      corr = correlation(s);
    } catch (e) {
      if (e instanceof Error && e.message === "ZERO_OR_NEAR_ZERO_VARIANCE")
        warnings.push("CORRELATION_UNDEFINED_ZERO_VARIANCE");
      else throw e;
    }
    const current = safeRisk(p.weights),
      rawRisk = safeRisk(raw.weights),
      targetRisk = safeRisk(target),
      projected = safeRisk(execution.projectedWeights);
    analytics = {
      volatility: s.map((row, i) => Math.sqrt(row[i])),
      correlation: corr,
      current,
      raw: rawRisk,
      target: targetRisk,
      projected,
      rcDistance:
        targetRisk && projected
          ? sum(projected.shares.map((x, i) => (x - targetRisk.shares[i]) ** 2))
          : null,
    };
  }
  const targetValues = target.map((x) => x * (p.total + capital));
  const output = {
    portfolio: p,
    rawTarget: raw.weights,
    rawSolver: raw.solver,
    constrainedTarget: target,
    constrainedSolver: constrained.solver,
    activeConstraints: constrained.active,
    targetValues,
    targetReachable: targetValues.every((x, i) => x >= p.values[i] - 1e-8),
    continuousBuy: continuous,
    execution,
    risk: analytics,
    diagnostics,
    riskInputs: prepared,
    preDeviation: p.weights ? deviation(p.weights, target) : null,
    warnings,
    validation: [
      {
        check: "capital reconciliation <=0.01 DKK",
        passed:
          Math.abs(
            execution.spend + execution.fees + execution.residual - capital,
          ) <= 0.01,
      },
      {
        check: "buy-only, zero fees, nonnegative cash",
        passed:
          execution.orders.every((o) => o.buy >= 0 && o.fee === 0) &&
          execution.residual >= 0,
      },
      {
        check: "target full precision sum=1",
        passed: Math.abs(sum(target) - 1) <= 1e-10,
      },
      { check: "computational asset order", passed: true },
    ],
  };
  requireThat(
    output.validation.every((x) => x.passed),
    "VALIDATION_FAILED",
  );
  return deepFreeze({
    schemaVersion: input.dataset?.schemaVersion===2?2:1,
    versions: { ...VERSIONS, snapshot:input.dataset?.schemaVersion===2?2:VERSIONS.snapshot } as {
      engine: string;
      risk: string;
      execution: string;
      assetMaster: string;
      snapshot: number;
    },
    reproduction: { ...REPRODUCTION },
    baseCurrency: "DKK",
    assetOrder: [...ASSETS],
    timestamp: input.timestamp,
    input,
    output,
  });
}
export type Snapshot = ReturnType<typeof calculate>;
export function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`)
    .join(",")}}`;
}
function firstDifference(a: unknown, b: unknown, path = "snapshot"): string {
  if (a === b) return "";
  // ECMAScript transcendental functions may differ by last bits across engines.
  // Tolerance applies to derived analytics, never to original inputs or orders.
  const exact =
    !path.startsWith("snapshot.output.") ||
    path.includes(".configuration.") ||
    path.startsWith("snapshot.output.execution.orders") ||
    /\.(iterations|starts|tolerance|conditionLimit|moneyPrecisionDKK|spend|fees|residual)$/.test(
      path,
    );
  if (
    !exact &&
    typeof a === "number" &&
    typeof b === "number" &&
    Number.isFinite(a) &&
    Number.isFinite(b) &&
    Math.abs(a - b) <=
      REPRODUCTION.absoluteTolerance +
        REPRODUCTION.relativeTolerance * Math.max(Math.abs(a), Math.abs(b))
  )
    return "";
  if (
    a === null ||
    b === null ||
    typeof a !== "object" ||
    typeof b !== "object"
  )
    return `${path}: stored=${JSON.stringify(a)}, reproduced=${JSON.stringify(b)}`;
  if (Array.isArray(a) !== Array.isArray(b))
    return `${path}: array/object mismatch`;
  const left = a as Record<string, unknown>,
    right = b as Record<string, unknown>;
  if (
    Object.keys(left).sort().join("\u0000") !==
    Object.keys(right).sort().join("\u0000")
  )
    return `${path}: key mismatch`;
  for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
    const found = firstDifference(left[key], right[key], `${path}.${key}`);
    if (found) return found;
  }
  return "";
}
export function regenerate(value: unknown): Snapshot {
  const header = z
    .object({
      versions: z.object({
        engine: z.string(),
        risk: z.string(),
        execution: z.string(),
        assetMaster: z.string(),
        snapshot: z.number(),
      }),
      input: inputSchema,
    })
    .passthrough()
    .parse(value);
  const snapshotVersion=header.input.dataset?.schemaVersion===2?2:VERSIONS.snapshot;
  requireThat(
    (snapshotVersion===2?[VERSIONS.engine]:["1.0.0", VERSIONS.engine]).includes(header.versions.engine) &&
      canonical({ ...header.versions, engine: VERSIONS.engine }) === canonical({...VERSIONS,snapshot:snapshotVersion}),
    "UNSUPPORTED_MODEL_VERSION",
  );
  // 1.0.1 only strengthens input validation; the numerical models are unchanged.
  // Valid 1.0.0 histories retain their identity, but contradictory data fail closed.
  const calculated = calculate(header.input),
    reproduced = {
      ...calculated,
      versions: { ...calculated.versions, engine: header.versions.engine },
    },
    difference = firstDifference(value, reproduced);
  requireThat(difference === "", "SNAPSHOT_REGENERATION_MISMATCH", difference);
  // Keep the original hash-covered bytes/values. Reproduction verifies; it never
  // replaces historical results with the current runtime's last-bit variant.
  return deepFreeze(structuredClone(value)) as Snapshot;
}
