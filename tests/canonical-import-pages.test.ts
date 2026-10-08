import { expect, it, vi } from 'vitest';
import { MassiveAdapter, parseMassiveBars } from '../src/market-data/live/massive';
import { massivePages } from '../src/market-data/live/network';

const now='2026-10-07T12:00:00.000Z';
// Independent calendar facts: Thanksgiving has no session; Black Friday closes
// 13:00 New York / 18:00 UTC, not the normal 21:00 UTC November close.
const sessions=[{date:'2025-11-26',close:'2025-11-26T21:00:00.000Z'},
  {date:'2025-11-28',close:'2025-11-28T18:00:00.000Z'}];
const start0=Date.parse(sessions[0].close)-60000,start1=Date.parse(sessions[1].close)-60000;
const bar=(t:number,c:number)=>({t,o:c,h:c,l:c,c,v:1});
const page=(results:ReturnType<typeof bar>[],next_url?:string)=>({ticker:'GOOGL',adjusted:false,status:'OK',resultsCount:results.length,results,...(next_url?{next_url}:{})});
const route=`https://api.massive.com/v2/aggs/ticker/GOOGL/range/1/minute/${start0}/${start1+59999}?adjusted=false&sort=asc&limit=50000`;
it('retains only canonical stock minutes across validated native JSON pages, including an early close', async()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date(now));vi.resetModules();
  const {MassiveAdapter:Adapter}=await import('../src/market-data/live/massive');
  const key=crypto.randomUUID(),seen:{url:string;headers:Headers;at:number}[]=[];
  const payloads=[page([bar(start0,100)],route+'&cursor=2'),page([bar(start1-60000,999)],route+'&cursor=3'),page([bar(start1,101)])];
  vi.stubGlobal('fetch',async(u:string,init:RequestInit)=>{
    seen.push({url:u,headers:new Headers(init.headers),at:Date.now()});return new Response(JSON.stringify(payloads.shift()));
  });
  try {
    const pending=new Adapter(key).canonicalCloses('GOOGL',sessions);
    const checked=expect(pending).resolves.toMatchObject([{price:100,observationTimestamp:sessions[0].close},
      {price:101,observationTimestamp:sessions[1].close}]);
    await vi.advanceTimersByTimeAsync(40000);await checked;
    expect(seen).toHaveLength(3);expect(seen[1].at-seen[0].at).toBeGreaterThanOrEqual(13000);
    expect(seen[2].at-seen[1].at).toBeGreaterThanOrEqual(13000);
    expect(seen.every(r=>!r.url.includes(key)&&r.headers.get('Authorization')===`Bearer ${key}`)).toBe(true);
  } finally {vi.unstubAllGlobals();vi.useRealTimers();}
});
it('an unselected minute still undergoes full schema, future timestamp and OHLC validation',()=>{
  const chosen=new Set([start1]);
  expect(parseMassiveBars(page([bar(start1-60000,999),bar(start1,101)]),'GOOGL','minute',now,chosen).map(q=>q.price)).toEqual([101]);
  expect(()=>parseMassiveBars(page([{...bar(start1-60000,999),h:1},bar(start1,101)]),'GOOGL','minute',now,chosen)).toThrow('SCHEMA_INVALID');
  expect(()=>parseMassiveBars(page([bar(Date.parse(now)+60000,999)]),'GOOGL','minute',now,chosen)).toThrow('FUTURE_OBSERVATION');
});
it('streaming pages cannot accept malformed continuation, switch symbols or retain raw payloads',async()=>{
  expect(await massivePages(route,async()=>page([bar(start0,100)]),false)).toEqual([]);
  await expect(massivePages(route,async()=>page([],route.replace('GOOGL','TSM')),false)).rejects.toThrow('PAGINATION_INVALID');
  let calls=0;
  await expect(massivePages(route,async()=>++calls===1?page([bar(start0,100)],route+'&cursor=2'):{status:'OK'},false)).rejects.toThrow('SCHEMA_INVALID');
});
it.each(['duplicate','missing','out-of-range','401'] as const)('canonical close pagination fails atomically on %s',async(mode)=>{
  vi.useFakeTimers();vi.setSystemTime(new Date(now));vi.resetModules();
  const {MassiveAdapter:Adapter}=await import('../src/market-data/live/massive');
  const key=crypto.randomUUID();let calls=0;
  vi.stubGlobal('fetch',async()=>{
    if(++calls===1)return new Response(JSON.stringify(page([bar(mode==='out-of-range'?start0-60000:start0,100)],route+'&cursor=2')));
    if(mode==='401')return new Response(key,{status:401});
    return new Response(JSON.stringify(page(mode==='duplicate'?[bar(start0,100),bar(start1,101)]:mode==='missing'?[]:[bar(start1,101)])));
  });
  try {
    const checked=expect(new Adapter(key).canonicalCloses('GOOGL',sessions)).rejects.toThrow(
      {duplicate:'DUPLICATE_OBSERVATION',missing:'MISSING_OBSERVATION','out-of-range':'PAGINATION_INVALID','401':'AUTH_FAILED'}[mode]);
    await vi.advanceTimersByTimeAsync(40000);await checked;
  } finally {vi.unstubAllGlobals();vi.useRealTimers();}
});
it('the canonical reader never treats a holiday as a missing 16:00 session',async()=>{
  await expect(new MassiveAdapter(crypto.randomUUID()).canonicalCloses('GOOGL',[{date:'2025-11-27',close:'2025-11-27T21:00:00.000Z'}])).rejects.toThrow('CALENDAR_MISMATCH');
});
