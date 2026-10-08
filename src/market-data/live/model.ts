import { z } from 'zod';
import { ASSETS } from '../../domain/core';
export const APP_VERSION='1.1.2';
export const MARKET_DATA_MODEL_VERSION='1.1.2';
export const NATIONALBANK_HISTORY_SOURCE='https://api.statbank.dk/v1/data/DNVALD/JSONSTAT';
export const NATIONALBANK_RSS_SOURCE='https://www.nationalbanken.dk/api/currencyrates?format=rss&isocodes=usd&lang=en';
export const SOURCES={
 massive:'https://api.massive.com',
 coingecko:'https://api.coingecko.com/api/v3/simple/price',
 nationalbank:'https://www.nationalbanken.dk/api/currencyratesxml?lang=en',
} as const;
export const observationSchema=z.object({
 schemaVersion:z.literal(1),dataModelVersion:z.enum(['1.1.0','1.1.1',MARKET_DATA_MODEL_VERSION]),
 provider:z.enum(['massive','coingecko','nationalbank']),
 instrument:z.enum([...ASSETS,'USD/DKK']),
 observationDate:z.iso.date(), observationTimestamp:z.iso.datetime().nullable(),
 providerTimestamp:z.iso.datetime().nullable(),acquiredAt:z.iso.datetime(),
 price:z.number().finite().positive().max(1e9),unit:z.enum(['USD','DKK_PER_USD']),
 kind:z.enum(['equity-eod','equity-minute','crypto-minute','crypto-current','fx-reference']),
 bucketStart:z.iso.datetime().nullable(),bucketEnd:z.iso.datetime().nullable(),
 sourceURL:z.enum([SOURCES.massive,SOURCES.coingecko,SOURCES.nationalbank,NATIONALBANK_RSS_SOURCE,NATIONALBANK_HISTORY_SOURCE]),
 semantics:z.enum(['RAW_DAILY_BAR_CLOSE_TIME_UNVERIFIED','LAST_ELIGIBLE_TRADE_IN_MINUTE',
 'COINGECKO_CURRENT_REFERENCE','NATIONALBANK_DATE_ONLY_DKK_PER_100_DIVIDED_BY_100']),
}).strict().superRefine((q,ctx)=>{
 const crypto=['BTC','ETH'].includes(q.instrument),noBuckets=q.bucketStart===null&&q.bucketEnd===null;
 const valid=q.kind==='fx-reference'
  ? q.provider==='nationalbank'&&q.instrument==='USD/DKK'&&q.unit==='DKK_PER_USD'&&q.price<=1000&&q.observationTimestamp===null&&q.providerTimestamp===null&&noBuckets&&q.semantics==='NATIONALBANK_DATE_ONLY_DKK_PER_100_DIVIDED_BY_100'
  : q.kind==='equity-eod'
  ? q.provider==='massive'&&['GOOGL','ISRG','TSM'].includes(q.instrument)&&q.unit==='USD'&&q.observationTimestamp===null&&q.providerTimestamp!==null&&noBuckets&&q.semantics==='RAW_DAILY_BAR_CLOSE_TIME_UNVERIFIED'
  : q.kind==='crypto-current'
  ? q.provider==='coingecko'&&crypto&&q.unit==='USD'&&q.observationTimestamp!==null&&q.providerTimestamp===q.observationTimestamp&&q.observationDate===q.observationTimestamp.slice(0,10)&&noBuckets&&q.semantics==='COINGECKO_CURRENT_REFERENCE'
 : q.provider==='massive'&&(q.kind==='equity-minute'?['GOOGL','ISRG','TSM'].includes(q.instrument):crypto)&&q.unit==='USD'&&q.bucketStart!==null&&q.bucketEnd!==null&&q.providerTimestamp===q.bucketStart&&q.observationTimestamp===q.bucketEnd&&q.observationDate===q.bucketStart.slice(0,10)&&Date.parse(q.bucketStart)%60000===0&&Date.parse(q.bucketEnd)-Date.parse(q.bucketStart)===60000&&q.semantics==='LAST_ELIGIBLE_TRADE_IN_MINUTE';
 const sourceMatches=q.sourceURL===SOURCES[q.provider]||(q.provider==='nationalbank'&&[NATIONALBANK_RSS_SOURCE,NATIONALBANK_HISTORY_SOURCE].includes(q.sourceURL));
 if(!valid||!sourceMatches||(q.dataModelVersion==='1.1.0'&&(q.kind==='equity-minute'||q.sourceURL===NATIONALBANK_HISTORY_SOURCE)))ctx.addIssue({code:'custom',message:'Inconsistent observation roles'});
});
export type Observation=z.infer<typeof observationSchema>;
export const observation=(input:Observation)=>observationSchema.parse(input);
