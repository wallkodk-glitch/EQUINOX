import { version } from "../../package.json";
import type { AppState } from "../persistence/schema";
import type { SealedSnapshot } from "../snapshots/integrity";
import { safeError, type ErrorCode } from "../market-data/live/network";

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

const marketMessages: Record<ErrorCode, string> = {
  AUTH_FAILED: "Nøglen blev afvist. Erstat den og test forbindelsen igen.",
  ENTITLEMENT_DENIED: "Kontoen mangler adgang til de krævede data. Kontrollér providerens abonnement.",
  RATE_LIMITED: "Providerens request-grænse er nået. Vent mindst et minut og prøv igen.",
  PROVIDER_UNAVAILABLE: "Provideren er midlertidigt utilgængelig. Prøv igen senere.",
  NETWORK_OR_CORS: "Forbindelsen kunne ikke etableres. Kontrollér netværk; browseradgang kan være blokeret.",
  TIMEOUT: "Forespørgslen tog for lang tid. Kontrollér forbindelsen og prøv igen.",
  ABORTED: "Annulleret eller input ændret. Tidligere risikodata er bevaret.",
  MALFORMED_PAYLOAD: "Svaret kunne ikke læses. Ingen nye risikodata er accepteret.",
  SCHEMA_INVALID: "Svaret har et uventet dataformat. Ingen nye risikodata er accepteret.",
  MISSING_CREDENTIAL: "Tilslut Massive med en lokal nøgle for at hente risikohistorik.",
  INVALID_CREDENTIAL: "Nøglen har et ugyldigt format. Indtast den igen.",
  CREDENTIAL_STORAGE_UNAVAILABLE: "Browseren kunne ikke åbne lokal nøglelagring. Kontrollér browserens lagring.",
  UNSAFE_PROVIDER_URL: "Providerens adresse kunne ikke valideres. Forespørgslen er stoppet.",
  PAGINATION_INVALID: "Providerens historik er ikke komplet. Ingen nye risikodata er accepteret.",
  FUTURE_OBSERVATION: "Data indeholder en fremtidig observation. Kontrollér også enhedens ur.",
  DUPLICATE_OBSERVATION: "Data indeholder gentagne eller modstridende observationer. Opdateringen er stoppet.",
  FX_OBSERVATION_CONFLICT: "Valutakurser for samme dato er modstridende. Opdateringen er stoppet.",
  INVALID_FX: "USD/DKK-data kunne ikke valideres. Ingen nye risikodata er accepteret.",
  MISSING_OBSERVATION: "Historikken mangler en krævet observation. Tidligere risikodata er bevaret.",
  STALE_DATA: "Data er for gamle til den krævede policy. Prøv at hente igen.",
  CALENDAR_MISMATCH: "Observationerne matcher ikke den krævede US-session. Opdateringen er stoppet.",
  CACHE_UNAVAILABLE: "Market-cache kunne ikke åbnes eller gemmes. Finansielle data er ikke slettet.",
  CACHE_INVALID: "Market-cache kunne ikke valideres. Slet kun denne cache og hent data igen.",
  CORPORATE_ACTION_UNVERIFIED: "Corporate-action-evidens dækker ikke denne historik. Tidligere risikodata er bevaret; kræver verificeret udstederdokumentation.",
  RISK_INTEGRATION_BLOCKED: "Risikohistorikken bestod ikke alle datakrav. Tidligere risikodata er bevaret. Kontrollér historik og prøv igen.",
  MARKET_DATA_FAILED: "Markedsdata kunne ikke opdateres. Tidligere risikodata er bevaret. Prøv igen.",
  REQUEST_IN_PROGRESS: "En dataforespørgsel er allerede i gang. Vent eller annullér den først.",
};
export function marketErrorMessage(error: unknown): string {
  return marketMessages[safeError(error)];
}
