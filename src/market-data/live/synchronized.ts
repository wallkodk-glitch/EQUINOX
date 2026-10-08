import { ASSETS, deepFreeze } from '../../domain/core';
import { CALENDAR_POLICY, sessionWindow } from '../calendar';
import { EQUITY_SEMANTICS, retrospectiveDatasetSchema, prepareRisk, type RetrospectiveDataset } from '../provider';
import { RETROSPECTIVE_FX_POLICY, FX_MAX_CALENDAR_DAYS, validateFXHistory, retrospectiveFXAsOf, type HistoricalFXPoint } from '../retrospective-fx';
import { MARKET_DATA_MODEL_VERSION, NATIONALBANK_HISTORY_SOURCE, SOURCES, observationSchema, type Observation } from './model';
import { MassiveAdapter } from './massive';
import { MarketCache } from './cache';
import { historicalFX } from './nationalbank-history';
import { equityAtClose, cryptoAtClose } from './timestamps';
import { validateRiskActions, type RiskActionEvidence } from './risk-actions';
import { MarketError } from './network';

type Instrument=(typeof ASSETS)[number];
export interface SynchronizedInputs {
  now:string;lookback:number;observations:Record<Instrument,Observation[]>;
  corporateActions:RiskActionEvidence[];fx:Observation[];cacheUsed?:boolean;
}
// No partial output, overrides, guessed publication times or CoinGecko prices.
// This constructs data only; it does not write financial state or run allocation.
export function buildSynchronizedRisk(input:SynchronizedInputs):RetrospectiveDataset {
  const grid=sessionWindow(input.now,input.lookback),from=grid[0].date,to=grid.at(-1)!.date;
  const market:Observation[]=[];
  for(const instrument of ASSETS){
    const rows=input.observations[instrument];
    if(!Array.isArray(rows)||rows.length!==grid.length)throw new MarketError('MISSING_OBSERVATION');
    for(const raw of rows){
      const q=observationSchema.safeParse(raw);
      if(!q.success||q.data.provider!=='massive'||q.data.instrument!==instrument||Date.parse(q.data.acquiredAt)>Date.parse(input.now))throw new MarketError('SCHEMA_INVALID');
    }
    for(const s of grid)market.push(instrument==='BTC'||instrument==='ETH'?cryptoAtClose(rows,s.date):equityAtClose(rows,s.date,instrument));
  }
  const actions=input.corporateActions.map(a=>validateRiskActions(a,from,to,input.now));
  if(actions.length!==3||new Set(actions.map(a=>a.ticker)).size!==3)throw new MarketError('CORPORATE_ACTION_UNVERIFIED');
  const fxHistory=input.fx.map((raw):HistoricalFXPoint=>{
    const q=observationSchema.safeParse(raw);
    if(!q.success||q.data.provider!=='nationalbank'||q.data.kind!=='fx-reference'||q.data.sourceURL!==NATIONALBANK_HISTORY_SOURCE)throw new MarketError('INVALID_FX');
    return {observationDate:q.data.observationDate,rate:q.data.price,acquiredAt:q.data.acquiredAt,
      provider:'nationalbank' as const,sourceURL:NATIONALBANK_HISTORY_SOURCE,unit:'DKK_PER_USD' as const};
  }).sort((a,b)=>a.observationDate.localeCompare(b.observationDate));
  if(!fxHistory.length)throw new MarketError('MISSING_OBSERVATION');
  validateFXHistory(fxHistory,input.now);
  const rows=grid.map(s=>{
    const selected=retrospectiveFXAsOf(fxHistory,s.close);
    const equity=(['GOOGL','ISRG','TSM'] as const).map(ticker=>actions.find(a=>a.ticker===ticker)!);
    return {date:s.date,closeAt:s.close,closeUSD:ASSETS.map(instrument=>market.find(q=>q.instrument===instrument&&q.observationDate===s.date)!.price),
      splitRatio:equity.map(a=>a.splits.filter(e=>e.date===s.date).reduce((ratio,e)=>ratio*e.ratio,1)),
      dividendUSD:equity.map(a=>a.dividends.filter(e=>e.date===s.date).reduce((amount,e)=>amount+e.cashAmountUSD,0)),
      cryptoBucketStart:new Date(Date.parse(s.close)-60000).toISOString(),cryptoBucketEnd:s.close,
      fx:{observationDate:selected.observationDate,rate:selected.rate}};
  });
  const dataset=retrospectiveDatasetSchema.parse({schemaVersion:2,classification:'user-supplied',assetOrder:[...ASSETS],
    provider:'MASSIVE_NATIONALBANK_SYNCHRONIZED_RETROSPECTIVE_V1',sourceURLs:[SOURCES.massive,NATIONALBANK_HISTORY_SOURCE,...new Set(actions.flatMap(a=>a.sourceURLs))],
    symbols:['GOOGL','ISRG','TSM','X:BTCUSD','X:ETHUSD'],acquiredAt:input.now,equitySemantics:EQUITY_SEMANTICS,
    cryptoSemantics:'USD_SPOT_LAST_TRADE_IN_CLOSE_ENDING_60S_BUCKET',fxPolicy:RETROSPECTIVE_FX_POLICY,calendarPolicy:CALENDAR_POLICY,
    corporateActionsComplete:true,rows,fxHistory,provenance:{dataModelVersion:MARKET_DATA_MODEL_VERSION,
      stockClosePolicy:'LAST_ELIGIBLE_TRADE_IN_SESSION_CLOSE_ENDING_60S_BUCKET',fxAvailability:'RETROSPECTIVE_DATE_ONLY_NOT_POINT_IN_TIME',
      cacheUsed:input.cacheUsed??false,marketObservations:market,corporateActions:actions}});
  const gate=prepareRisk(dataset,input.now,input.lookback);
  if(gate.missingDates.length||gate.coverage!==1||gate.returns.length!==input.lookback)throw new MarketError('RISK_INTEGRATION_BLOCKED');
  return deepFreeze(dataset);
}

