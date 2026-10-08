// Real, public Node transport probe. This does NOT assert browser CORS.
import { createServer } from 'vite';
import { writeFile } from 'node:fs/promises';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
const nativeFetch=globalThis.fetch,raw=[];
globalThis.fetch=async(url,options)=>{
  const response=await nativeFetch(url,options);
  if(response.ok&&String(url).startsWith('https://api.statbank.dk/v1/'))raw.push({sourceURL:String(url),acquiredAt:new Date().toISOString(),response:await response.clone().json()});
  return response;
};
try {
  const {historicalFX}=await server.ssrLoadModule('/src/market-data/live/nationalbank-history.ts');
  const {sessionWindow}=await server.ssrLoadModule('/src/market-data/calendar.ts');
  const now=new Date().toISOString(),grid=sessionWindow(now,252),from=new Date(Date.parse(grid[0].date)-7*86400000).toISOString().slice(0,10),to=grid.at(-1).date;
  const normalized=await historicalFX(from,to);
  const asOf=grid.map(s=>{
    const selected=normalized.filter(q=>q.observationDate<s.date).at(-1);
    return {sessionDate:s.date,observationDate:selected?.observationDate??null,calendarAgeDays:selected?(Date.parse(s.date)-Date.parse(selected.observationDate))/86400000:null};
  });
  const evidence={format:'EQUINOX_OFFICIAL_FX_NODE_PROBE_V1',transport:'NODE_PUBLIC_FETCH',browserCORS:'NOT TESTED',
    acquiredAt:new Date().toISOString(),from,to,raw,normalized,asOf};
  await writeFile('validation/closure-final-fx.json',JSON.stringify(evidence,null,2));
  console.log(JSON.stringify({status:'PASS',observations:normalized.length,maximumAsOfAgeDays:Math.max(...asOf.map(x=>x.calendarAgeDays??Infinity)),
    longestGaps:asOf.filter(x=>(x.calendarAgeDays??Infinity)>4),file:'validation/closure-final-fx.json'}));
} catch(e) {
  const {safeError}=await server.ssrLoadModule('/src/market-data/live/network.ts');
  await writeFile('validation/closure-final-fx-attempt.json',JSON.stringify({acquiredAt:new Date().toISOString(),status:'NOT VERIFIED',reason:safeError(e),raw},null,2));
  console.error(JSON.stringify({status:'NOT VERIFIED',reason:safeError(e),successfulPublicResponses:raw.length}));process.exitCode=1;
} finally {globalThis.fetch=nativeFetch;await server.close();}
