import sessions from '../sessions.json';
import { MarketError } from './network';
import { observationSchema, type Observation } from './model';
const calendar=new Map(sessions.map(s=>[s.date,s]));
export function canonicalSession(date:string) {
 const s=calendar.get(date); if(!s) throw new MarketError('CALENDAR_MISMATCH');return s;
}
export function dayInZone(ms:number,zone:string):string {
 if(!Number.isFinite(ms)) throw new MarketError('SCHEMA_INVALID');
 return new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(ms);
}
export function validDate(value:string):boolean {
 return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
}
export function cryptoAtClose(bars:Observation[],date:string):Observation {
 const s=canonicalSession(date),close=Date.parse(s.close);
 const selected=bars.filter(b=>b.kind==='crypto-minute'&&Date.parse(b.bucketStart??'')===close-60000&&b.bucketEnd===s.close);
 if(selected.length>1) throw new MarketError('DUPLICATE_OBSERVATION');
 if(selected.length!==1) throw new MarketError('MISSING_OBSERVATION');
 if(Date.parse(selected[0].acquiredAt)<close) throw new MarketError('FUTURE_OBSERVATION');
 return selected[0];
}
// Daily aggregate c is never eligible. Only the final complete regular-session minute.
export function equityAtClose(bars:Observation[],date:string,instrument:'GOOGL'|'ISRG'|'TSM'):Observation {
 const s=canonicalSession(date),close=Date.parse(s.close);
 const selected=bars.filter(b=>b.provider==='massive'&&b.instrument===instrument&&b.kind==='equity-minute'&&b.observationDate===date&&Date.parse(b.bucketStart??'')===close-60000&&b.bucketEnd===s.close&&b.observationTimestamp===s.close&&b.providerTimestamp===b.bucketStart);
 if(selected.length>1) throw new MarketError('DUPLICATE_OBSERVATION');
 if(selected.length!==1) throw new MarketError('MISSING_OBSERVATION');
 const row=selected[0];
 if(!observationSchema.safeParse(row).success) throw new MarketError('SCHEMA_INVALID');
 if(!Number.isFinite(Date.parse(row.acquiredAt))||Date.parse(row.acquiredAt)<close) throw new MarketError('FUTURE_OBSERVATION');
 if(!Number.isFinite(row.price)||row.price<=0) throw new MarketError('SCHEMA_INVALID');
 return row;
}
