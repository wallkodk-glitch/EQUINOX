import { ASSETS, NAMES } from "../domain/core";
import type { SealedSnapshot } from "../snapshots/integrity";
import { BalanceRail } from "./BalanceRail";
import { money, amount, time } from "./format";
import { Glyph } from "./Glyph";
import { modelLabels } from "./presentation";

export function BuyPlan({ sealed, sameInput, isDemo, onDetails }: {
  sealed: SealedSnapshot; sameInput: boolean; isDemo: boolean; onDetails: () => void;
}) {
  const snapshot = sealed.snapshot, o = snapshot.output;
  return <>
    <section className="buy-plan" aria-labelledby="buy-plan-title">
      <div className="section-heading"><div><span className="eyebrow">BUY ONLY · DKK</span><h2 id="buy-plan-title">Din købsplan</h2></div><Glyph name="balance" /></div>
      <div className={`snapshot-status ${sameInput ? "" : "changed"}`}><span>{sameInput ? isDemo ? "Midlertidigt demo-snapshot" : "Snapshot gemt" : "Input ændret · beregn igen"}</span><span>{time(snapshot.timestamp)}</span></div>
      <p className="small">{modelLabels[snapshot.input.model]}{snapshot.input.dataset?.classification === "synthetic-demo" ? " · SYNTETISK DEMO" : ""}</p>
      <div className="buy-rows">
        {ASSETS.map((asset, i) => <article className="buy-row" key={asset}><div><strong>{asset}</strong><span>{NAMES[i]}</span></div><div><strong>{money(o.execution.orders[i].buy)}</strong><span>{amount(o.execution.orders[i].quantity)} stk.</span></div></article>)}
      </div>
      <dl className="plan-reconciliation">
        <div><dt>Ny kapital</dt><dd>{money(snapshot.input.capital)}</dd></div>
        <div><dt>Køb i alt</dt><dd>{money(o.execution.spend)}</dd></div>
        <div><dt>Fees</dt><dd>{money(o.execution.fees)}</dd></div>
        <div className="cash-row"><dt>Restkontanter</dt><dd>{money(o.execution.residual)}</dd></div>
      </dl>
      <div className="plan-wealth"><span>Samlet formue efter køb</span><strong>{money(o.execution.totalWealth)}</strong></div>
      <p className="micro">Investeret {money(o.execution.invested)} · før køb {money(o.portfolio.total)}. Planen udfører ingen handel.</p>
    </section>
    <BalanceRail current={o.portfolio.weights} target={o.constrainedTarget} projected={o.execution.projectedWeights} />
    <section className="target-distance"><div className="section-heading"><h2>Afstand til target</h2><button className="icon-button" type="button" aria-label="Åbn Calculation Details" onClick={onDetails}><Glyph name="arrow" /></button></div><div className="metrics"><div><span>L1 · efter køb</span><strong>{o.execution.riskyDeviation ? `${amount(o.execution.riskyDeviation.l1 * 100, 2)} pp` : "—"}</strong></div><div><span>L2 · efter køb</span><strong>{o.execution.riskyDeviation ? `${amount(o.execution.riskyDeviation.l2 * 100, 2)} pp` : "—"}</strong></div></div><p className="small">{o.targetReachable ? "Target kan nås kontinuerligt før quantity-regler." : "Eksisterende overvægt forhindrer præcis target med denne kapital uden salg."}</p><p className="micro">Baseret på investerede aktiver. Restkontanter indgår separat i execution-objectivet.</p></section>
  </>;
}