let importing=false;
export async function refreshSynchronizedRisk(options:{key:string;lookback:252|504|756;cache?:MarketCache;signal?:AbortSignal}):Promise<RetrospectiveDataset> {
  if(!options.key)throw new MarketError('MISSING_CREDENTIAL');
  if(!/^[\x21-\x7e]{1,512}$/.test(options.key))throw new MarketError('INVALID_CREDENTIAL');
  if(options.signal?.aborted)throw new MarketError('ABORTED');
  if(importing)throw new MarketError('REQUEST_IN_PROGRESS');
  importing=true;
  try {
    const now=new Date().toISOString(),grid=sessionWindow(now,options.lookback),adapter=new MassiveAdapter(options.key);
    const cached=options.cache?await options.cache.all():[],observations={} as Record<Instrument,Observation[]>;
    let cacheUsed=false;
    for(const instrument of ASSETS){
      const valid=cached.filter(q=>q.provider==='massive'&&q.instrument===instrument&&q.kind===(['BTC','ETH'].includes(instrument)?'crypto-minute':'equity-minute')&&grid.some(s=>s.date===q.observationDate&&s.close===q.bucketEnd&&Date.parse(q.bucketStart??'')===Date.parse(s.close)-60000));
      const missing=grid.filter(s=>!valid.some(q=>q.observationDate===s.date));
      cacheUsed ||= valid.length>0;
      observations[instrument]=[...valid,...(missing.length?await adapter.canonicalCloses(instrument,missing,options.signal):[])];
    }
    const from=grid[0].date,to=grid.at(-1)!.date,corporateActions:RiskActionEvidence[]=[];
    for(const ticker of ['GOOGL','ISRG','TSM'] as const)corporateActions.push(await adapter.riskActions(ticker,from,to,options.signal));
    const fx=await historicalFX(new Date(Date.parse(from)-FX_MAX_CALENDAR_DAYS*86400000).toISOString().slice(0,10),to,options.signal);
    if(options.signal?.aborted)throw new MarketError('ABORTED');
    const dataset=buildSynchronizedRisk({now:new Date().toISOString(),lookback:options.lookback,observations,corporateActions,fx,cacheUsed});
    // Persist normalized cache only AFTER every provider/calendar/data gate passes.
    if(options.cache)await options.cache.put([...dataset.provenance!.marketObservations,...fx]);
    return dataset;
  } catch(e) {
    if(e instanceof MarketError)throw e;
    // Never forward provider, schema-library, fetch or raw credential-bearing text.
    throw new MarketError('RISK_INTEGRATION_BLOCKED');
  } finally {importing=false;}
}
