import { expect, it, vi } from 'vitest';
import { parseHistoricalFX, historicalFXAsOf, historicalFX } from '../src/market-data/live/nationalbank-history';
import { MarketCache } from '../src/market-data/live/cache';
import { allowedURL } from '../src/market-data/live/network';
import 'fake-indexeddb/auto';
import raw from './fixtures/providers/nationalbank-history.raw.json';
import expected from './fixtures/providers/nationalbank-history.expected.json';

const acquiredAt = '2026-10-06T12:00:00.000Z';
it('normalizes official DNVALD KBH USD rates with date-only economic metadata', () => {
  const rows = parseHistoricalFX(raw, acquiredAt);
  expect(rows.map(r => [r.observationDate, r.price])).toEqual(expected.rates);
  expect(rows.every(r => r.acquiredAt === acquiredAt && r.observationTimestamp === null && r.providerTimestamp === null)).toBe(true);
  expect(rows.every(r => r.provider === 'nationalbank' && r.instrument === 'USD/DKK' && r.unit === 'DKK_PER_USD')).toBe(true);
});
it('the historical adapter selects official metadata dates and sends no credential to StatBank', async () => {
  const metadata = {id:'DNVALD',variables:[
    {id:'VALUTA',values:[{id:'USD',text:'US Dollars'}]},
    {id:'KURTYP',values:[{id:'KBH',text:'Exchange rates (DKK per 100 units of foreign currency)'}]},
    {id:'Tid',values:[{id:'2026M10D01',text:'2026M10D01'},{id:'2026M10D02',text:'2026M10D02'},{id:'2026M10D05',text:'2026M10D05'}]},
  ]};
  const seen:{url:string;headers:Headers}[]=[];
  vi.stubGlobal('fetch',async (url:string, options:RequestInit) => {
    seen.push({url,headers:new Headers(options.headers)});
    return new Response(JSON.stringify(seen.length===1?metadata:raw));
  });
  try {
    expect((await historicalFX('2026-10-01','2026-10-05')).map(r => r.price)).toEqual([6.6169,6.658,6.6713]);
    expect(seen).toHaveLength(2);
    expect(seen[0].url).toBe('https://api.statbank.dk/v1/tableinfo/DNVALD?format=JSON&lang=en');
    expect(new URL(seen[1].url).searchParams.get('Tid')).toBe('>=2026M10D01<=2026M10D05');
    expect(seen[1].url.length).toBeLessThan(200); // No years of dates in an oversized GET URL.
    expect(seen.every(r => !r.headers.has('Authorization')&&!r.headers.has('x-cg-demo-api-key'))).toBe(true);
    expect(allowedURL('https://api.statbank.dk/v1/data/OTHER/JSONSTAT','nationalbank')).toBe(false);
    expect(allowedURL(seen[1].url,'massive')).toBe(false);
  } finally {vi.unstubAllGlobals();}
});
it('historical date-only observations survive offline cache reopen with conflicts rejected', async () => {
  const name=crypto.randomUUID(),cache=await MarketCache.open(name),rows=parseHistoricalFX(raw,acquiredAt);
  await cache.put(rows);cache.close();
  const reopened=await MarketCache.open(name);
  expect(await reopened.all()).toEqual(rows);
  await expect(reopened.put([{...rows[1],price:7}])).rejects.toThrow('FX_OBSERVATION_CONFLICT');
  expect(await reopened.all()).toEqual(rows);reopened.close();
});
it('uses the preceding Copenhagen date, never guesses a same-day publication clock', () => {
  const rows = parseHistoricalFX(raw, acquiredAt);
  expect(historicalFXAsOf(rows, '2026-10-02').observationDate).toBe('2026-10-01');
  expect(historicalFXAsOf(rows, '2026-10-05').price).toBe(6.658);
  expect(historicalFXAsOf(rows, '2026-10-06').price).toBe(6.6713);
  expect(() => historicalFXAsOf(rows, '2026-10-01')).toThrow('MISSING_OBSERVATION');
  expect(() => historicalFXAsOf(rows, '2026-10-12')).toThrow('STALE_DATA');
});
it('rejects sparse, non-finite, non-positive, wrong-currency or incompatible-unit history', () => {
  for (const values of [[661.69,null,667.13], [661.69,0,667.13], [661.69,-1,667.13], [661.69,Infinity,667.13], [661.69]]) {
    expect(() => parseHistoricalFX({dataset:{...raw.dataset,value:values}}, acquiredAt)).toThrow();
  }
  for (const change of [
    { source: 'Unverified source' },
    { dimension: {...raw.dataset.dimension,KURTYP:{...raw.dataset.dimension.KURTYP,category:{index:{INX:0},label:{INX:'Nominal index'}}}} },
    { dimension: {...raw.dataset.dimension,VALUTA:{...raw.dataset.dimension.VALUTA,category:{index:{EUR:0},label:{EUR:'Euro'}}}} },
  ]) expect(() => parseHistoricalFX({dataset:{...raw.dataset,...change}}, acquiredAt)).toThrow('SCHEMA_INVALID');
});
it('rejects future dates, duplicate indexes, conflicting FX dates and missing selected dates', () => {
  expect(() => parseHistoricalFX(raw, '2026-10-01T12:00:00.000Z')).toThrow('FUTURE_OBSERVATION');
  const bad = structuredClone(raw); bad.dataset.dimension.Tid.category.index['2026M10D02']=0;
  expect(() => parseHistoricalFX(bad, acquiredAt)).toThrow('DUPLICATE_OBSERVATION');
  expect(() => parseHistoricalFX(raw, acquiredAt, ['2026-10-01','2026-10-02','2026-10-05','2026-10-06'])).toThrow('MISSING_OBSERVATION');
  const rows = parseHistoricalFX(raw, acquiredAt);
  expect(() => historicalFXAsOf([...rows,{...rows[1],price:7}], '2026-10-05')).toThrow('FX_OBSERVATION_CONFLICT');
});
