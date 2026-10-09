import type { ReactNode } from "react";
import { ASSETS, NAMES } from "../domain/core";
import type { AppState } from "../persistence/schema";
import type { SealedSnapshot } from "../snapshots/integrity";
import { money, moneyNumber, signedMoney, amount, time } from "./format";
import { valuationPresentation, modelLabels } from "./presentation";
import { Glyph } from "./Glyph";
import { BuyPlan } from "./BuyPlan";
import { RiskSummary } from "./RiskView";

export function Overview({ state, sealed, sameInput, isDemo, online, clock, capitalForm, history, onPortfolio, onRisk, onDetails, onSnapshot, onDemo }: {
  state: AppState; sealed: SealedSnapshot | null; sameInput: boolean; isDemo: boolean; online: boolean; clock: number;
  capitalForm: ReactNode; history: SealedSnapshot[]; onPortfolio: () => void; onRisk: () => void; onDetails: () => void;
  onSnapshot: (sealed: SealedSnapshot) => void; onDemo: () => void;
}) {
  const valuation = valuationPresentation(state.holdings, Math.max(clock, Date.now()));
  const freshness = isDemo ? "Syntetisk demo" : !online ? "Offline · manuelle priser" : valuation.state === "confirmed" ? "Manuelle priser · bekræftet" : valuation.state === "stale" ? "Priser udløbet · bekræft igen" : "Priser ikke bekræftet";
  return <>
    <div className="overview-heading"><h1 data-page-title tabIndex={-1}>Overview</h1><span className={`freshness ${!online || valuation.state === "stale" ? "attention" : ""}`}>{freshness}</span></div>
    <section className="portfolio-hero" aria-labelledby="portfolio-value-title">
      <div className="hero-heading"><span className="eyebrow" id="portfolio-value-title">PORTEFØLJEVÆRDI · DKK</span><button type="button" className="icon-button" aria-label="Redigér portefølje" onClick={onPortfolio}><Glyph name="arrow" /></button></div>
      <div className="display-number">{valuation.value === null ? "—" : moneyNumber(valuation.value)}</div>
      <p className="hero-asof">{isDemo ? "Isoleret demo · ingen gemte ændringer" : valuation.asOf ? `Ældste prisbekræftelse · ${time(valuation.asOf)}` : "Indtast og bekræft alle fem DKK-priser"}</p>
      <div className="equilibrium-axis" aria-hidden="true"><i /></div>
      <div className="hero-secondary"><div><span>Cost basis</span><strong>{money(valuation.cost)}</strong></div><div><span>Urealiseret P/L</span><strong>{valuation.value === null ? "—" : signedMoney(valuation.value - valuation.cost)}</strong></div></div>
      <p className="micro">Manuel værdi. Providerreferencer og risikohistorik opdaterer ikke disse priser.</p>
    </section>
    <div className="section-heading capital-heading"><div><span className="eyebrow">NEXT ALLOCATION</span><h2>Ny kapital</h2></div></div>
    {capitalForm}
    {sealed ? <BuyPlan sealed={sealed} sameInput={sameInput} isDemo={isDemo} onDetails={onDetails} /> : <section className="empty initial-empty"><Glyph name="balance" /><div><h2>En plan begynder her</h2><p>Indtast beholdninger og aktuelle DKK-priser. Beregn derefter fordelingen af din nye kapital.</p></div><button type="button" onClick={onPortfolio}>Indtast portefølje</button>{!isDemo && <button type="button" className="text-button" onClick={onDemo}>Prøv med demodata</button>}</section>}
    <section className="holdings-preview"><div className="section-heading"><h2>Beholdninger</h2><button className="text-button" type="button" onClick={onPortfolio}>Redigér <Glyph name="arrow" /></button></div><div className="holding-preview-rows">{state.holdings.map((h, i) => <div key={ASSETS[i]}><div><strong>{h.symbol}</strong><span>{NAMES[i]}</span></div><div><strong>{h.units > 0 && h.priceDKK <= 0 ? "—" : money(h.units * h.priceDKK)}</strong><span>{amount(h.units)} stk.</span></div></div>)}</div></section>
    <RiskSummary sealed={sealed} sameInput={sameInput} onOpen={onRisk} />
    <section className="snapshot-history"><div className="section-heading"><div><span className="eyebrow">IMMUTABLE HISTORY</span><h2>Snapshots</h2></div><span className="micro">{history.length} gemt lokalt</span></div>{history.length ? history.slice(0, 3).map(item => <button type="button" className="history-row" key={item.id} onClick={() => onSnapshot(item)}><span>{time(item.snapshot.timestamp)}<small>{modelLabels[item.snapshot.input.model]}</small></span><span>{money(item.snapshot.input.capital)}<Glyph name="arrow" /></span></button>) : <p className="small">Gemte beregninger vises her. Demo gemmes ikke.</p>}</section>
  </>;
}
