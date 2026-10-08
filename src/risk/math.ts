import {
  dot,
  mv,
  requireThat,
  sum,
  vector,
  weights,
  type Matrix,
} from "../domain/core";
export function toDKK(levels: number[], fx: number[]): number[] {
  vector(levels);
  vector(fx, levels.length);
  requireThat(
    [...levels, ...fx].every((x) => x > 0),
    "FX_DATA_MISSING",
  );
  return levels.map((x, i) => x * fx[i]);
}
export function simpleReturns(levels: number[]): number[] {
  vector(levels);
  requireThat(
    levels.length >= 2 && levels.every((x) => x > 0),
    "INVALID_LEVELS",
  );
  return levels.slice(1).map((x, i) => x / levels[i] - 1);
}
export function covariance(returns: Matrix, annualization = 252): Matrix {
  requireThat(
    returns.length >= 2 && Number.isFinite(annualization) && annualization > 0,
    "INSUFFICIENT_HISTORY",
  );
  const n = returns[0].length;
  returns.forEach((r) => vector(r, n));
  const mean = returns[0].map(
    (_, i) => sum(returns.map((r) => r[i])) / returns.length,
  );
  return mean.map((_, i) =>
    mean.map(
      (_, j) =>
        (annualization *
          sum(returns.map((r) => (r[i] - mean[i]) * (r[j] - mean[j])))) /
        (returns.length - 1),
    ),
  );
}
function eigenSymmetric(input: Matrix) {
  const n = input.length,
    a = input.map((r) => [...r]),
    q = input.map((_, i) => input.map((_, j) => (i === j ? 1 : 0))) as Matrix;
  const scale = Math.max(...a.flat().map(Math.abs));
  let iterations = 0;
  for (; iterations < 200 * n * n; iterations++) {
    let p = 0,
      r = n > 1 ? 1 : 0,
      largest = 0;
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++)
        if (Math.abs(a[i][j]) > largest) {
          largest = Math.abs(a[i][j]);
          p = i;
          r = j;
        }
    if (largest <= Math.max(1e-30, scale * 1e-15)) break;
    const angle = 0.5 * Math.atan2(2 * a[p][r], a[r][r] - a[p][p]),
      c = Math.cos(angle),
      s = Math.sin(angle),
      app = a[p][p],
      arr = a[r][r],
      apr = a[p][r];
    for (let k = 0; k < n; k++)
      if (k !== p && k !== r) {
        const akp = a[k][p],
          akr = a[k][r];
        a[k][p] = a[p][k] = c * akp - s * akr;
        a[k][r] = a[r][k] = s * akp + c * akr;
      }
    a[p][p] = c * c * app - 2 * s * c * apr + s * s * arr;
    a[r][r] = s * s * app + 2 * s * c * apr + c * c * arr;
    a[p][r] = a[r][p] = 0;
    for (let k = 0; k < n; k++) {
      const kp = q[k][p],
        kr = q[k][r];
      q[k][p] = c * kp - s * kr;
      q[k][r] = s * kp + c * kr;
    }
  }
  requireThat(iterations < 200 * n * n, "COVARIANCE_NUMERICALLY_UNSTABLE");
  return { values: a.map((row, i) => row[i]), vectors: q };
}
export function diagnose(input: Matrix) {
  const n = input.length;
  requireThat(n > 0, "INVALID_COVARIANCE");
  input.forEach((r) => vector(r, n));
  const scale = Math.max(1, ...input.flat().map(Math.abs));
  const symmetryError = Math.max(
    ...input.flatMap((r, i) => r.map((v, j) => Math.abs(v - input[j][i]))),
  );
  requireThat(symmetryError <= 1e-10 * scale, "COVARIANCE_ASYMMETRIC");
  const symmetric = input.map((r, i) => r.map((v, j) => (v + input[j][i]) / 2));
  const e = eigenSymmetric(symmetric),
    max = Math.max(...e.values),
    min = Math.min(...e.values);
  requireThat(min >= -1e-10 * Math.max(1, max), "COVARIANCE_NOT_PSD");
  const repaired = min < 0;
  const matrix = repaired
    ? symmetric.map((r, i) =>
        r.map((_, j) =>
          sum(
            e.values.map(
              (l, k) => e.vectors[i][k] * Math.max(0, l) * e.vectors[j][k],
            ),
          ),
        ),
      )
    : symmetric;
  const condition = min > 0 ? max / min : null;
  const stable = condition !== null && condition <= 1e12 && max > 0;
  return {
    raw: input.map((r) => [...r]),
    matrix,
    eigenvalues: [...e.values].sort((a, b) => a - b),
    minEigenvalue: min,
    maxEigenvalue: max,
    condition,
    stable,
    repaired,
    symmetryError,
    repair: repaired ? "EIGENVALUE_CLAMP_TO_ZERO" : "NONE",
    conditionLimit: 1e12,
  };
}
export function correlation(s: Matrix): Matrix {
  s.forEach((r) => vector(r, s.length));
  const vol = s.map((r, i) => Math.sqrt(r[i]));
  requireThat(
    vol.every((x) => x > 1e-12),
    "ZERO_OR_NEAR_ZERO_VARIANCE",
  );
  return s.map((r, i) => r.map((x, j) => x / (vol[i] * vol[j])));
}
export function risk(w: number[], s: Matrix) {
  weights(w, s.length);
  s.forEach((r) => vector(r, w.length));
  const sw = mv(s, w),
    variance = dot(w, sw);
  requireThat(
    Number.isFinite(variance) && variance > 1e-24,
    "ZERO_PORTFOLIO_RISK",
  );
  const volatility = Math.sqrt(variance),
    mrc = sw.map((x) => x / volatility),
    rc = w.map((x, i) => x * mrc[i]),
    shares = rc.map((x) => x / volatility);
  requireThat(
    Math.abs(sum(rc) - volatility) <= 1e-10 * Math.max(1, volatility) &&
      Math.abs(sum(shares) - 1) <= 1e-9,
    "RISK_INVARIANT_FAILED",
  );
  return { volatility, mrc, rc, shares };
}
