import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { waitForInteractive } from './helpers';

async function settings(page: Page) {
  await page.getByRole('navigation').getByRole('button', { name: 'Settings', exact: true }).click();
  await page.locator('.settings-group').filter({ hasText: 'Backup og historik' }).locator('summary').first().click();
}

test('a demo history file held across exit cannot alter the personal database', async ({ page }) => {
  const fixture = JSON.parse(readFileSync('validation/closure-final-synchronized.json', 'utf8'));
  await page.clock.install({ time: new Date(fixture.validationAsOf) });
  await page.goto('./'); await waitForInteractive(page);
  await page.getByLabel('Ny kapital i DKK').fill('4321');
  await expect(page.locator('.statusline')).toContainText('Gemt lokalt');
  const readState = () => page.evaluate(async () => {
    return new Promise<unknown>((resolve, reject) => {
      const opened = indexedDB.open('EQUINOX_V1');
      opened.onerror = () => reject(opened.error);
      opened.onsuccess = () => {
        const db = opened.result, t = db.transaction('state');
        const current = t.objectStore('state').get('current');
        t.oncomplete = () => { db.close(); resolve(current.result); };
        t.onabort = () => { db.close(); reject(t.error); };
      };
    });
  });
  const before = await readState();
  await page.getByRole('button', { name: 'Prøv med demodata' }).click();
  await page.getByRole('navigation').getByRole('button', { name: 'Settings', exact: true }).click();
  await page.locator('.settings-group').filter({ hasText: 'Historiske markedsdata' }).locator('summary').first().click();
  await page.evaluate(() => {
    const text = File.prototype.text;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    Object.assign(window, { demoFileHeld: false, releaseDemoFile: release });
    File.prototype.text = async function () {
      if (this.name === 'held-history.json') { Object.assign(window, { demoFileHeld: true }); await gate; }
      return text.call(this);
    };
  });
  await page.getByLabel('Importér datasæt', { exact: true }).setInputFiles({
    name: 'held-history.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture.normalizedInput)),
  });
  await page.waitForFunction(() => (window as unknown as { demoFileHeld: boolean }).demoFileHeld);
  await page.getByRole('button', { name: 'Afslut demo' }).click();
  await page.evaluate(() => (window as unknown as { releaseDemoFile: () => void }).releaseDemoFile());
  await expect(page.getByLabel('Importér datasæt', { exact: true })).toBeEnabled();
  expect(await readState()).toEqual(before);
  await expect(page.getByText('Historik importeret.', { exact: false })).toHaveCount(0);
  await page.reload(); await waitForInteractive(page);
  expect(await readState()).toEqual(before);
  await expect(page.getByLabel('Ny kapital i DKK')).toHaveValue('4321');
});

