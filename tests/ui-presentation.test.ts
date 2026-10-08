import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { initialState } from "../src/persistence/schema";
import { calculate, inputFromState, canonical } from "../src/snapshots/calculate";
import { seal, validateSeal, type SealedSnapshot } from "../src/snapshots/integrity";
import { demoDataset } from "../src/market-data/demo";
import { MARKET_DATA_MODEL_VERSION } from "../src/market-data/live/model";
import { VERSIONS } from "../src/domain/core";
import { BalanceRail } from "../src/ui/BalanceRail";
import { BuyPlan } from "../src/ui/BuyPlan";
import { RiskView, RiskSummary } from "../src/ui/RiskView";
import { Overview } from "../src/ui/Overview";
import { Details } from "../src/ui/Details";
import { MarketDataSettings } from "../src/ui/MarketDataSettings";
import { money, percent, signedMoney } from "../src/ui/format";
import { UI_VERSION, railDomain, railPosition, valuationPresentation, fxContractLabel } from "../src/ui/presentation";

const now = "2026-10-02T06:00:00.000Z";
const noop = () => {};
function stateWithQuotes() {
  const state = initialState();
  state.holdings.forEach(h => { h.priceDKK = 100; h.units = 1; h.priceAsOf = now; h.costBasisDKK = 100; });
  return state;
}
function overview(state = stateWithQuotes(), online = true) {
  return renderToStaticMarkup(createElement(Overview, { state, sealed: null, sameInput: false, isDemo: false, online, clock: Date.parse(now), capitalForm: null, history: [], onPortfolio: noop, onRisk: noop, onDetails: noop, onSnapshot: noop, onDemo: noop }));
}

describe("financial presentation and honest manual freshness", () => {
  it("separates app, engine and market-data versions", () => {
    expect(UI_VERSION).toBe("1.2.0");
    expect(VERSIONS.engine).toBe("1.0.1");
    expect(MARKET_DATA_MODEL_VERSION).toBe("1.1.2");
  });
  it("uses consistent two-decimal DKK and weights, signs and absent values", () => {
    expect(money(1234.5).replace(/\s/g, " ")).toBe("1.234,50 kr.");
    expect(percent(.2).replace(/\s/g, " ")).toBe("20,00 %");
    expect(percent(null)).toBe("—");
    expect(percent(0).replace(/\s/g, " ")).toBe("0,00 %");
    expect(signedMoney(-25)).toContain("-25,00");
    expect(signedMoney(25)).toContain("+25,00");
  });
  it("does not turn a missing held-asset price into a zero-valued portfolio", () => {
    const state = stateWithQuotes(); state.holdings[2].priceDKK = 0;
    expect(valuationPresentation(state.holdings, Date.parse(now)).value).toBeNull();
    expect(overview(state)).toContain('class="display-number">—');
    expect(overview(state)).toContain("Priser ikke bekræftet");
  });
  it("keeps the existing inclusive 24-hour quote boundary and marks later/future quotes stale", () => {
    const state = stateWithQuotes(); const stamp = Date.parse(now);
    expect(valuationPresentation(state.holdings, stamp + 24 * 3600e3).state).toBe("confirmed");
    expect(valuationPresentation(state.holdings, stamp + 24 * 3600e3 + 1).state).toBe("stale");
    expect(valuationPresentation(state.holdings, stamp - 1).state).toBe("stale");
  });
  it("an edited unconfirmed price is never labeled current or live", () => {
    const state = stateWithQuotes(); state.holdings[0].priceAsOf = "";
    expect(valuationPresentation(state.holdings, Date.parse(now)).state).toBe("unconfirmed");
    expect(overview(state)).toContain("Priser ikke bekræftet");
    expect(overview(state)).not.toContain(">LIVE<");
  });
  it("offline shows manual values with an explicit offline label", () => {
    const html = overview(stateWithQuotes(), false);
    expect(html).toContain("Offline · manuelle priser");
    expect(html).toContain("500,00");
    expect(html).toContain("Providerreferencer og risikohistorik opdaterer ikke disse priser");
  });
  it("a negative P/L has its financial sign without an error/danger state", () => {
    const state = stateWithQuotes(); state.holdings.forEach(h => { h.costBasisDKK = 200; });
    const html = overview(state);
    expect(html).toContain("-500,00");
    expect(html).not.toContain('class="danger"');
    expect(html).not.toContain('role="alert"');
  });
});

describe("Balance Rail semantics", () => {
  const target = [.2, .2, .2, .2, .2];
  it("has one symmetric scale and exact signed positions around Target", () => {
    expect(railDomain([.4, .1, .1, .2, .2], target, [.3, .15, .15, .2, .2])).toBe(20);
    expect(railPosition(.2, .2, 20)).toBe(160);
    expect(railPosition(0, .2, 20)).toBe(16);
    expect(railPosition(.4, .2, 20)).toBe(304);
  });
  it("uses a finite readable domain for equilibrium or absent portfolios", () => {
    expect(railDomain(null, target, null)).toBe(5);
    expect(railDomain(target, target, target)).toBe(5);
  });
  it("missing weights render no Current/Projected markers and have explicit missing labels", () => {
    const html = renderToStaticMarkup(createElement(BalanceRail, { current: null, target, projected: null }));
    expect(html).not.toContain('class="rail-current"');
    expect(html).not.toContain('class="rail-projected"');
    expect(html).toContain("Current —");
    expect(html).toContain("Projected —");
    expect(html).toContain("Target 20,00");
  });
  it("coincident values retain both marker shapes and all three direct labels", () => {
    const html = renderToStaticMarkup(createElement(BalanceRail, { current: target, target, projected: target }));
    expect((html.match(/class="rail-current"/g) ?? [])).toHaveLength(5);
    expect((html.match(/class="rail-projected"/g) ?? [])).toHaveLength(5);
    expect(html).toContain('cx="160"');
    expect(html).toContain('translate(160 28)');
    expect(html).toContain("Afstand til constrained Target");
  });
});

