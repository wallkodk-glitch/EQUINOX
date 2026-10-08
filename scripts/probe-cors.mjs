// Unmocked public/invalid-credential probe. Never records key values or response bodies.
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createServer } from 'vite';
const server=process.env.EQUINOX_PROBE_ORIGIN?null:await createServer({server:{host:'127.0.0.1',port:5173,strictPort:true}});
if(server)await server.listen();
const browser=await chromium.launch({executablePath:process.env.EQUINOX_CHROMIUM_EXECUTABLE,args:['--disable-gpu','--no-zygote'],...(process.env.HTTPS_PROXY?{proxy:{server:process.env.HTTPS_PROXY,bypass:'127.0.0.1,localhost'}}:{})});
try {
 const page=await browser.newPage(),origin=process.env.EQUINOX_PROBE_ORIGIN||'http://127.0.0.1:5173/EQUINOX/';await page.goto(origin);
 const probes=[
  {name:'nationalbank-xml',url:'https://www.nationalbanken.dk/api/currencyratesxml?lang=en',headers:{}},
  {name:'nationalbank-rss',url:'https://www.nationalbanken.dk/api/currencyrates?format=rss&isocodes=usd&lang=en',headers:{}},
  {name:'coingecko-public',url:'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_last_updated_at=true',headers:{}},
  {name:'massive-invalid-key',url:'https://api.massive.com/stocks/v1/splits?ticker=GOOGL&limit=1',headers:{Authorization:`Bearer ${randomUUID()}`}},
  {name:'coingecko-invalid-demo-key',url:'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_last_updated_at=true',headers:{'x-cg-demo-api-key':randomUUID()}},
 ];
 const results=[];
 for(const probe of probes){
  const diagnostics=[],handler=m=>{const t=m.text();if(t.includes('CORS policy'))diagnostics.push('BROWSER_CORS_POLICY_REJECTION');if(t.includes('ERR_CERT'))diagnostics.push('CERTIFICATE_ERROR');};page.on('console',handler);
  const result=await page.evaluate(async p=>{
   try{const r=await fetch(p.url,{headers:p.headers,cache:'no-store',credentials:'omit',redirect:'error',signal:AbortSignal.timeout(15000)}),body=await r.text();let d;try{d=JSON.parse(body);}catch{/* XML/error body discarded. */}
    return {readable:true,httpStatus:r.status,contentType:r.headers.get('content-type'),bytes:body.length,positiveBtcEth:!!(d?.bitcoin?.usd>0&&d?.ethereum?.usd>0),freshnessMetadata:!!(d?.bitcoin?.last_updated_at&&d?.ethereum?.last_updated_at)};
   }catch(e){return {readable:false,errorClass:e instanceof Error?e.name:'Unknown'};}
  },probe);page.off('console',handler);results.push({name:probe.name,...result,diagnostics:[...new Set(diagnostics)]});
 }
 const evidence={acquiredAt:new Date().toISOString(),origin,browser:await browser.version(),security:'Default CORS/TLS; no disabled web security; no response interception',validCredentials:'NOT PROVIDED / NOT TESTED',results};
 await writeFile('validation/cors-probe.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));
}finally{await browser.close();await server?.close();}
