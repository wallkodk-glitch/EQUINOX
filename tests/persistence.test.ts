import "fake-indexeddb/auto";
import { it, expect } from "vitest";
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
