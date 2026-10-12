import { it, expect } from 'vitest';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
it('generated worker bypasses authenticated, external and query-bearing requests', async () => {
 const folder=await mkdtemp(join(tmpdir(),'equinox-sw-test-'));
 try {
  await mkdir(join(folder,'dist')); await writeFile(join(folder,'dist/index.html'),'<title>Test shell</title>');
  execFileSync(process.execPath,[resolve('scripts/build-pwa.mjs')],{cwd:folder});
  const handlers=new Map<string,(event:unknown)=>void>();
  runInNewContext(await readFile(join(folder,'dist/sw.js'),'utf8'),{URL,self:{location:{origin:'https://equinox.test'},addEventListener:(n:string,f:(e:unknown)=>void)=>handlers.set(n,f)},caches:{open:async()=>({match:async()=>new Response('shell')})}});
  const key=crypto.randomUUID(),cases:[string,HeadersInit][]=[['https://api.massive.com/stocks/v1/splits',{Authorization:`Bearer ${key}`}],['https://equinox.test/EQUINOX/index.html',{Authorization:`Bearer ${key}`}],['https://equinox.test/EQUINOX/index.html',{'x-cg-demo-api-key':key}],[`https://equinox.test/EQUINOX/index.html?cursor=${key}`,{}]];
  for(const [url,headers] of cases){let intercepted=false; handlers.get('fetch')!({request:{url,headers:new Headers(headers),method:'GET',mode:'navigate'},respondWith:()=>{intercepted=true;}}); expect(intercepted).toBe(false);}
 } finally {await rm(folder,{recursive:true,force:true});}
});

it('installation fetches exact build bytes without a stale HTTP cache and activation extends the message lifetime', async () => {
 const folder = await mkdtemp(join(tmpdir(), 'equinox-sw-install-'));
 try {
  await mkdir(join(folder, 'dist')); const html = '<title>Current release</title>';
  await writeFile(join(folder, 'dist/index.html'), html);
  execFileSync(process.execPath, [resolve('scripts/build-pwa.mjs')], { cwd: folder });
  const handlers = new Map<string, (event: unknown) => void>();
  let requests: Request[] = [], installed: Promise<void> | undefined, activated: Promise<void> | undefined;
  const activation = Promise.resolve();
  runInNewContext(await readFile(join(folder, 'dist/sw.js'), 'utf8'), {
   URL, Request, self: { location: { origin: 'https://equinox.test' },
    skipWaiting: () => activation, addEventListener: (n: string, f: (e: unknown) => void) => handlers.set(n, f) },
   caches: { keys: async () => [], open: async () => ({ addAll: async (items: Request[]) => { requests = items; } }) },
  });
  handlers.get('install')!({ waitUntil: (p: Promise<void>) => { installed = p; } });
  await installed;
  expect(requests.length).toBeGreaterThan(0);
  expect(requests.every(r => r instanceof Request && r.cache === 'reload')).toBe(true);
  const index = requests.find(r => r.url.endsWith('/index.html'));
  expect(index?.integrity).toBe('sha256-' + createHash('sha256').update(html).digest('base64'));
  handlers.get('message')!({ data: { type: 'ACTIVATE_UPDATE' }, waitUntil: (p: Promise<void>) => { activated = p; } });
  expect(activated).toBe(activation);
 } finally { await rm(folder, { recursive: true, force: true }); }
});

it.each([false, true])('failed shell installation cleans only a newly created cache; pre-existing=%s', async existing => {
 const folder = await mkdtemp(join(tmpdir(), 'equinox-sw-failure-'));
 try {
  await mkdir(join(folder, 'dist')); await writeFile(join(folder, 'dist/index.html'), '<title>Stable shell</title>');
  execFileSync(process.execPath, [resolve('scripts/build-pwa.mjs')], { cwd: folder });
  const worker = await readFile(join(folder, 'dist/sw.js'), 'utf8');
  const cache = JSON.parse(/const CACHE=("[^"]+")/.exec(worker)![1]);
  const handlers = new Map<string, (event: unknown) => void>(), removed: string[] = [];
  let installation: Promise<void> | undefined;
  runInNewContext(worker, { URL, Request, self: { location: { origin: 'https://equinox.test' }, addEventListener: (name: string, handler: (e: unknown) => void) => handlers.set(name, handler) },
   caches: { keys: async () => existing ? [cache] : [], open: async () => ({ addAll: async () => { throw new Error('Synthetic network/integrity failure'); } }), delete: async (name: string) => { removed.push(name); return true; } } });
  handlers.get('install')!({ waitUntil: (promise: Promise<void>) => { installation = promise; } });
  await expect(installation).rejects.toThrow('Synthetic network/integrity failure');
  expect(removed).toEqual(existing ? [] : [cache]);
 } finally { await rm(folder, { recursive: true, force: true }); }
});
