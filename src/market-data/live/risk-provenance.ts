import { z } from 'zod';
import { ASSETS, requireThat } from '../../domain/core';
import { observationSchema, SOURCES, MARKET_DATA_MODEL_VERSION } from './model';
import { riskActionSchema, validateRiskActions } from './risk-actions';

export const riskProvenanceSchema=z.object({
  dataModelVersion:z.literal(MARKET_DATA_MODEL_VERSION),
  stockClosePolicy:z.literal('LAST_ELIGIBLE_TRADE_IN_SESSION_CLOSE_ENDING_60S_BUCKET'),
  fxAvailability:z.literal('RETROSPECTIVE_DATE_ONLY_NOT_POINT_IN_TIME'),cacheUsed:z.boolean(),
  marketObservations:z.array(observationSchema).min(5).max(757*5),
  corporateActions:z.array(riskActionSchema).length(3),
}).strict();
export type RiskProvenance=z.infer<typeof riskProvenanceSchema>;
type Row={date:string;closeAt:string;closeUSD:number[];splitRatio:number[];dividendUSD:number[]};
export function validateRiskProvenance(provenance:RiskProvenance,rows:Row[],acquiredAt:string) {
  requireThat(provenance.marketObservations.length===rows.length*5,'PROVENANCE_MISMATCH');
  const byDate=new Map(rows.map(row=>[row.date,row])),seen=new Set<string>();
  for(const q of provenance.marketObservations){
    const row=byDate.get(q.observationDate),i=ASSETS.findIndex(a=>a===q.instrument),key=`${q.instrument}:${q.observationDate}`;
    requireThat(row&&i>=0&&!seen.has(key),'PROVENANCE_MISMATCH');seen.add(key);
    requireThat(q.provider==='massive'&&q.sourceURL===SOURCES.massive&&q.kind===(i<3?'equity-minute':'crypto-minute')&&q.price===row.closeUSD[i]&&
      q.observationTimestamp===row.closeAt&&q.bucketEnd===row.closeAt&&Date.parse(q.bucketStart??'')===Date.parse(row.closeAt)-60000&&
      Date.parse(q.acquiredAt)>=Date.parse(row.closeAt)&&Date.parse(q.acquiredAt)<=Date.parse(acquiredAt),'PROVENANCE_MISMATCH');
  }
  const actionTickers=new Set<string>();
  for(const raw of provenance.corporateActions){
    const a=validateRiskActions(raw,rows[0].date,rows.at(-1)!.date,acquiredAt),i=ASSETS.indexOf(a.ticker);
    requireThat(!actionTickers.has(a.ticker),'PROVENANCE_MISMATCH');actionTickers.add(a.ticker);
    for(const row of rows){
      const split=a.splits.filter(s=>s.date===row.date).reduce((ratio,s)=>ratio*s.ratio,1);
      const cash=a.dividends.filter(d=>d.date===row.date).reduce((amount,d)=>amount+d.cashAmountUSD,0);
      requireThat(row.splitRatio[i]===split&&row.dividendUSD[i]===cash,'PROVENANCE_MISMATCH');
    }
  }
}
