import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { initialState } from '../src/persistence/schema';
import { Store } from '../src/persistence/store';
import { datasetSchema, type RetrospectiveDataset } from '../src/market-data/provider';
import { finishRiskImport } from '../src/ui/risk-import';
import { seal } from '../src/snapshots/integrity';
import { calculate, inputFromState } from '../src/snapshots/calculate';

const raw = JSON.parse(readFileSync('validation/closure-final-synchronized.json', 'utf8'));
const now: string = raw.validationAsOf;
const dataset = () => datasetSchema.parse(raw.normalizedInput) as RetrospectiveDataset;
function state() {
  const s = initialState(); s.lookback = 252; s.capital = 1234;
  s.holdings.forEach((h, i) => { h.units = i + 1; h.priceDKK = 100 + i; h.priceAsOf = now; h.costBasisDKK = 17; });
  return s;
}

// Catches a refresh writing captured (old) holdings, or publishing before save.
it('accepts a complete gated risk dataset, preserving the latest financial fields and saved calculations across reopen', async () => {
  const name = crypto.randomUUID(), store = await Store.open(name), source = state();
  const snapshot = await seal(calculate(inputFromState(source, now)));
  let current = await store.save(source, 0, snapshot);
  const start = structuredClone(current);
  current.capital = 999; current.holdings[0].priceDKK = 112; current.holdings[0].units = 23;
  current = await store.save(current, 1);
  const before = structuredClone(current);
  const accepted = await finishRiskImport(dataset(), start, () => current, new AbortController().signal,
    next => store.save(next, current.revision), now);
  expect(current).toEqual(before); // job never mutates/publishes the editor itself
  expect(accepted).toEqual({ ...before, dataset: dataset(), revision: 3 });
  expect(accepted.acknowledgeUserData).toBe(false); // no silent consent
  store.close();
  const reopened = await Store.open(name);
  expect((await reopened.load()).state).toEqual(accepted);
  expect((await reopened.load()).snapshots).toEqual([snapshot]);
  expect(JSON.parse(await reopened.backup()).state.holdings).toEqual(before.holdings);
  reopened.close();
});

// Catches bypass of provenance/coverage/provider roles at the UI commit boundary.
it.each(['missing', 'partial', 'coingecko', 'daily-stock', 'dividend', 'fx', 'stale'] as const)
  ('refuses %s risk data without any financial write', async mode => {
    const source = state(), bad = structuredClone(dataset());
    if (mode === 'missing') bad.rows.pop();
    if (mode === 'partial') bad.rows.splice(20, 1);
    if (mode === 'coingecko') bad.provenance!.marketObservations[0].provider = 'coingecko';
    if (mode === 'daily-stock') bad.provenance!.marketObservations[0].kind = 'equity-eod';
    if (mode === 'dividend') bad.provenance!.corporateActions[2].dividends.pop();
    if (mode === 'fx') bad.rows.at(-1)!.fx.rate = 7;
    const persist = vi.fn(async () => source), before = structuredClone(source);
    await expect(finishRiskImport(bad, source, () => source, new AbortController().signal, persist,
      mode === 'stale' ? '2026-10-09T12:00:00.000Z' : now)).rejects.toThrow();
    expect(persist).not.toHaveBeenCalled(); expect(source).toEqual(before);
  });

it.each(['cancel', 'lookback-change', 'dataset-change'] as const)('%s invalidates a pending import, preserving newer edits', async mode => {
  const source = state(), latest = structuredClone(source), c = new AbortController();
  if (mode === 'cancel') c.abort();
  if (mode === 'lookback-change') latest.lookback = 504;
  if (mode === 'dataset-change') latest.dataset = dataset();
  const before = structuredClone(latest), persist = vi.fn(async () => latest);
  await expect(finishRiskImport(dataset(), source, () => latest, c.signal, persist, now)).rejects.toThrow('ABORTED');
  expect(persist).not.toHaveBeenCalled(); expect(latest).toEqual(before);
});

it('a rejected atomic save leaves the previous accepted state and backup unchanged', async () => {
  const store = await Store.open(crypto.randomUUID()), source = state();
  source.dataset = dataset(); source.acknowledgeUserData = true;
  const current = await store.save(source, 0), before = await store.backup();
  await expect(finishRiskImport(dataset(), current, () => current, new AbortController().signal,
    next => store.save(next, 0), now)).rejects.toThrow('STATE_CONFLICT');
  expect((await store.load()).state).toEqual(current);
  expect(JSON.parse(await store.backup()).state).toEqual(JSON.parse(before).state);
  store.close();
});
