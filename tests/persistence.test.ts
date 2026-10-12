import "fake-indexeddb/auto";
import { it, expect, vi } from "vitest";
import { initialState, migrateState } from "../src/persistence/schema";
import { Store } from "../src/persistence/store";
import { calculate, inputFromState } from "../src/snapshots/calculate";
import { seal } from "../src/snapshots/integrity";
it("migration is idempotent and unknown future/corrupt state fails", () => {
  const s = initialState();
  expect(migrateState(s)).toEqual(migrateState(migrateState(s)));
  expect(() => migrateState({ ...s, schemaVersion: 999 })).toThrow();
  expect(() => migrateState("{broken")).toThrow();
  expect(() => migrateState({ ...s, holdings: [] })).toThrow();
});
it("atomic save survives database reopen and checks revision to avoid multi-tab loss", async () => {
  const name = "save-test";
  const a = await Store.open(name);
  const s = initialState();
  const saved = await a.save(s, 0);
  a.close();
  const b = await Store.open(name);
  expect((await b.load()).state).toEqual(saved);
  await expect(b.save({ ...s, capital: 999 }, 0)).rejects.toThrow(
    "STATE_CONFLICT",
  );
  b.close();
});
it("backup restore preserves prior state and rejects corrupt backup before writes", async () => {
  const a = await Store.open("backup-test");
  await a.save({ ...initialState(), capital: 42 }, 0);
  const backup = await a.backup();
  await expect(a.restore("not json", 1)).rejects.toThrow();
  expect((await a.load()).state.capital).toBe(42);
  await a.save({ ...initialState(), capital: 91 }, 1);
  await a.restore(backup, 2);
  expect((await a.load()).state.capital).toBe(42);
  expect((await a.recoveryCopies()).length).toBe(1);
  a.close();
});
it("a backup with more than 200 real saved snapshots can be restored", async () => {
  const a = await Store.open("history-201");
  const s = initialState();
  s.holdings.forEach((h) => {
    h.priceDKK = 100;
    h.priceAsOf = "2026-10-02T06:00:00.000Z";
  });
  for (let i = 0; i < 201; i++) {
    const now = new Date(
      Date.parse("2026-10-02T06:00:00.000Z") + i * 1000,
    ).toISOString();
    const snapshot = await seal(calculate(inputFromState(s, now)));
    await a.save(s, i, snapshot);
  }
  const text = await a.backup();
  await a.restore(text, 201);
  expect((await a.load()).snapshots).toHaveLength(201);
  a.close();
});
it("malformed revision can be recovered without discarding the corrupt original", async () => {
  const name = "corrupt-revision",
    a = await Store.open(name);
  await a.save(initialState(), 0);
  const backup = await a.backup();
  await new Promise<void>((resolve, reject) => {
    const r = indexedDB.open(name);
    r.onsuccess = () => {
      const db = r.result,
        t = db.transaction("state", "readwrite");
      t.objectStore("state").put(
        { ...initialState(), revision: "bad" },
        "current",
      );
      t.oncomplete = () => {
        db.close();
        resolve();
      };
      t.onerror = () => reject(t.error);
    };
    r.onerror = () => reject(r.error);
  });
  await expect(a.load()).rejects.toThrow("CORRUPTED_OR_UNSUPPORTED_STATE");
  const revision = await a.currentRevision();
  await a.restore(backup, revision);
  expect((await a.load()).state.schemaVersion).toBe(1);
  expect((await a.recoveryCopies())[0].state.revision).toBe("bad");
  a.close();
});
it("valid backups are not rejected solely for exceeding the former 50 MB cutoff", async () => {
  const a = await Store.open("large-backup");
  await a.save(initialState(), 0);
  const backup = await a.backup();
  await a.restore(" ".repeat(50_000_001) + backup, 1);
  expect((await a.load()).state.schemaVersion).toBe(1);
  a.close();
});

