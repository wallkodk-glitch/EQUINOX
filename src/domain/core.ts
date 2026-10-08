export const ASSETS = ["GOOGL", "ISRG", "TSM", "BTC", "ETH"] as const;
export const NAMES = [
  "Alphabet",
  "Intuitive Surgical",
  "TSMC ADR",
  "Bitcoin",
  "Ethereum",
];
export const VERSIONS = {
  engine: "1.0.1",
  risk: "SAMPLE_SIMPLE_DKK_252_V1",
  execution: "L2_ZERO_FEE_DISCRETE_V1",
  assetMaster: "EQUINOX_ASSETS_V1",
  snapshot: 1,
} as const;
export type Matrix = number[][];
export type Model = "equal" | "inverse" | "erc";
export function fail(code: string, detail = ""): never {
  throw new Error(detail ? `${code}: ${detail}` : code);
}
export function requireThat(
  condition: unknown,
  code: string,
  detail = "",
): asserts condition {
  if (!condition) fail(code, detail);
}
export const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);
export const dot = (a: number[], b: number[]) => sum(a.map((x, i) => x * b[i]));
export const mv = (a: Matrix, x: number[]) => a.map((row) => dot(row, x));
export function vector(x: number[], n = x.length, nonnegative = false): void {
  requireThat(
    n > 0 &&
      x.length === n &&
      x.every((v) => Number.isFinite(v) && (!nonnegative || v >= 0)),
    "INVALID_VECTOR",
  );
}
export function weights(x: number[], n = x.length): void {
  vector(x, n, true);
  requireThat(Math.abs(sum(x) - 1) <= 1e-10, "INVALID_WEIGHTS");
}
export function normalize(x: number[]): number[] {
  vector(x, x.length, true);
  requireThat(sum(x) > 0, "INVALID_WEIGHTS");
  return x.map((v) => v / sum(x));
}
export function deepFreeze<T>(x: T): Readonly<T> {
  if (x && typeof x === "object") {
    Object.values(x).forEach(deepFreeze);
    Object.freeze(x);
  }
  return x;
}
