import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fxPayload, nativeFXResponse } from '../fixtures/native-fx-projection';

// Controlled sanitized projections are wrapped in documented JSON envelopes.
// This exercises the real adapters/gates/UI, NOT live account entitlement/CORS.
test.use({ serviceWorkers: 'block' });
const accepted = JSON.parse(readFileSync('validation/closure-final-synchronized.json', 'utf8'));
const providers = JSON.parse(readFileSync('validation/closure-final-provider-rows.json', 'utf8'));
const snapshot = JSON.parse(readFileSync('validation/node-snapshot.json', 'utf8'));

async function backup(page: Page) {
  const group = page.locator('.settings-group').filter({ has: page.getByText('Backup og historik', { exact: true }) });
  if (await group.getAttribute('open') === null) await group.locator('summary').first().click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Eksportér backup', exact: true }).click();
  const stream = await (await download).createReadStream(), chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString());
}
async function setup(page: Page, previous = true) {
  await page.clock.install({ time: new Date(accepted.validationAsOf) });
  await page.goto('./'); await page.clock.fastForward(1601);
  await page.getByRole('navigation').getByRole('button', { name: 'Settings', exact: true }).click();
  const history = page.locator('.settings-group').filter({ has: page.getByText('Historiske markedsdata', { exact: true }) });
  await history.locator('summary').first().click();
  await page.getByLabel('Lookback', { exact: true }).selectOption('252');
  await expect(page.getByText('Gemt lokalt', { exact: true })).toBeVisible();
  const before = await backup(page);
  before.state.holdings[0].units = 17; before.state.holdings[0].priceDKK = 1234; before.state.holdings[0].priceAsOf = accepted.validationAsOf;
  before.state.dataset = previous ? accepted.normalizedInput : null; before.snapshots = [snapshot];
  await page.getByLabel('Gendan backup', { exact: true }).setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(before)) });
  await expect(page.getByText('Backup gendannet.', { exact: false })).toBeVisible();
  // A real local key, generated per test, never stored in fixtures or evidence.
  const key = crypto.randomUUID();
  await page.locator('.provider-row').filter({ hasText: 'Massive' }).locator('summary').click();
  await page.getByRole('button', { name: 'Connect Massive', exact: true }).click();
  await page.getByLabel('API key').fill(key); await page.getByRole('button', { name: 'Save locally', exact: true }).click();
  return { key, before: await backup(page) };
}
async function nativeFixtures(page: Page, key: string, failETH = false) {
  let calls = 0;
  await page.route('https://api.massive.com/**', async route => {
    calls++;
    expect(route.request().headers()['authorization']).toBe(`Bearer ${key}`);
    expect(route.request().url()).not.toContain(key);
    const url = new URL(route.request().url());
    if (url.pathname.includes('/aggs/')) {
      const symbol = url.pathname.split('/ticker/')[1].split('/range/')[0];
      const instrument = symbol.replace('X:', '').replace('USD', '');
      const bars = failETH && instrument === 'ETH' ? [] : providers.data[instrument].bars;
      await route.fulfill({ json: { ticker: symbol, adjusted: false, status: 'OK', resultsCount: bars.length, results: bars } });
    } else {
      const action = providers.actions[url.searchParams.get('ticker')!];
      await route.fulfill({ json: { status: 'OK', results: url.pathname.endsWith('splits') ? action.rawSplits : action.rawDividends } });
    }
  });
  await page.route('https://api.statbank.dk/**', async route => {
    if (route.request().url().includes('/tableinfo/')) {
      await route.fulfill({ json: { id: 'DNVALD', variables: [
        { id: 'VALUTA', values: [{ id: 'USD', text: 'USD' }] },
        { id: 'KURTYP', values: [{ id: 'KBH', text: 'Exchange rates (DKK per 100 units of foreign currency)' }] },
        { id: 'Tid', values: Object.keys(fxPayload.dataset.dimension.Tid.category.index).map(id => ({ id, text: id })) },
      ] } });
    } else await route.fulfill({ json: nativeFXResponse(new URL(route.request().url())) });
  });
  return () => calls;
}
async function driveRequests(page: Page, calls: () => number, expected: number) {
  for (let n = 1; n <= expected; n++) {
    await expect.poll(calls).toBeGreaterThanOrEqual(n);
    if (n < expected) await page.clock.runFor(13020);
  }
}

test('manual refresh accepts a fully gated synchronized dataset only; reload preserves prices, holdings, snapshots and key separation', async ({ page }) => {
  const { key, before } = await setup(page, false), calls = await nativeFixtures(page, key);
  await page.getByRole('button', { name: 'Opdatér risikohistorik', exact: true }).click();
  await expect(page.getByText(/Henter data ·/)).toBeVisible(); await driveRequests(page, calls, 11);
  await expect(page.getByText('Klar · risikohistorik gemt', { exact: true })).toBeVisible();
  const after = await backup(page);
  expect(after.state.dataset.rows).toEqual(accepted.normalizedInput.rows);
  expect(after.state.dataset.provider).toBe('MASSIVE_NATIONALBANK_SYNCHRONIZED_RETROSPECTIVE_V1');
  expect(after.state.holdings).toEqual(before.state.holdings); expect(after.snapshots).toEqual(before.snapshots);
  expect(after.state.acknowledgeUserData).toBe(before.state.acknowledgeUserData);
  expect(JSON.stringify(after)).not.toContain(key);
  await page.reload(); await page.clock.fastForward(1601);
  await page.getByRole('navigation').getByRole('button', { name: 'Settings', exact: true }).click();
  expect((await backup(page)).state).toEqual(after.state);
  await expect(page.getByTestId('accepted-risk-status')).toContainText('ikke live');
});

