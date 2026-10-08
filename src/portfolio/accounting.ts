import { requireThat, sum, vector } from "../domain/core";
export function portfolio(
  units: number[],
  prices: number[],
  costBasis: number[],
) {
  vector(units, units.length, true);
  vector(prices, units.length);
  vector(costBasis, units.length, true);
  requireThat(
    prices.every((x) => x > 0),
    "INVALID_PRICE",
  );
  const values = units.map((x, i) => x * prices[i]);
  requireThat(
    values.every(Number.isFinite) && sum(values) <= 1e12,
    "PORTFOLIO_LIMIT_EXCEEDED",
  );
  const total = sum(values),
    cost = sum(costBasis);
  return {
    values,
    total,
    cost,
    pnl: total - cost,
    weights: total > 0 ? values.map((x) => x / total) : null,
  };
}