describe("sealed calculation rendering", () => {
  it("summary risk remains explicitly historical when editable portfolio input has changed", async () => {
    const state = stateWithQuotes(); state.dataset = demoDataset(now); state.model = "erc";
    const sealed = await seal(calculate(inputFromState(state, now)));
    const before = canonical(sealed);
    const html = renderToStaticMarkup(createElement(RiskSummary, { sealed, sameInput: false, onOpen: noop }));
    expect(html).toContain("historisk snapshot");
    expect(html).toContain("Input ændret · risiko fra den viste beregning");
    expect(html).toContain(percent(sealed.snapshot.output.risk!.projected!.volatility));
    expect(canonical(sealed)).toBe(before);
  });
  it("matrix details name their assets and rounding without assigning covariance units to correlation", () => {
    const fixtures = JSON.parse(readFileSync("validation/closure-final-snapshots.json", "utf8")) as Record<string, SealedSnapshot>;
    const html = renderToStaticMarkup(createElement(Details, { sealed: fixtures.erc }));
    expect(html).toContain('scope="col">Aktiv');
    expect(html).toContain("Correlation. Visning med seks decimaler");
    expect(html).not.toContain("DKK / 252");
  });
  it("an invalidated plan still displays its sealed capital/orders, with a recalculation notice", async () => {
    const sealed = await seal(calculate(inputFromState(stateWithQuotes(), now)));
    const html = renderToStaticMarkup(createElement(BuyPlan, { sealed, sameInput: false, isDemo: false, onDetails: noop }));
    expect(html).toContain("Input ændret · beregn igen");
    expect(html).toContain("2.500,00");
    expect((html.match(/500,00/g) ?? []).length).toBeGreaterThanOrEqual(5);
    expect(html).toContain("Restkontanter");
  });
  it("rendering every financial view cannot mutate a snapshot or its replay/hash", async () => {
    const state = stateWithQuotes(); state.model = "erc"; state.dataset = demoDataset(now);
    const sealed = await seal(calculate(inputFromState(state, now))), before = canonical(sealed);
    renderToStaticMarkup(createElement(BuyPlan, { sealed, sameInput: true, isDemo: true, onDetails: noop }));
    renderToStaticMarkup(createElement(RiskView, { sealed, sameInput: true, onDetails: noop, onAllocate: noop }));
    renderToStaticMarkup(createElement(Details, { sealed }));
    expect(canonical(sealed)).toBe(before);
    expect(await validateSeal(sealed)).toEqual(sealed);
  });
  it("risk absence is shown as unavailable rather than zero volatility", async () => {
    const sealed = await seal(calculate(inputFromState(stateWithQuotes(), now)));
    const html = renderToStaticMarkup(createElement(RiskView, { sealed, sameInput: true, onDetails: noop, onAllocate: noop }));
    expect(html).toContain("Risikohistorik mangler");
    expect(html).not.toContain('class="hero-metric">0');
  });
  it("signed risk contributions are not clipped or recolored as danger", async () => {
    const state = stateWithQuotes(); state.dataset = demoDataset(now); state.model = "erc";
    const sealed = structuredClone(await seal(calculate(inputFromState(state, now))));
    // Rendering stress input only: no claim that this deliberately changed seal is valid.
    sealed.snapshot.output.risk!.projected!.shares = [-.2, .3, .3, .3, .3];
    const html = renderToStaticMarkup(createElement(RiskView, { sealed, sameInput: false, onDetails: noop, onAllocate: noop }));
    expect(html).toContain("-20,00");
    expect(html).toContain('x="114.4"');
    expect(html).toContain("Input ændret · historisk beregning");
    expect(html).not.toContain('class="danger"');
  });
  it("legacy and date-only historical FX explanations remain distinct", () => {
    expect(fxContractLabel(1)).toContain("120 timer");
    expect(fxContractLabel(2)).toContain("strengt før");
    expect(fxContractLabel(2)).toContain("6 kalenderdage");
    expect(fxContractLabel(2)).not.toContain("120 timer");
    const fixtures = JSON.parse(readFileSync("validation/closure-final-snapshots.json", "utf8")) as Record<string, SealedSnapshot>;
    const html = renderToStaticMarkup(createElement(Details, { sealed: fixtures.equal }));
    expect(html).toContain("Retrospektiv date-only FX");
    expect(html).toContain("Canonical 1-minute session close");
    expect(html).toContain(fixtures.equal.sha256);
  });
  it("the original 1.0.0 snapshot still renders and retains its accepted hash", async () => {
    const legacy = JSON.parse(readFileSync("tests/legacy-snapshot.json", "utf8")) as SealedSnapshot;
    const verified = await validateSeal(legacy);
    const html = renderToStaticMarkup(createElement(Details, { sealed: verified }));
    expect(html).toContain("120 timer");
    expect(verified.sha256).toBe("9d114db13ee5dd700208cb1fe93f709521484b20b6bcf0ce2a6e1d1423d7f633");
    expect(html.includes("9d114db13ee5dd700208cb1fe93f709521484b20b6bcf0ce2a6e1d1423d7f633")).toBe(true);
  });
  it("Settings does not open a key sheet or expose an input before a user action", () => {
    const html = renderToStaticMarkup(createElement(MarketDataSettings, { online: true }));
    expect(html).not.toContain("<dialog");
    expect(html).not.toContain('type="password"');
    expect(html).toContain("Not configured");
    expect(html).toContain("Lokal browserlagring er ikke sikker secret storage");
    expect(html).toContain("Danmarks Nationalbank");
  });
});
