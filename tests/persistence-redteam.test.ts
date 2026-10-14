import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Store } from '../src/persistence/store';
import { initialState } from '../src/persistence/schema';
import { calculate, inputFromState } from '../src/snapshots/calculate';
import { seal } from '../src/snapshots/integrity';

async function overwriteCurrent(name: string, value: unknown): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const opened = indexedDB.open(name);
    opened.onerror = () => reject(opened.error);
    opened.onsuccess = () => {
      const db = opened.result;
      const t = db.transaction('state', 'readwrite');
      t.oncomplete = () => { db.close(); resolve(); };
      t.onabort = t.onerror = () => { db.close(); reject(t.error); };
      t.objectStore('state').put(value, 'current');
    };
  });
}

async function currentRecords(name: string): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const opened = indexedDB.open(name);
    opened.onerror = () => reject(opened.error);
    opened.onsuccess = () => {
      const db = opened.result;
      const t = db.transaction('state');
      const read = t.objectStore('state').getAll('current');
      t.oncomplete = () => { db.close(); resolve(read.result); };
      t.onabort = t.onerror = () => { db.close(); reject(t.error); };
    };
  });
}

it('raw export rejects an existing undefined state record rather than claiming it is absent', async () => {
  const name = crypto.randomUUID(), store = await Store.open(name);
  try {
    await overwriteCurrent(name, undefined);
    expect(await currentRecords(name)).toStrictEqual([undefined]);
    await expect(store.rawBackup()).rejects.toThrow('RAW_RECOVERY_NOT_JSON_SAFE');
    expect(await currentRecords(name)).toStrictEqual([undefined]);
  } finally { store.close(); }
});

it('load rejects an existing undefined state record rather than silently resetting it', async () => {
  const name = crypto.randomUUID(), store = await Store.open(name);
  try {
    await overwriteCurrent(name, undefined);
    await expect(store.load()).rejects.toThrow('CORRUPTED_OR_UNSUPPORTED_STATE');
    expect(await currentRecords(name)).toStrictEqual([undefined]);
  } finally { store.close(); }
});

it('save cannot overwrite an existing undefined state record as a fresh database', async () => {
  const name = crypto.randomUUID(), store = await Store.open(name);
  try {
    await overwriteCurrent(name, undefined);
    await expect(store.save(initialState(), 0)).rejects.toThrow('CORRUPTED_OR_UNSUPPORTED_STATE');
    expect(await currentRecords(name)).toStrictEqual([undefined]);
  } finally { store.close(); }
});

it('explicit restore preserves the existence and undefined value of the corrupt prior state', async () => {
  const name = crypto.randomUUID(), store = await Store.open(name);
  try {
    const backup = await store.backup();
    await overwriteCurrent(name, undefined);
    await store.restore(backup, 0);
    const copies = await store.recoveryCopies();
    expect(copies).toHaveLength(1);
    expect(Object.hasOwn(copies[0], 'state')).toBe(true);
    expect(copies[0].state).toBeUndefined();
    await expect(store.rawBackup()).rejects.toThrow('RAW_RECOVERY_NOT_JSON_SAFE');
    expect((await store.load()).state.revision).toBe(1);
  } finally { store.close(); }
});

it.each([
  ['-Infinity', -Infinity],
  ['Set', new Set([1, 2])],
  ['BigInt', 9n],
  ['undefined array element', [undefined]],
  ['cycle', (() => { const a: { cycle?: unknown } = {}; a.cycle = a; return a; })()],
])('raw export rejects %s and explicit restore preserves the original', async (_, value) => {
  const name = crypto.randomUUID(), store = await Store.open(name);
  try {
    const backup = await store.backup();
    const corrupt = { revision: 'broken', value };
    await overwriteCurrent(name, corrupt);
    await expect(store.rawBackup()).rejects.toThrow('RAW_RECOVERY_NOT_JSON_SAFE');
    await store.restore(backup, 0);
    expect((await store.recoveryCopies())[0].state).toStrictEqual(corrupt);
    await expect(store.rawBackup()).rejects.toThrow('RAW_RECOVERY_NOT_JSON_SAFE');
  } finally { store.close(); }
});

