import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { Store } from '../src/persistence/store';
import { initialState } from '../src/persistence/schema';
import { finishRiskImport } from '../src/ui/risk-import';
import { fxPayload, nativeFXResponse } from './fixtures/native-fx-projection';

const accepted = JSON.parse(readFileSync('validation/closure-final-synchronized.json', 'utf8'));
const providers = JSON.parse(readFileSync('validation/closure-final-provider-rows.json', 'utf8'));
const snapshot = JSON.parse(readFileSync('validation/node-snapshot.json', 'utf8'));
type Failure = 401 | 403 | 429 | 503 | 'network' | 'timeout' | 'schema' | 'empty' | 'partial' | 'dividend' | 'fx' | 'cancel';

async function scenario(failure?: Failure) {
  const store = await Store.open(crypto.randomUUID()), source = initialState();
  source.lookback = 252; source.dataset = accepted.normalizedInput; source.holdings[0].units = 17; source.holdings[0].priceDKK = 1234;
  const current = await store.save(source, 0, snapshot), before = await store.backup();
  vi.resetModules(); vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(new Date(accepted.validationAsOf));
  const { refreshSynchronizedRisk } = await import('../src/market-data/live/synchronized');
  const { MarketCache } = await import('../src/market-data/live/cache');
  const cache = await MarketCache.open(crypto.randomUUID());
  const key = crypto.randomUUID(), controller = new AbortController(), seen: string[] = [], progress: string[] = [];
  vi.stubGlobal('fetch', async (input: string, init: RequestInit) => {
    const url = new URL(input), headers = new Headers(init.headers); seen.push(input);
    expect(input.includes(key)).toBe(false);
    if (url.origin === 'https://api.massive.com') {
      expect(headers.get('Authorization')).toBe(`Bearer ${key}`);
      if (failure === 'cancel') controller.abort();
      if (typeof failure === 'number') return new Response(key, { status: failure });
      if (failure === 'network') throw new Error(key);
      if (failure === 'timeout') return new Promise<Response>((_resolve, reject) => init.signal!.addEventListener('abort', () => reject(new Error(key)), { once: true }));
      if (failure === 'schema') return new Response(JSON.stringify({ error: key }));
      if (url.pathname.includes('/aggs/')) {
        const symbol = url.pathname.split('/ticker/')[1].split('/range/')[0], instrument = symbol.replace('X:', '').replace('USD', '');
        const bars = failure === 'empty' || failure === 'partial' && instrument === 'ETH' ? [] : providers.data[instrument].bars;
        return new Response(JSON.stringify({ ticker: symbol, adjusted: false, status: 'OK', resultsCount: bars.length, results: bars }));
      }
      const ticker = url.searchParams.get('ticker')!, action = providers.actions[ticker];
      const rows = url.pathname.endsWith('splits') ? action.rawSplits : action.rawDividends;
      return new Response(JSON.stringify({ status: 'OK', results: failure === 'dividend' && ticker === 'TSM' && url.pathname.endsWith('dividends') ? [] : rows }));
    }
    expect(url.origin).toBe('https://api.statbank.dk'); expect(headers.has('Authorization')).toBe(false);
    if (url.pathname.includes('/tableinfo/')) return new Response(JSON.stringify({ id: 'DNVALD', variables: [
      { id: 'VALUTA', values: [{ id: 'USD', text: 'USD' }] },
      { id: 'KURTYP', values: [{ id: 'KBH', text: 'Exchange rates (DKK per 100 units of foreign currency)' }] },
      { id: 'Tid', values: Object.keys(fxPayload.dataset.dimension.Tid.category.index).map(id => ({ id, text: id })) },
    ] }));
    const payload = nativeFXResponse(url);
    if (failure === 'fx') payload.dataset.value[0] = -1;
    return new Response(JSON.stringify(payload));
  });
  try {
    let settled = false;
    const pending = refreshSynchronizedRisk({ key, lookback: 252, cache, signal: controller.signal, onProgress: p => progress.push(p.phase) })
      .then(async dataset => ({ state: await finishRiskImport(dataset, current, () => current, controller.signal, next => store.save(next, current.revision), new Date().toISOString()) }))
      .catch(error => ({ error: error.message as string })).finally(() => { settled = true; });
    for (let n = 0; n < 30 && !settled && !progress.includes('validating'); n++) await vi.advanceTimersByTimeAsync(13020);
    // After provider timers are finished, let real IndexedDB/WebCrypto tasks
    // complete naturally instead of treating one fake-timer tick as a disk save.
    expect(settled || progress.includes('validating')).toBe(true);
    const result = await pending;
    expect(JSON.stringify(result)).not.toContain(key);
    const after = await store.load(), backup = JSON.parse(await store.backup());
    expect(after.state.holdings).toEqual(current.holdings); expect(after.snapshots).toEqual([snapshot]);
    expect(backup).not.toHaveProperty('credentials'); expect(JSON.stringify(backup)).not.toContain(key);
    expect(JSON.stringify(await cache.all())).not.toContain(key);
    if (failure) {
      expect(after.state).toEqual(current); expect(backup.state).toEqual(JSON.parse(before).state); expect(await cache.all()).toEqual([]);
    } else {
      expect('state' in result, 'error' in result ? JSON.stringify({ error: result.error, progress, requests: seen.map(url => new URL(url).pathname) }) : 'READY').toBe(true);
      expect(after.state.dataset!.rows).toEqual(accepted.normalizedInput.rows);
      expect(after.state.dataset!.provider).toBe('MASSIVE_NATIONALBANK_SYNCHRONIZED_RETROSPECTIVE_V1');
      expect(after.state.acknowledgeUserData).toBe(false); expect((await cache.all()).length).toBeGreaterThan(1265);
      expect([...new Set(progress)]).toEqual(['acquiring', 'synchronizing', 'validating']);
      expect(seen.filter(url => url.includes('api.massive.com'))).toHaveLength(11);
      expect(seen.some(url => url.includes('coingecko'))).toBe(false);
    }
    return result;
  } finally { cache.close(); store.close(); vi.unstubAllGlobals(); vi.useRealTimers(); }
}
it('real adapter → synchronization → gate → atomic save succeeds for the accepted window without current valuation or credential writes', async () => {
  await scenario();
});
it.each([
  [401, 'AUTH_FAILED'], [403, 'ENTITLEMENT_DENIED'], [429, 'RATE_LIMITED'], [503, 'PROVIDER_UNAVAILABLE'],
  ['network', 'NETWORK_OR_CORS'], ['timeout', 'TIMEOUT'], ['schema', 'SCHEMA_INVALID'], ['empty', 'MISSING_OBSERVATION'],
  ['partial', 'MISSING_OBSERVATION'], ['dividend', 'CORPORATE_ACTION_UNVERIFIED'], ['fx', 'INVALID_FX'], ['cancel', 'ABORTED'],
] as const)('transport/data failure %s preserves previous financial state, snapshots and empty cache', async (failure, code) => {
  expect(await scenario(failure)).toEqual({ error: code });
});
