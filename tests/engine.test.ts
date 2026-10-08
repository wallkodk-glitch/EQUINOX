import { describe, it, expect } from "vitest";
import {
  covariance,
  diagnose,
  risk,
  correlation,
  simpleReturns,
  toDKK,
} from "../src/risk/math";
import {
  equalWeight,
  inverseVol,
  erc,
  constrainedTarget,
  defaultPolicy,
  projectPolicy,
  ercObjective,
} from "../src/optimization/targets";
import { allocate, execute, deviation } from "../src/execution/allocator";
import { portfolio } from "../src/portfolio/accounting";

const diag = [0.01, 0.04, 0.09, 0.16, 0.25].map((v, i, a) =>
  a.map((_, j) => (i === j ? v : 0)),
);
const close = (a: number[], b: number[], tol = 1e-8) => {
  expect(a.length).toBe(b.length);
  a.forEach((v, i) => expect(Math.abs(v - b[i])).toBeLessThanOrEqual(tol));
};
const rules = (step: number[], min = 0) =>
  step.map((increment) => ({ increment, minimumDKK: min }));
describe("independent mathematical fixtures", () => {
  it("FX-01 uses DKK simple returns", () => {
    const d = toDKK([100, 102, 101, 104], [6.8, 6.9, 6.85, 7]);
    close(d, [680, 703.8, 691.85, 728]);
    close(simpleReturns(d), [0.035, 691.85 / 703.8 - 1, 728 / 691.85 - 1]);
  });
  it("COV-01 ddof1 annualization and correlation", () => {
    const s = covariance(
      [
        [0.01, 0.02, 0],
        [-0.01, 0.01, 0.02],
        [0.02, -0.01, 0.01],
        [0, 0, -0.01],
      ],
      252,
    );
    s.forEach((r, i) =>
      close(
        r,
        [
          [0.042, -0.0168, -0.0084],
          [-0.0168, 0.042, 0],
          [-0.0084, 0, 0.042],
        ][i],
      ),
    );
    close(
      s.map((r, i) => Math.sqrt(r[i])),
      Array(3).fill(0.204939015319),
    );
    close(correlation(s)[0], [1, -0.4, -0.2]);
  });
  it("ERC-01 analytical diagonal result and Euler identities", () => {
    const inv = inverseVol(diag),
      e = erc(diag);
    close(e.weights, inv, 1e-7);
    close(
      e.weights,
      [
        0.43795620438, 0.21897810219, 0.14598540146, 0.1094890511,
        0.08759124088,
      ],
      1e-8,
    );
    const r = risk(e.weights, diag);
    close(r.shares, Array(5).fill(0.2), 1e-7);
    expect(r.rc.reduce((a, b) => a + b, 0)).toBeCloseTo(r.volatility, 12);
    expect(r.shares.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });
  it("market accounting never uses cost as value", () => {
    const p = portfolio([2, 3], [100, 200], [10, 20]);
    expect(p.total).toBe(800);
    expect(p.cost).toBe(30);
    expect(p.pnl).toBe(770);
    close(p.weights!, [0.25, 0.75]);
  });
  it("BUY-01 normalized exact simplex optimum and KKT", () => {
    const t = [0.26222622, 0.22582258, 0.20692069, 0.17811781, 0.12691269];
    const target = t.map((x) => x / t.reduce((a, b) => a + b, 0));
    const v = [2000, 2000, 3000, 1800, 1200],
      b = allocate(v, 2500, target);
    expect(b[2]).toBe(0);
    expect(b.reduce((a, x) => a + x, 0)).toBeCloseTo(2500, 9);
    const errors = b.map((x, i) => v[i] + x - 12500 * target[i]);
    [1, 3, 4].forEach((i) => expect(errors[i]).toBeCloseTo(errors[0], 8));
    expect(errors[2]).toBeGreaterThan(errors[0]);
  });
});
describe("model failures and constraints", () => {
  it("equal weight has no covariance dependency", () =>
    close(equalWeight(5), Array(5).fill(0.2)));
  it("zero variance fails explicitly", () =>
    expect(() =>
      inverseVol([
        [0, 0],
        [0, 1],
      ]),
    ).toThrow("ZERO_OR_NEAR_ZERO_VARIANCE"));
  it("constant returns retain zero covariance", () =>
    expect(
      covariance(
        [
          [1, 1],
          [1, 1],
          [1, 1],
        ],
        252,
      ),
    ).toEqual([
      [0, 0],
      [0, 0],
    ]));
  it("zero portfolio risk fails explicitly", () =>
    expect(() =>
      risk(
        [0.5, 0.5],
        [
          [0, 0],
          [0, 0],
        ],
      ),
    ).toThrow("ZERO_PORTFOLIO_RISK"));
  it("rejects nonfinite/asymmetric/material indefinite covariance", () => {
    expect(() =>
      diagnose([
        [1, NaN],
        [NaN, 1],
      ]),
    ).toThrow();
    expect(() =>
      diagnose([
        [1, 0.2],
        [0.4, 1],
      ]),
    ).toThrow("COVARIANCE_ASYMMETRIC");
    expect(() =>
      diagnose([
        [1, 2],
        [2, 1],
      ]),
    ).toThrow("COVARIANCE_NOT_PSD");
  });
  it("records tiny eigenvalue repair and singularity", () => {
    const d = diagnose([
      [1, 0],
      [0, -1e-12],
    ]);
    expect(d.repaired).toBe(true);
    expect(d.stable).toBe(false);
    expect(() =>
      erc([
        [1, 1],
        [1, 1],
      ]),
    ).toThrow("COVARIANCE_NUMERICALLY_UNSTABLE");
    expect(() =>
      erc([
        [1, 0],
        [0, 1e-14],
      ]),
    ).toThrow("COVARIANCE_NUMERICALLY_UNSTABLE");
  });
  it("rejects impossible lower upper and crypto constraints", () => {
    for (const p of [
      {
        lower: [0.3, 0.3, 0.3, 0.3, 0.3],
        upper: Array(5).fill(1),
        cryptoCap: 1,
      },
      { lower: Array(5).fill(0), upper: Array(5).fill(0.1), cryptoCap: 1 },
      { lower: [0, 0, 0, 0.2, 0.2], upper: Array(5).fill(1), cryptoCap: 0.1 },
    ])
      expect(() => projectPolicy(Array(5).fill(0.2), p)).toThrow(
        "INFEASIBLE_POLICY",
      );
  });
  it("constrained ERC honors cap and reports nonzero objective honestly", () => {
    const p = defaultPolicy(5);
    p.upper[0] = 0.25;
    p.cryptoCap = 0.15;
    const out = constrainedTarget("erc", diag, erc(diag).weights, p);
    expect(out.weights[0]).toBeLessThanOrEqual(0.250000001);
    expect(out.weights[3] + out.weights[4]).toBeLessThanOrEqual(0.150000001);
    expect(out.active.length).toBeGreaterThan(0);
    expect(ercObjective(out.weights, diag)).toBeGreaterThan(1e-5);
    expect(out.solver.stationarity).toBeLessThan(1e-7);
  });
  it("ERC is deterministic", () => expect(erc(diag)).toEqual(erc(diag)));
});
describe("buy-only and execution edges", () => {
  it.each([
    { v: [20, 30, 50], c: 0, t: [0.2, 0.3, 0.5], b: [0, 0, 0] },
    { v: [20, 30, 50], c: 100, t: [0.2, 0.3, 0.5], b: [20, 30, 50] },
    { v: [90, 9, 1], c: 10, t: [0.1, 0.2, 0.7], b: [0, 0, 10] },
    { v: [0, 0, 0], c: 1e-7, t: [0.2, 0.3, 0.5], b: [2e-8, 3e-8, 5e-8] },
  ])("solves fixture $v / $c", ({ v, c, t, b }) =>
    close(allocate(v, c, t), b, 1e-9),
  );
  it("no capital has explicit failure", () =>
    expect(() => allocate([0, 0], 0, [0.5, 0.5])).toThrow("NO_CAPITAL"));
  it("target and money input validation", () => {
    expect(() => allocate([1, 2], -1, [0.5, 0.5])).toThrow();
    expect(() => allocate([1, 2], 1, [0.5, 0.6])).toThrow();
  });
  it("whole shares obey cash and increments", () => {
    const v = [0, 0],
      t = [0.5, 0.5],
      c = 100,
      b = allocate(v, c, t);
    const e = execute(v, c, t, b, [30, 70], rules([1, 1]));
    expect(e.orders.every((o) => Number.isInteger(o.quantity))).toBe(true);
    expect(e.residual).toBeGreaterThanOrEqual(0);
    expect(e.spend + e.fees + e.residual).toBeCloseTo(c, 8);
    expect(e.fees).toBe(0);
  });
  it("minimum order is respected and residual is not redistributed into risky weights", () => {
    const e = execute(
      [0, 0],
      20,
      [0.5, 0.5],
      [10, 10],
      [10, 10],
      rules([1, 1], 30),
    );
    expect(e.spend).toBe(0);
    expect(e.residual).toBe(20);
    expect(e.projectedWeights).toBe(null);
  });
  it("fractional quantities remain feasible and zero fees explicit", () => {
    const e = execute(
      [20, 10],
      13,
      [0.5, 0.5],
      allocate([20, 10], 13, [0.5, 0.5]),
      [1.23456789, 9.87654321],
      rules([0.001, 0.0001]),
    );
    expect(e.orders[0].quantity / 0.001).toBeCloseTo(
      Math.round(e.orders[0].quantity / 0.001),
      7,
    );
    expect(e.residual).toBeGreaterThanOrEqual(0);
    expect(e.feeModel).toBe("ZERO_FEE_V1");
  });
  it("exact tie follows computational order", () => {
    const e = execute([0, 0], 1, [0.5, 0.5], [0.5, 0.5], [1, 1], rules([1, 1]));
    expect(e.orders[0].quantity).toBe(1);
    expect(e.orders[1].quantity).toBe(0);
  });
  it("tiny capital stays cash", () =>
    expect(execute([1], 0.001, [1], [0.001], [100], rules([1])).residual).toBe(
      0.001,
    ));
  it("L1/L2 diagnostic has no invented completion percentage", () =>
    expect(deviation([0.6, 0.4], [0.5, 0.5]).l1).toBeCloseTo(0.2, 12));
  it("full precision survives display formatting", () => {
    const w = inverseVol(diag);
    w.forEach((x) => (x * 100).toFixed(2));
    expect(w).toEqual(inverseVol(diag));
  });
  it("default crypto increments terminate with fractional DKK quotes and a normal budget", () => {
    const v = [0, 0, 0, 0, 0],
      t = [0.2, 0.2, 0.2, 0.2, 0.2],
      c = 2500,
      prices = [1400.23, 3200.45, 1600.67, 600000.23, 24000.47];
    const e = execute(
      v,
      c,
      t,
      allocate(v, c, t),
      prices,
      rules([1, 1, 1, 1e-8, 1e-8]),
    );
    expect(e.iterations).toBeLessThan(1000);
    expect(e.residual).toBeGreaterThanOrEqual(0);
    expect(e.spend + e.residual).toBeCloseTo(c, 8);
    e.orders.forEach((o, i) =>
      expect(o.buy).toBeCloseTo(o.quantity * prices[i], 8),
    );
  });
});