test('partial ETH history cannot replace previous accepted data or modify financial state; offline and return-online are explicit', async ({ page, context }) => {
  const { key, before } = await setup(page), calls = await nativeFixtures(page, key, true);
  await page.getByRole('button', { name: 'Opdatér risikohistorik', exact: true }).click(); await driveRequests(page, calls, 5);
  await expect(page.getByText('Klar · risikohistorik gemt', { exact: true })).toHaveCount(0);
  await expect(page.locator('.market-settings')).toContainText('MISSING_OBSERVATION');
  expect((await backup(page)).state).toEqual(before.state);
  await context.setOffline(true); await expect(page.getByTestId('accepted-risk-status')).toContainText('Offline');
  await expect(page.getByRole('button', { name: 'Opdatér risikohistorik', exact: true })).toBeDisabled();
  await context.setOffline(false); await expect(page.getByRole('button', { name: 'Opdatér risikohistorik', exact: true })).toBeEnabled();
  await page.reload(); await page.clock.fastForward(1601);
  await page.getByRole('navigation').getByRole('button', { name: 'Settings', exact: true }).click();
  expect((await backup(page)).state).toEqual(before.state);
});

for (const failure of [401, 403, 429, 'network', 'empty', 'schema'] as const) test(`refresh ${failure} is recoverable, secret-free and never accepts partial data`, async ({ page }) => {
  const { key, before } = await setup(page);
  await page.route('https://api.massive.com/**', route => failure === 'network' ? route.abort('failed') : route.fulfill({
    status: typeof failure === 'number' ? failure : 200, json: failure === 'empty' ? { ticker: 'GOOGL', adjusted: false, status: 'OK', resultsCount: 0, results: [] } : { error: key },
  }));
  await page.getByRole('button', { name: 'Opdatér risikohistorik', exact: true }).click();
  const code = { 401: 'AUTH_FAILED', 403: 'ENTITLEMENT_DENIED', 429: 'RATE_LIMITED', network: 'NETWORK_OR_CORS', empty: 'MISSING_OBSERVATION', schema: 'SCHEMA_INVALID' }[failure];
  await expect(page.locator('.market-settings')).toContainText(code);
  expect(await page.locator('body').innerText()).not.toContain(key);
  expect((await backup(page)).state).toEqual(before.state);
});

test('cancellation during acquisition preserves accepted state and removes busy UI', async ({ page }) => {
  const { before } = await setup(page);
  let release!: () => void; const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('https://api.massive.com/**', async route => { await held; await route.abort().catch(() => {}); });
  try {
    await page.getByRole('button', { name: 'Opdatér risikohistorik', exact: true }).click();
    await page.getByRole('button', { name: 'Annullér opdatering', exact: true }).click();
    await expect(page.locator('.market-settings')).toContainText('ABORTED');
    await expect(page.getByRole('button', { name: 'Opdatér risikohistorik', exact: true })).toBeEnabled();
    expect((await backup(page)).state).toEqual(before.state);
  } finally { release(); }
});

test('manual file history import is not swallowed by its own persistence guard', async ({ page }) => {
  await setup(page, false);
  await page.getByLabel('Importér historik', { exact: true }).setInputFiles({ name: 'history.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(accepted.normalizedInput)) });
  await expect(page.getByText('Historik importeret.', { exact: false })).toBeVisible();
  expect((await backup(page)).state.dataset).toEqual(accepted.normalizedInput);
});

test('explicit corrupt-cache recovery preserves financial state, calculations and local credential domain', async ({ page }) => {
  const { before } = await setup(page);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('EQUINOX_MARKET_DATA_V1'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    await new Promise<void>((resolve, reject) => { const transaction = db.transaction('normalized', 'readwrite'); transaction.objectStore('normalized').put({ price: 'broken' }, 'invalid'); transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); });
    db.close();
  });
  await page.reload(); await page.clock.fastForward(1601);
  await page.getByRole('navigation').getByRole('button', { name: 'Settings', exact: true }).click();
  const recover = page.getByRole('button', { name: 'Slet kun market-cache', exact: true });
  await expect(recover).toBeVisible();
  page.once('dialog', dialog => dialog.accept()); await recover.click();
  await expect(page.locator('.market-settings')).toContainText('Market-cache er klar.');
  expect((await backup(page)).state).toEqual(before.state);
  expect((await backup(page)).snapshots).toEqual(before.snapshots);
  await page.locator('.provider-row').filter({ hasText: 'Massive' }).locator('summary').click();
  await expect(page.getByRole('button', { name: 'Replace key Massive', exact: true })).toBeVisible();
});
