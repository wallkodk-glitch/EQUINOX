import { ASSETS } from "../domain/core";
import { amount, percent } from "./format";
import { railDomain, railPosition } from "./presentation";

export function StateLegend() {
  return <div className="state-legend" aria-label="Markørforklaring">
    <span><i className="current-marker" />Current</span>
    <span><i className="target-marker" />Target</span>
    <span><i className="projected-marker" />Projected</span>
  </div>;
}

export function BalanceRail({ current, target, projected }: {
  current: readonly number[] | null;
  target: readonly number[];
  projected: readonly number[] | null;
}) {
  const domain = railDomain(current, target, projected);
  return <section className="balance-section" aria-labelledby="balance-title">
    <div className="section-heading"><div><span className="eyebrow">EQUILIBRIUM</span><h2 id="balance-title">Balance Rail</h2></div><span className="micro">±{amount(domain, 0)} pp</span></div>
    <p className="small">Afstand til constrained Target. Samme skala for alle aktiver.</p>
    <StateLegend />
    <div className="balance-scroll" role="region" aria-label="Balance Rail, aktivernes vægte" tabIndex={0}><div className="balance-canvas">
    <div className="balance-rows">
      {ASSETS.map((asset, i) => <div className="balance-row" key={asset}>
        <strong className="asset-symbol">{asset}</strong>
        <svg className="rail" viewBox="0 0 320 42" role="img" aria-label={`${asset}: Current ${percent(current?.[i])}, Target ${percent(target[i])}, Projected ${percent(projected?.[i])}`}>
          <path className="rail-line" d="M16 21h288" />
          <path className="rail-ticks" d="M16 18v6m72-5v4m72-15v26m72-15v4m72-5v6" />
          <path className="rail-target" d="M160 7v28" />
          {current && <circle className="rail-current" cx={railPosition(current[i], target[i], domain)} cy="15" r="4" />}
          {projected && <path className="rail-projected" d="M0-5 5 0 0 5-5 0Z" transform={`translate(${railPosition(projected[i], target[i], domain)} 28)`} />}
        </svg>
        <div className="rail-values"><span>{percent(current?.[i])}</span><span>{percent(target[i])}</span><span>{percent(projected?.[i])}</span></div>
      </div>)}
    </div>
    <div className="rail-scale"><span>−{amount(domain, 0)} pp</span><span>Target · 0</span><span>+{amount(domain, 0)} pp</span></div>
    </div></div>
    <p className="micro">Vægte i investerede aktiver. Restkontanter vises separat.</p>
  </section>;
}
