import { test, expect } from '@playwright/test';
import { createServer, type ViteDevServer } from 'vite';
import { readFile } from 'node:fs/promises';
import expected from '../fixtures/providers/expected.normalized.json' with { type: 'json' };
let server:ViteDevServer;
test.beforeAll(async()=>{server=await createServer({server:{host:'127.0.0.1',port:5193,strictPort:true}});await server.listen();});
test.afterAll(async()=>{await server?.close();});
const acquired='2026-10-02T23:00:00.000Z';
const xml=(date='2026-10-02',rate='665,80')=>`<exchangerates type="Exchange rates" author="Danmarks Nationalbank" refcur="DKK" refamt="1"><dailyrates id="${date}"><currency code="USD" rate="${rate}"/></dailyrates></exchangerates>`;
const rss=(rate='665,80',date='fre, 02 okt. 2026 12.00.00 +02:00')=>`<rss version="2.0"><channel><title>Danmarks Nationalbank - Valutakurser</title><item><description>100 USD koster ${rate} DKK</description><pubDate>${date}</pubDate></item></channel></rss>`;
async function parse(page:import('@playwright/test').Page,value:string){
 await page.goto('http://127.0.0.1:5193/EQUINOX/');
 return page.evaluate(async({value,when})=>{
  const path='/EQUINOX/src/market-data/live/nationalbank.ts';const {parseNationalbank}=await import(/* @vite-ignore */ path);
  try{return {rows:parseNationalbank(value,when),error:''};}catch(e){return {rows:[],error:e instanceof Error?e.message:'ERROR'};}
 },{value,when:acquired});
}
test('official XML units and independent expected output; no invented publication time',async({page})=>{
 const r=await parse(page,await readFile('tests/fixtures/providers/nationalbank.raw.xml','utf8'));
 expect(r.error).toBe('');expect(r.rows).toHaveLength(1);expect(r.rows[0]).toMatchObject(expected.fx);expect(r.rows[0].acquiredAt).toBe(acquired);expect(r.rows[0]).not.toHaveProperty('publishedAt');
});
test('Danish and English RSS labels preserve source but discard noon clock',async({page})=>{
 for(const input of [rss(),rss('665.80','Fri, 02 Oct 2026 12:00:00 +02:00').replace('koster','cost')]){
  const r=await parse(page,input);expect(r.error).toBe('');expect(r.rows[0]).toMatchObject(expected.fx);expect(r.rows[0].sourceURL).toBe('https://www.nationalbanken.dk/api/currencyrates?format=rss&isocodes=usd&lang=en');
 }
});
test('malformed, identity, missing USD, unit, nonfinite and future observations reject',async({page})=>{
 // Acquisition is October 3 in Copenhagen, so October 4 is future.
 for(const input of [xml().replace('</exchangerates>',''),xml().replace('Danmarks Nationalbank','Other Bank'),xml().replace('code="USD"','code="EUR"'),rss().replace('100 USD','1 USD'),xml('2026-10-04'),xml('2026-10-02','NaN'),xml('2026-10-02','0'),'<!DOCTYPE x [<!ENTITY x "oops">]><rss/>']) expect((await parse(page,input)).error,input).not.toBe('');
});
test('conflicting date rejects; exact duplicate collapses',async({page})=>{
 const duplicate=xml().replace('</exchangerates>','<dailyrates id="2026-10-02"><currency code="USD" rate="665.80"/></dailyrates></exchangerates>');
 expect((await parse(page,duplicate)).rows).toHaveLength(1);expect((await parse(page,duplicate.replace('rate="665.80"','rate="666.80"'))).error).toBe('FX_OBSERVATION_CONFLICT');
});
