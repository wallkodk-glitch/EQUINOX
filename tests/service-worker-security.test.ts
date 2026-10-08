import { it, expect } from 'vitest';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
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
