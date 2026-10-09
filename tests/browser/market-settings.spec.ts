import { test, expect } from '@playwright/test';
import { readdir, readFile } from 'node:fs/promises';

// Playwright routing does not intercept page requests handled by a service worker.
// These tests validate provider/UI behavior, not the PWA shell, so block SW here.
test.use({ serviceWorkers: 'block' });
async function downloadedText(d:import('@playwright/test').Download){
 const stream=await d.createReadStream(),chunks:Buffer[]=[];
 for await(const c of stream!)chunks.push(c);return Buffer.concat(chunks).toString();
}
async function backupText(page:import('@playwright/test').Page){
 const wait=page.waitForEvent('download');await page.getByRole('button',{name:'Eksportér backup',exact:true}).click();return downloadedText(await wait);
}
async function settings(page:import('@playwright/test').Page){
 await page.getByRole('navigation',{name:'Hovednavigation'}).getByRole('button',{name:'Settings',exact:true}).click();
 for(const row of await page.locator('.provider-row').all()) if(await row.getAttribute('open')===null) await row.locator('summary').click();
 const backup=page.locator('.settings-group').filter({has:page.getByText('Backup og historik',{exact:true})});if(await backup.getAttribute('open')===null)await backup.locator('summary').first().click();
}
const prices=()=>({bitcoin:{usd:100000,last_updated_at:Math.floor(Date.now()/1000)-5},ethereum:{usd:4000,last_updated_at:Math.floor(Date.now()/1000)-5}});
test('credential sheet saves, masks, persists, replaces, removes and excludes backup',async({page})=>{
 const key=crypto.randomUUID(),replacement=crypto.randomUUID();await page.goto('');await expect(page.getByRole('dialog')).toHaveCount(0);await settings(page);
 await page.getByRole('button',{name:'Connect Massive',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();await expect(dialog.getByLabel('API key')).toHaveAttribute('type','password');
 await dialog.getByLabel('API key').fill(key);await dialog.getByRole('button',{name:'Save locally'}).click();await expect(dialog).toHaveCount(0);expect(await page.locator('body').innerText()).not.toContain(key);expect(await page.locator('input[type=password]').count()).toBe(0);
 await page.reload();await expect(page.getByRole('dialog')).toHaveCount(0);await settings(page);await expect(page.getByRole('button',{name:'Replace key Massive'})).toBeVisible();expect(await backupText(page)).not.toContain(key);
 await page.getByRole('button',{name:'Replace key Massive'}).click();await expect(page.getByLabel('API key')).toHaveValue('');await page.getByLabel('API key').fill(replacement);await page.getByRole('button',{name:'Save locally'}).click();await page.getByRole('button',{name:'Remove key Massive'}).click();await expect(page.getByRole('button',{name:'Connect Massive',exact:true})).toBeVisible();
});
test('HTTP 200 malformed payload cannot authenticate or display echoed key; cancel restores focus',async({page})=>{
 const key=crypto.randomUUID();await page.route('https://api.coingecko.com/**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({error:key})}));
 await page.goto('');await settings(page);await page.getByRole('button',{name:'Connect CoinGecko',exact:true}).click();await page.getByLabel('API key').fill(key);await page.getByRole('dialog').getByRole('button',{name:'Test connection'}).click();await expect(page.getByRole('dialog')).toContainText('SCHEMA_INVALID');expect(await page.locator('body').innerText()).not.toContain(key);
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('button',{name:'Connect CoinGecko',exact:true})).toBeFocused();
});
test('editing a successfully tested draft invalidates verification',async({page})=>{
 await page.route('https://api.coingecko.com/**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(prices())}));await page.goto('');await settings(page);await page.getByRole('button',{name:'Connect CoinGecko',exact:true}).click();
 const sheet=page.getByRole('dialog');await sheet.getByLabel('API key').fill(crypto.randomUUID());await sheet.getByRole('button',{name:'Test connection'}).click();await expect(sheet).toContainText('Connection verified');await sheet.getByLabel('API key').fill(crypto.randomUUID());await expect(sheet).not.toContainText('Connection verified');await sheet.getByRole('button',{name:'Save locally'}).click();await expect(page.locator('.provider-row').filter({hasText:'CoinGecko'})).toContainText('Saved locally · not tested');
});
test('current reference cache survives reload and offline without changing financial state',async({page,context})=>{
 await page.route('https://api.coingecko.com/**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(prices())}));await page.goto('');await settings(page);
 const before=JSON.parse(await backupText(page));expect(before.state.holdings).toHaveLength(5);expect(Array.isArray(before.snapshots)).toBe(true);
 await page.getByRole('button',{name:'Test public access CoinGecko'}).click();await expect(page.getByText('Public access verified')).toBeVisible();await expect(page.getByTestId('market-references')).toContainText('CURRENT');await expect(page.getByTestId('market-references')).toContainText('100.000');
 const after=JSON.parse(await backupText(page));expect(after.state).toEqual(before.state);expect(after.snapshots).toEqual(before.snapshots);
 await page.reload();await settings(page);await expect(page.getByTestId('market-references')).toContainText('CACHED');await context.setOffline(true);await expect(page.getByTestId('market-references')).toContainText('OFFLINE');await expect(page.getByRole('button',{name:'Opdatér risikohistorik',exact:true})).toBeDisabled();
});
test('saved auth is header-only and excluded from logs, snapshot, cache and bundle',async({page})=>{
 const key=crypto.randomUUID(),logs:string[]=[];page.on('console',m=>logs.push(m.text()));page.on('pageerror',e=>logs.push(e.message));
 await page.route('https://api.coingecko.com/**',r=>{
  expect(r.request().headers()['x-cg-demo-api-key']).toBe(key);expect(r.request().url()).not.toContain(key);
  return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({...prices(),error:key})});
 });
 await page.goto('');await settings(page);await page.getByRole('button',{name:'Connect CoinGecko',exact:true}).click();await page.getByLabel('API key').fill(key);await page.getByRole('button',{name:'Save locally'}).click();await page.reload();await settings(page);await expect(page.locator('.provider-row').filter({hasText:'CoinGecko'})).toContainText('Saved locally · not tested');
 await page.getByRole('button',{name:'Test connection CoinGecko',exact:true}).click();await expect(page.getByText('Connected ✓',{exact:true})).toBeVisible();expect(await backupText(page)).not.toContain(key);
 await page.getByRole('navigation',{name:'Hovednavigation'}).getByRole('button',{name:'Allocate',exact:true}).click();await page.getByRole('button',{name:'Prøv med demodata'}).click();await page.getByRole('button',{name:'Beregn fordeling'}).click();await expect(page.getByRole('heading',{name:'Din købsplan'})).toBeVisible();await settings(page);
 const wait=page.waitForEvent('download');await page.getByRole('button',{name:'Eksportér vist snapshot',exact:true}).click();expect(await downloadedText(await wait)).not.toContain(key);
 const stored=await page.evaluate(async()=>{
  const cached:unknown[]=[];
  for(const name of await caches.keys()){const cache=await caches.open(name);for(const req of await cache.keys())cached.push({url:req.url,headers:[...req.headers],body:await (await cache.match(req))!.text()});}
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('EQUINOX_MARKET_DATA_V1');r.onsuccess=()=>resolve(r.result);r.onerror=reject;});
  const rows=await new Promise<unknown[]>((resolve,reject)=>{const r=db.transaction('normalized').objectStore('normalized').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=reject;});db.close();return {cached,rows};
 });
 expect(stored.rows).toHaveLength(2);expect(JSON.stringify(stored)).not.toContain(key);expect(logs.join('\n')).not.toContain(key);
 for(const f of await readdir('dist',{recursive:true,withFileTypes:true}))if(f.isFile())expect((await readFile(`${f.parentPath}/${f.name}`)).includes(Buffer.from(key))).toBe(false);
});
