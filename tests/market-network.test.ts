import { it, expect, vi } from 'vitest';
import { request, MarketError, safeError, massivePages } from '../src/market-data/live/network';
const url = 'https://api.massive.com/stocks/v1/splits?ticker=GOOGL';
it('authenticated requests use headers, omit browser credentials, and bypass HTTP cache', async () => {
  const key = crypto.randomUUID(); let captured: RequestInit | undefined;
  const result = await request(url,{provider:'massive',key,fetcher:async (u,init)=>{
    expect(String(u)).not.toContain(key); captured=init;
    return new Response('{"status":"OK","results":[]}');
  }});
  expect(result).toEqual({status:'OK',results:[]});
  expect(new Headers(captured?.headers).get('Authorization')).toBe(`Bearer ${key}`);
  expect(captured?.cache).toBe('no-store'); expect(captured?.credentials).toBe('omit');
  expect(captured?.redirect).toBe('error');
});
it('keys cannot cross providers, insecure origins or query strings', async()=>{
  for(const bad of ['https://evil.test/data','https://api.coingecko.com/api/v3/ping','http://api.massive.com/a',url+'&apiKey=abc']) {
    await expect(request(bad,{provider:'massive',key:crypto.randomUUID()})).rejects.toThrow('UNSAFE_PROVIDER_URL');
  }
  await expect(request(url,{provider:'massive'})).rejects.toThrow('MISSING_CREDENTIAL');
});
it.each([[401,'AUTH_FAILED'],[403,'ENTITLEMENT_DENIED'],[429,'RATE_LIMITED'],[503,'PROVIDER_UNAVAILABLE']])('HTTP %s exposes only safe code %s',async(status,code)=>{
  const key=crypto.randomUUID();
  await expect(request(url,{provider:'massive',key,fetcher:async()=>new Response(key,{status:status as number})})).rejects.toThrow(code as string);
});
it('malformed JSON and network/offline exceptions cannot echo credentials',async()=>{
  const key=crypto.randomUUID();
  await expect(request(url,{provider:'massive',key,fetcher:async()=>new Response(key)})).rejects.toThrow('MALFORMED_PAYLOAD');
  await expect(request(url,{provider:'massive',key,fetcher:async()=>{throw new Error(key);}})).rejects.toThrow('NETWORK_OR_CORS');
  expect(safeError(new Error(key))).toBe('MARKET_DATA_FAILED');
  expect(safeError(new MarketError('AUTH_FAILED'))).toBe('AUTH_FAILED');
});
it('pagination cannot conceal the active credential in an otherwise allowed cursor URL', async () => {
 const key=crypto.randomUUID();
 await expect(request(url+'&cursor='+encodeURIComponent(key),{provider:'massive',key,fetcher:async()=>new Response('{}')})).rejects.toThrow('UNSAFE_PROVIDER_URL');
});
it('timeout and explicit abort stop fetch with no retry', async()=>{
  vi.useFakeTimers();
  const hanging:typeof fetch=async(_u,init)=>new Promise((_r,reject)=>init?.signal?.addEventListener('abort',()=>reject(new DOMException('abort','AbortError'))));
  const pending=request(url,{provider:'massive',key:crypto.randomUUID(),timeoutMs:10,fetcher:hanging});
  const checked=expect(pending).rejects.toThrow('TIMEOUT'); await vi.advanceTimersByTimeAsync(11); await checked;
  const c=new AbortController(); c.abort();
  await expect(request(url,{provider:'massive',key:crypto.randomUUID(),signal:c.signal,fetcher:hanging})).rejects.toThrow('ABORTED');
  vi.useRealTimers();
});
it('pagination validates every page and rejects untrusted, secret or repeated cursors',async()=>{
  const pages=[{status:'OK',results:[{x:1}],next_url:url+'&cursor=2'},{status:'OK',results:[{x:2}]}];
  expect(await massivePages(url,async()=>pages.shift())).toEqual([{x:1},{x:2}]);
  for(const next_url of ['https://evil.test/steal',url+'&apiKey=echoed',url])
    await expect(massivePages(url,async()=>({status:'OK',results:[],next_url}))).rejects.toThrow('PAGINATION_INVALID');
  await expect(massivePages(url,async()=>({status:'OK'}))).rejects.toThrow('SCHEMA_INVALID');
});
