import { it, expect } from 'vitest';
import 'fake-indexeddb/auto';
import { MarketCache, freshness } from '../src/market-data/live/cache';
import { parseCoinGecko } from '../src/market-data/live/coingecko';
import { parseMassiveBars } from '../src/market-data/live/massive';
import stockFixture from './fixtures/providers/massive-stock.raw.json';
const acquired = '2026-10-02T23:00:00.000Z';
const fixture = () => parseCoinGecko({ bitcoin: { usd: 100000, last_updated_at: 1790981940 }, ethereum: { usd: 4000, last_updated_at: 1790981940 } }, acquired);
it('validated cache persists after reopen without contaminating financial database', async () => {
 const name=crypto.randomUUID(),cache=await MarketCache.open(name); await cache.put(fixture()); cache.close();
 const reopened=await MarketCache.open(name);
 expect((await reopened.all()).map(r=>[r.instrument,r.price,r.acquiredAt])).toEqual([['BTC',100000,acquired],['ETH',4000,acquired]]); reopened.close();
});
it('cache refuses unknown fields so echoed provider credentials cannot enter persistence', async () => {
 const cache=await MarketCache.open(crypto.randomUUID());
 await expect(cache.put([{...fixture()[0],error:crypto.randomUUID()}])).rejects.toThrow('CACHE_INVALID');
 expect(await cache.all()).toEqual([]); cache.close();
});
it('cache rejects inconsistent provider, instrument, currency and timestamp roles', async () => {
 const cache=await MarketCache.open(crypto.randomUUID()),row=fixture()[0];
 for(const change of [{instrument:'GOOGL'},{unit:'DKK_PER_USD'},{kind:'equity-eod'},{providerTimestamp:null},{observationDate:'2026-10-01'},{bucketEnd:acquired}]) await expect(cache.put([{...row,...change}])).rejects.toThrow('CACHE_INVALID');
 cache.close();
});
it('cache rejects future observations and conflicting same observation identities atomically', async () => {
 const cache=await MarketCache.open(crypto.randomUUID()),rows=fixture(); await cache.put(rows);
 await expect(cache.put([{...rows[0],price:1}])).rejects.toThrow('DUPLICATE_OBSERVATION');
 await expect(cache.put([{...rows[0],acquiredAt:'2020-01-01T00:00:00.000Z'}])).rejects.toThrow('FUTURE_OBSERVATION');
 expect((await cache.all()).map(r=>r.price)).toEqual([100000,4000]); cache.close();
});
it('cached equity dates must match the provider window and a completed canonical session', async () => {
 const cache=await MarketCache.open(crypto.randomUUID()),stock=parseMassiveBars(stockFixture,'GOOGL','day',acquired)[0];
 for(const change of [{observationDate:'2026-10-05',acquiredAt:'2026-10-05T23:00:00.000Z'},{providerTimestamp:'2026-10-02T04:30:00.000Z'},{observationDate:'2026-10-03',providerTimestamp:'2026-10-03T04:00:00.000Z',acquiredAt:'2026-10-05T23:00:00.000Z'}]) await expect(cache.put([{...stock,...change}])).rejects.toThrow('CACHE_INVALID');
 await expect(cache.put([{...stock,acquiredAt:'2026-10-02T19:00:00.000Z'}])).rejects.toThrow('FUTURE_OBSERVATION');
 expect(await cache.all()).toEqual([]); await cache.put([stock]); expect(await cache.all()).toEqual([stock]); cache.close();
});
it('offline, stale and cached statuses never say live or current', () => {
 const q=fixture()[0]; expect(freshness(q,acquired,true,false)).toBe('CURRENT'); expect(freshness(q,acquired,true,true)).toBe('CACHED'); expect(freshness(q,acquired,false,true)).toBe('OFFLINE'); expect(freshness(q,'2026-10-03T00:00:00.000Z',true,true)).toBe('STALE');
});
