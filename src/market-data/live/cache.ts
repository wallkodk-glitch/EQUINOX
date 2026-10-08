import { MarketError } from './network';
import { observationSchema, SOURCES, NATIONALBANK_RSS_SOURCE, NATIONALBANK_HISTORY_SOURCE, type Observation } from './model';
import { canonicalSession, dayInZone, equityAtClose } from './timestamps';
import { sessionWindow } from '../calendar';

export type Freshness = 'CURRENT' | 'EOD' | 'CACHED' | 'STALE' | 'OFFLINE';
export function freshness(q: Observation, now: string, online: boolean, cached: boolean): Freshness {
  const ms = Date.parse(now);
  if (!online) return 'OFFLINE';
  if (!Number.isFinite(ms) || Date.parse(q.acquiredAt) > ms) return 'STALE';
  if (q.kind === 'crypto-current') {
    const age = ms - Date.parse(q.observationTimestamp ?? '');
    if (!Number.isFinite(age) || age < 0 || age > 15 * 60000) return 'STALE';
    return cached ? 'CACHED' : 'CURRENT';
  }
  if (q.kind === 'fx-reference') {
    const days = (Date.parse(dayInZone(ms, 'Europe/Copenhagen')) - Date.parse(q.observationDate)) / 86400000;
    if (days < 0 || days > 4) return 'STALE';
    return cached ? 'CACHED' : 'EOD';
  }
  try {
    if (q.observationDate !== sessionWindow(now, 252).at(-1)!.date) return 'STALE';
  } catch { return 'STALE'; }
  return cached ? 'CACHED' : 'EOD';
}
function validated(raw: unknown): Observation {
  const parsed = observationSchema.safeParse(raw);
  if (!parsed.success) throw new MarketError('CACHE_INVALID');
  const q = parsed.data, ms = Date.parse(q.acquiredAt);
  if (q.sourceURL !== SOURCES[q.provider] && !(q.provider === 'nationalbank' && [NATIONALBANK_RSS_SOURCE,NATIONALBANK_HISTORY_SOURCE].includes(q.sourceURL))) throw new MarketError('CACHE_INVALID');
  if (q.kind === 'equity-minute') {
    try { equityAtClose([q],q.observationDate,q.instrument as 'GOOGL'|'ISRG'|'TSM'); }
    catch(e) { if(e instanceof MarketError&&e.code==='FUTURE_OBSERVATION')throw e;throw new MarketError('CACHE_INVALID'); }
  }
  if (q.kind === 'equity-eod') {
    const start = Date.parse(q.providerTimestamp!);
    const localTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(start);
    if (dayInZone(start, 'America/New_York') !== q.observationDate || localTime !== '00:00:00' || start % 1000 !== 0) throw new MarketError('CACHE_INVALID');
    let close: string;
    try { close = canonicalSession(q.observationDate).close; } catch { throw new MarketError('CACHE_INVALID'); }
    if (Date.parse(close) > ms) throw new MarketError('FUTURE_OBSERVATION');
  }
  if ((q.observationTimestamp && Date.parse(q.observationTimestamp) > ms) ||
      (q.providerTimestamp && Date.parse(q.providerTimestamp) > ms) ||
      (q.bucketEnd && Date.parse(q.bucketEnd) > ms) ||
      q.observationDate > dayInZone(ms, q.provider === 'nationalbank' ? 'Europe/Copenhagen' : q.kind === 'equity-eod' ? 'America/New_York' : 'UTC')) throw new MarketError('FUTURE_OBSERVATION');
  return q;
}
const key = (q: Observation) => `${q.provider}|${q.instrument}|${q.kind}|${q.observationTimestamp ?? q.observationDate}`;
const read = <T>(r: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  r.onsuccess = () => resolve(r.result); r.onerror = () => reject(new MarketError('CACHE_UNAVAILABLE'));
});
const complete = (t: IDBTransaction) => new Promise<void>((resolve, reject) => {
  t.oncomplete = () => resolve(); t.onerror = t.onabort = () => reject(new MarketError('CACHE_UNAVAILABLE'));
});
export class MarketCache {
  private constructor(private db: IDBDatabase) {}
  static async open(name = 'EQUINOX_MARKET_DATA_V1'): Promise<MarketCache> {
    try {
      const r = indexedDB.open(name, 1); r.onupgradeneeded = () => r.result.createObjectStore('normalized');
      const db = await read(r); db.onversionchange = () => db.close(); return new MarketCache(db);
    } catch { throw new MarketError('CACHE_UNAVAILABLE'); }
  }
  close() { this.db.close(); }
  async all(): Promise<Observation[]> {
    try {
      const t = this.db.transaction('normalized'), done = complete(t);
      const raw = await read(t.objectStore('normalized').getAll()); await done; return raw.map(validated);
    } catch (e) { if (e instanceof MarketError) throw e; throw new MarketError('CACHE_UNAVAILABLE'); }
  }
  async put(input: unknown[]): Promise<void> {
    const rows = input.map(validated), batch = new Map<string, Observation>();
    for (const q of rows) {
      const previous = batch.get(key(q));
      if (previous && previous.price !== q.price) throw new MarketError(q.provider === 'nationalbank' ? 'FX_OBSERVATION_CONFLICT' : 'DUPLICATE_OBSERVATION');
      batch.set(key(q), q);
    }
    const t = this.db.transaction('normalized', 'readwrite'), done = complete(t); void done.catch(() => {});
    try {
      const store = t.objectStore('normalized');
      for (const [id, q] of batch) {
        const old = await read(store.get(id));
        if (old !== undefined) {
          const previous = validated(old);
          if (previous.price !== q.price) throw new MarketError(q.provider === 'nationalbank' ? 'FX_OBSERVATION_CONFLICT' : 'DUPLICATE_OBSERVATION');
        } else store.put(q, id);
      }
      await done;
    } catch (e) {
      try { t.abort(); } catch { /* Already aborted. */ }
      await done.catch(() => {}); if (e instanceof MarketError) throw e; throw new MarketError('CACHE_UNAVAILABLE');
    }
  }
}
