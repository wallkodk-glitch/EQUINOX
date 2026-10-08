import { requireThat, sum, vector, weights } from "../domain/core";
export interface ExecutionRule {
  increment: number;
  minimumDKK: number;
}
export function allocate(
  v: number[],
  capital: number,
  target: number[],
): number[];
export function allocate(
  v: number[],
  capital: number | number[],
  target: number[],
): number[] {
  vector(v, v.length, true);
  weights(target, v.length);
  requireThat(
    typeof capital === "number" &&
      Number.isFinite(capital) &&
      capital >= 0 &&
      capital <= 1e12,
    "INVALID_CAPITAL",
  );
  const total = sum(v) + capital;
  requireThat(Number.isFinite(total) && total > 0, "NO_CAPITAL");
  if (capital === 0) return v.map(() => 0);
  const gap = v.map((x, i) => target[i] * total - x),
    sorted = [...gap].sort((a, b) => b - a);
  let accum = 0,
    theta = 0;
  for (let i = 0; i < sorted.length; i++) {
    accum += sorted[i];
    const t = (accum - capital) / (i + 1);
    if (i === sorted.length - 1 || sorted[i + 1] <= t) {
      theta = t;
      break;
    }
  }
  const b = gap.map((x) => Math.max(0, x - theta));
  const diff = capital - sum(b),
    last = b.reduce((last, x, i) => (x > 0 ? i : last), -1);
  if (last >= 0) b[last] += diff;
  requireThat(
    b.every((x) => Number.isFinite(x) && x >= 0) &&
      Math.abs(sum(b) - capital) <= 1e-7 * Math.max(1, capital),
    "BUY_OPTIMIZATION_FAILED",
  );
  return b;
}
export function deviation(w: number[], target: number[]) {
  vector(w, target.length);
  weights(target);
  const drift = w.map((x, i) => x - target[i]);
  return {
    drift,
    l1: sum(drift.map(Math.abs)),
    l2: Math.sqrt(sum(drift.map((x) => x * x))),
  };
}
const SCALE = 100000000n;
function decimal(x: number): bigint {
  requireThat(
    Number.isFinite(x) && x >= 0 && x <= 1e12,
    "INVALID_EXECUTION_VALUE",
  );
  const fixed = x.toFixed(8);
  requireThat(
    Math.abs(Number(fixed) - x) <= 1e-9,
    "UNSUPPORTED_EXECUTION_PRECISION",
  );
  return BigInt(fixed.replace(".", ""));
}
const ceilDiv = (a: bigint, b: bigint) => (a + b - 1n) / b;
// Eight decimal places in both price and quantity give an exact common
// 10^-16 DKK cost lattice. Never round each increment into a phantom fee.
const MONEY_SCALE = SCALE * SCALE;
const amount = (x: bigint) => Number(x) / Number(MONEY_SCALE);
export function execute(
  v: number[],
  capital: number,
  target: number[],
  continuous: number[],
  prices: number[],
  rules: ExecutionRule[],
) {
  vector(v, v.length, true);
  weights(target, v.length);
  vector(continuous, v.length, true);
  vector(prices, v.length);
  requireThat(
    rules.length === v.length && prices.every((x) => x > 0),
    "INVALID_EXECUTION_RULE",
  );
  requireThat(
    Math.abs(sum(continuous) - capital) <= 1e-6 * Math.max(1, capital),
    "BUY_OPTIMIZATION_FAILED",
  );
  const cash = decimal(capital) * SCALE,
    den = sum(v) + capital;
  requireThat(den > 0, "NO_CAPITAL");
  const meta = rules.map((r, i) => {
    requireThat(
      r.increment > 0 && r.increment <= 1e12 && r.minimumDKK >= 0,
      "INVALID_EXECUTION_RULE",
    );
    const increment = decimal(r.increment),
      price = decimal(prices[i]);
    requireThat(increment > 0n && price > 0n, "INVALID_EXECUTION_RULE");
    return {
      increment,
      price,
      unit: increment * price,
      minimum: decimal(r.minimumDKK),
    };
  });
  const cost = (i: number, k: bigint) => k * meta[i].unit;
  const minimum = meta.map((m) => {
    const k = ceilDiv(m.minimum * SCALE, m.unit);
    return k > 1n ? k : 1n;
  });
  const counts = continuous.map((b, i) => {
    const budget = BigInt(Math.floor(b * 1e8));
    let k = (budget * SCALE) / meta[i].unit;
    if (k < minimum[i]) k = 0n;
    return k;
  });
  let spent = counts.reduce((s, k, i) => s + cost(i, k), 0n);
  requireThat(spent <= cash, "EXECUTION_RECONCILIATION_FAILED");
  let iterations = 0;
  for (; iterations < 100000; iterations++) {
    const residual = cash - spent;
    let best = -1,
      bestGain = -Infinity,
      runner = -Infinity,
      bestJump = 1n;
    const candidates: {
      i: number;
      gain: number;
      step: number;
      jump: bigint;
      cost: bigint;
    }[] = [];
    for (let i = 0; i < v.length; i++) {
      const jump = counts[i] === 0n ? minimum[i] : 1n,
        extra = cost(i, counts[i] + jump) - cost(i, counts[i]);
      if (extra > residual) continue;
      const x = v[i] + amount(cost(i, counts[i])),
        step = amount(extra),
        gap = target[i] * den - x,
        gain = 2 * gap * step - step * step;
      candidates.push({ i, gain, step, jump, cost: extra });
      if (gain > bestGain) {
        runner = bestGain;
        bestGain = gain;
        best = i;
        bestJump = jump;
      } else if (gain > runner) runner = gain;
    }
    if (best < 0) break;
    // Merge the decreasing arithmetic marginal-gain sequences in bulk. Leave
    // enough cash for EVERY current candidate, so affordability cannot alter
    // their ordering during this batch. Unopened minimum-order bundles are
    // barriers: do not skip a bundle that should precede the batch.
    const stable = candidates.filter((c) => c.jump === 1n);
    const largestCost = candidates.reduce(
      (m, c) => (c.cost > m ? c.cost : m),
      0n,
    );
    const batchBudget = residual - largestCost;
    if (stable.length > 1 && batchBudget > 0n) {
      const barrier = Math.max(
        -Infinity,
        ...candidates.filter((c) => c.jump > 1n).map((c) => c.gain),
      );
      let lo = Math.max(
        barrier,
        Math.min(
          ...stable.map(
            (c) => c.gain - 2 * c.step * c.step * Number(batchBudget / c.cost),
          ),
        ),
      );
      let hi = Math.max(...stable.map((c) => c.gain));
      let accepted = stable.map(() => 0n);
      for (let k = 0; k < 80 && lo < hi; k++) {
        const threshold = lo + (hi - lo) / 2;
        const take = stable.map((c) =>
          c.gain > threshold
            ? BigInt(
                Math.max(
                  0,
                  Math.ceil((c.gain - threshold) / (2 * c.step * c.step)),
                ),
              )
            : 0n,
        );
        const total = take.reduce((s, n, j) => s + n * stable[j].cost, 0n);
        if (total <= batchBudget) {
          hi = threshold;
          accepted = take;
        } else lo = threshold;
      }
      if (accepted.reduce((s, n) => s + n, 0n) > 1n) {
        accepted.forEach((n, j) => {
          counts[stable[j].i] += n;
          spent += n * stable[j].cost;
        });
        continue;
      }
    }
    // Exact money reconciliation uses integers. Bulk repeated increments only while
    // their decreasing quadratic gains provably stay ahead of the next candidate.
    let jump = bestJump;
    if (counts[best] > 0n) {
      const step = amount(meta[best].unit),
        affordable = (cash - spent) / meta[best].unit;
      const ahead = Number.isFinite(runner)
        ? BigInt(
            Math.max(1, Math.floor((bestGain - runner) / (2 * step * step))),
          )
        : affordable;
      jump = ahead < affordable ? ahead : affordable;
      if (jump < 1n) jump = 1n;
    }
    const extra = cost(best, counts[best] + jump) - cost(best, counts[best]);
    counts[best] += jump;
    spent += extra;
  }
  requireThat(iterations < 100000, "EXECUTION_ITERATION_LIMIT");
  const orders = counts.map((k, i) => {
    requireThat(
      k <= BigInt(Number.MAX_SAFE_INTEGER) &&
        k * meta[i].increment <= BigInt(Number.MAX_SAFE_INTEGER) * SCALE,
      "QUANTITY_LIMIT_EXCEEDED",
    );
    const quantity = Number(k * meta[i].increment) / 1e8,
      buy = amount(cost(i, k));
    requireThat(
      k === 0n || cost(i, k) >= meta[i].minimum * SCALE,
      "MINIMUM_ORDER_FAILED",
    );
    return {
      quantity,
      increments: k.toString(),
      buy,
      fee: 0,
      increment: rules[i].increment,
      minimumDKK: rules[i].minimumDKK,
    };
  });
  const buys = orders.map((o) => o.buy),
    projectedValues = v.map((x, i) => x + buys[i]),
    invested = sum(projectedValues),
    residual = amount(cash - spent),
    spend = amount(spent),
    projectedWeights =
      invested > 0 ? projectedValues.map((x) => x / invested) : null,
    wealthWeights = projectedValues.map((x) => x / den);
  requireThat(
    residual >= 0 && Math.abs(capital - spend - residual) <= 0.01,
    "EXECUTION_RECONCILIATION_FAILED",
  );
  return {
    orders,
    spend,
    fees: 0,
    feeModel: "ZERO_FEE_V1" as const,
    residual,
    projectedValues,
    projectedWeights,
    wealthWeights,
    invested,
    totalWealth: invested + residual,
    iterations,
    canonicalDeviation: deviation(wealthWeights, target),
    riskyDeviation: projectedWeights
      ? deviation(projectedWeights, target)
      : null,
    moneyPrecisionDKK: 1e-16,
  };
}
