import { expect, it } from 'vitest';
import { historicalFXAsOf } from '../src/market-data/live/nationalbank-history';
import { retrospectiveFXAsOf, validateFXHistory } from '../src/market-data/retrospective-fx';
import { NATIONALBANK_HISTORY_SOURCE, type Observation } from '../src/market-data/live/model';

const acquiredAt='2026-10-07T12:00:00.000Z';
// Dates independently verified in the complete official DNVALD USD/KBH
// response and its metadata. The rate here is deliberately synthetic: this
// regression isolates availability/date semantics, not a price reference.
const observation=(date:string):Observation=>({schemaVersion:1,dataModelVersion:'1.1.1',provider:'nationalbank',instrument:'USD/DKK',
  observationDate:date,observationTimestamp:null,providerTimestamp:null,acquiredAt,price:6.658,unit:'DKK_PER_USD',kind:'fx-reference',
  bucketStart:null,bucketEnd:null,sourceURL:NATIONALBANK_HISTORY_SOURCE,semantics:'NATIONALBANK_DATE_ONLY_DKK_PER_100_DIVIDED_BY_100'});
it.each([
  ['2025-12-23','2025-12-29','2025-12-29T21:00:00.000Z'],
  ['2026-04-01','2026-04-07','2026-04-07T20:00:00.000Z'],
] as const)('accepts a genuine six-calendar-day official gap (%s → %s), without fabricating publication times', (previous,date,close)=>{
  const rows=[observation(previous),observation(date)];
  expect(historicalFXAsOf(rows,date).observationDate).toBe(previous); // same-day publication is not inferred.
  const points=rows.map(q=>({observationDate:q.observationDate,rate:q.price,acquiredAt:q.acquiredAt,provider:'nationalbank' as const,
    sourceURL:NATIONALBANK_HISTORY_SOURCE as typeof NATIONALBANK_HISTORY_SOURCE,unit:'DKK_PER_USD' as const}));
  validateFXHistory(points,acquiredAt);
  expect(retrospectiveFXAsOf(points,close).observationDate).toBe(previous);
});
it('rejects seven-day gaps and identical duplicate official dates',()=>{
  expect(()=>historicalFXAsOf([observation('2025-12-22')],'2025-12-29')).toThrow('STALE_DATA');
  expect(()=>historicalFXAsOf([observation('2025-12-23'),observation('2025-12-23')],'2025-12-29')).toThrow('DUPLICATE_OBSERVATION');
});
