import { ASSETS } from "../domain/core";
import type { SealedSnapshot } from "../snapshots/integrity";
import { amount, money, percent, time } from "./format";
import { fxContractLabel } from "./presentation";
function Matrix({ title, data }: { title: string; data: number[][] | null }) {
  return (
    <>
      <h4>{title}</h4>
      {data ? (
        <div className="table-wrap" role="region" tabIndex={0} aria-label={title}>
          <table>
            <caption className="sr-only">{title}. Visning med seks decimaler; full precision findes i snapshot JSON.</caption>
            <thead>
              <tr>
                <th scope="col">Aktiv</th>
                {ASSETS.map((a) => (
                  <th scope="col" key={a}>{a}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((r, i) => (
                <tr key={i}>
                  <th scope="row">{ASSETS[i]}</th>
                  {r.map((x, j) => (
                    <td key={j}>{x.toFixed(6)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>Ikke tilgængelig.</p>
      )}
    </>
  );
}
export function Details({ sealed }: { sealed: SealedSnapshot | null }) {
  if (!sealed)
    return (
      <section className="card">
        <h1 data-page-title tabIndex={-1}>Calculation Details</h1>
        <p>Beregn en fordeling for at se input, matematik og validering.</p>
      </section>
    );
  const s = sealed.snapshot,
    o = s.output,
    ri = o.riskInputs;
  return (
    <>
      <div className="section-title">
        <div className="eyebrow">D · PROOF</div>
        <h1 data-page-title tabIndex={-1}>Calculation Details</h1>
        <p>{time(s.timestamp)} · historisk snapshot</p>
      </div>
      <section className="card">
        <h3>Datagrundlag</h3>
        <dl>
          <dt>Status</dt>
          <dd>
            {s.input.dataset?.classification === "synthetic-demo"
              ? "SYNTETISKE DEMODATA"
              : s.input.dataset
                ? "Brugerdata · ikke uafhængigt verificeret"
                : "Manuelle priser · ingen risikohistorik"}
          </dd>
          <dt>Base currency</dt>
          <dd>DKK</dd>
          <dt>Provider</dt>
          <dd>{ri?.provider ?? "Manuel valuation"}</dd>
          <dt>Lookback</dt>
          <dd>{s.input.lookback} sessioner</dd>
          <dt>Aligned returns</dt>
          <dd>
            {ri
              ? `${ri.returns.length} / ${ri.expectedReturns} (${percent(ri.coverage)})`
              : "—"}
          </dd>
          <dt>Observationsperiode</dt>
          <dd>{ri ? `${ri.windowStart} – ${ri.windowEnd}` : "—"}</dd>
          <dt>Return convention</dt>
          <dd>Simple returns · sample covariance · 252</dd>
          <dt>Aktiehistorik</dt>
          <dd>
            {s.input.dataset?.schemaVersion === 2 ? "Canonical 1-minute session close" : "Raw close"} + splitfaktor + brutto cash dividend, reinvesteret ved
            ex-date close. Ingen skat eller ADR-gebyrer.
          </dd>
          <dt>FX</dt>
          <dd>
            DKK pr. USD. {fxContractLabel(s.input.dataset?.schemaVersion)}
          </dd>
          <dt>Calendar</dt>
          <dd>
            US regular close · DST og early closes · 2024–2027 · 2 timers
            publiceringsfrist.
          </dd>
        </dl>
        <p className="small">
          Kildehenvisninger er provenance, ikke bevis for datas ægthed.
        </p>
        <p className="small">
          Dette immutable snapshot bruger kun sine gemte input. Market Data-referencepriser
          fra Settings indgår ikke i beregningen og ændrer ikke dette snapshots resultater.
          Automatisk risk-refresh er ikke aktiveret i denne UI. Den accepterede datakontrakt er uændret.
        </p>
        {ri?.sourceURLs.map((u) => (
          <p key={u} className="small break">
            {u}
          </p>
        ))}
      </section>
      <details className="card">
        <summary>Covariance og correlation</summary>
        <Matrix
          title="Annualized covariance"
          data={o.diagnostics?.matrix ?? null}
        />
        <Matrix title="Correlation" data={o.risk?.correlation ?? null} />
        <h4>Matrixdiagnostik</h4>
        <pre>{JSON.stringify(o.diagnostics, null, 2)}</pre>
      </details>
      <details className="card">
        <summary>Targets og solver</summary>
        <dl>
          <dt>Model</dt>
          <dd>{s.input.model}</dd>
          <dt>Aktive constraints</dt>
          <dd>{o.activeConstraints.join(", ") || "Ingen"}</dd>
          <dt>Target nås uden salg</dt>
          <dd>
            {o.targetReachable
              ? "Ja, kontinuerligt før execution"
              : "Nej med denne kapital"}
          </dd>
        </dl>
        <div className="table-wrap" tabIndex={0} aria-label="Target comparison">
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th>Aktuel</th>
                <th>Raw target</th>
                <th>Constrained</th>
                <th>Efter køb</th>
                <th>Targetværdi DKK</th>
              </tr>
            </thead>
            <tbody>
              {ASSETS.map((a, i) => (
                <tr key={a}>
                  <th>{a}</th>
                  <td>{percent(o.portfolio.weights?.[i])}</td>
                  <td>{percent(o.rawTarget[i])}</td>
                  <td>{percent(o.constrainedTarget[i])}</td>
                  <td>{percent(o.execution.projectedWeights?.[i])}</td>
                  <td>{money(o.targetValues[i])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small">
          Constrained ERC dokumenterer førsteordens stationaritet. Det er ikke
          et globalt optimalitetsbevis.
        </p>
        <pre>
          {JSON.stringify(
            {
              raw: o.rawTarget,
              rawSolver: o.rawSolver,
              policy: s.input.policy,
              constrained: o.constrainedTarget,
              solver: o.constrainedSolver,
            },
            null,
            2,
          )}
        </pre>
      </details>
      <details className="card">
        <summary>Kontinuerlig løsning og ordrer</summary>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th>Kontinuerlig</th>
                <th>Køb DKK</th>
                <th>Antal</th>
                <th>Fee</th>
              </tr>
            </thead>
            <tbody>
              {ASSETS.map((a, i) => (
                <tr key={a}>
                  <th>{a}</th>
                  <td>{amount(o.continuousBuy[i])}</td>
                  <td>{amount(o.execution.orders[i].buy)}</td>
                  <td>{amount(o.execution.orders[i].quantity)}</td>
                  <td>0</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          {money(s.input.capital)} = køb {money(o.execution.spend)} + fees 0 +
          rest {amount(o.execution.residual)} DKK.
        </p>
        <p className="small">
          Quantity increments og minimumskøb er antagelser, som du skal matche
          med din handelsplatform. Algoritmen lover ikke det globale
          heltalsoptimum.
        </p>
        <pre>
          {JSON.stringify(
            { rules: s.input.executionRules, execution: o.execution },
            null,
            2,
          )}
        </pre>
      </details>
      <details className="card">
        <summary>Risk contributions og afvigelser</summary>
        <p className="small">
          Risk og viste porteføljevægte normaliseres over investerede aktiver.
          Execution-objectivet bruger V + ny kapital. Restkontanter holdes
          separat.
        </p>
        <pre>
          {JSON.stringify(
            {
              risk: o.risk,
              before: o.preDeviation,
              afterRisky: o.execution.riskyDeviation,
              afterWealth: o.execution.canonicalDeviation,
            },
            null,
            2,
          )}
        </pre>
      </details>
      <section className="card">
        <h3>Validering</h3>
        {o.validation.map((v) => (
          <p className="validation" key={v.check}>
            <span>{v.passed ? "✓" : "×"}</span>
            {v.check}
          </p>
        ))}
        <h4>Antagelser og advarsler</h4>
        {o.warnings.map((w) => (
          <p key={w} className="code small">
            {w}
          </p>
        ))}
        <dl>
          <dt>Engine</dt>
          <dd>{s.versions.engine}</dd>
          <dt>Risk model</dt>
          <dd className="break">{s.versions.risk}</dd>
          <dt>Execution model</dt>
          <dd className="break">{s.versions.execution}</dd>
          <dt>SHA-256</dt>
          <dd className="code small break">{sealed.sha256}</dd>
        </dl>
      </section>
    </>
  );
}
