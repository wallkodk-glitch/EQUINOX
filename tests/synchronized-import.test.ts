import { expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { ASSETS } from '../src/domain/core';
import { sessionWindow } from '../src/market-data/calendar';
import { demoDataset } from '../src/market-data/demo';
import { prepareRisk } from '../src/market-data/provider';
import { buildSynchronizedRisk, refreshSynchronizedRisk } from '../src/market-data/live/synchronized';
import { riskActionEvidence } from '../src/market-data/live/risk-actions';
import { MassiveAdapter } from '../src/market-data/live/massive';
import { MarketCache } from '../src/market-data/live/cache';
import { NATIONALBANK_HISTORY_SOURCE, type Observation } from '../src/market-data/live/model';
import * as nationalbank from '../src/market-data/live/nationalbank-history';
import tsm from './fixtures/providers/tsm-dividends.raw.json';

const now='2026-10-07T12:00:00.000Z';
function fixture(at=now) {
  const grid=sessionWindow(at,252);
  const observations=Object.fromEntries(ASSETS.map((instrument,i)=>[instrument,grid.map((s,k):Observation=>({
    schemaVersion:1,dataModelVersion:'1.1.1',provider:'massive',instrument,
    observationDate:s.date,observationTimestamp:s.close,providerTimestamp:new Date(Date.parse(s.close)-60000).toISOString(),
    acquiredAt:at,price:i===2?100:100+k*0.07*(i+1)+Math.sin((k+1)*(i+1))*2,
    unit:'USD',kind:i<3?'equity-minute':'crypto-minute',bucketStart:new Date(Date.parse(s.close)-60000).toISOString(),
    bucketEnd:s.close,sourceURL:'https://api.massive.com',semantics:'LAST_ELIGIBLE_TRADE_IN_MINUTE',
  }))])) as Record<(typeof ASSETS)[number],Observation[]>;
  // Explicitly synthetic business-date FX points, not an official history fixture.
  const dates=grid.map(s=>{
    let ms=Date.parse(s.date)-86400000;
    while([0,6].includes(new Date(ms).getUTCDay()))ms-=86400000;
    return new Date(ms).toISOString().slice(0,10);
  });
  const fx=[...new Set(dates)].sort().map((date):Observation=>({
    schemaVersion:1,dataModelVersion:'1.1.1',provider:'nationalbank',instrument:'USD/DKK',
    observationDate:date,observationTimestamp:null,providerTimestamp:null,acquiredAt:at,price:6.658,
    unit:'DKK_PER_USD',kind:'fx-reference',bucketStart:null,bucketEnd:null,sourceURL:NATIONALBANK_HISTORY_SOURCE,
    semantics:'NATIONALBANK_DATE_ONLY_DKK_PER_100_DIVIDED_BY_100',
  }));
  const from=grid[0].date,to=grid.at(-1)!.date;
  const corporateActions=(['GOOGL','ISRG','TSM'] as const).map(ticker=>riskActionEvidence(
    [],ticker==='TSM'?tsm.filter(e=>e.ex_dividend_date>=from&&e.ex_dividend_date<=to):[],ticker,from,to,at));
  return {now:at,lookback:252,observations,fx,corporateActions};
}
it('constructs all five assets and retrospective FX atomically, with gross ADR dividend reinvestment exactly once', () => {
  const data=buildSynchronizedRisk(fixture()), prepared=prepareRisk(data,now,252);
  expect(data.schemaVersion).toBe(2);expect(data.rows).toHaveLength(253);expect(prepared.returns).toHaveLength(252);
  const index=prepared.returnDates.indexOf('2026-09-16');expect(index).toBeGreaterThan(-1);
  expect(prepared.returns[index][2]).toBeCloseTo(0.01096251,14);
  expect(data.rows.find(r=>r.date==='2026-09-16')!.dividendUSD[2]).toBe(1.096251);
  expect(data.provenance!.marketObservations).toHaveLength(1265);
  expect(Object.isFrozen(data)).toBe(true);expect(buildSynchronizedRisk(fixture())).toEqual(data);
  expect(JSON.stringify(data)).not.toMatch(/authorization|apiKey|publishedAt|observedAt/i);
});
it('the full synchronized gate accepts October 8 without rebooking the ADR payment or relaxing FX/calendar semantics', () => {
  // Synthetic prices/FX only: this is a boundary integration test, NOT live acquisition evidence.
  const acquiredAt='2026-10-09T12:00:00.000Z';
  const data=buildSynchronizedRisk(fixture(acquiredAt)),prepared=prepareRisk(data,acquiredAt,252);
  expect(data.rows.at(-1)).toMatchObject({date:'2026-10-08',closeAt:'2026-10-08T20:00:00.000Z',dividendUSD:[0,0,0]});
  expect(data.provenance!.corporateActions.find(a=>a.ticker==='TSM')!.to).toBe('2026-10-08');
  expect(prepared.coverage).toBe(1);expect(prepared.missingDates).toEqual([]);expect(prepared.returns).toHaveLength(252);
  const ex=prepared.returnDates.indexOf('2026-09-16');
  expect(ex).toBeGreaterThan(-1);expect(prepared.returns[ex][2]).toBeCloseTo(0.01096251,14);
  expect(data.provenance!.marketObservations).toHaveLength(1265);
  expect(data.provenance!.fxAvailability).toBe('RETROSPECTIVE_DATE_ONLY_NOT_POINT_IN_TIME');
  expect(JSON.stringify(data)).not.toMatch(/authorization|apiKey|publishedAt|observedAt/i);
});
it('fails closed on any missing asset/close, current crypto, daily stock c, mixed provider or malformed observation', () => {
  for (const change of [
    (f:ReturnType<typeof fixture>)=>{f.observations.GOOGL.splice(10,1);},
    (f:ReturnType<typeof fixture>)=>{f.observations.ETH.splice(10,1);},
    (f:ReturnType<typeof fixture>)=>{f.observations.BTC[10].kind='crypto-current';},
    (f:ReturnType<typeof fixture>)=>{f.observations.TSM[10].kind='equity-eod';},
    (f:ReturnType<typeof fixture>)=>{f.observations.ETH[10].instrument='BTC';},
    (f:ReturnType<typeof fixture>)=>{f.observations.ISRG[10].sourceURL='https://api.coingecko.com/api/v3/simple/price';},
    (f:ReturnType<typeof fixture>)=>{f.observations.BTC[10].price=NaN;},
    (f:ReturnType<typeof fixture>)=>{f.observations.GOOGL[10].acquiredAt='2025-01-01T00:00:00.000Z';},
    (f:ReturnType<typeof fixture>)=>{f.observations.ETH[10].bucketEnd='2026-01-01T00:00:00.000Z';},
    (f:ReturnType<typeof fixture>)=>{f.observations.ISRG.push({...f.observations.ISRG[0]});},
  ]) {const f=fixture();change(f);expect(()=>buildSynchronizedRisk(f)).toThrow();}
});
it('fails closed on incomplete/uncertain actions, missing/stale/conflicting/future FX or any failed Data Quality Gate', () => {
  for(const change of [
    (f:ReturnType<typeof fixture>)=>{f.corporateActions.pop();},
    (f:ReturnType<typeof fixture>)=>{f.corporateActions[2].dividends.pop();},
    (f:ReturnType<typeof fixture>)=>{f.corporateActions[0].to='2026-09-01';},
    (f:ReturnType<typeof fixture>)=>{f.fx=[];},
    (f:ReturnType<typeof fixture>)=>{f.fx=f.fx.slice(0,-6);},
    (f:ReturnType<typeof fixture>)=>{f.fx.push({...f.fx[0],price:7});},
    (f:ReturnType<typeof fixture>)=>{f.fx[0].observationDate='2026-10-08';},
    (f:ReturnType<typeof fixture>)=>{f.observations.GOOGL[50].price=1000000;},
  ]){const f=fixture();change(f);expect(()=>buildSynchronizedRisk(f)).toThrow();}
});
it('the existing gate independently rejects inconsistent normalized provenance, not just the bridge', () => {
  const data=structuredClone(buildSynchronizedRisk(fixture()));
  data.provenance!.marketObservations[20].price+=1;
  expect(()=>prepareRisk(data,now,252)).toThrow('PROVENANCE_MISMATCH');
});
it('a synchronized provider cannot bypass gross corporate-action proof by deleting provenance', () => {
  const data=structuredClone(buildSynchronizedRisk(fixture()));
  for(const change of [
    (d:typeof data)=>{d.rows.find(r=>r.date==='2026-09-16')!.dividendUSD[2]=0.866038;},
    (d:typeof data)=>{d.rows[50].closeUSD[0]+=0.01;},
  ]) {
    const corrupted=structuredClone(data);change(corrupted);
    expect(()=>prepareRisk(corrupted,now,252)).toThrow('PROVENANCE_MISMATCH');
    delete corrupted.provenance;
    expect(()=>prepareRisk(corrupted,now,252)).toThrow('PROVENANCE_MISMATCH');
  }
  const legacy=demoDataset(now);legacy.provider=data.provider;
  // Legacy V1 provider names were free-form manual metadata; a new V2-only
  // identity rule must not invalidate previously valid immutable snapshots.
  expect(()=>prepareRisk(legacy,now,252)).not.toThrow();
  delete data.provenance;
  // Explicit manual date-only imports retain the pre-existing acknowledgment
  // contract; they must not be silently certified as synchronized provider data.
  data.provider='MANUAL_RETROSPECTIVE_IMPORT_V1';
  expect(prepareRisk(data,now,252).warnings).toContain('USER_SUPPLIED_NOT_INDEPENDENTLY_VERIFIED');
});
it('refresh commits no partial cache on failure, never returns a credential, and reuses complete canonical cache', async () => {
  vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date(now));const f=fixture(),key=crypto.randomUUID();
  const closes=vi.spyOn(MassiveAdapter.prototype,'canonicalCloses').mockImplementation(async instrument=>f.observations[instrument]);
  const actions=vi.spyOn(MassiveAdapter.prototype,'riskActions').mockImplementation(async ticker=>f.corporateActions.find(a=>a.ticker===ticker)!);
  const fx=vi.spyOn(nationalbank,'historicalFX').mockResolvedValue(f.fx);
  const cache=await MarketCache.open(crypto.randomUUID());
  try {
    actions.mockRejectedValueOnce(new Error(key));
    await expect(refreshSynchronizedRisk({key,lookback:252,cache})).rejects.toThrow('RISK_INTEGRATION_BLOCKED');
    expect(await cache.all()).toEqual([]);
    const data=await refreshSynchronizedRisk({key,lookback:252,cache});
    expect(JSON.stringify(data)).not.toContain(key);expect((await cache.all()).length).toBeGreaterThan(1265);
    const calls=closes.mock.calls.length;
    const replay=await refreshSynchronizedRisk({key,lookback:252,cache});
    expect(closes.mock.calls).toHaveLength(calls);expect(replay.rows).toEqual(data.rows);
    expect(replay.provenance!.cacheUsed).toBe(true);
    expect(fx).toHaveBeenCalledTimes(2);
  } finally {cache.close();vi.restoreAllMocks();vi.useRealTimers();}
});
it('missing credentials and pre-aborted jobs are rejected before any network or cache mutation', async () => {
  const get=vi.spyOn(MassiveAdapter.prototype,'canonicalCloses');
  await expect(refreshSynchronizedRisk({key:'',lookback:252})).rejects.toThrow('MISSING_CREDENTIAL');
  const c=new AbortController();c.abort();
  await expect(refreshSynchronizedRisk({key:crypto.randomUUID(),lookback:252,signal:c.signal})).rejects.toThrow('ABORTED');
  expect(get).not.toHaveBeenCalled();get.mockRestore();
});
it('reports acquisition, synchronization and validation truthfully without changing normalized output', async () => {
  vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date(now));const f=fixture(),phases:string[]=[];
  vi.spyOn(MassiveAdapter.prototype,'canonicalCloses').mockImplementation(async instrument=>f.observations[instrument]);
  vi.spyOn(MassiveAdapter.prototype,'riskActions').mockImplementation(async ticker=>f.corporateActions.find(a=>a.ticker===ticker)!);
  vi.spyOn(nationalbank,'historicalFX').mockResolvedValue(f.fx);
  try {
    const data=await refreshSynchronizedRisk({key:crypto.randomUUID(),lookback:252,onProgress:p=>phases.push(p.phase)});
    expect([...new Set(phases)]).toEqual(['acquiring','synchronizing','validating']);
    expect(data).toEqual(buildSynchronizedRisk(f));
  } finally {vi.restoreAllMocks();vi.useRealTimers();}
});
it('cancellation during the final cache write cannot return a ready risk dataset', async () => {
  vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date(now));const f=fixture(),c=new AbortController(),cache=await MarketCache.open(crypto.randomUUID());
  vi.spyOn(MassiveAdapter.prototype,'canonicalCloses').mockImplementation(async instrument=>f.observations[instrument]);
  vi.spyOn(MassiveAdapter.prototype,'riskActions').mockImplementation(async ticker=>f.corporateActions.find(a=>a.ticker===ticker)!);
  vi.spyOn(nationalbank,'historicalFX').mockResolvedValue(f.fx);
  const put=cache.put.bind(cache);vi.spyOn(cache,'put').mockImplementation(async rows=>{await put(rows);c.abort();});
  try {
    const result=await refreshSynchronizedRisk({key:crypto.randomUUID(),lookback:252,cache,signal:c.signal}).then(()=> 'READY',e=>e instanceof Error?e.message:'UNKNOWN');
    expect(result).toBe('ABORTED');
    expect((await cache.all()).length).toBeGreaterThan(1265); // validated market cache is not financial acceptance
  } finally {cache.close();vi.restoreAllMocks();vi.useRealTimers();}
});
