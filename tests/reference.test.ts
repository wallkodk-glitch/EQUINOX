import { it, expect } from "vitest";
import reference from "../reference/reference.json";
import { erc, constrainedTarget } from "../src/optimization/targets";
import { allocate } from "../src/execution/allocator";
it("production constrained ERC agrees with independent SciPy + active-face KKT reference", () => {
  const f = reference.erc[1],
    s = f.annual_covariance;
  const out = constrainedTarget("erc", s, erc(s).weights, {
    lower: f.lower_bounds!,
    upper: f.upper_bounds!,
    cryptoCap: f.crypto_cap!,
  });
  out.weights.forEach((w, i) => expect(w).toBeCloseTo(f.weights[i], 6));
  expect(out.solver.objective).toBeCloseTo(f.objective, 10);
});
it("all independent Python buy fixtures agree", () => {
  for (const f of reference.buy_only) {
    const actual = allocate(
      f.current_values_dkk,
      f.cash_dkk,
      f.normalized_target,
    );
    actual.forEach((x, i) => expect(x).toBeCloseTo(f.buys_dkk[i], 6));
  }
  const b = allocate(
    [2000, 2000, 3000, 1800, 1200],
    2500,
    [0.26222622, 0.22582258, 0.20692069, 0.17811781, 0.12691269].map(
      (x) => x / 0.99999999,
    ),
  );
  [
    1174.4549454945502, 719.4094409440943, 0, 323.09980998099786,
    283.0358035803579,
  ].forEach((x, i) => expect(b[i]).toBeCloseTo(x, 7));
});
