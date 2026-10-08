import { version } from "../../package.json";
import type { AppState } from "../persistence/schema";
import type { SealedSnapshot } from "../snapshots/integrity";

// UI release identity is separate from the frozen market-data and engine versions.
export const UI_VERSION = version;
export const modelLabels = {
  equal: "Equal Weight",
  inverse: "Inverse Volatility",
  erc: "Equal Risk Contribution",
} as const;

/** Shared symmetric display scale, in percentage points. No allocation is changed. */
export function railDomain(
  current: readonly number[] | null,
  target: readonly number[],
  projected: readonly number[] | null,
): number {
  let largest = 0;
  for (const weights of [current, projected]) {
    weights?.forEach((weight, i) => {
      largest = Math.max(largest, Math.abs(weight - target[i]) * 100);
    });
  }
  return Math.max(5, Math.ceil(largest / 5) * 5);
}

export function railPosition(weight: number, target: number, domain: number): number {
  return 160 + ((weight - target) * 100 / domain) * 144;
}

/** Mirrors the existing manual quote display contract; this never admits engine input. */
export function valuationPresentation(holdings: AppState["holdings"], now: number) {
  const missing = holdings.some(h => h.units > 0 && h.priceDKK <= 0);
  const stamps = holdings.map(h => Date.parse(h.priceAsOf));
  const incomplete = holdings.some(h => h.priceDKK <= 0 || !h.priceAsOf);
  const stale = !incomplete && stamps.some(stamp => stamp > now || now - stamp > 24 * 3600e3);
  return {
    value: missing ? null : holdings.reduce((total, h) => total + h.units * h.priceDKK, 0),
    cost: holdings.reduce((total, h) => total + h.costBasisDKK, 0),
    state: incomplete ? "unconfirmed" as const : stale ? "stale" as const : "confirmed" as const,
    asOf: incomplete ? null : new Date(Math.min(...stamps)).toISOString(),
  };
}

export function riskSource(sealed: SealedSnapshot | null): string {
  const dataset = sealed?.snapshot.input.dataset;
  return !dataset ? "Ingen risikohistorik" : dataset.classification === "synthetic-demo"
    ? "Syntetiske demodata" : "Importerede risikodata";
}

export function fxContractLabel(schemaVersion: number | undefined): string {
  return schemaVersion === 2
    ? "Retrospektiv date-only FX · seneste observationDate strengt før sessionens dato i København · højst 6 kalenderdage. acquiredAt er hentetid; ingen historisk publication timestamp."
    : "Timestampbaseret FX · senest dokumenterede offentliggørelse før US-close · højst 120 timer gammel.";
}