it('repeated primitive values and JSON-safe unknown fields are not shared-graph false positives', async () => {
  const name = crypto.randomUUID(), store = await Store.open(name);
  try {
    const corrupt = { revision: 'broken', value: [1, 1, null, null, 'same', 'same', { a: 1 }, { a: 1 }] };
    await overwriteCurrent(name, corrupt);
    expect(JSON.parse(await store.rawBackup()).state).toStrictEqual(corrupt);
  } finally { store.close(); }
});

it('raw export and normal restore retain the accepted synchronized history and a valid sealed snapshot', async () => {
  const accepted = JSON.parse(readFileSync('validation/closure-final-synchronized.json', 'utf8'));
  const store = await Store.open(crypto.randomUUID()), state = initialState();
  state.dataset = accepted.normalizedInput; state.lookback = 252; state.model = 'erc';
  state.acknowledgeUserData = true;
  state.holdings.forEach(item => { item.priceDKK = 100; item.priceAsOf = accepted.validationAsOf; });
  const snapshot = await seal(calculate(inputFromState(state, accepted.validationAsOf)));
  try {
    const saved = await store.save(state, 0, snapshot), raw = JSON.parse(await store.rawBackup());
    expect(raw.state).toEqual(saved); expect(raw.snapshots).toEqual([snapshot]);
    await store.restore(await store.backup(), 1);
    expect((await store.load()).snapshots).toEqual([snapshot]);
    expect((await store.load()).state.dataset).toEqual(accepted.normalizedInput);
  } finally { store.close(); }
});

it.each([false, true])('corrupt snapshot records are preserved by recovery (JSON-lossy=%s)', async lossy => {
  const name = crypto.randomUUID(), store = await Store.open(name);
  try {
    const backup = await store.backup(), corrupt = { id: 'CORRUPT_LEGACY_SNAPSHOT', value: lossy ? NaN : { old: [1, null] } };
    await new Promise<void>((resolve, reject) => {
      const opened = indexedDB.open(name);
      opened.onerror = () => reject(opened.error);
      opened.onsuccess = () => {
        const db = opened.result, t = db.transaction('snapshots', 'readwrite');
        t.objectStore('snapshots').put(corrupt);
        t.oncomplete = () => { db.close(); resolve(); };
        t.onabort = () => { db.close(); reject(t.error); };
      };
    });
    await expect(store.load()).rejects.toThrow();
    if (lossy) await expect(store.rawBackup()).rejects.toThrow('RAW_RECOVERY_NOT_JSON_SAFE');
    else expect(JSON.parse(await store.rawBackup()).snapshots).toEqual([corrupt]);
    await store.restore(backup, 0);
    expect((await store.recoveryCopies())[0].snapshots).toStrictEqual([corrupt]);
  } finally { store.close(); }
});

it('an unsafe corrupt revision is recovery metadata, not permission to write unsupported state', async () => {
  const name = crypto.randomUUID(), store = await Store.open(name);
  try {
    const backup = await store.backup(), corrupt = { ...initialState(), revision: 1e20 };
    await overwriteCurrent(name, corrupt);
    await expect(store.load()).rejects.toThrow('CORRUPTED_OR_UNSUPPORTED_STATE');
    const revision = await store.currentRevision();
    await store.restore(backup, revision);
    expect((await store.load()).state.revision).toBe(1);
    expect(revision).toBe(0);
    expect((await store.recoveryCopies())[0].state).toStrictEqual(corrupt);
  } finally { store.close(); }
});

it.each(['save', 'restore'] as const)('an exhausted safe revision rejects %s before it can corrupt committed state', async operation => {
  const name = crypto.randomUUID(), store = await Store.open(name);
  try {
    const backup = await store.backup(), state = { ...initialState(), revision: Number.MAX_SAFE_INTEGER };
    await overwriteCurrent(name, state);
    expect((await store.load()).state).toEqual(state);
    const before = await store.rawBackup();
    const job = operation === 'save' ? store.save(state, state.revision) : store.restore(backup, state.revision);
    await expect(job).rejects.toThrow('STATE_REVISION_EXHAUSTED');
    expect(await store.rawBackup()).toBe(before);
  } finally { store.close(); }
});
