import { MarketError,request } from './network';
import { observation,type Observation,MARKET_DATA_MODEL_VERSION,SOURCES,NATIONALBANK_RSS_SOURCE } from './model';
import { dayInZone,validDate } from './timestamps';
export function parseRate(raw:string):number {
 const value=raw.trim();
 if(!/^\d+(?:[.,]\d+)?$/.test(value)) throw new MarketError('INVALID_FX');
 const [whole, fraction='']=value.replace(',','.').split('.');
 const rate=Number(`${whole}${fraction}e-${fraction.length+2}`);
 if(!Number.isFinite(rate)||rate<=0||rate>1000) throw new MarketError('INVALID_FX');
 return rate;
}
const months:Record<string,string>={jan:'01',feb:'02',mar:'03',apr:'04',may:'05',maj:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',okt:'10',nov:'11',dec:'12'};
export function rssObservationDate(text:string):string {
 const m=/^[a-z]{3},\s+(\d{2})\s+([a-z]{3})\.?\s+(\d{4})\s+\d{2}[:.]\d{2}[:.]\d{2}\s+[+-]\d{2}:?\d{2}$/i.exec(text.trim());
 const date=m?`${m[3]}-${months[m[2].toLowerCase()]}-${m[1]}`:'';
 if(!validDate(date)) throw new MarketError('INVALID_FX');
 // Calendar label only. Never use the RSS clock as economic publication time.
 return date;
}
export function parseNationalbank(xml:string,acquiredAt:string):Observation[] {
 if(xml.length>1000000||/<!DOCTYPE|<!ENTITY/i.test(xml)||!Number.isFinite(Date.parse(acquiredAt))) throw new MarketError('MALFORMED_PAYLOAD');
 const doc=new DOMParser().parseFromString(xml,'application/xml');
 if(doc.querySelector('parsererror')) throw new MarketError('MALFORMED_PAYLOAD');
 const values:{date:string;raw:string}[]=[];
 if(doc.documentElement.tagName==='exchangerates') {
  const root=doc.documentElement;
  if(root.getAttribute('author')!=='Danmarks Nationalbank'||root.getAttribute('refcur')!=='DKK') throw new MarketError('SCHEMA_INVALID');
  for(const day of Array.from(root.children)) {
   if(day.tagName!=='dailyrates') throw new MarketError('SCHEMA_INVALID');
   const rows=Array.from(day.children).filter(c=>c.tagName==='currency'&&c.getAttribute('code')==='USD');
   if(rows.length!==1) throw new MarketError('INVALID_FX');
   values.push({date:day.getAttribute('id')??'',raw:rows[0].getAttribute('rate')??''});
  }
 } else if(doc.documentElement.tagName==='rss') {
  const channel=doc.querySelector('rss > channel');
  if(!channel||channel.querySelector(':scope > title')?.textContent?.trim()!=='Danmarks Nationalbank - Valutakurser') throw new MarketError('SCHEMA_INVALID');
  for(const item of Array.from(channel.querySelectorAll(':scope > item'))) {
   const text=item.querySelector(':scope > description')?.textContent?.trim()??'';
   const match=/^100 USD (?:cost|koster) (\d+(?:[.,]\d+)?) DKK$/.exec(text);
   if(!match) throw new MarketError('INVALID_FX');
   values.push({date:rssObservationDate(item.querySelector(':scope > pubDate')?.textContent??''),raw:match[1]});
  }
 } else throw new MarketError('SCHEMA_INVALID');
 if(!values.length) throw new MarketError('MISSING_OBSERVATION');
 const byDate=new Map<string,number>(),today=dayInZone(Date.parse(acquiredAt),'Europe/Copenhagen');
 for(const {date,raw} of values) {
  if(!validDate(date)) throw new MarketError('INVALID_FX');
  if(date>today) throw new MarketError('FUTURE_OBSERVATION');
  const rate=parseRate(raw);
  if(byDate.has(date)&&byDate.get(date)!==rate) throw new MarketError('FX_OBSERVATION_CONFLICT');
  byDate.set(date,rate);
 }
 return [...byDate].sort(([a],[b])=>a.localeCompare(b)).map(([date,price])=>observation({schemaVersion:1,dataModelVersion:MARKET_DATA_MODEL_VERSION,provider:'nationalbank',instrument:'USD/DKK',observationDate:date,observationTimestamp:null,providerTimestamp:null,acquiredAt,price,unit:'DKK_PER_USD',kind:'fx-reference',bucketStart:null,bucketEnd:null,sourceURL:doc.documentElement.tagName==='rss'?NATIONALBANK_RSS_SOURCE:SOURCES.nationalbank,semantics:'NATIONALBANK_DATE_ONLY_DKK_PER_100_DIVIDED_BY_100'}));
}
export async function currentFX(signal?:AbortSignal):Promise<Observation[]> {
 const xml=await request(SOURCES.nationalbank,{provider:'nationalbank',signal,format:'text'});
 const observations=parseNationalbank(xml as string,new Date().toISOString());
 const last=observations.at(-1)!;
 if(Date.parse(last.acquiredAt)-Date.parse(last.observationDate+'T00:00:00.000Z')>120*3600e3) throw new MarketError('STALE_DATA');
 return observations;
}
