import { useEffect, useRef, useState } from 'react';
import { CredentialStore, type CredentialProvider } from '../market-data/live/credentials';
import { MarketCache, freshness } from '../market-data/live/cache';
import { MassiveAdapter } from '../market-data/live/massive';
import { currentCrypto } from '../market-data/live/coingecko';
import { currentFX } from '../market-data/live/nationalbank';
import { safeError, MarketError, ERROR_CODES, type ErrorCode, type Provider } from '../market-data/live/network';
import { MARKET_DATA_MODEL_VERSION, type Observation } from '../market-data/live/model';
import { refreshSynchronizedRisk, type RiskRefreshPhase } from '../market-data/live/synchronized';
import { prepareRisk, type RiskDataset, type RetrospectiveDataset } from '../market-data/provider';
import { time } from './format';
import { UI_VERSION, marketErrorMessage } from './presentation';
import { Glyph, InfinityLoader } from './Glyph';

const names: Record<Provider, string> = { massive: 'Massive', coingecko: 'CoinGecko', nationalbank: 'Danmarks Nationalbank' };
const credentials = () => new CredentialStore(window.localStorage);
type DisplayObservation = { observation: Observation; cached: boolean };
const isCode = (value: string): value is ErrorCode => ERROR_CODES.some(code => code === value);
const readable = (value: string) => isCode(value) ? marketErrorMessage(new MarketError(value)) : value;
function ErrorDetail({ value }: { value: string }) {
  return isCode(value) ? <details className="error-diagnostic"><summary>Teknisk detalje</summary><code>{value}</code></details> : null;
}
async function probe(provider: Provider, key: string | null, signal: AbortSignal, progress: (n: number) => void) {
  if (provider === 'massive') return new MassiveAdapter(key ?? '').test(signal, progress);
  return provider === 'coingecko' ? currentCrypto(key, signal) : currentFX(signal);
}
function CredentialSheet({ provider, onClose, onSaved, onBusyChange }: {
  provider: CredentialProvider; onClose: () => void; onSaved: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null), input = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null), alive = useRef(true), pending = useRef(false);
  const [status, setStatus] = useState(''), [testing, setTesting] = useState(false);
  useEffect(() => {
    alive.current = true;
    const element = dialog.current!, previous = document.activeElement as HTMLElement | null;
    element.showModal(); input.current?.focus();
    return () => {
      alive.current = false; abort.current?.abort();
      onBusyChange?.(false);
      if (input.current) input.current.value = '';
      element.close(); previous?.focus();
    };
  }, []);
  const test = async () => {
    if (pending.current) return;
    const key = input.current?.value.trim() ?? '';
    if (!key) { setStatus('MISSING_CREDENTIAL'); return; }
    if (!/^[\x21-\x7e]{1,512}$/.test(key)) { setStatus('INVALID_CREDENTIAL'); return; }
    pending.current = true; onBusyChange?.(true); setTesting(true); setStatus('Tester…');
    const controller = new AbortController(); abort.current = controller;
    try {
      await probe(provider, key, controller.signal, n => { if (alive.current) setStatus(`Tester adgang: ${n}/11 requests`); });
      if (alive.current) setStatus('Connection verified. Save locally gemmer nøglen. Testen opdaterer ikke risikohistorik.');
    } catch (e) { if (alive.current) setStatus(safeError(e)); }
    finally { pending.current = false; if (alive.current) { setTesting(false); onBusyChange?.(false); } }
  };
  return <dialog ref={dialog} className="credential-sheet" aria-labelledby="credential-title" onCancel={e => { e.preventDefault(); onClose(); }}>
    <div className="sheet-content">
      <div className="sheet-handle" aria-hidden="true" />
      <div className="sheet-heading"><h2 id="credential-title">{names[provider]}</h2><button className="icon-button" type="button" aria-label="Luk dialog" onClick={onClose}><Glyph name="close" /></button></div>
      <p className="small" id="credential-warning">Nøglen gemmes kun i denne browser. Lokal browserlagring er ikke krypteret eller sikker secret storage. Brug en særskilt, read-only nøgle, hvis udbyderen tilbyder det.</p>
      <label className="credential-label">API key
        <input ref={input} type="password" aria-describedby="credential-warning" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={512} disabled={testing} onChange={() => setStatus('')} onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }} />
      </label>
      {provider === 'massive' && <p className="small">Adgangstesten kontrollerer tre aktier, to crypto-buckets samt splits/dividends. Op til ca. 3 minutter med begrænset request-rate.</p>}
      <div role="status" className="small break">{testing ? <InfinityLoader label={status} compact /> : readable(status)}</div>
      <ErrorDetail value={status} />
      <div className="button-stack">
        <button className="primary" type="button" disabled={testing} onClick={() => {
          try {
            credentials().save(provider, input.current?.value ?? '');
            if (input.current) input.current.value = '';
            onSaved(); onClose();
          } catch (e) { setStatus(safeError(e)); }
        }}>Save locally</button>
        <button type="button" disabled={testing} onClick={() => void test()}>Test connection</button>
        <button type="button" onClick={onClose}>Cancel</button>
      </div>
    </div>
  </dialog>;
}

