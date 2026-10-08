import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ASSETS, NAMES, VERSIONS } from "../domain/core";
import { Store } from "../persistence/store";
import { initialState, type AppState } from "../persistence/schema";
import { canonical, inputFromState } from "../snapshots/calculate";
import { validateSeal, type SealedSnapshot } from "../snapshots/integrity";
import { finishCalculation } from "./calculation-job";
import { demoDataset } from "../market-data/demo";
import { ImportProvider, prepareRisk } from "../market-data/provider";
import { money, signedMoney, amount, time, download } from "./format";
import { Details } from "./Details";
import { MarketDataSettings } from "./MarketDataSettings";
import { Overview } from "./Overview";
import { BuyPlan } from "./BuyPlan";
import { RiskSummary, RiskView } from "./RiskView";
import { BrandMark, Glyph, InfinityLoader } from "./Glyph";
import { UI_VERSION, valuationPresentation } from "./presentation";
type MainTab = "overview" | "allocation" | "risk" | "data";
type Tab = MainTab | "portfolio" | "details";
function NumberField({
  label,
  value,
  onChange,
  large = false,
  max = 1e12,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  large?: boolean;
  max?: number;
}) {
  const errorId = useId();
  const [text, setText] = useState(String(value)),
    [invalid, setInvalid] = useState(false),
    focused = useRef(false);
  const min = label.includes("quantity increment") ? 1e-8 : 0;
  useEffect(() => {
    if (!focused.current) setText(String(value));
  }, [value]);
  return (
    <label className={large ? "number-field large" : "number-field"}>
      <span>{large ? "DKK" : label}</span>
      <input
        type="number"
        inputMode="decimal"
        required
        min={min}
        max={max}
        step="any"
        aria-label={label}
        aria-invalid={invalid}
        aria-describedby={invalid ? errorId : undefined}
        value={text}
        placeholder="0"
        onFocus={() => {
          focused.current = true;
        }}
        onChange={(e) => {
          const raw = e.target.value,
            n = Number(raw),
            valid = raw !== "" && Number.isFinite(n) && n >= min && n <= max;
          setText(raw);
          setInvalid(!valid);
          if (valid) onChange(n);
        }}
        onBlur={() => {
          focused.current = false;
          if (invalid) {
            setText(String(value));
            setInvalid(false);
          }
        }}
      />
      {invalid && (
        <small id={errorId}>
          Indtast et gyldigt tal mellem {min} og {max}. Ændringen er ikke gemt.
        </small>
      )}
    </label>
  );
}
const labels = {
  equal: "Equal Weight",
  inverse: "Inverse Volatility",
  erc: "Equal Risk Contribution",
};
export function App() {
  const [state, setState] = useState(initialState),
    [demo, setDemo] = useState<AppState | null>(null),
    [tab, setTab] = useState<Tab>("overview"),
    [backTo, setBackTo] = useState<MainTab>("overview"),
    [clock, setClock] = useState(Date.now()),
    [saved, setSaved] = useState("Åbner data…"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [fatal, setFatal] = useState(false),
    [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [history, setHistory] = useState<SealedSnapshot[]>([]),
    [current, setCurrent] = useState<SealedSnapshot | null>(null),
    [online, setOnline] = useState(navigator.onLine),
    [update, setUpdate] = useState<ServiceWorkerRegistration | null>(null);
  const main = useRef<HTMLElement>(null),
    previousTab = useRef<Tab>("overview"),
    db = useRef<Store | null>(null),
    revision = useRef(0),
    queue = useRef<Promise<unknown>>(Promise.resolve()),
    alive = useRef(true),
    pending = useRef(0),
    stateRef = useRef(state),
    demoRef = useRef(demo);
  const data = demo ?? state;
  const valuation = valuationPresentation(data.holdings, clock);
  stateRef.current = state;
  demoRef.current = demo;
  const activeTab = tab === "portfolio" || tab === "details" ? backTo : tab;
  function openDetails(parent: MainTab) {
    setBackTo(parent);
    setTab("details");
  }
  function openPortfolio(parent: MainTab = "overview") {
    setBackTo(parent);
    setTab("portfolio");
  }
  useEffect(() => {
    const tick = () => setClock(Date.now());
    const timer = setInterval(tick, 60000);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
  }, []);
  useEffect(() => {
    if (loaded && previousTab.current !== tab) {
      window.scrollTo({ top: 0 });
      main.current?.querySelector<HTMLElement>("[data-page-title]")?.focus({ preventScroll: true });
      previousTab.current = tab;
    }
  }, [tab, loaded]);
  useEffect(() => {
    alive.current = true;
    Store.open()
      .then(async (s) => {
        db.current = s;
        try {
          const r = await s.load();
          if (!alive.current) return;
          revision.current = r.state.revision;
          setState(r.state);
          setHistory(
            r.snapshots.sort((a, b) =>
              b.snapshot.timestamp.localeCompare(a.snapshot.timestamp),
            ),
          );
          setSaved("Gemt lokalt");
        } catch (e) {
          setFatal(true);
          setError(String(e));
          setSaved("Gendannelse kræves");
        } finally {
          setLoaded(true);
        }
      })
      .catch((e) => {
        setFatal(true);
        setLoaded(true);
        setError(`Lokal lagring kunne ikke åbnes: ${String(e)}`);
      });
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = data.theme;
  }, [data.theme]);
  useEffect(() => {
    const handler = () => setOnline(navigator.onLine);
    addEventListener("online", handler);
    addEventListener("offline", handler);
    return () => {
      removeEventListener("online", handler);
      removeEventListener("offline", handler);
    };
  }, []);
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !import.meta.env.PROD) return;
    let reload = false;
    const change = () => {
      if (reload) location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", change);
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, {
        scope: import.meta.env.BASE_URL,
        updateViaCache: "none",
      })
      .then((r) => {
        if (r.waiting) setUpdate(r);
        r.addEventListener("updatefound", () => {
          const w = r.installing;
          w?.addEventListener("statechange", () => {
            if (w.state === "installed" && navigator.serviceWorker.controller)
              setUpdate(r);
          });
        });
      })
      .catch((e) =>
        setNotice(`Offline-shell kunne ikke installeres: ${String(e)}`),
      );
    const listener = () => {
      reload = true;
    };
    addEventListener("equinox-update", listener);
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", change);
      removeEventListener("equinox-update", listener);
    };
  }, []);
  function persist(next: AppState, snapshot?: SealedSnapshot) {
    if (!db.current || fatal)
      return Promise.reject(new Error("STORAGE_UNAVAILABLE"));
    pending.current++;
    setSaved("Gemmer…");
    const job = queue.current.then(async () => {
      const result = await db.current!.save(next, revision.current, snapshot);
      revision.current = result.revision;
      return result;
    });
    queue.current = job;
    job
      .then(() => {
        pending.current--;
        if (pending.current === 0) setSaved("Gemt lokalt");
      })
      .catch((e) => {
        pending.current--;
        setSaved("IKKE GEMT");
        setFatal(true);
        setError(String(e));
      });
    return job;
  }
  function edit(fn: (d: AppState) => void) {
    const next = structuredClone(demoRef.current ?? stateRef.current);
    fn(next);
    setError("");
    if (demoRef.current) {
      demoRef.current = next;
      setDemo(next);
    } else {
      stateRef.current = next;
      setState(next);
      void persist(next).catch(() => {});
    }
  }
  function startDemo() {
    const d = initialState(),
      now = new Date().toISOString();
    d.capital = 2500;
    d.model = "erc";
    d.dataset = demoDataset(now);
    d.holdings = d.holdings.map((h, i) => ({
      ...h,
      units: [2, 2, 3, 0.003, 0.04][i],
      costBasisDKK: [1600, 3000, 3000, 1400, 800][i],
      priceDKK: [1000, 1600, 1200, 600000, 30000][i],
      priceAsOf: now,
    }));
    setDemo(d);
    demoRef.current = d;
    setCurrent(null);
    setError("");
    setTab("allocation");
  }
  async function run(e: FormEvent) {
    e.preventDefault();
    const wasDemo = demoRef.current !== null,
      source = structuredClone(demoRef.current ?? stateRef.current);
    setBusy(true);
    setError("");
    try {
      await queue.current;
      const s = await finishCalculation(
        source,
        wasDemo,
        new Date().toISOString(),
        () => stateRef.current,
        persist,
      );
      if (!wasDemo) setHistory((h) => [s, ...h.filter((x) => x.id !== s.id)]);
      if (wasDemo === (demoRef.current !== null)) setCurrent(s);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }
  const sameInput = current
    ? canonical(inputFromState(data, current.snapshot.timestamp)) ===
      canonical(current.snapshot.input)
    : false;
  async function exportBackup() {
    try {
      await queue.current;
      download(
        `EQUINOX-backup-${new Date().toISOString().slice(0, 10)}.json`,
        await db.current!.backup(),
      );
    } catch (e) {
      setError(String(e));
    }
  }
  async function fileAction(
    file: File | undefined,
    type: "dataset" | "backup" | "snapshot",
  ) {
    if (!file) return;
    try {
      if (type !== "backup" && file.size > 50_000_000)
        throw new Error("Denne enkeltfil er større end 50 MB.");
      if (type === "backup" && file.size > 50_000_000)
        setNotice(
          "Stor backup: validering kan tage tid og kræver ledig hukommelse. Eksisterende data ændres først efter fuld validering.",
        );
      const text = await file.text();
      if (type === "dataset") {
        const d = new ImportProvider().readHistory(JSON.parse(text));
        prepareRisk(d, new Date().toISOString(), data.lookback);
        edit((s) => {
          s.dataset = d;
          s.acknowledgeUserData = false;
        });
        setNotice(
          "Historik importeret. Numeriske checks er bestået; markedskilden er ikke verificeret.",
        );
      } else if (type === "snapshot") {
        const s = await validateSeal(JSON.parse(text));
        setCurrent(s);
        openDetails("data");
        setNotice("Historisk snapshot genberegnet og hash verificeret.");
      } else {
        await queue.current.catch(() => {});
        const revisionNow = await db.current!.currentRevision();
        const restored = await db.current!.restore(text, revisionNow);
        revision.current = restored.revision;
        const r = await db.current!.load();
        setState(r.state);
        setHistory(r.snapshots);
        setCurrent(null);
        setDemo(null);
        setFatal(false);
        setError("");
        setSaved("Gemt lokalt");
        queue.current = Promise.resolve();
        setNotice(
          "Backup gendannet. Den tidligere database er bevaret som recovery-kopi.",
        );
      }
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  }
  const capitalForm = (
<form className="capital-form" onSubmit={(e) => void run(e)}>
                  <section className="capital">
                    <NumberField
                      label="Ny kapital i DKK"
                      value={data.capital}
                      large
                      onChange={(v) =>
                        edit((s) => {
                          s.capital = v;
                        })
                      }
                    />
                    <div className="quick">
                      {[500, 1000, 2500, 5000].map((v) => (
                        <button
                          type="button"
                          key={v}
                          aria-pressed={data.capital === v}
                          onClick={() =>
                            edit((s) => {
                              s.capital = v;
                            })
                          }
                        >
                          {amount(v)}
                        </button>
                      ))}
                    </div>
                    <label className="select-label">
                      Målmodel
                      <select
                        aria-label="Målmodel"
                        value={data.model}
                        onChange={(e) =>
                          edit((s) => {
                            s.model = e.target.value as AppState["model"];
                          })
                        }
                      >
                        <option value="equal">Equal Weight</option>
                        <option value="inverse">Inverse Volatility</option>
                        <option value="erc">Equal Risk Contribution</option>
                      </select>
                    </label>
                    <p className="small model-description">
                      {data.model === "equal"
                        ? "Lige kapitalvægt. Kræver ingen risikohistorik."
                        : data.model === "inverse"
                          ? "Kapitalvægt omvendt proportional med DKK-volatilitet."
                          : "Søger lige bidrag til porteføljens DKK-volatilitet."}
                    </p>
                    <button className="primary" type="submit" disabled={busy}>
                      {busy ? <InfinityLoader label="Beregner og validerer…" compact /> : <>Beregn fordeling <Glyph name="arrow" /></>}
                    </button>
                    <p className="small assumptions">
                      Buy-only · Fees = 0 · Ingen automatisk handel
                    </p>
                  </section>
                </form>
  );
  if (!loaded)
    return (
      <main className="loading">
        <BrandMark />
        <h1>EQUINOX</h1>
        <InfinityLoader label="Åbner din lokale portefølje…" />
      </main>
    );
  return (
    <div className="app">
      <a className="skip-link" href="#main-content">Gå til indhold</a>
      <header className="app-header">
        <div className="brand">
          <BrandMark />
          <div>
            <strong>EQUINOX</strong>
            <small>CAPITAL ALLOCATION</small>
          </div>
        </div>
        <span className="connection">{online ? "Local first" : "Offline"}</span>
      </header>
      <main id="main-content" ref={main} tabIndex={-1} data-view={tab}>
        <div className="statusline">
          <span>{demo ? "Isoleret demo" : saved}</span>
          <span>Engine {VERSIONS.engine} · DKK</span>
        </div>
        {demo && (
          <div className="banner demo">
            <strong>DEMO · SYNTETISKE DATA</strong>
            <button
              type="button"
              onClick={() => {
                setDemo(null);
                demoRef.current = null;
                setCurrent(null);
                setError("");
              }}
            >
              Afslut demo
            </button>
            <span>Kun til afprøvning. Din portefølje er uændret.</span>
          </div>
        )}
        {update && (
          <div className="banner">
            <span>En ny version er klar.</span>
            <button
              type="button"
              disabled={busy || pending.current > 0 || fatal}
              onClick={async () => {
                await queue.current;
                dispatchEvent(new Event("equinox-update"));
                update.waiting?.postMessage({ type: "ACTIVATE_UPDATE" });
              }}
            >
              Opdatér app
            </button>
          </div>
        )}
        {error && (
          <div role="alert" className="banner error">
            <strong>Beregning eller lagring stoppet</strong>
            <span className="break">{error}</span>
          </div>
        )}
        {notice && (
          <div role="status" className="banner">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice("")}>
              Luk
            </button>
          </div>
        )}
        {fatal ? (
          <section className="card">
            <h2>Bevar dine data</h2>
            <p>
              Lagringen kunne ikke valideres. Appen overskriver den ikke.
              Eksportér en recovery-kopi og gendan derefter en kendt backup,
              eller genindlæs ved en konflikt mellem faner.
            </p>
            <button
              type="button"
              onClick={async () =>
                download("EQUINOX-recovery.json", await db.current!.rawBackup())
              }
            >
              Eksportér recovery-kopi
            </button>
            <label className="file-button">
              Gendan backup
              <input
                type="file"
                accept=".json,application/json"
                onChange={(e) => void fileAction(e.target.files?.[0], "backup")}
              />
            </label>
            <button type="button" onClick={() => location.reload()}>
              Genindlæs app
            </button>
          </section>
        ) : (
          <>
            {(tab === "portfolio" || tab === "details") && <button className="back-button" type="button" onClick={() => setTab(backTo)}><Glyph name="back" />{backTo === "overview" ? "Overview" : backTo === "allocation" ? "Allocate" : backTo === "risk" ? "Risk" : "Settings"}</button>}
            {tab === "overview" && <Overview state={data} sealed={current} sameInput={sameInput} isDemo={!!demo} online={online} clock={clock} capitalForm={capitalForm} history={history} onPortfolio={() => openPortfolio()} onRisk={() => setTab("risk")} onDetails={() => openDetails("overview")} onSnapshot={item => { setCurrent(item); openDetails("overview"); }} onDemo={startDemo} />}
            {tab === "risk" && <RiskView sealed={current} sameInput={sameInput} onDetails={() => openDetails("risk")} onAllocate={() => setTab("allocation")} />}
            {tab === "allocation" && (
              <>
                <div className="section-title">
                  <span className="eyebrow">KAPITAL · FORDELING</span>
                  <h1 data-page-title tabIndex={-1}>Allocate</h1>
                  <p>Ny kapital. En præcis købsplan.</p>
                </div>
                {capitalForm}
                {!demo && (
                  <button
                    className="text-button"
                    type="button"
                    onClick={startDemo}
                  >
                    Prøv med demodata
                  </button>
                )}
                {current ? (
                  <>
                    <BuyPlan sealed={current} sameInput={sameInput} isDemo={!!demo} onDetails={() => openDetails("allocation")} />
                    <RiskSummary sealed={current} sameInput={sameInput} onOpen={() => setTab("risk")} />
                  </>
                ) : (
                  <section className="empty">
                    <Glyph name="balance" />
                    <h2>Byg fra din portefølje</h2>
                    <p>Indtast beholdninger og aktuelle DKK-priser. Equal Weight kræver ingen risikohistorik.</p>
                    <button type="button" onClick={() => openPortfolio("allocation")}>Indtast portefølje</button>
                  </section>
                )}
              </>
            )}
            {tab === "portfolio" && (
              <>
                <div className="section-title">
                  <span className="eyebrow">A · PORTFOLIO STATE</span>
                  <h1 data-page-title tabIndex={-1}>Portefølje</h1>
                  <p>Antal, kostpris og markedspris holdes adskilt.</p>
                </div>
                <section className="card summary">
                  <span>Samlet cost basis</span>
                  <strong>
                    {money(
                      data.holdings.reduce((v, h) => v + h.costBasisDKK, 0),
                    )}
                  </strong>
                  <span>Aktuel værdi</span>
                  <strong>
                    {valuation.value === null ? "—" : money(valuation.value)}
                  </strong>
                  <span>Urealiseret P/L</span>
                  <strong>
                    {valuation.value === null ? "—" : signedMoney(valuation.value - valuation.cost)}
                  </strong>
                </section>
                {data.holdings.map((h, i) => (
                  <section className="card holding" key={h.symbol}>
                    <div className="asset-top">
                      <div>
                        <h3>{h.symbol}</h3>
                        <span>{NAMES[i]}</span>
                      </div>
                      <strong>{h.units > 0 && h.priceDKK <= 0 ? "Pris mangler" : money(h.units * h.priceDKK)}</strong>
                    </div>
                    <div className="input-grid">
                      <NumberField
                        label={`${h.symbol} antal`}
                        value={h.units}
                        onChange={(v) =>
                          edit((s) => {
                            s.holdings[i].units = v;
                          })
                        }
                      />
                      <NumberField
                        label={`${h.symbol} pris i DKK`}
                        value={h.priceDKK}
                        onChange={(v) =>
                          edit((s) => {
                            s.holdings[i].priceDKK = v;
                            s.holdings[i].priceAsOf = "";
                          })
                        }
                      />
                    </div>
                    <NumberField
                      label={`${h.symbol} samlet cost basis i DKK`}
                      value={h.costBasisDKK}
                      onChange={(v) =>
                        edit((s) => {
                          s.holdings[i].costBasisDKK = v;
                        })
                      }
                    />
                    <p className="small">Manuel pris · {time(h.priceAsOf)}</p>
                    <details>
                      <summary>Ordreprecision</summary>
                      <div className="input-grid">
                        <NumberField
                          label={`${h.symbol} quantity increment`}
                          value={data.executionRules[i].increment}
                          onChange={(v) =>
                            edit((s) => {
                              s.executionRules[i].increment = v;
                            })
                          }
                        />
                        <NumberField
                          label={`${h.symbol} minimumskøb DKK`}
                          value={data.executionRules[i].minimumDKK}
                          onChange={(v) =>
                            edit((s) => {
                              s.executionRules[i].minimumDKK = v;
                            })
                          }
                        />
                      </div>
                      <p className="small">
                        1 = hele aktier. Fractional support kræver et mindre
                        increment, som din platform faktisk tillader.
                      </p>
                    </details>
                  </section>
                ))}
                <section className="card">
                  <p>
                    Bekræft kun, hvis de indtastede priser er aktuelle
                    DKK-priser. De er manuelle oplysninger og udløber efter 24
                    timer.
                  </p>
                  <button
                    type="button"
                    disabled={data.holdings.some((h) => h.priceDKK <= 0)}
                    onClick={() =>
                      edit((s) => {
                        const n = new Date().toISOString();
                        s.holdings.forEach((h) => (h.priceAsOf = n));
                      })
                    }
                  >
                    Bekræft priser som aktuelle
                  </button>
                </section>
              </>
            )}
            {tab === "details" && <Details sealed={current} />}
            {tab === "data" && (
              <>
                <div className="section-title">
                  <span className="eyebrow">DATA · POLICY · HISTORIK</span>
                  <h1 data-page-title tabIndex={-1}>Settings</h1>
                  <p>Lokale data, forbindelser og præferencer.</p>
                </div>
                <MarketDataSettings online={online} />
                <section className="card">
                  <details className="settings-group">
                  <summary>Historiske markedsdata</summary>
                  <p>
                    Importér risikohistorik efter den accepterede EQUINOX-kontrakt.
                    Providerreferencer og manuelle DKK-priser er adskilt fra risikodata. Demodata er syntetiske.
                  </p>
                  <label className="select-label">
                    Lookback
                    <select
                      aria-label="Lookback"
                      value={data.lookback}
                      onChange={(e) =>
                        edit((s) => {
                          s.lookback = Number(
                            e.target.value,
                          ) as AppState["lookback"];
                        })
                      }
                    >
                      {[252, 504, 756].map((n) => (
                        <option key={n} value={n}>
                          {n} US-sessioner
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="small">
                    Mindst 252 gyldige daily returns og 95% coverage.
                    252-sessioners lookback tolererer derfor ingen manglende
                    observationer.
                  </p>
                  <label className="file-button">
                    Importér historik
                    <input
                      type="file"
                      accept=".json,application/json"
                      aria-label="Importér historik"
                      onChange={(e) =>
                        void fileAction(e.target.files?.[0], "dataset")
                      }
                    />
                  </label>
                  {data.dataset && (
                    <>
                      <p className="small break">
                        {data.dataset.provider}
                        <br />
                        Hentet {time(data.dataset.acquiredAt)}
                        <br />
                        {data.dataset.rows.length} observationer ·{" "}
                        {data.dataset.classification}
                      </p>
                      {data.dataset.classification === "user-supplied" && (
                        <label className="check">
                          <input
                            type="checkbox"
                            checked={data.acknowledgeUserData}
                            onChange={(e) =>
                              edit((s) => {
                                s.acknowledgeUserData = e.target.checked;
                              })
                            }
                          />
                          Jeg bruger egne data og accepterer, at markedskilden
                          og corporate actions ikke er uafhængigt verificeret.
                        </label>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          edit((s) => {
                            s.dataset = null;
                            s.acknowledgeUserData = false;
                          })
                        }
                      >
                        Fjern historik fra nye beregninger
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      download(
                        "EQUINOX-DEMO-data-contract.json",
                        JSON.stringify(
                          demoDataset(new Date().toISOString()),
                          null,
                          2,
                        ),
                      )
                    }
                  >
                    Hent syntetisk format-eksempel
                  </button>
                  </details>
                </section>
                <section className="card">
                  <details className="settings-group">
                  <summary>Portfolio policy</summary>
                  <p className="small">
                    Dine grænser anvendes efter modellens raw target.
                  </p>
                  <NumberField
                    label="Samlet crypto cap (%)"
                    value={data.policy.cryptoCap * 100}
                    max={100}
                    onChange={(v) =>
                      edit((s) => {
                        s.policy.cryptoCap = v / 100;
                      })
                    }
                  />
                  <details>
                    <summary>Individuelle min./max.-vægte</summary>
                    {ASSETS.map((a, i) => (
                      <div className="input-grid" key={a}>
                        <NumberField
                          label={`${a} min. (%)`}
                          value={data.policy.lower[i] * 100}
                          max={100}
                          onChange={(v) =>
                            edit((s) => {
                              s.policy.lower[i] = v / 100;
                            })
                          }
                        />
                        <NumberField
                          label={`${a} max. (%)`}
                          value={data.policy.upper[i] * 100}
                          max={100}
                          onChange={(v) =>
                            edit((s) => {
                              s.policy.upper[i] = v / 100;
                            })
                          }
                        />
                      </div>
                    ))}
                  </details>
                  </details>
                </section>
                <section className="card">
                  <details className="settings-group">
                  <summary>Backup og historik</summary>
                  <p className="small">
                    Lokal browserlagring kan slettes af dig eller systemet.
                    Eksportér regelmæssigt en backup til Filer.
                  </p>
                  <div className="button-stack">
                    <button
                      type="button"
                      disabled={!!demo}
                      onClick={() => void exportBackup()}
                    >
                      Eksportér backup
                    </button>
                    <label className="file-button">
                      Gendan backup
                      <input
                        type="file"
                        accept=".json,application/json"
                        aria-label="Gendan backup"
                        disabled={!!demo}
                        onChange={(e) =>
                          void fileAction(e.target.files?.[0], "backup")
                        }
                      />
                    </label>
                    <label className="file-button">
                      Verificér snapshot
                      <input
                        type="file"
                        accept=".json,application/json"
                        onChange={(e) =>
                          void fileAction(e.target.files?.[0], "snapshot")
                        }
                      />
                    </label>
                    {current && (
                      <button
                        type="button"
                        onClick={() =>
                          download(
                            `EQUINOX-snapshot-${current.id.slice(0, 12)}.json`,
                            JSON.stringify(current, null, 2),
                          )
                        }
                      >
                        Eksportér vist snapshot
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={async () =>
                        setNotice(
                          (await navigator.storage?.persist?.())
                            ? "Vedvarende lagring er tildelt. Backup er stadig nødvendig."
                            : "Browseren har ikke tildelt vedvarende lagring. Brug backup.",
                        )
                      }
                    >
                      Anmod om vedvarende lagring
                    </button>
                  </div>
                  <p className="small">
                    Gendannelse bevarer først den eksisterende database som
                    recovery-kopi.
                  </p>
                  {history.map((h) => (
                    <button
                      className="history-row"
                      type="button"
                      key={h.id}
                      onClick={() => {
                        setCurrent(h);
                        openDetails("data");
                      }}
                    >
                      <span>{time(h.snapshot.timestamp)}</span>
                      <span>
                        {money(h.snapshot.input.capital)} ·{" "}
                        {labels[h.snapshot.input.model]}
                      </span>
                    </button>
                  ))}
                  </details>
                </section>
                <section className="card">
                  <details className="settings-group">
                  <summary>Udseende og installation</summary>
                  <label className="select-label">
                    Tema
                    <select
                      value={data.theme}
                      onChange={(e) =>
                        edit((s) => {
                          s.theme = e.target.value as AppState["theme"];
                        })
                      }
                    >
                      <option value="system">Følg system</option>
                      <option value="light">Lyst</option>
                      <option value="dark">Mørkt</option>
                    </select>
                  </label>
                  <p className="small">
                    På iPhone: åbn i Safari, vælg Del og Føj til hjemmeskærm.
                    Appen skal være åbnet online én gang, før offline-shell er
                    klar.
                  </p>
                  <p className="small">
                    {matchMedia("(display-mode: standalone)").matches
                      ? "Standalone PWA"
                      : "Browser-mode"}{" "}
                    ·{" "}
                    {navigator.serviceWorker?.controller
                      ? "Offline-shell aktiv"
                      : "Offline-shell afventer"}
                  </p>
                  </details>
                </section>
                <section className="about-equinox">
                  <img src={`${import.meta.env.BASE_URL}brand/equinox-primary.jpeg`} width="1254" height="1254" alt="EQUINOX: teal øvre hemisfære, violet nedre crescent og central balanceakse" loading="lazy" />
                  <p>App {UI_VERSION} · Engine {VERSIONS.engine}</p>
                  <p className="small">Capital allocation · local first</p>
                </section>
              </>
            )}
          </>
        )}
      </main>
      <nav className="bottom-nav" aria-label="Hovednavigation">
        {(
          [
            ["overview", "Overview", "overview"],
            ["allocation", "Allocate", "allocate"],
            ["risk", "Risk", "risk"],
            ["data", "Settings", "settings"],
          ] as const
        ).map(([id, label, symbol]) => (
          <button
            type="button"
            key={id}
            aria-current={activeTab === id ? "page" : undefined}
            onClick={() => {
              setTab(id);
              window.scrollTo({ top: 0 });
            }}
          >
            <Glyph name={symbol} />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
