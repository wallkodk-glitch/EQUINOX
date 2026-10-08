export const ERROR_CODES = [
  'AUTH_FAILED','ENTITLEMENT_DENIED','RATE_LIMITED','PROVIDER_UNAVAILABLE',
  'NETWORK_OR_CORS','TIMEOUT','ABORTED','MALFORMED_PAYLOAD','SCHEMA_INVALID',
  'MISSING_CREDENTIAL','INVALID_CREDENTIAL','CREDENTIAL_STORAGE_UNAVAILABLE',
  'UNSAFE_PROVIDER_URL','PAGINATION_INVALID','FUTURE_OBSERVATION','DUPLICATE_OBSERVATION',
  'FX_OBSERVATION_CONFLICT','INVALID_FX','MISSING_OBSERVATION','STALE_DATA',
  'CALENDAR_MISMATCH','CACHE_UNAVAILABLE','CACHE_INVALID','CORPORATE_ACTION_UNVERIFIED',
  'RISK_INTEGRATION_BLOCKED','MARKET_DATA_FAILED','REQUEST_IN_PROGRESS',
] as const;
export type ErrorCode = typeof ERROR_CODES[number];
export class MarketError extends Error {
  constructor(readonly code: ErrorCode) { super(code); this.name='MarketError'; }
}
export function safeError(error: unknown): ErrorCode {
  if(error instanceof MarketError) return error.code;
  // Only locally generated codes are admitted; never retain provider error text.
  if(error instanceof Error && ERROR_CODES.some(c=>c===error.message)) return error.message as ErrorCode;
  return 'MARKET_DATA_FAILED';
}
export type Provider = 'massive'|'coingecko'|'nationalbank';
export function allowedURL(raw: string, provider: Provider): boolean {
  try {
    const u=new URL(raw);
    if(u.protocol!=='https:'||u.username||u.password||u.hash||u.port) return false;
    const paths={massive:/^\/(v2\/aggs\/ticker\/(GOOGL|ISRG|TSM|X:BTCUSD|X:ETHUSD)\/range\/|stocks\/v1\/(splits|dividends)$)/,
      coingecko:/^\/api\/v3\/simple\/price$/, nationalbank:/^\/api\/currencyrates(xml)?$/};
    const origins={massive:'https://api.massive.com',coingecko:'https://api.coingecko.com',nationalbank:'https://www.nationalbanken.dk'};
    if(provider==='nationalbank'&&u.origin==='https://api.statbank.dk') {
      return /^\/v1\/(tableinfo\/DNVALD|data\/DNVALD\/JSONSTAT)$/.test(u.pathname)&&![...u.searchParams.keys()].some(k=>/key|token|auth|secret|credential/i.test(k));
    }
    return u.origin===origins[provider] && paths[provider].test(u.pathname) &&
      ![...u.searchParams.keys()].some(k=>/key|token|auth|secret|credential/i.test(k));
  } catch { return false; }
}
export interface RequestOptions {
  provider: Provider; key?: string|null; signal?: AbortSignal;
  timeoutMs?: number; fetcher?: typeof fetch; format?: 'json'|'text';
}
export async function request(url:string, options:RequestOptions):Promise<unknown> {
  if(!allowedURL(url,options.provider)) throw new MarketError('UNSAFE_PROVIDER_URL');
  if(options.key) {
    try {
      if(url.includes(options.key)||decodeURIComponent(url).includes(options.key)) throw new MarketError('UNSAFE_PROVIDER_URL');
    } catch { throw new MarketError('UNSAFE_PROVIDER_URL'); }
  }
  if(options.provider==='massive'&&!options.key) throw new MarketError('MISSING_CREDENTIAL');
  if(options.key && (!/^[\x21-\x7e]{1,512}$/.test(options.key)||options.provider==='nationalbank')) throw new MarketError('INVALID_CREDENTIAL');
  if(options.signal?.aborted) throw new MarketError('ABORTED');
  const controller=new AbortController(); let timedOut=false;
  const abort=()=>controller.abort(); options.signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(()=>{timedOut=true;controller.abort();},options.timeoutMs??15000);
  const headers=new Headers({Accept:options.format==='text'?'application/xml, application/rss+xml':'application/json'});
  if(options.key) headers.set(options.provider==='massive'?'Authorization':'x-cg-demo-api-key',options.provider==='massive'?`Bearer ${options.key}`:options.key);
  try {
    const response=await (options.fetcher??fetch)(url,{headers,signal:controller.signal,cache:'no-store',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer'});
    if(!response.ok) throw new MarketError(response.status===401?'AUTH_FAILED':response.status===403?'ENTITLEMENT_DENIED':response.status===429?'RATE_LIMITED':'PROVIDER_UNAVAILABLE');
    const raw=await response.text();
    if(raw.length>16*1024*1024) throw new MarketError('MALFORMED_PAYLOAD');
    if(options.format==='text') return raw;
    try { return JSON.parse(raw); } catch { throw new MarketError('MALFORMED_PAYLOAD'); }
  } catch(e) {
    if(timedOut) throw new MarketError('TIMEOUT');
    if(options.signal?.aborted) throw new MarketError('ABORTED');
    if(e instanceof MarketError) throw e;
    throw new MarketError('NETWORK_OR_CORS');
  } finally { clearTimeout(timer);options.signal?.removeEventListener('abort',abort); }
}
export async function massivePages(url:string, get:(url:string)=>Promise<unknown>, collectResults=true):Promise<unknown[]> {
  const seen=new Set<string>(),out:unknown[]=[];
  const initial=new URL(url);
  for(let page=0;page<100;page++) {
    if(!allowedURL(url,'massive')||seen.has(url)) throw new MarketError('PAGINATION_INVALID');
    const current=new URL(url);
    // Aggregate cursors may advance the from component, but cannot switch ticker/timespan.
    const route=(u:URL)=>u.pathname.includes('/range/')?u.pathname.split('/range/')[0]+'/range/'+u.pathname.split('/range/')[1].split('/').slice(0,2).join('/'):u.pathname;
    if(route(current)!==route(initial)) throw new MarketError('PAGINATION_INVALID');
    seen.add(url);
    const p=await get(url);
    if(!p||typeof p!=='object'||!('status' in p)||p.status!=='OK'||!('results' in p)||!Array.isArray(p.results)) throw new MarketError('SCHEMA_INVALID');
    if(collectResults)out.push(...p.results);
    if(!('next_url' in p)||p.next_url===undefined) return out;
    if(typeof p.next_url!=='string'||!p.next_url) throw new MarketError('PAGINATION_INVALID');
    url=p.next_url;
  }
  throw new MarketError('PAGINATION_INVALID');
}