export function MarketDataSettings({ online, disabled = false, lookback = 252, dataset = null, onAcceptRiskDataset, onBusyChange }: {
  online: boolean; disabled?: boolean; lookback?: 252 | 504 | 756; dataset?: RiskDataset | null;
  onAcceptRiskDataset?: (dataset: RetrospectiveDataset, signal: AbortSignal) => Promise<void>;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [configured, setConfigured] = useState({ massive: false, coingecko: false });
  const [status, setStatus] = useState<Record<Provider, string>>({ massive: 'Not configured', coingecko: 'Public access · not tested', nationalbank: 'No key required · not tested' });
  const [sheet, setSheet] = useState<CredentialProvider | null>(null);
  const [running, setRunning] = useState<Provider | null>(null), [message, setMessage] = useState('');
  const [rows, setRows] = useState<DisplayObservation[]>([]), [clock, setClock] = useState(Date.now());
  const [riskRunning, setRiskRunning] = useState(false), [phase, setPhase] = useState<RiskRefreshPhase | 'saving' | 'ready' | null>(null);
  const [completedAssets, setCompletedAssets] = useState(0), [cacheIssue, setCacheIssue] = useState<ErrorCode | null>(null);
  const cache = useRef<MarketCache | null>(null), alive = useRef(true), busy = useRef(false), abort = useRef<AbortController | null>(null);
  const details = useRef<HTMLDetailsElement>(null);
  const syncCredentials = () => {
    try { setConfigured({ massive: credentials().has('massive'), coingecko: credentials().has('coingecko') }); }
    catch (e) { setMessage(safeError(e)); }
  };
  useEffect(() => {
    alive.current = true; syncCredentials();
    const stored = () => { abort.current?.abort(); syncCredentials(); setStatus({ massive: 'Credential state changed · test again', coingecko: 'Credential state changed · test again', nationalbank: 'No key required · not tested' }); };
    addEventListener('storage', stored);
    void MarketCache.open().then(async db => {
      if (!alive.current) { db.close(); return; }
      cache.current = db;
      const observations = await db.all();
      if (alive.current) setRows(observations.map(observation => ({ observation, cached: true })));
    }).catch(e => { if (alive.current) { setCacheIssue(safeError(e)); setMessage(safeError(e)); } });
    const timer = setInterval(() => setClock(Date.now()), 30000);
    return () => { alive.current = false; abort.current?.abort(); cache.current?.close(); clearInterval(timer); removeEventListener('storage', stored); onBusyChange?.(false); };
  }, []);
  const testProvider = async (provider: Provider, publicMode = false) => {
    if (busy.current || disabled) return;
    let key: string | null = null;
    try { if (provider !== 'nationalbank' && !publicMode) key = credentials().read(provider); }
    catch (e) { setMessage(safeError(e)); return; }
    if (provider === 'massive' && !key) { setSheet('massive'); return; }
    if (!online) { setMessage('OFFLINE · cache er ikke current'); return; }
    const controller = new AbortController(); abort.current = controller;
    busy.current = true; onBusyChange?.(true); setRunning(provider); setMessage('');
    try {
      const observations = await probe(provider, key, controller.signal, n => { if (alive.current) setMessage(`${names[provider]}: ${n}/11 requests`); });
      if (controller.signal.aborted || !alive.current) return;
      if (provider !== 'nationalbank' && !publicMode && credentials().read(provider) !== key) return;
      if (!cache.current) throw new Error('CACHE_UNAVAILABLE');
      await cache.current.put(observations);
      if (!alive.current || controller.signal.aborted) return;
      setRows(previous => [...previous.filter(r => !observations.some(o => o.instrument === r.observation.instrument && o.provider === r.observation.provider)), ...observations.map(observation => ({ observation, cached: false }))]);
      setClock(Date.now());
      setStatus(s => ({ ...s, [provider]: provider === 'nationalbank' ? 'Feed verified' : publicMode ? 'Public access verified' : 'Connected ✓' }));
      setMessage('Reference-data er opdateret. Holdings, risikodata og gemte beregninger er uændrede.');
    } catch (e) {
      if (alive.current) { const code = safeError(e); setStatus(s => ({ ...s, [provider]: code })); setMessage(code); }
    } finally { busy.current = false; if (alive.current) { setRunning(null); onBusyChange?.(false); } }
  };
  const refreshRisk = async () => {
    if (busy.current || disabled || !onAcceptRiskDataset) return;
    let key: string | null;
    try { key = credentials().read('massive'); }
    catch (e) { setMessage(safeError(e)); return; }
    if (!key) { setSheet('massive'); return; }
    if (!online) { setMessage('Offline · eksisterende historik er bevaret. Tilslut netværk for at hente igen.'); return; }
    if (cacheIssue) { setMessage(cacheIssue); return; }
    // Capture the app callback/context at user action, not after a long request.
    const accept = onAcceptRiskDataset, controller = new AbortController(); abort.current = controller;
    busy.current = true; onBusyChange?.(true); setRiskRunning(true); setPhase('acquiring'); setCompletedAssets(0); setMessage('');
    try {
      if (!cache.current) throw new MarketError('CACHE_UNAVAILABLE');
      const result = await refreshSynchronizedRisk({ key, lookback, cache: cache.current, signal: controller.signal,
        onProgress: progress => { if (alive.current && !controller.signal.aborted) { setPhase(progress.phase); setCompletedAssets(progress.completedAssets); } },
      });
      if (!alive.current || controller.signal.aborted || credentials().read('massive') !== key) throw new MarketError('ABORTED');
      setPhase('saving');
      await accept(result, controller.signal);
      if (!alive.current) return;
      setPhase('ready'); setClock(Date.now());
      setMessage('Risikohistorik gemt. Alle datagates er bestået. Holdings, manuelle DKK-priser og snapshots er uændrede.');
    } catch (e) { if (alive.current) { setPhase(null); setMessage(safeError(e)); } }
    finally { busy.current = false; if (alive.current) { setRiskRunning(false); onBusyChange?.(false); } }
  };
  const recoverCache = async () => {
    if (busy.current || disabled) return;
    if (cacheIssue === 'CACHE_INVALID' && !confirm('Slet kun market-cache? Holdings, risikohistorik, snapshots og lokale nøgler bevares.')) return;
    busy.current = true; onBusyChange?.(true);
    try {
      cache.current?.close();
      const reopened = await MarketCache.open();
      if (!alive.current) { reopened.close(); return; }
      cache.current = reopened;
      if (cacheIssue === 'CACHE_INVALID') await cache.current.clear();
      const observations = await cache.current.all();
      if (alive.current) { setRows(observations.map(observation => ({ observation, cached: true }))); setCacheIssue(null); setMessage('Market-cache er klar. Finansielle data og nøgler er uændrede.'); }
    } catch (e) { if (alive.current) { setCacheIssue(safeError(e)); setMessage(safeError(e)); } }
    finally { busy.current = false; if (alive.current) onBusyChange?.(false); }
  };
  let acceptedStatus = dataset ? 'Historik kræver validering' : 'Ingen accepteret risikohistorik';
  if (dataset) {
    try { prepareRisk(dataset, new Date(clock).toISOString(), lookback); acceptedStatus = online ? 'Historik klar · ikke live' : 'Offline · gemt historik'; }
    catch { acceptedStatus = online ? 'Historik udløbet eller utilstrækkelig · opdatér' : 'Offline · historik kan ikke bruges til ny risiko'; }
  }
  const working = !!running || riskRunning;
  const stageLabel = phase === 'acquiring' ? `Henter data · ${completedAssets}/5 aktiver hentet eller fra cache`
    : phase === 'synchronizing' ? 'Synkroniserer observationer'
    : phase === 'validating' ? 'Validerer datagates' : 'Gemmer accepteret historik';
  const latest = new Map<string, DisplayObservation>();
  for (const row of rows) {
    const q = row.observation, key = `${q.provider}|${q.instrument}`, previous = latest.get(key);
    if (!previous || (q.observationTimestamp ?? q.observationDate) > (previous.observation.observationTimestamp ?? previous.observation.observationDate)) latest.set(key, row);
  }
  return <section className="card market-settings">
    <div className="section-heading"><div><span className="eyebrow">Lokale forbindelser</span><h3>Market Data</h3></div><span className="micro">Manuel opdatering</span></div>
    {!configured.massive && <div className="market-config-line"><small>Market data not configured</small><button type="button" onClick={() => { if (details.current) details.current.open = true; }}>Configure</button></div>}
    {(['massive', 'coingecko', 'nationalbank'] as const).map(provider => <details className="provider-row" key={provider} ref={provider === 'massive' ? details : undefined}>
      <summary><div><strong>{names[provider]}</strong><small>{running === provider ? 'Tester…' : configured[provider as CredentialProvider] && ['Not configured', 'Public access · not tested'].includes(status[provider]) ? 'Saved locally · not tested' : readable(status[provider])}</small><small>{provider === 'massive' ? 'Alle fem aktiver · kanonisk risikohistorik' : provider === 'coingecko' ? 'kun aktuelle crypto-referencer' : 'Kanonisk historisk USD/DKK · ingen nøgle'}</small></div></summary>
      <div className="provider-actions">
        {provider !== 'nationalbank' && <>
          <button type="button" disabled={working || disabled} aria-label={(configured[provider] ? 'Replace key' : 'Connect') + ' ' + names[provider]} onClick={() => setSheet(provider)}>{configured[provider] ? 'Replace key' : 'Connect'}</button>
          {configured[provider] && <>
            <button type="button" disabled={working || disabled || !online} aria-label={'Test connection ' + names[provider]} onClick={() => void testProvider(provider)}>Test connection</button>
            <button type="button" disabled={working || disabled} aria-label={'Remove key ' + names[provider]} onClick={() => {
              try { credentials().remove(provider); syncCredentials(); setStatus(s => ({ ...s, [provider]: provider === 'massive' ? 'Not configured' : 'Public access · not tested' })); }
              catch (e) { setMessage(safeError(e)); }
            }}>Remove key</button>
          </>}
        </>}
        {provider === 'coingecko' && !configured.coingecko && <button type="button" disabled={working || disabled || !online} aria-label="Test public access CoinGecko" onClick={() => void testProvider('coingecko', true)}>Test public access</button>}
        {provider === 'nationalbank' && <button type="button" disabled={working || disabled || !online} onClick={() => void testProvider(provider)}>Test feed</button>}
      </div>
    </details>)}
    <div className="risk-refresh" aria-busy={riskRunning}>
      <div className="section-heading"><h4>Synkroniseret risikohistorik</h4><span className="micro">{lookback} US-sessioner</span></div>
      <p className="small" data-testid="accepted-risk-status">{acceptedStatus}</p>
      <p className="micro">TSM issuer-evidens: 2025-01-01–2026-10-08. Senere og bredere perioder afvises uden ny officiel evidens.</p>
      {dataset && <p className="micro">{dataset.rows[0].date} – {dataset.rows.at(-1)!.date} · hentet {time(dataset.acquiredAt)}</p>}
      <button type="button" disabled={working || disabled || !onAcceptRiskDataset || !online || !!cacheIssue} onClick={() => void refreshRisk()}>Opdatér risikohistorik</button>
      <p className="micro">Massive + Nationalbanken. Alle fem aktiver, corporate actions, FX og kalender skal bestå før accept. Første hentning kan tage flere minutter med begrænset request-rate. Ingen automatisk opdatering af holdings eller manuelle priser.</p>
      {riskRunning && <><InfinityLoader label={stageLabel} compact /><button type="button" disabled={phase === 'saving'} onClick={() => abort.current?.abort()}>Annullér opdatering</button></>}
      {phase === 'ready' && <p className="small verified">Klar · risikohistorik gemt</p>}
      {dataset?.classification === 'user-supplied' && <p className="micro">Den eksisterende godkendelse af brugerdata under Historiske markedsdata kræves stadig til beregning.</p>}
    </div>
    <div className="button-stack">
      {running && <><InfinityLoader label={message || 'Tester forbindelse…'} compact /><button type="button" onClick={() => abort.current?.abort()}>Cancel request</button></>}
    </div>
    <p className="small break" role="status">{working ? '' : readable(message)}</p>
    <ErrorDetail value={message} />
    {cacheIssue && <button type="button" disabled={working || disabled} onClick={() => void recoverCache()}>{cacheIssue === 'CACHE_INVALID' ? 'Slet kun market-cache' : 'Prøv market-cache igen'}</button>}
    {!!latest.size && <details className="reference-details">
      <summary>Valuation references</summary>
      <div data-testid="market-references" className="market-references">
        <p className="small">Ikke en synkroniseret live-porteføljeværdi. Referencer ændrer ikke covariance/ERC eller manuelle DKK-priser. FX er daily reference; aktier er EOD.</p>
        {[...latest.values()].map(({ observation: q, cached }) => <div className="reference-row" key={q.provider + '|' + q.instrument}>
          <strong>{q.instrument}: {q.price.toLocaleString('da-DK', { maximumFractionDigits: 8 })} {q.unit === 'USD' ? 'USD' : 'DKK/USD'}</strong>
          <small>{freshness(q, new Date(clock).toISOString(), online, cached)} · {names[q.provider]} · {q.observationTimestamp ? time(q.observationTimestamp) : q.observationDate}</small>
          <small>Hentet {time(q.acquiredAt)} · {q.kind}</small>
        </div>)}
      </div>
    </details>}
    <p className="small">Nøgler opbevares separat fra finansiel backup, recovery og snapshots. Lokal browserlagring er ikke sikker secret storage. En gemt nøgle beviser ikke gyldig adgang.</p>
    <small className="micro">App {UI_VERSION} · MarketDataModel {MARKET_DATA_MODEL_VERSION}</small>
    {sheet && <CredentialSheet provider={sheet} onBusyChange={onBusyChange} onClose={() => setSheet(null)} onSaved={() => { syncCredentials(); setStatus(s => ({ ...s, [sheet]: 'Saved locally · not tested' })); }} />}
  </section>;
}
