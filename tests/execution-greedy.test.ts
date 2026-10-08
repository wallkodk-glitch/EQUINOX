import { it, expect } from "vitest";
import { allocate, execute } from "../src/execution/allocator";
// Intentionally simple one-at-a-time reference, independent of production batching.
function naive(
  v: number[],
  cash: number,
  target: number[],
  price: number[],
  increments: number[],
  minimum: number[],
) {
  const b = allocate(v, cash, target),
    cost = price.map((p, i) => p * increments[i]);
  const min = minimum.map((m, i) =>
    Math.max(1, Math.ceil(m / cost[i] - 1e-10)),
  );
  const k = b.map((x, i) => {
    const q = Math.floor(x / cost[i] + 1e-10);
    return q < min[i] ? 0 : q;
  });
  let spent = k.reduce((s, x, i) => s + x * cost[i], 0);
  for (let n = 0; n < 10000; n++) {
    let best = -1,
      gain = -Infinity,
      jump = 0;
    for (let i = 0; i < k.length; i++) {
      const j = k[i] ? 1 : min[i],
        extra = j * cost[i];
      if (spent + extra > cash + 1e-9) continue;
      const gap =
          target[i] * (v.reduce((s, x) => s + x, 0) + cash) -
          v[i] -
          k[i] * cost[i],
        g = 2 * gap * extra - extra * extra;
      if (g > gain + 1e-10) {
        gain = g;
        best = i;
        jump = j;
      }
    }
    if (best < 0) return k;
    k[best] += jump;
    spent += jump * cost[best];
  }
  throw new Error("test reference did not finish");
}
it("batched execution matches literal greedy across 120 deterministic bounded fixtures", () => {
  for (let seed = 1; seed <= 120; seed++) {
    const v = [seed % 9, seed % 7, seed % 5],
      cash = 20 + (seed % 23),
      t = [0.2, 0.3, 0.5],
      p = [0.25 * (1 + (seed % 3)), 0.5 * (1 + (seed % 4)), 1.25],
      inc = [1, 0.5, 0.2],
      min = [seed % 4, seed % 2, 0];
    const e = execute(
      v,
      cash,
      t,
      allocate(v, cash, t),
      p,
      inc.map((increment, i) => ({ increment, minimumDKK: min[i] })),
    );
    expect(e.orders.map((o) => Number(o.increments))).toEqual(
      naive(v, cash, t, p, inc, min),
    );
  }
});
