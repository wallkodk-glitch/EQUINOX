import {
  dot,
  mv,
  normalize,
  requireThat,
  sum,
  vector,
  weights,
  type Matrix,
  type Model,
} from "../domain/core";
import { diagnose, risk } from "../risk/math";
export interface Policy {
  lower: number[];
  upper: number[];
  cryptoCap: number;
}
export interface Solver {
  name: string;
  version: string;
  iterations: number;
  objective: number;
  stationarity: number;
  converged: boolean;
  initialization: string;
  tolerance: number;
  starts?: number;
  configuration: Record<string, number | string>;
}
export const equalWeight = (n: number) => {
  requireThat(Number.isInteger(n) && n > 0, "INVALID_ASSET_COUNT");
  return Array(n).fill(1 / n) as number[];
};
export function inverseVol(s: Matrix): number[] {
  requireThat(s.length > 0, "INVALID_COVARIANCE");
  s.forEach((r) => vector(r, s.length));
  const v = s.map((r, i) => Math.sqrt(r[i]));
  requireThat(
    v.every((x) => Number.isFinite(x) && x > 1e-12),
    "ZERO_OR_NEAR_ZERO_VARIANCE",
  );
  return normalize(v.map((x) => 1 / x));
}
export const defaultPolicy = (n = 5): Policy => ({
  lower: Array(n).fill(0),
  upper: Array(n).fill(1),
  cryptoCap: 1,
});
export function feasible(p: Policy, n: number) {
  vector(p.lower, n, true);
  vector(p.upper, n, true);
  requireThat(
    Number.isFinite(p.cryptoCap) &&
      p.cryptoCap >= 0 &&
      p.cryptoCap <= 1 &&
      p.lower.every((l, i) => l <= p.upper[i] && p.upper[i] <= 1),
    "INFEASIBLE_POLICY",
  );
  const crypto = [3, 4].filter((i) => i < n),
    stocks = p.lower.map((_, i) => i).filter((i) => !crypto.includes(i));
  requireThat(
    sum(p.lower) <= 1 + 1e-12 &&
      sum(p.upper) >= 1 - 1e-12 &&
      sum(crypto.map((i) => p.lower[i])) <= p.cryptoCap + 1e-12 &&
      sum(stocks.map((i) => p.upper[i])) +
        Math.min(p.cryptoCap, sum(crypto.map((i) => p.upper[i]))) >=
        1 - 1e-12,
    "INFEASIBLE_POLICY",
  );
  return { crypto, stocks };
}
function boxProjection(x: number[], l: number[], u: number[], mass: number) {
  if (x.length === 0) {
    requireThat(Math.abs(mass) < 1e-10, "INFEASIBLE_POLICY");
    return [];
  }
  let lo = Math.min(...x.map((v, i) => v - u[i])) - 1,
    hi = Math.max(...x.map((v, i) => v - l[i])) + 1;
  for (let k = 0; k < 100; k++) {
    const mid = (lo + hi) / 2,
      ss = sum(x.map((v, i) => Math.max(l[i], Math.min(u[i], v - mid))));
    if (ss > mass) lo = mid;
    else hi = mid;
  }
  const y = x.map((v, i) => Math.max(l[i], Math.min(u[i], v - (lo + hi) / 2)));
  let d = mass - sum(y);
  for (let i = 0; i < y.length && d !== 0; i++) {
    const delta = Math.max(l[i] - y[i], Math.min(u[i] - y[i], d));
    y[i] += delta;
    d -= delta;
  }
  return y;
}
export function projectPolicy(x: number[], p: Policy): number[] {
  vector(x);
  const { crypto, stocks } = feasible(p, x.length);
  let y = boxProjection(x, p.lower, p.upper, 1);
  if (sum(crypto.map((i) => y[i])) > p.cryptoCap) {
    y = Array(x.length).fill(0);
    for (const [ids, mass] of [
      [crypto, p.cryptoCap],
      [stocks, 1 - p.cryptoCap],
    ] as [number[], number][]) {
      const r = boxProjection(
        ids.map((i) => x[i]),
        ids.map((i) => p.lower[i]),
        ids.map((i) => p.upper[i]),
        mass,
      );
      ids.forEach((i, j) => (y[i] = r[j]));
    }
  }
  return y;
}
export function ercObjective(w: number[], s: Matrix) {
  const r = risk(w, s).shares;
  return sum(r.map((x) => (x - 1 / w.length) ** 2));
}
function gradient(w: number[], s: Matrix) {
  const a = mv(s, w),
    q = dot(w, a),
    r = w.map((x, i) => (x * a[i]) / q);
  return w.map(
    (_, j) =>
      2 *
      sum(
        w.map(
          (wi, i) =>
            (r[i] - 1 / w.length) *
            (((i === j ? a[i] : 0) + wi * s[i][j]) / q - (2 * r[i] * a[j]) / q),
        ),
      ),
  );
}
export function erc(input: Matrix) {
  const inv = inverseVol(input),
    d = diagnose(input);
  requireThat(d.stable, "COVARIANCE_NUMERICALLY_UNSTABLE");
  const scale = d.maxEigenvalue,
    s = d.matrix.map((r) => r.map((x) => x / scale)),
    n = s.length,
    x = [...inv];
  let objective = Infinity,
    iterations = 0;
  for (; iterations < 10000; iterations++) {
    for (let i = 0; i < n; i++) {
      const a = s[i][i],
        c = dot(s[i], x) - a * x[i],
        b = 1 / n,
        root = Math.sqrt(c * c + 4 * a * b);
      x[i] = c >= 0 ? (2 * b) / (root + c) : (root - c) / (2 * a);
    }
    objective = ercObjective(normalize(x), s);
    if (objective <= 1e-20) break;
  }
  requireThat(objective <= 1e-16, "ERC_NO_CONVERGENCE");
  const w = normalize(x);
  weights(w);
  requireThat(
    w.every((x) => x > 0),
    "ERC_NO_CONVERGENCE",
  );
  return {
    weights: w,
    solver: {
      name: "risk-budget-coordinate-descent",
      version: "1",
      iterations: Math.min(iterations + 1, 10000),
      objective,
      stationarity: Math.sqrt(objective),
      converged: true,
      initialization: "normalized inverse volatility",
      tolerance: 1e-16,
      configuration: {
        maxSweeps: 10000,
        objectiveStop: 1e-20,
        objectiveAcceptance: 1e-16,
        covarianceScale: "largest eigenvalue",
      },
    } satisfies Solver,
  };
}
export function activeConstraints(w: number[], p: Policy) {
  const a: string[] = [];
  w.forEach((x, i) => {
    if (Math.abs(x - p.lower[i]) < 1e-8) a.push(`lower:${i}`);
    if (Math.abs(x - p.upper[i]) < 1e-8) a.push(`upper:${i}`);
  });
  if ((w[3] || 0) + (w[4] || 0) >= p.cryptoCap - 1e-8) a.push("cryptoCap");
  return a;
}
export function constrainedTarget(
  model: Model,
  s: Matrix | null,
  raw: number[],
  p: Policy,
) {
  weights(raw);
  feasible(p, raw.length);
  const projected = projectPolicy(raw, p);
  if (
    model !== "erc" ||
    Math.max(...projected.map((x, i) => Math.abs(x - raw[i]))) < 1e-12
  ) {
    return {
      weights: projected,
      active: activeConstraints(projected, p),
      solver: {
        name:
          model === "erc" ? "feasible-raw-erc" : "euclidean-policy-projection",
        version: "1",
        iterations: 0,
        objective:
          model === "erc"
            ? ercObjective(projected, s!)
            : sum(projected.map((x, i) => (x - raw[i]) ** 2)),
        stationarity: 0,
        converged: true,
        initialization: "raw target",
        tolerance: 1e-10,
        configuration: {
          projectionBisections: 100,
          feasibleRawTolerance: 1e-12,
        },
      } satisfies Solver,
    };
  }
  requireThat(s, "COVARIANCE_REQUIRED");
  const matrix = s;
  const starts = [
    projected,
    projectPolicy(equalWeight(raw.length), p),
    ...raw.map((_, i) =>
      projectPolicy(
        raw.map((_, j) => (i === j ? 1 : 0)),
        p,
      ),
    ),
  ];
  let best: { weights: number[]; solver: Solver } | null = null;
  for (let si = 0; si < starts.length; si++) {
    let w = starts[si],
      f = ercObjective(w, matrix),
      eta = 1,
      stationarity = Infinity,
      iterations = 0;
    for (; iterations < 20000; iterations++) {
      const g = gradient(w, matrix),
        pg = projectPolicy(
          w.map((x, i) => x - g[i]),
          p,
        );
      stationarity = Math.max(...w.map((x, i) => Math.abs(x - pg[i])));
      if (stationarity < 1e-8) break;
      let accepted = false;
      for (let bt = 0; bt < 70; bt++) {
        const next = projectPolicy(
            w.map((x, i) => x - eta * g[i]),
            p,
          ),
          delta = next.map((x, i) => x - w[i]),
          nf = ercObjective(next, matrix);
        if (nf <= f + 1e-4 * dot(g, delta) + 1e-16) {
          w = next;
          f = nf;
          eta = Math.min(10, eta * 1.3);
          accepted = true;
          break;
        }
        eta *= 0.5;
      }
      if (!accepted) break;
    }
    if (stationarity < 1e-8 && (!best || f < best.solver.objective))
      best = {
        weights: w,
        solver: {
          name: "projected-gradient-armijo-multistart",
          version: "1",
          iterations,
          objective: f,
          stationarity,
          converged: true,
          initialization: `fixed start ${si}`,
          starts: starts.length,
          tolerance: 1e-8,
          configuration: {
            maxIterationsPerStart: 20000,
            maxBacktracks: 70,
            initialStep: 1,
            maximumStep: 10,
            growth: 1.3,
            backtrackFactor: 0.5,
            armijo: 1e-4,
            objectiveSlack: 1e-16,
            projectionBisections: 100,
            starts:
              "projected raw, projected equal, projected unit vectors in asset order",
          },
        },
      };
  }
  requireThat(
    best,
    "ERC_NO_CONVERGENCE",
    "constrained first-order residual failed",
  );
  return { ...best, active: activeConstraints(best.weights, p) };
}
