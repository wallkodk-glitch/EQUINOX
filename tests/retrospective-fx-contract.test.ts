import { expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { demoDataset } from '../src/market-data/demo';
import { prepareRisk, datasetSchema } from '../src/market-data/provider';
import { calculate, inputFromState } from '../src/snapshots/calculate';
import { seal, validateSeal } from '../src/snapshots/integrity';
import { initialState } from '../src/persistence/schema';
import { Store } from '../src/persistence/store';
import { CredentialStore } from '../src/market-data/live/credentials';

const now = '2026-10-07T12:00:00.000Z';
const policy = 'NATIONALBANK_RETROSPECTIVE_DATE_ONLY_PREVIOUS_COPENHAGEN_DATE_MAX_6D_V1';
const source = 'https://api.statbank.dk/v1/data/DNVALD/JSONSTAT';
// Deliberately synthetic prices/rates. Expected dates and rates are independently
// specified here, not computed with the production as-of selector or adapter.
function histories() {
  const legacy = demoDataset(now); legacy.rows = legacy.rows.slice(-253);
  const points = legacy.rows.map(row => ({
    observationDate:new Date(Date.parse(row.date)-86400000).toISOString().slice(0,10),
    rate:row.fx.rate, acquiredAt:now, provider:'nationalbank' as const,
    sourceURL:source, unit:'DKK_PER_USD' as const,
  }));
  legacy.rows.forEach((row,i) => {
    row.fx.observedAt=`${points[i].observationDate}T12:00:00.000Z`;
    row.fx.publishedAt=`${points[i].observationDate}T13:00:00.000Z`;
  });
  const retrospective = {...legacy,schemaVersion:2,fxPolicy:policy,fxHistory:points,
    rows:legacy.rows.map((row,i) => ({...row,fx:{rate:row.fx.rate,observationDate:points[i].observationDate}}))};
  return {legacy,retrospective};
}
it('accepts an explicit retrospective date-only FX contract without invented economic clocks', () => {
  const {legacy,retrospective}=histories();
  const expected=prepareRisk(legacy,now,252), actual=prepareRisk(retrospective,now,252);
  expect(actual.returns).toEqual(expected.returns);
  expect(actual.levelsDKK).toEqual(expected.levelsDKK);
  expect(actual.returnDates).toEqual(expected.returnDates);
  expect(actual.fxPolicy).toBe(policy);
  expect(actual.warnings).toContain('RETROSPECTIVE_FX_NOT_POINT_IN_TIME');
  expect(JSON.stringify(datasetSchema.parse(retrospective))).not.toMatch(/publishedAt|observedAt/);
});
it('selects the latest strictly preceding date, including weekends, without same-day availability inference', () => {
  const {retrospective}=histories(), last=retrospective.rows.at(-1)!;
  retrospective.fxHistory.push({...retrospective.fxHistory.at(-1)!,observationDate:last.date,rate:8});
  expect(prepareRisk(retrospective,now,252).returns).toHaveLength(252);
  const old=retrospective.fxHistory.at(-3)!;
  last.fx={observationDate:old.observationDate,rate:old.rate};
  expect(() => prepareRisk(retrospective,now,252)).toThrow('FX_ASOF_MISMATCH');
});
it('rejects identical duplicate FX dates as well as conflicting observations', () => {
  for (const conflicting of [false,true]) {
    const {retrospective}=histories(), point=retrospective.fxHistory[20];
    retrospective.fxHistory.splice(21,0,{...point,rate:conflicting?point.rate+0.01:point.rate});
    expect(() => prepareRisk(retrospective,now,252)).toThrow(conflicting?'FX_OBSERVATION_CONFLICT':'DUPLICATE_FX_DATE');
  }
});
it('rejects future FX dates/acquisitions, missing FX, >6-day as-of and incompatible timestamp contracts', () => {
  const {retrospective}=histories();
  retrospective.fxHistory[0].observationDate='2026-10-08';
  expect(() => prepareRisk(retrospective,now,252)).toThrow('FUTURE_FX_DATE');
  const acquisition=histories().retrospective;
  acquisition.fxHistory[0].acquiredAt='2026-10-08T12:00:00.000Z';
  expect(() => prepareRisk(acquisition,now,252)).toThrow('DATA_ACQUISITION_BEFORE_OBSERVATION');
  const missing=histories().retrospective; missing.fxHistory=[];
  expect(() => prepareRisk(missing,now,252)).toThrow('DATA_SCHEMA_INVALID');
  const stale=histories().retrospective;
  stale.fxHistory[0].observationDate=new Date(Date.parse(stale.rows[0].date)-7*86400000).toISOString().slice(0,10);
  stale.rows[0].fx.observationDate=stale.fxHistory[0].observationDate;
  expect(() => prepareRisk(stale,now,252)).toThrow('FX_DATA_MISSING');
  expect(() => prepareRisk({...histories().retrospective,fxPolicy:'ASOF_PUBLISHED_DKK_PER_USD_MAX_120H_V1'},now,252)).toThrow('DATA_SCHEMA_INVALID');
  const mixed=histories().retrospective;
  Object.assign(mixed.rows[0].fx,{publishedAt:'2025-01-01T00:00:00.000Z'});
  expect(() => prepareRisk(mixed,now,252)).toThrow('DATA_SCHEMA_INVALID');
});
it('retains Engine mathematics while versioning and immutably replaying date-only snapshots', async () => {
  const {legacy,retrospective}=histories(), state=initialState();
  state.model='erc'; state.lookback=252;
  state.holdings.forEach(h=>{h.units=1;h.priceDKK=100;h.priceAsOf=now;});
  state.dataset=legacy;
  const old=calculate(inputFromState(state,now));
  const parsed=datasetSchema.parse(retrospective);
  state.dataset=parsed;
  const result=calculate(inputFromState(state,now));
  expect(result.schemaVersion).toBe(2);expect(result.versions.snapshot).toBe(2);
  expect(result.versions.engine).toBe('1.0.1');expect(old.schemaVersion).toBe(1);
  for (const key of ['rawTarget','constrainedTarget','continuousBuy','execution','risk','diagnostics'] as const) expect(result.output[key]).toEqual(old.output[key]);
  expect(Object.isFrozen(result.input.dataset)).toBe(true);
  const sealed=await seal(result);expect(await validateSeal(sealed)).toEqual(sealed);
  expect(calculate(inputFromState(state,now))).toEqual(result);
  const incompatible=structuredClone(sealed);incompatible.snapshot.versions.snapshot=1;
  await expect(validateSeal(incompatible)).rejects.toThrow('UNSUPPORTED_MODEL_VERSION');
});
it('backs up/restores date-only data and version-2 snapshots without touching isolated credentials', async () => {
  const state=initialState();state.lookback=252;state.dataset=datasetSchema.parse(histories().retrospective);
  state.holdings.forEach(h=>{h.units=1;h.priceDKK=100;h.priceAsOf=now;});
  const values=new Map<string,string>();
  const credentials=new CredentialStore({getItem:k=>values.get(k)??null,setItem:(k,v)=>{values.set(k,v);},removeItem:k=>{values.delete(k);}});
  const secret=crypto.randomUUID();credentials.save('massive',secret);
  const db=await Store.open(crypto.randomUUID());
  const saved=await db.save(state,0,await seal(calculate(inputFromState(state,now))));
  const backup=await db.backup();expect(backup).not.toContain(secret);
  await db.restore(backup,saved.revision);expect(credentials.read('massive')).toBe(secret);
  expect((await db.load()).state.dataset).toEqual(state.dataset);db.close();
});