it('persists only the validated sealed snapshot, excluding unknown outer fields from raw recovery', async () => {
  const db = await Store.open(crypto.randomUUID()), state = initialState();
  const now = '2026-10-02T06:00:00.000Z';
  state.holdings.forEach(h => { h.priceDKK = 100; h.priceAsOf = now; });
  const snapshot = await seal(calculate(inputFromState(state, now)));
  const marker = crypto.randomUUID();
  await db.save(state, 0, { ...snapshot, credentials: marker } as typeof snapshot);
  expect(await db.rawBackup()).not.toContain(marker);
  expect((await db.load()).snapshots).toEqual([snapshot]);
  db.close();
});

it('financial saves and restores request strict durability before reporting completion', async () => {
  const db = await Store.open(crypto.randomUUID());
  const transactions = vi.spyOn(IDBDatabase.prototype, 'transaction');
  try {
    await db.save({ ...initialState(), capital: 91 }, 0);
    const backup = await db.backup();
    await db.restore(backup, 1);
    const writes = transactions.mock.calls.filter(call => call[1] === 'readwrite');
    expect(writes).toHaveLength(2);
    expect(writes.every(call => call[2]?.durability === 'strict')).toBe(true);
  } finally { transactions.mockRestore(); db.close(); }
});

it('an aborted read rejects once without leaving an unhandled transaction rejection', async () => {
  const db = await Store.open(crypto.randomUUID());
  await db.save(initialState(), 0);
  const original = IDBObjectStore.prototype.get;
  const reads = vi.spyOn(IDBObjectStore.prototype, 'get').mockImplementation(function(this: IDBObjectStore, ...args) {
    const request = original.apply(this, args);
    this.transaction.abort();
    return request;
  });
  try { await expect(db.currentRevision()).rejects.toThrow(); }
  finally { reads.mockRestore(); db.close(); }
});

it('duplicate snapshot restore fails before mutation and a failed transaction cannot partially save state', async () => {
  const db = await Store.open(crypto.randomUUID()), state = initialState();
  const now = '2026-10-02T06:00:00.000Z';
  state.holdings.forEach(h => { h.priceDKK = 100; h.priceAsOf = now; });
  const snapshot = await seal(calculate(inputFromState(state, now)));
  await db.save(state, 0, snapshot);
  const before = await db.rawBackup(), backup = JSON.parse(await db.backup());
  backup.snapshots.push(backup.snapshots[0]);
  await expect(db.restore(JSON.stringify(backup), 1)).rejects.toThrow('DUPLICATE_SNAPSHOT');
  expect(await db.rawBackup()).toBe(before);
  const original = IDBObjectStore.prototype.put;
  const puts = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function(this: IDBObjectStore, ...args) {
    const result = original.apply(this, args);
    if (this.name === 'snapshots') this.transaction.abort();
    return result;
  });
  try {
    await expect(db.save({ ...state, capital: 123 }, 1, snapshot)).rejects.toThrow();
    expect(await db.rawBackup()).toBe(before);
  } finally { puts.mockRestore(); db.close(); }
});

it.each(['save', 'restore'] as const)('synchronous snapshot-write failure rolls back the entire %s transaction', async operation => {
  const db = await Store.open(crypto.randomUUID()), state = initialState();
  const now = '2026-10-02T06:00:00.000Z';
  state.holdings.forEach(h => { h.priceDKK = 100; h.priceAsOf = now; });
  const snapshot = await seal(calculate(inputFromState(state, now)));
  await db.save(state, 0, snapshot);
  const backup = await db.backup();
  await db.save({ ...state, capital: 91 }, 1);
  const before = await db.rawBackup();
  const method = operation === 'save' ? 'put' : 'add';
  const original = IDBObjectStore.prototype[method];
  const writes = vi.spyOn(IDBObjectStore.prototype, method).mockImplementation(function(this: IDBObjectStore, ...args) {
    if (this.name === 'snapshots') throw new DOMException('Synthetic write failure', 'QuotaExceededError');
    return original.apply(this, args);
  });
  try {
    const job = operation === 'save' ? db.save({ ...state, capital: 123 }, 2, snapshot) : db.restore(backup, 2);
    await expect(job).rejects.toThrow('Synthetic write failure');
    expect(await db.rawBackup()).toBe(before);
  } finally { writes.mockRestore(); db.close(); }
});
