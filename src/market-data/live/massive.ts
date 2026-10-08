import { z } from 'zod';
import { observation,type Observation,MARKET_DATA_MODEL_VERSION,SOURCES } from './model';
import { MarketError,request,massivePages } from './network';
import { canonicalSession,cryptoAtClose,equityAtClose,dayInZone,validDate } from './timestamps';
import { sessionWindow } from '../calendar';
import { riskActionEvidence } from './risk-actions';
type Instrument='GOOGL'|'ISRG'|'TSM'|'BTC'|'ETH';
const tickers:Record<Instrument,string>={GOOGL:'GOOGL',ISRG:'ISRG',TSM:'TSM',BTC:'X:BTCUSD',ETH:'X:ETHUSD'};
const positive=z.number().finite().positive().max(1e9);
const barSchema=z.object({t:z.number().int().nonnegative(),o:positive,h:positive,l:positive,c:positive,v:z.number().finite().nonnegative(),n:z.number().int().positive().optional()});
const envelope=z.object({ticker:z.string(),adjusted:z.literal(false),status:z.literal('OK'),resultsCount:z.number().int().nonnegative(),results:z.array(barSchema),next_url:z.string().optional()});
export function parseMassiveBars(input:unknown,instrument:Instrument,interval:'day'|'minute',acquiredAt:string,selectedStarts?:ReadonlySet<number>):Observation[] {
 const r=envelope.safeParse(input),acquired=Date.parse(acquiredAt);
 if(!r.success||!Number.isFinite(acquired)||r.data.ticker!==tickers[instrument]||r.data.resultsCount!==r.data.results.length) throw new MarketError('SCHEMA_INVALID');
 const crypto=['BTC','ETH'].includes(instrument);
 if(interval==='day'&&crypto) throw new MarketError('SCHEMA_INVALID');
 const seen=new Set<number>();let previous=-1;
 return r.data.results.flatMap(b=>{
  if(seen.has(b.t)) throw new MarketError('DUPLICATE_OBSERVATION');
  if(b.t<previous||b.h<Math.max(b.o,b.c)||b.l>Math.min(b.o,b.c)||b.h<b.l) throw new MarketError('SCHEMA_INVALID');
  seen.add(b.t);previous=b.t;
  if(b.t>acquired) throw new MarketError('FUTURE_OBSERVATION');
  const providerTimestamp=new Date(b.t).toISOString();
  const date=dayInZone(b.t,interval==='day'?'America/New_York':'UTC');
  let start:string|null=null,end:string|null=null;
  if(interval==='day') {
   const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'America/New_York',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(b.t);
   if(parts!=='00:00:00'||b.t%1000!==0) throw new MarketError('CALENDAR_MISMATCH');
   const close=canonicalSession(date).close;
   if(Date.parse(close)>acquired) throw new MarketError('FUTURE_OBSERVATION');
  } else {
   if(b.t%60000!==0) throw new MarketError('CALENDAR_MISMATCH');
   start=providerTimestamp;end=new Date(b.t+60000).toISOString();
   if(b.t+60000>acquired) throw new MarketError('FUTURE_OBSERVATION');
  }
  if(selectedStarts&&!selectedStarts.has(b.t))return [];
  return [observation({schemaVersion:1,dataModelVersion:MARKET_DATA_MODEL_VERSION,provider:'massive',instrument,price:b.c,unit:'USD',kind:interval==='day'?'equity-eod':crypto?'crypto-minute':'equity-minute',observationDate:date,providerTimestamp,observationTimestamp:end,acquiredAt,bucketStart:start,bucketEnd:end,sourceURL:SOURCES.massive,semantics:interval==='day'?'RAW_DAILY_BAR_CLOSE_TIME_UNVERIFIED':'LAST_ELIGIBLE_TRADE_IN_MINUTE'})];
 });
}
const splitSchema=z.object({ticker:z.string(),execution_date:z.iso.date(),split_from:positive,split_to:positive,adjustment_type:z.enum(['forward_split','reverse_split','stock_dividend'])});
const dividendSchema=z.object({ticker:z.string(),ex_dividend_date:z.iso.date(),cash_amount:z.number().finite().nonnegative().max(1e6),currency:z.literal('USD'),distribution_type:z.enum(['recurring','special','supplemental','irregular','unknown'])});
export function parseActions(rawSplits:unknown[],rawDividends:unknown[],ticker:'GOOGL'|'ISRG'|'TSM') {
 const splits=z.array(splitSchema).safeParse(rawSplits),dividends=z.array(dividendSchema).safeParse(rawDividends);
 if(!splits.success||!dividends.success||splits.data.some(s=>s.ticker!==ticker)||dividends.data.some(d=>d.ticker!==ticker)) throw new MarketError('CORPORATE_ACTION_UNVERIFIED');
 const splitDates=new Set<string>();
 for(const s of splits.data){if(splitDates.has(s.execution_date))throw new MarketError('DUPLICATE_OBSERVATION');splitDates.add(s.execution_date);}
 // This is verified parsing, not proof of gross ADR cash basis or completeness.
 return {splits:splits.data.map(s=>({date:s.execution_date,ratio:s.split_to/s.split_from})),dividends:dividends.data.map(d=>({date:d.ex_dividend_date,cashAmountUSD:d.cash_amount})),verifiedForRisk:false as const};
}
const wait=(ms:number,signal?:AbortSignal)=>new Promise<void>((resolve,reject)=>{
 if(signal?.aborted){reject(new MarketError('ABORTED'));return;}
 const abort=()=>{clearTimeout(timer);reject(new MarketError('ABORTED'));};
 const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);
 signal?.addEventListener('abort',abort,{once:true});
});
// One per tab, shared by tests/refresh. 13 seconds is a conservative <=5/min policy.
let tail:Promise<unknown>=Promise.resolve(),nextRequest=0;
async function scheduledGet(url:string,key:string,signal?:AbortSignal):Promise<unknown> {
 const job=tail.then(async()=>{
  await wait(Math.max(0,nextRequest-Date.now()),signal);
  nextRequest=Date.now()+13000;
  try { return await request(url,{provider:'massive',key,signal}); }
  catch(e){if(e instanceof MarketError&&e.code==='RATE_LIMITED')nextRequest=Date.now()+60000;throw e;}
 });
 tail=job.catch(()=>{});return job;
}
export class MassiveAdapter {
 constructor(private key:string){}
 async canonicalCloses(instrument:Instrument,sessions:{date:string;close:string}[],signal?:AbortSignal):Promise<Observation[]> {
  if(!sessions.length||sessions.length>757)throw new MarketError('SCHEMA_INVALID');
  const starts=new Set<number>();let previous=-1;
  for(const s of sessions){
   const close=Date.parse(s.close);
   if(canonicalSession(s.date).close!==s.close||close<=previous)throw new MarketError('CALENDAR_MISMATCH');
   starts.add(close-60000);previous=close;
  }
  const from=Date.parse(sessions[0].close)-60000,to=Date.parse(sessions.at(-1)!.close)-1;
  const path=`${SOURCES.massive}/v2/aggs/ticker/${tickers[instrument]}/range/1/minute/${from}/${to}?adjusted=false&sort=asc&limit=50000`;
  const selected:Observation[]=[];let lastTimestamp=-1;
  await massivePages(path,async url=>{
   const payload=await scheduledGet(url,this.key,signal);
   const rows=parseMassiveBars(payload,instrument,'minute',new Date().toISOString(),starts);
   const page=envelope.parse(payload);
   for(const bar of page.results){
    if(bar.t===lastTimestamp)throw new MarketError('DUPLICATE_OBSERVATION');
    if(bar.t<lastTimestamp||bar.t<from||bar.t>to)throw new MarketError('PAGINATION_INVALID');
    lastTimestamp=bar.t;
   }
   selected.push(...rows);return payload;
  },false); // Do not retain millions of irrelevant raw/normalized minutes.
  if(selected.length!==sessions.length)throw new MarketError('MISSING_OBSERVATION');
  return sessions.map(s=>['BTC','ETH'].includes(instrument)?cryptoAtClose(selected,s.date):equityAtClose(selected,s.date,instrument as 'GOOGL'|'ISRG'|'TSM'));
 }
 async bars(instrument:Instrument,interval:'day'|'minute',from:string,to:string,signal?:AbortSignal):Promise<Observation[]> {
  if(interval==='day'&&(!validDate(from)||!validDate(to)||from>to)) throw new MarketError('SCHEMA_INVALID');
  if(interval==='minute'&&(!/^\d{1,16}$/.test(from)||!/^\d{1,16}$/.test(to)||!Number.isSafeInteger(Number(from))||!Number.isSafeInteger(Number(to))||Number(from)>Number(to))) throw new MarketError('SCHEMA_INVALID');
  const path=`${SOURCES.massive}/v2/aggs/ticker/${tickers[instrument]}/range/1/${interval}/${from}/${to}?adjusted=false&sort=asc&limit=50000`;
  const observations:Observation[]=[];
  await massivePages(path,async url=>{
   const payload=await scheduledGet(url,this.key,signal);
   observations.push(...parseMassiveBars(payload,instrument,interval,new Date().toISOString()));
   return payload;
  });
  if(!observations.length)throw new MarketError('MISSING_OBSERVATION');
  const seen=new Set<string>();
  for(const o of observations){if(seen.has(o.providerTimestamp!))throw new MarketError('DUPLICATE_OBSERVATION');seen.add(o.providerTimestamp!);}
  return observations;
 }
 async actions(ticker:'GOOGL'|'ISRG'|'TSM',from:string,to:string,signal?:AbortSignal) {
  if(!validDate(from)||!validDate(to)||from>to) throw new MarketError('SCHEMA_INVALID');
  const splits=await massivePages(`${SOURCES.massive}/stocks/v1/splits?ticker=${ticker}&execution_date.gte=${from}&execution_date.lte=${to}&sort=execution_date.asc&limit=5000`,url=>scheduledGet(url,this.key,signal));
  const dividends=await massivePages(`${SOURCES.massive}/stocks/v1/dividends?ticker=${ticker}&ex_dividend_date.gte=${from}&ex_dividend_date.lte=${to}&sort=ex_dividend_date.asc&limit=5000`,url=>scheduledGet(url,this.key,signal));
  return parseActions(splits,dividends,ticker);
 }
 async riskActions(ticker:'GOOGL'|'ISRG'|'TSM',from:string,to:string,signal?:AbortSignal) {
  if(!validDate(from)||!validDate(to)||from>to)throw new MarketError('SCHEMA_INVALID');
  const splits=await massivePages(`${SOURCES.massive}/stocks/v1/splits?ticker=${ticker}&execution_date.gte=${from}&execution_date.lte=${to}&sort=execution_date.asc&limit=5000`,url=>scheduledGet(url,this.key,signal));
  const dividends=await massivePages(`${SOURCES.massive}/stocks/v1/dividends?ticker=${ticker}&ex_dividend_date.gte=${from}&ex_dividend_date.lte=${to}&sort=ex_dividend_date.asc&limit=5000`,url=>scheduledGet(url,this.key,signal));
  return riskActionEvidence(splits,dividends,ticker,from,to,new Date().toISOString());
 }
 async test(signal?:AbortSignal,onProgress?:(n:number)=>void):Promise<Observation[]> {
  const now=new Date().toISOString(),grid=sessionWindow(now,252),s=grid.at(-1)!;
  const result:Observation[]=[];let count=0;
  for(const stock of ['GOOGL','ISRG','TSM'] as const){
   const close=Date.parse(s.close),b=await this.bars(stock,'minute',String(close-60000),String(close-1),signal);
   result.push(equityAtClose(b,s.date,stock));onProgress?.(++count);
  }
  for(const crypto of ['BTC','ETH'] as const){
   const close=Date.parse(s.close),b=await this.bars(crypto,'minute',String(close-60000),String(close-1),signal);
   result.push(cryptoAtClose(b,s.date));onProgress?.(++count);
  }
  for(const stock of ['GOOGL','ISRG','TSM'] as const){await this.actions(stock,grid[0].date,s.date,signal);count+=2;onProgress?.(count);}
  return result;
 }
}
