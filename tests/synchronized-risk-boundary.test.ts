import { expect, it } from 'vitest';
import { demoDataset } from '../src/market-data/demo';
import { prepareRisk } from '../src/market-data/provider';
import { ASSETS } from '../src/domain/core';
import { parseMassiveBars } from '../src/market-data/live/massive';
import { equityAtClose, cryptoAtClose } from '../src/market-data/live/timestamps';
import { parseHistoricalFX, historicalFXAsOf } from '../src/market-data/live/nationalbank-history';
import { calculate, inputFromState } from '../src/snapshots/calculate';
import { initialState } from '../src/persistence/schema';
import { validateSeal } from '../src/snapshots/integrity';
import fxRaw from './fixtures/providers/nationalbank-history.raw.json';
import legacy from './legacy-snapshot.json';
import current from '../validation/node-snapshot.json';

const now = '2026-10-06T12:00:00.000Z';
function synchronizedSyntheticDataset() {
  const dataset = demoDataset(now); dataset.rows = dataset.rows.slice(-253);
  // This is deliberately synthetic. Its known synthetic publication clocks
  // must never be used to assign publication times to actual Nationalbank rates.
  for (const row of dataset.rows) {
    row.closeUSD = row.closeUSD.map((price,i) => {
      const instrument = ASSETS[i], payload = { ticker:i<3?instrument:`X:${instrument}USD`, adjusted:false,status:'OK',resultsCount:1,
        results:[{t:Date.parse(row.closeAt)-60000,o:price,h:price,l:price,c:price,v:1}] };
      const bars = parseMassiveBars(payload,instrument,'minute',now);
      return (i<3?equityAtClose(bars,row.date,instrument as 'GOOGL'|'ISRG'|'TSM'):cryptoAtClose(bars,row.date)).price;
    });
  }
  return dataset;
}
it('the same normalized synchronized five-asset inputs produce identical frozen Engine output', () => {
  const state = initialState(); state.model='erc'; state.lookback=252;
  state.holdings.forEach(h => {h.units=1;h.priceDKK=100;h.priceAsOf=now;});
  state.dataset=demoDataset(now);
  const expected = calculate(inputFromState(state,now));
  state.dataset=synchronizedSyntheticDataset();
  const actual = calculate(inputFromState(state,now));
  expect(actual.output).toEqual(expected.output);
  expect(actual.versions.engine).toBe('1.0.1');
  expect(calculate(inputFromState(state,now))).toEqual(actual);
});
it('date-only real FX is rejected by the existing gate instead of receiving invented clocks', () => {
  const data = synchronizedSyntheticDataset();
  const fx = historicalFXAsOf(parseHistoricalFX(fxRaw,now),'2026-10-05');
  const raw = structuredClone(data) as unknown as {rows:{fx:unknown}[]};
  raw.rows.at(-1)!.fx = {rate:fx.price,observationDate:fx.observationDate,observedAt:null,publishedAt:null};
  expect(() => prepareRisk(raw,now,252)).toThrow('DATA_SCHEMA_INVALID');
});
it('synchronized risk fails closed on calendar mismatch, missing pair or unverified actions', () => {
  const data = synchronizedSyntheticDataset();
  data.rows[5].closeAt='2025-10-16T21:00:00.000Z';
  expect(() => prepareRisk(data,now,252)).toThrow('CALENDAR_ALIGNMENT_FAILED');
  const missing = synchronizedSyntheticDataset(); missing.rows.splice(5,1);
  expect(() => prepareRisk(missing,now,252)).toThrow('INSUFFICIENT_HISTORY');
  expect(() => prepareRisk({...synchronizedSyntheticDataset(),corporateActionsComplete:false},now,252)).toThrow('DATA_SCHEMA_INVALID');
});
it('both previously sealed snapshot versions replay with their original economic output and hash', async () => {
  expect(await validateSeal(legacy)).toEqual(legacy);
  expect(await validateSeal(current)).toEqual(current);
  expect(current.sha256).toBe('e491090dd7e2cf8a81bd33c23d67460158aab62bac455d2f177de25038c50891');
});
