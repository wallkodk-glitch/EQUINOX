import { z } from 'zod';
import { MarketError } from './network';
import { canonicalSession, validDate } from './timestamps';
import { validateTSMADRDividends } from './tsm-adr';

export const SPLIT_SOURCE='https://api.massive.com/stocks/v1/splits';
export const DIVIDEND_SOURCE='https://api.massive.com/stocks/v1/dividends';
const issuerSources=['3q24','4q24','1q25','2q25','3q25','4q25','1q26'].map(q=>`https://investor.tsmc.com/english/dividends/${q}`);
const positive=z.number().finite().positive();
export const riskActionSchema=z.object({
  provider:z.literal('massive'),ticker:z.enum(['GOOGL','ISRG','TSM']),
  from:z.iso.date(),to:z.iso.date(),acquiredAt:z.iso.datetime(),
  basis:z.literal('RAW_PRICES_ORIGINAL_GROSS_USD_CASH'),
  completeness:z.literal('ALL_PAGES_VALIDATED'),
  sourceURLs:z.array(z.enum([SPLIT_SOURCE,DIVIDEND_SOURCE,...issuerSources])).min(2).max(9),
  splits:z.array(z.object({date:z.iso.date(),ratio:positive}).strict()).max(100),
  dividends:z.array(z.object({date:z.iso.date(),cashAmountUSD:positive,payDate:z.iso.date(),
    distributionType:z.enum(['recurring','special','supplemental','irregular'])}).strict()).max(100),
}).strict();
export type RiskActionEvidence=z.infer<typeof riskActionSchema>;

export function validateRiskActions(input:unknown,from:string,to:string,acquiredAt:string):RiskActionEvidence {
  const parsed=riskActionSchema.safeParse(input);
  if(!parsed.success)throw new MarketError('CORPORATE_ACTION_UNVERIFIED');
  const a=parsed.data;
  if(!validDate(from)||!validDate(to)||from>to||a.from!==from||a.to!==to||Date.parse(a.acquiredAt)>Date.parse(acquiredAt)||!a.sourceURLs.includes(SPLIT_SOURCE)||!a.sourceURLs.includes(DIVIDEND_SOURCE))throw new MarketError('CORPORATE_ACTION_UNVERIFIED');
  const seenSplits=new Set<string>(),seenDividends=new Set<string>();
  for(const s of a.splits){
    if(s.date<from||s.date>to)throw new MarketError('CORPORATE_ACTION_UNVERIFIED');
    canonicalSession(s.date);
    if(seenSplits.has(s.date))throw new MarketError('DUPLICATE_OBSERVATION');
    seenSplits.add(s.date);
  }
  for(const d of a.dividends){
    if(d.date<from||d.date>to||d.payDate<d.date)throw new MarketError('CORPORATE_ACTION_UNVERIFIED');
    canonicalSession(d.date);
    const key=`${d.date}:${d.distributionType}`;
    if(seenDividends.has(key))throw new MarketError('DUPLICATE_OBSERVATION');
    seenDividends.add(key);
    // Simultaneous split/dividend share basis is not certified by these fields.
    if(seenSplits.has(d.date))throw new MarketError('CORPORATE_ACTION_UNVERIFIED');
  }
  if(a.ticker==='TSM'){
    if(a.splits.length)throw new MarketError('CORPORATE_ACTION_UNVERIFIED');
    const verified=validateTSMADRDividends(a.dividends.map(d=>({ticker:'TSM',currency:'USD',ex_dividend_date:d.date,
      pay_date:d.payDate,distribution_type:d.distributionType,cash_amount:d.cashAmountUSD,split_adjusted_cash_amount:d.cashAmountUSD})),from,to);
    if(verified.dividends.some(d=>!a.sourceURLs.includes(d.sourceURL)))throw new MarketError('CORPORATE_ACTION_UNVERIFIED');
    // The final September gross conversion was not known on the ex-date. This
    // is retrospective, and may not be used as a point-in-time historical feed.
    if(a.dividends.some(d=>d.date==='2026-09-16')&&a.acquiredAt<'2026-10-03T00:00:00.000Z')throw new MarketError('CORPORATE_ACTION_UNVERIFIED');
  }
  return a;
}
export function riskActionEvidence(rawSplits:unknown[],rawDividends:unknown[],ticker:RiskActionEvidence['ticker'],from:string,to:string,acquiredAt:string):RiskActionEvidence {
  const splits=z.array(z.object({ticker:z.literal(ticker),execution_date:z.iso.date(),split_from:positive,split_to:positive,
    adjustment_type:z.enum(['forward_split','reverse_split','stock_dividend'])})).safeParse(rawSplits);
  const dividends=z.array(z.object({ticker:z.literal(ticker),ex_dividend_date:z.iso.date(),cash_amount:positive,
    currency:z.literal('USD'),pay_date:z.iso.date(),distribution_type:z.enum(['recurring','special','supplemental','irregular'])})).safeParse(rawDividends);
  if(!splits.success||!dividends.success)throw new MarketError('CORPORATE_ACTION_UNVERIFIED');
  const proof=ticker==='TSM'?validateTSMADRDividends(rawDividends,from,to):null;
  return validateRiskActions({provider:'massive',ticker,from,to,acquiredAt,basis:'RAW_PRICES_ORIGINAL_GROSS_USD_CASH',completeness:'ALL_PAGES_VALIDATED',
    sourceURLs:[SPLIT_SOURCE,DIVIDEND_SOURCE,...(proof?.dividends.map(d=>d.sourceURL)??[])],
    splits:splits.data.map(s=>({date:s.execution_date,ratio:s.split_to/s.split_from})),
    dividends:dividends.data.map(d=>({date:d.ex_dividend_date,cashAmountUSD:d.cash_amount,payDate:d.pay_date,distributionType:d.distribution_type})),
  },from,to,acquiredAt);
}