test('an existing undefined state record requires recovery and is not silently reset', async ({ page }) => {
  await page.goto('./'); await waitForInteractive(page);
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const opened = indexedDB.open('EQUINOX_V1');
    opened.onerror = () => reject(opened.error);
    opened.onsuccess = () => {
      const db = opened.result, t = db.transaction('state', 'readwrite');
      t.objectStore('state').put(undefined, 'current');
      t.oncomplete = () => { db.close(); resolve(); };
      t.onabort = () => { db.close(); reject(t.error); };
    };
  }));
  await page.reload(); await waitForInteractive(page);
  await expect(page.getByRole('heading', { name: 'Bevar dine data' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('CORRUPTED_OR_UNSUPPORTED_STATE');
  await page.getByRole('button', { name: 'Eksportér recovery-kopi' }).click();
  await expect(page.getByRole('alert')).toContainText('RAW_RECOVERY_NOT_JSON_SAFE');
});

test('a delayed demo result cannot select itself in a later demo session', async ({ page }) => {
  await page.goto('./'); await waitForInteractive(page);
  await page.getByLabel('Ny kapital i DKK').fill('4321');
  await expect(page.locator('.statusline')).toContainText('Gemt lokalt');
  await page.getByRole('button', { name: 'Prøv med demodata' }).click();
  await page.getByLabel('Ny kapital i DKK').fill('1234');
  await page.evaluate(() => {
    const digest = crypto.subtle.digest.bind(crypto.subtle);
    let release!: () => void, first = true;
    const held = new Promise<void>(resolve => { release = resolve; });
    Object.assign(window, { demoDigestHeld: false, releaseDemoDigest: release });
    crypto.subtle.digest = async (...args) => {
      if (first) { first = false; Object.assign(window, { demoDigestHeld: true }); await held; }
      return digest(...args);
    };
  });
  await page.getByRole('button', { name: 'Beregn fordeling' }).click();
  await page.waitForFunction(() => (window as unknown as { demoDigestHeld: boolean }).demoDigestHeld);
  await page.getByRole('button', { name: 'Afslut demo' }).click();
  await page.getByRole('button', { name: 'Prøv med demodata' }).click();
  await page.getByLabel('Ny kapital i DKK').fill('9876');
  await page.evaluate(() => (window as unknown as { releaseDemoDigest: () => void }).releaseDemoDigest());
  await expect(page.getByRole('button', { name: 'Beregn fordeling' })).toBeEnabled();
  await expect(page.locator('.buy-plan')).toHaveCount(0);
  await expect(page.getByLabel('Ny kapital i DKK')).toHaveValue('9876');
  await page.getByRole('button', { name: 'Beregn fordeling' }).click();
  await expect(page.getByText('Midlertidigt demo-snapshot', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Afslut demo' }).click();
  await expect(page.getByLabel('Ny kapital i DKK')).toHaveValue('4321');
  await settings(page);
  await expect(page.locator('.history-row')).toHaveCount(0);
});

test('calculation excludes restore and duplicate submits but preserves rapid edits and exact snapshot input', async ({ page }) => {
  await page.goto('./'); await waitForInteractive(page);
  await page.getByRole('button', { name: 'Redigér portefølje', exact: true }).click();
  for (const asset of ['GOOGL', 'ISRG', 'TSM', 'BTC', 'ETH']) await page.getByLabel(`${asset} pris i DKK`).fill('100');
  await page.getByRole('button', { name: 'Bekræft priser som aktuelle' }).click();
  await page.getByRole('navigation').getByRole('button', { name: 'Allocate', exact: true }).click();
  await page.getByLabel('Ny kapital i DKK').fill('1234');
  await expect(page.locator('.statusline')).toContainText('Gemt lokalt');
  await page.evaluate(() => {
    const digest = crypto.subtle.digest.bind(crypto.subtle);
    let release!: () => void, first = true;
    const held = new Promise<void>(resolve => { release = resolve; });
    Object.assign(window, { releaseDigest: release });
    crypto.subtle.digest = async (...args) => {
      if (first) { first = false; await held; }
      return digest(...args);
    };
  });
  await page.getByRole('button', { name: 'Beregn fordeling' }).click();
  await expect(page.locator('.capital-form button[type=submit]')).toBeDisabled();
  await page.locator('.capital-form').dispatchEvent('submit');
  await page.getByLabel('Ny kapital i DKK').fill('4567');
  await settings(page);
  await expect(page.getByLabel('Gendan backup', { exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Eksportér backup', exact: true })).toBeDisabled();
  await page.evaluate(() => (window as unknown as { releaseDigest: () => void }).releaseDigest());
  await expect(page.locator('.history-row')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Eksportér backup', exact: true })).toBeEnabled();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Eksportér backup', exact: true }).click();
  const stream = await (await downloaded).createReadStream(), chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(chunk);
  const backup = JSON.parse(Buffer.concat(chunks).toString());
  expect(backup.state.capital).toBe(4567);
  expect(backup.snapshots).toHaveLength(1);
  expect(backup.snapshots[0].snapshot.input.capital).toBe(1234);
  await page.reload(); await waitForInteractive(page);
  await expect(page.getByLabel('Ny kapital i DKK')).toHaveValue('4567');
});

test('failed storage save reports not saved and reload recovers the last committed capital', async ({ page }) => {
  await page.goto('./'); await waitForInteractive(page);
  await page.getByLabel('Ny kapital i DKK').fill('1234');
  await expect(page.locator('.statusline')).toContainText('Gemt lokalt');
  await page.evaluate(() => {
    const transaction = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (...args) {
      if (this.name === 'EQUINOX_V1' && args[1] === 'readwrite') throw new DOMException('Synthetic quota failure', 'QuotaExceededError');
      return transaction.apply(this, args);
    };
  });
  await page.getByLabel('Ny kapital i DKK').fill('999');
  await expect(page.locator('.statusline')).toContainText('IKKE GEMT');
  await expect(page.getByRole('heading', { name: 'Bevar dine data' })).toBeVisible();
  await page.reload(); await waitForInteractive(page);
  await expect(page.getByLabel('Ny kapital i DKK')).toHaveValue('1234');
});

test('storage-open failure has an explicit recovery screen without null database actions', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => { indexedDB.open = () => { throw new DOMException('Synthetic blocked storage', 'SecurityError'); }; });
  await page.goto('./'); await waitForInteractive(page);
  await expect(page.getByRole('heading', { name: 'Bevar dine data' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Eksportér recovery-kopi' })).toBeDisabled();
  await expect(page.getByLabel('Gendan backup')).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('Lokal lagring kunne ikke åbnes');
  expect(errors).toEqual([]);
});

test('closing and reopening a page preserves committed state and does not persist demo edits', async ({ page, context }) => {
  await page.goto('./'); await waitForInteractive(page);
  await page.getByLabel('Ny kapital i DKK').fill('1234');
  await expect(page.locator('.statusline')).toContainText('Gemt lokalt');
  await page.getByRole('button', { name: 'Prøv med demodata' }).click();
  await page.getByLabel('Ny kapital i DKK').fill('9999');
  await page.getByRole('button', { name: 'Beregn fordeling' }).click();
  await expect(page.getByText('Midlertidigt demo-snapshot', { exact: true })).toBeVisible();
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto('./'); await waitForInteractive(reopened);
  await expect(reopened.getByLabel('Ny kapital i DKK')).toHaveValue('1234');
  await expect(reopened.getByText('DEMO · SYNTETISKE DATA', { exact: true })).toHaveCount(0);
  await settings(reopened);
  await expect(reopened.locator('.history-row')).toHaveCount(0);
});
