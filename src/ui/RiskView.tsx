import { useState, type CSSProperties } from "react";
import { ASSETS } from "../domain/core";
import type { SealedSnapshot } from "../snapshots/integrity";
import { percent, time, amount } from "./format";
import { Glyph } from "./Glyph";
import { riskSource } from "./presentation";
import { StateLegend } from "./BalanceRail";

export function RiskSummary({ sealed, sameInput, onOpen }: { sealed: SealedSnapshot | null; sameInput: boolean; onOpen: () => void }) {
  const risk = sealed?.snapshot.output.risk;
  return <section className="risk-summary" aria-labelledby="risk-summary-title">
    <div className="section-heading"><div><span className="eyebrow">RISK · DKK</span><h2 id="risk-summary-title">Porteføljerisiko</h2></div><button className="icon-button" type="button" aria-label="Åbn Risk" onClick={onOpen}><Glyph name="arrow" /></button></div>
    <div className="three-metrics">
      {([['Current', risk?.current], ['Target', risk?.target], ['Projected', risk?.projected]] as const).map(([label, value]) => <div key={label}><span>{label}</span><strong>{percent(value?.volatility)}</strong></div>)}
    </div>
    <p className="small">Annualized volatilitet · {risk ? "252 × sample covariance" : "ingen beregnet risikohistorik"}</p>
    {sealed && <><p className="micro">{riskSource(sealed)} · historisk snapshot {time(sealed.snapshot.timestamp)}</p>{!sameInput && <p className="small snapshot-changed">Input ændret · risiko fra den viste beregning</p>}</>}
  </section>;
}

export function CorrelationMatrix({ matrix }: { matrix: readonly (readonly number[])[] | null }) {
  return <section className="correlation-section">
    <div className="section-heading"><div><span className="eyebrow">DEPENDENCE</span><h2>Korrelation</h2></div><span className="micro">−1 til +1</span></div>
    {matrix ? <>
      <div className="matrix-scroll" role="region" aria-label="Korrelationsmatrix" tabIndex={0}>
        <table className="correlation-table"><caption className="sr-only">Korrelation mellem aktivernes DKK-returns. Tallene er afrundet til to decimaler.</caption><thead><tr><th scope="col" aria-label="Aktiv" />{ASSETS.map(asset => <th scope="col" key={asset}>{asset}</th>)}</tr></thead><tbody>
          {matrix.map((row, i) => <tr key={ASSETS[i]}><th scope="row">{ASSETS[i]}</th>{row.map((value, j) => <td key={ASSETS[j]} style={{ "--correlation-opacity": Math.abs(value) * .7, "--correlation-rgb": value < 0 ? "91,82,109" : "31,105,102" } as CSSProperties}><span>{amount(value, 2)}</span></td>)}</tr>)}
        </tbody></table>
      </div>
      <div className="correlation-key" aria-hidden="true"><span>−1</span><i /><span>0</span><i /><span>+1</span></div>
      <p className="small">Synchronized daily DKK-returns fra dette snapshot. Farven angiver relation, ikke gevinst eller tab.</p>
    </> : <p className="small">Korrelation er ikke defineret for dette snapshot.</p>}
  </section>;
}

export function RiskView({ sealed, onDetails, onAllocate, sameInput }: {
  sealed: SealedSnapshot | null; onDetails: () => void; onAllocate: () => void; sameInput: boolean;
}) {
  const [selected, setSelected] = useState<"current" | "target" | "projected">("projected");
  const risk = sealed?.snapshot.output.risk;
  const selectedRisk = risk?.[selected];
  const shares = selectedRisk?.shares;
  const signed = shares?.some(share => share < 0) ?? false;
  const domain = Math.max(1, ...shares?.map(Math.abs) ?? []);
  return <>
    <div className="section-title"><span className="eyebrow">RISK · INSTRUMENT</span><h1 data-page-title tabIndex={-1}>Risk</h1><p>Risiko fra en reproducerbar beregning.</p></div>
    {!sealed || !risk ? <section className="empty"><Glyph name="balance" /><h2>{sealed ? "Risikohistorik mangler" : "Ingen beregnet risiko"}</h2><p>{sealed ? "Denne beregning indeholder ingen risikohistorik. Equal Weight kan beregnes uden den." : "Beregn en fordeling med historik for at se volatilitet, risikobidrag og korrelation."}</p><button type="button" onClick={onAllocate}>Åbn Allocate</button>{sealed && <button className="text-button" type="button" onClick={onDetails}>Calculation Details</button>}</section> : <>
      <div className="snapshot-context"><span>{riskSource(sealed)}</span><span>{time(sealed.snapshot.timestamp)}</span>{!sameInput && <strong>Input ændret · historisk beregning</strong>}</div>
      <StateLegend />
      <div className="risk-state-control" role="group" aria-label="Vælg risikofordeling">
        {([['current', 'Current'], ['target', 'Target'], ['projected', 'Projected']] as const).map(([state, label]) => <button type="button" aria-pressed={selected === state} onClick={() => setSelected(state)} key={state}>{label}</button>)}
      </div>
      <section className="risk-hero" aria-label={`${selected} volatilitet`}><span className="eyebrow">ANNUALIZED · DKK</span><div className="hero-metric">{percent(selectedRisk?.volatility)}</div><p>{selected === "target" ? "Constrained Target" : selected === "projected" ? "Projected · efter købsplan" : "Current · før købsplan"}</p></section>
      <section className="risk-contribution"><div className="section-heading"><div><span className="eyebrow">RC / VOLATILITY</span><h2>Risikobidrag</h2></div><span className="micro">RCShare</span></div>
        {shares ? <div className="contribution-rows">{ASSETS.map((asset, i) => {
          const origin = signed ? 140 : 8;
          const width = shares[i] / domain * (signed ? 128 : 264);
          return <div className="contribution-row" key={asset}><strong>{asset}</strong><svg viewBox="0 0 280 28" aria-hidden="true"><path className="contribution-axis" d="M8 14h264" /><path className="contribution-zero" d={`M${origin} 6v16`} /><rect className={`contribution-bar ${selected}`} x={width < 0 ? origin + width : origin} y="10" width={Math.abs(width)} height="8" rx="1" /></svg><span>{percent(shares[i])}</span></div>;
        })}</div> : <p className="small">Risikobidrag er ikke defineret for denne tilstand.</p>}
        <p className="small">Andel af porteføljens volatilitet. Negative bidrag bevares med fortegn og betyder risikoreduktion.</p>
      </section>
      <section className="asset-volatility"><div className="section-heading"><h2>Aktivernes volatilitet</h2><span className="micro">Annualized · DKK</span></div><div className="data-rows">{ASSETS.map((asset, i) => <div key={asset}><span>{asset}</span><strong>{percent(risk.volatility[i])}</strong></div>)}</div></section>
      <CorrelationMatrix matrix={risk.correlation} />
      <section className="proof-link"><div><h2>Calculation Details</h2><p className="small">Kilde, vindue, full precision og validering.</p></div><button className="icon-button" type="button" aria-label="Åbn Calculation Details" onClick={onDetails}><Glyph name="arrow" /></button></section>
    </>}
  </>;
}
