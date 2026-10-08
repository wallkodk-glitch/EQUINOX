import { useEffect, useRef, useState } from 'react';
import { CredentialStore, type CredentialProvider } from '../market-data/live/credentials';
import { MarketCache, freshness } from '../market-data/live/cache';
import { MassiveAdapter } from '../market-data/live/massive';
import { currentCrypto } from '../market-data/live/coingecko';
import { currentFX } from '../market-data/live/nationalbank';
import { safeError, type Provider } from '../market-data/live/network';
import { MARKET_DATA_MODEL_VERSION, type Observation } from '../market-data/live/model';
import { time } from './format';
import { UI_VERSION } from './presentation';
import { Glyph, InfinityLoader } from './Glyph';

const names: Record<Provider, string> = { massive: 'Massive', coingecko: 'CoinGecko', nationalbank: 'Danmarks Nationalbank' };
const credentials = () => new CredentialStore(window.localStorage);
type DisplayObservation = { observation: Observation; cached: boolean };
async function probe(provider: Provider, key: string | null, signal: AbortSignal, progress: (n: number) => void) {
  if (provider === 'massive') return new MassiveAdapter(key ?? '').test(signal, progress);
  return provider === 'coingecko' ? currentCrypto(key, signal) : currentFX(signal);
}
function CredentialSheet({ provider, onClose, onSaved }: {
  provider: CredentialProvider; onClose: () => void; onSaved: () => void;
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
      if (input.current) input.current.value = '';
      element.close(); previous?.focus();
    };
  }, []);
  const test = async () => {
    if (pending.current) return;
    const key = input.current?.value.trim() ?? '';
    if (!key) { setStatus('MISSING_CREDENTIAL'); return; }
    if (!/^[\x21-\x7e]{1,512}$/.test(key)) { setStatus('INVALID_CREDENTIAL'); return; }
    pending.current = true; setTesting(true); setStatus('Tester…');
    const controller = new AbortController(); abort.current = controller;
    try {
      await probe(provider, key, controller.signal, n => { if (alive.current) setStatus(`Tester adgang: ${n}/11 requests`); });
      if (alive.current) setStatus('Connection verified. Save locally gemmer nøglen. Testen opdaterer ikke risikohistorik.');
    } catch (e) { if (alive.current) setStatus(safeError(e)); }
    finally { pending.current = false; if (alive.current) setTesting(false); }
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
      <div role="status" className="small break">{testing ? <InfinityLoader label={status} compact /> : status}</div>
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

export function MarketDataSettings({ online, disabled = false }: { online: boolean; disabled?: boolean }) {
  const [configured, setConfigured] = useState({ massive: false, coingecko: false });
  const [status, setStatus] = useState<Record<Provider, string>>({ massive: 'Not configured', coingecko: 'Public access · not tested', nationalbank: 'No key required · not tested' });
  const [sheet, setSheet] = useState<CredentialProvider | null>(null);
  const [running, setRunning] = useState<Provider | null>(null), [message, setMessage] = useState('');
  const [rows, setRows] = useState<DisplayObservation[]>([]), [clock, setClock] = useState(Date.now());
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
    }).catch(e => { if (alive.current) setMessage(safeError(e)); });
    const timer = setInterval(() => setClock(Date.now()), 30000);
    return () => { alive.current = false; abort.current?.abort(); cache.current?.close(); clearInterval(timer); removeEventListener('storage', stored); };
  }, []);
  const testProvider = async (provider: Provider, publicMode = false) => {
    if (busy.current || disabled) return;
    let key: string | null = null;
    try { if (provider !== 'nationalbank' && !publicMode) key = credentials().read(provider); }
    catch (e) { setMessage(safeError(e)); return; }
    if (provider === 'massive' && !key) { setSheet('massive'); return; }
    if (!online) { setMessage('OFFLINE · cache er ikke current'); return; }
    const controller = new AbortController(); abort.current = controller;
    busy.current = true; setRunning(provider); setMessage('');
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
    } finally { busy.current = false; if (alive.current) setRunning(null); }
  };
  const latest = new Map<string, DisplayObservation>();
  for (const row of rows) {
    const q = row.observation, key = `${q.provider}|${q.instrument}`, previous = latest.get(key);
    if (!previous || (q.observationTimestamp ?? q.observationDate) > (previous.observation.observationTimestamp ?? previous.observation.observationDate)) latest.set(key, row);
  }
  return <section className="card market-settings">
    <div className="section-heading"><div><span className="eyebrow">LOCAL CONNECTIONS</span><h3>Market Data</h3></div><span className="micro">Reference-data</span></div>
    {!configured.massive && <div className="market-config-line"><small>Market data not configured</small><button type="button" onClick={() => { if (details.current) details.current.open = true; }}>Configure</button></div>}
    {(['massive', 'coingecko', 'nationalbank'] as const).map(provider => <details className="provider-row" key={provider} ref={provider === 'massive' ? details : undefined}>
      <summary><div><strong>{names[provider]}</strong><small>{running === provider ? 'Tester…' : configured[provider as CredentialProvider] && ['Not configured', 'Public access · not tested'].includes(status[provider]) ? 'Saved locally · not tested' : status[provider]}</small></div></summary>
      <div className="provider-actions">
        {provider !== 'nationalbank' && <>
          <button type="button" disabled={!!running || disabled} aria-label={(configured[provider] ? 'Replace key' : 'Connect') + ' ' + names[provider]} onClick={() => setSheet(provider)}>{configured[provider] ? 'Replace key' : 'Connect'}</button>
          {configured[provider] && <>
            <button type="button" disabled={!!running || disabled || !online} aria-label={'Test connection ' + names[provider]} onClick={() => void testProvider(provider)}>Test connection</button>
            <button type="button" disabled={!!running || disabled} aria-label={'Remove key ' + names[provider]} onClick={() => {
              try { credentials().remove(provider); syncCredentials(); setStatus(s => ({ ...s, [provider]: provider === 'massive' ? 'Not configured' : 'Public access · not tested' })); }
              catch (e) { setMessage(safeError(e)); }
            }}>Remove key</button>
          </>}
        </>}
        {provider === 'coingecko' && !configured.coingecko && <button type="button" disabled={!!running || disabled || !online} aria-label="Test public access CoinGecko" onClick={() => void testProvider('coingecko', true)}>Test public access</button>}
        {provider === 'nationalbank' && <button type="button" disabled={!!running || disabled || !online} onClick={() => void testProvider(provider)}>Test feed</button>}
      </div>
    </details>)}
    <div className="button-stack">
      <button type="button" disabled aria-describedby="risk-refresh-blocked">Refresh market data · ikke aktiveret</button>
      <small className="micro" id="risk-refresh-blocked">RISK_INTEGRATION_BLOCKED i UI: automatisk risk-refresh er ikke aktiveret. Test connection / Test feed henter kun reference-data. Den accepterede v1.1.2-datakontrakt er uændret.</small>
      {running && <><InfinityLoader label={message || 'Tester forbindelse…'} compact /><button type="button" onClick={() => abort.current?.abort()}>Cancel request</button></>}
    </div>
    <p className="small break" role="status">{running ? '' : message}</p>
    {!!latest.size && <details className="reference-details" open>
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
    {sheet && <CredentialSheet provider={sheet} onClose={() => setSheet(null)} onSaved={() => { syncCredentials(); setStatus(s => ({ ...s, [sheet]: 'Saved locally · not tested' })); }} />}
  </section>;
}
