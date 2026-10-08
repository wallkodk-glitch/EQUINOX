import { z } from 'zod';
import { observation,type Observation,MARKET_DATA_MODEL_VERSION,SOURCES } from './model';
import { MarketError,request } from './network';
const coin=z.object({usd:z.number().finite().positive().max(1e9),last_updated_at:z.number().int().positive()});
const schema=z.object({bitcoin:coin,ethereum:coin});
export const COINGECKO_URL=SOURCES.coingecko+'?ids=bitcoin,ethereum&vs_currencies=usd&include_last_updated_at=true';
export function parseCoinGecko(input:unknown,acquiredAt:string):Observation[] {
 const parsed=schema.safeParse(input),acquired=Date.parse(acquiredAt);
 if(!parsed.success||!Number.isFinite(acquired)) throw new MarketError('SCHEMA_INVALID');
 return (['bitcoin','ethereum'] as const).map((id,i)=>{
  const q=parsed.data[id],ms=q.last_updated_at*1000;
  if(ms>acquired) throw new MarketError('FUTURE_OBSERVATION');
  if(acquired-ms>15*60000) throw new MarketError('STALE_DATA');
  const at=new Date(ms).toISOString();
  return observation({schemaVersion:1,dataModelVersion:MARKET_DATA_MODEL_VERSION,provider:'coingecko',instrument:i===0?'BTC':'ETH',price:q.usd,unit:'USD',kind:'crypto-current',observationDate:at.slice(0,10),observationTimestamp:at,providerTimestamp:at,acquiredAt,bucketStart:null,bucketEnd:null,sourceURL:SOURCES.coingecko,semantics:'COINGECKO_CURRENT_REFERENCE'});
 });
}
export async function currentCrypto(key:string|null,signal?:AbortSignal):Promise<Observation[]> {
 const payload=await request(COINGECKO_URL,{provider:'coingecko',key,signal});
 return parseCoinGecko(payload,new Date().toISOString());
}
