import { z } from 'zod';
import { requireThat } from '../domain/core';
import { dayInZone } from './live/timestamps';
import { NATIONALBANK_HISTORY_SOURCE } from './live/model';

// Date selection for retrospective risk measurement, NOT a claim about when a
// historical rate was published/available to a trader. Never synthesize clocks.
// Official DNVALD counterexamples: Dec 23→29 and Apr 1→7 are six calendar
// days when same-day publication is not inferred. A seven-day gap fails closed.
export const FX_MAX_CALENDAR_DAYS=6;
export const RETROSPECTIVE_FX_POLICY = 'NATIONALBANK_RETROSPECTIVE_DATE_ONLY_PREVIOUS_COPENHAGEN_DATE_MAX_6D_V1';
export const historicalFXPointSchema = z.object({
  observationDate:z.iso.date(), rate:z.number().finite().positive().max(1000),
  acquiredAt:z.iso.datetime(), provider:z.literal('nationalbank'),
  sourceURL:z.literal(NATIONALBANK_HISTORY_SOURCE),unit:z.literal('DKK_PER_USD'),
}).strict();
export type HistoricalFXPoint = z.infer<typeof historicalFXPointSchema>;

export function validateFXHistory(points:HistoricalFXPoint[], acquiredAt:string) {
  const seen=new Map<string,number>();let previous='';
  for (const point of points) {
    requireThat(Date.parse(point.acquiredAt)<=Date.parse(acquiredAt),'DATA_ACQUISITION_BEFORE_OBSERVATION');
    requireThat(point.observationDate<=dayInZone(Date.parse(point.acquiredAt),'Europe/Copenhagen'),'FUTURE_FX_DATE');
    if(seen.has(point.observationDate)) {
      requireThat(seen.get(point.observationDate)===point.rate,'FX_OBSERVATION_CONFLICT');
      requireThat(false,'DUPLICATE_FX_DATE');
    }
    requireThat(point.observationDate>previous,'NON_MONOTONIC_FX_DATES');
    seen.set(point.observationDate,point.rate);previous=point.observationDate;
  }
}
export function retrospectiveFXAsOf(points:HistoricalFXPoint[], canonicalClose:string):HistoricalFXPoint {
  const date=dayInZone(Date.parse(canonicalClose),'Europe/Copenhagen');
  const selected=points.filter(point=>point.observationDate<date).at(-1);
  requireThat(selected,'FX_DATA_MISSING');
  requireThat((Date.parse(date)-Date.parse(selected.observationDate))/86400000<=FX_MAX_CALENDAR_DAYS,'FX_DATA_MISSING');
  return selected;
}
