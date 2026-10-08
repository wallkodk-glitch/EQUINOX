import { expect, it, vi } from 'vitest';
import { parseMassiveBars, MassiveAdapter } from '../src/market-data/live/massive';
import { equityAtClose } from '../src/market-data/live/timestamps';
import { MarketCache, freshness } from '../src/market-data/live/cache';
import 'fake-indexeddb/auto';

// Literal session times are independent expectations, not computed by the adapter.
const acquiredAt = '2026-10-06T12:00:00.000Z';
const raw = (ticker: string, start: string) => ({ ticker, adjusted: false, status: 'OK', resultsCount: 1,
  results: [{ t: Date.parse(start), o: 100, h: 102, l: 99, c: 101, v: 1000 }] });

it.each(['GOOGL', 'ISRG', 'TSM'] as const)('parses %s minute bars without substituting a daily aggregate close', stock => {
  expect(parseMassiveBars(raw(stock, '2026-10-02T19:59:00.000Z'), stock, 'minute', acquiredAt)[0]).toMatchObject({
    provider: 'massive', instrument: stock, kind: 'equity-minute', price: 101,
    observationDate: '2026-10-02', providerTimestamp: '2026-10-02T19:59:00.000Z',
    observationTimestamp: '2026-10-02T20:00:00.000Z',
    bucketStart: '2026-10-02T19:59:00.000Z', bucketEnd: '2026-10-02T20:00:00.000Z', acquiredAt,
  });
});
it('connection test requests exact completed stock and crypto minutes with header authentication', async () => {
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-06T12:00:00.000Z'));
  const key=crypto.randomUUID(),requests:{url:URL;headers:Headers}[]=[];
  vi.stubGlobal('fetch',async (url:string,options:RequestInit) => {
    const u=new URL(url);requests.push({url:u,headers:new Headers(options.headers)});
    if (u.pathname.startsWith('/stocks/'))return new Response(JSON.stringify({status:'OK',results:[]}));
    const ticker=u.pathname.split('/')[4];
    return new Response(JSON.stringify(raw(ticker,'2026-10-05T19:59:00.000Z')));
  });
  try {
    const pending=new MassiveAdapter(key).test();
    await vi.runAllTimersAsync();const rows=await pending;
    expect(rows.map(r => [r.instrument,r.kind,r.observationTimestamp])).toEqual([
      ['GOOGL','equity-minute','2026-10-05T20:00:00.000Z'],
      ['ISRG','equity-minute','2026-10-05T20:00:00.000Z'],
      ['TSM','equity-minute','2026-10-05T20:00:00.000Z'],
      ['BTC','crypto-minute','2026-10-05T20:00:00.000Z'],
      ['ETH','crypto-minute','2026-10-05T20:00:00.000Z'],
    ]);
    expect(requests).toHaveLength(11);
    expect(requests.slice(0,5).every(r => r.url.pathname.endsWith('/range/1/minute/1791230340000/1791230399999'))).toBe(true);
    expect(requests.every(r => r.headers.get('Authorization')===`Bearer ${key}`&&!r.url.href.includes(key))).toBe(true);
  } finally {vi.unstubAllGlobals();vi.useRealTimers();}
});
it.each([
  ['2025-11-28','2025-11-28T17:59:00.000Z', '2025-11-28T18:00:00.000Z'],
  ['2026-03-06','2026-03-06T20:59:00.000Z', '2026-03-06T21:00:00.000Z'],
  ['2026-03-09','2026-03-09T19:59:00.000Z', '2026-03-09T20:00:00.000Z'],
])('selects the actual canonical final minute for %s', (date,start,end) => {
  const bars = parseMassiveBars(raw('TSM',start),'TSM','minute',acquiredAt);
  expect(equityAtClose(bars,date,'TSM').observationTimestamp).toBe(end);
});
it('rejects daily closes, wrong instruments, post-close/absent/duplicate/future points and non-sessions', () => {
  const bars = parseMassiveBars(raw('GOOGL','2026-10-02T19:59:00.000Z'),'GOOGL','minute',acquiredAt);
  const daily = parseMassiveBars(raw('GOOGL','2026-10-02T04:00:00.000Z'),'GOOGL','day',acquiredAt);
  const after = parseMassiveBars(raw('GOOGL','2026-10-02T20:00:00.000Z'),'GOOGL','minute',acquiredAt);
  for (const rows of [[],daily,after]) expect(() => equityAtClose(rows,'2026-10-02','GOOGL')).toThrow('MISSING_OBSERVATION');
  expect(() => equityAtClose(bars,'2026-10-02','TSM')).toThrow('MISSING_OBSERVATION');
  expect(() => equityAtClose([...bars,...bars],'2026-10-02','GOOGL')).toThrow('DUPLICATE_OBSERVATION');
  expect(() => equityAtClose([{...bars[0],acquiredAt:'2026-10-02T19:59:30.000Z'}],'2026-10-02','GOOGL')).toThrow('FUTURE_OBSERVATION');
  for (const date of ['2026-07-03','2026-10-03']) expect(() => equityAtClose(bars,date,'GOOGL')).toThrow('CALENDAR_MISMATCH');
});
it('canonical stock selection rejects normalized rows with incompatible units, semantics or model version', () => {
  const row=parseMassiveBars(raw('GOOGL','2026-10-02T19:59:00.000Z'),'GOOGL','minute',acquiredAt)[0];
  for (const invalid of [
    {...row,unit:'DKK_PER_USD' as const},
    {...row,semantics:'RAW_DAILY_BAR_CLOSE_TIME_UNVERIFIED' as const},
    {...row,dataModelVersion:'1.1.0' as const},
  ]) expect(() => equityAtClose([invalid],'2026-10-02','GOOGL')).toThrow('SCHEMA_INVALID');
});
it('persists final stock minutes and old model observations; rejects noncanonical cached minutes', async () => {
  const name = crypto.randomUUID(), cache = await MarketCache.open(name);
  const bar = parseMassiveBars(raw('GOOGL','2026-10-02T19:59:00.000Z'),'GOOGL','minute',acquiredAt)[0];
  const old = {...parseMassiveBars(raw('TSM','2026-10-02T04:00:00.000Z'),'TSM','day',acquiredAt)[0],dataModelVersion:'1.1.0' as const};
  await cache.put([bar,old]); cache.close();
  const reopened = await MarketCache.open(name);
  expect(await reopened.all()).toEqual([bar,old]);
  expect(freshness(bar,'2026-10-02T21:00:00.000Z',false,true)).toBe('OFFLINE');
  expect(freshness(bar,'2026-10-02T21:00:00.000Z',true,true)).toBe('STALE'); // acquisition is later than display clock
  const after = parseMassiveBars(raw('GOOGL','2026-10-02T20:00:00.000Z'),'GOOGL','minute',acquiredAt)[0];
  await expect(reopened.put([after])).rejects.toThrow('CACHE_INVALID');
  await expect(reopened.put([{...bar,dataModelVersion:'1.1.0'}])).rejects.toThrow('CACHE_INVALID');
  reopened.close();
});
it.each([
  ['2025-11-28T17:59:00.000Z', '2025-11-28T18:00:00.000Z'],
  ['2026-03-06T20:59:00.000Z', '2026-03-06T21:00:00.000Z'],
  ['2026-03-09T19:59:00.000Z', '2026-03-09T20:00:00.000Z'],
])('preserves stock minute timestamps for early close and both sides of DST: %s', (start, end) => {
  const bar = parseMassiveBars(raw('TSM', start), 'TSM', 'minute', acquiredAt)[0];
  expect([bar.bucketStart, bar.bucketEnd, bar.observationTimestamp]).toEqual([start, end, end]);
});
it('rejects an incomplete/future stock minute and retains unverified daily semantics', () => {
  expect(() => parseMassiveBars(raw('GOOGL', '2026-10-02T19:59:00.000Z'), 'GOOGL', 'minute', '2026-10-02T19:59:30.000Z')).toThrow('FUTURE_OBSERVATION');
  expect(parseMassiveBars(raw('GOOGL', '2026-10-02T04:00:00.000Z'), 'GOOGL', 'day', acquiredAt)[0]).toMatchObject({
    kind: 'equity-eod', observationTimestamp: null, semantics: 'RAW_DAILY_BAR_CLOSE_TIME_UNVERIFIED',
  });
});
