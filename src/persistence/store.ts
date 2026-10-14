import { requireThat } from "../domain/core";
import { initialState, migrateState, type AppState } from "./schema";
import { validateSeal, type SealedSnapshot } from "../snapshots/integrity";
const req = <T>(r: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error("STORAGE_READ_FAILED"));
  });
const completed = (t: IDBTransaction) => {
  const done = new Promise<void>((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onabort = () =>
      reject(t.error ?? new Error("STORAGE_TRANSACTION_ABORTED"));
    t.onerror = () => reject(t.error ?? new Error("STORAGE_WRITE_FAILED"));
  });
  // A request may reject before control reaches `await done`. Observe the
  // transaction rejection immediately; callers still receive the original
  // rejection when awaiting it, and no failed operation is reported as saved.
  void done.catch(() => {});
  return done;
};
const revisionOf = (raw: unknown) =>
  raw &&
  typeof raw === "object" &&
  "revision" in raw &&
  typeof raw.revision === "number" &&
  Number.isSafeInteger(raw.revision) &&
  raw.revision >= 0
    ? raw.revision
    : 0;
const nextRevision = (revision: number) => {
  const next = revision + 1;
  requireThat(Number.isSafeInteger(next), "STATE_REVISION_EXHAUSTED");
  return next;
};

// IndexedDB can retain values that JSON silently changes or drops. Raw export
// must not turn corrupt forensic material into a misleading recovery file.
// This check never rewrites the stored records or their recovery copies.
function requireRecoveryJSON(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value) && !Object.is(value, -0)) return;
  if (typeof value !== 'object' || seen.has(value)) throw new Error('RAW_RECOVERY_NOT_JSON_SAFE');
  if (Array.isArray(value)) {
    const keys = Object.keys(value);
    if (keys.length !== value.length || keys.some((key, index) => key !== String(index)))
      throw new Error('RAW_RECOVERY_NOT_JSON_SAFE');
  } else if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    throw new Error('RAW_RECOVERY_NOT_JSON_SAFE');
  }
  seen.add(value);
  for (const child of Object.values(value)) requireRecoveryJSON(child, seen);
}
export class Store {
  private constructor(private db: IDBDatabase) {}
  static async open(name = "EQUINOX_V1"): Promise<Store> {
    const r = indexedDB.open(name, 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore("state");
      r.result.createObjectStore("snapshots", { keyPath: "id" });
      r.result.createObjectStore("recovery", { autoIncrement: true });
    };
    const db = await req(r);
    db.onversionchange = () => db.close();
    return new Store(db);
  }
  close() {
    this.db.close();
  }
  async currentRevision() {
    const t = this.db.transaction("state"),
      done = completed(t);
    const raw = await req(t.objectStore("state").get("current"));
    await done;
    return revisionOf(raw);
  }
  async load() {
    const t = this.db.transaction(["state", "snapshots"], "readonly"),
      done = completed(t);
    // get() returns undefined for BOTH absence and a stored undefined value.
    // Keep record presence so corrupt data can never become a fresh state.
    const [records, snapshots] = await Promise.all([
      req(t.objectStore("state").getAll("current")),
      req(t.objectStore("snapshots").getAll()),
    ]);
    await done;
    const validated: SealedSnapshot[] = [];
    for (const snapshot of snapshots)
      validated.push(await validateSeal(snapshot));
    return {
      state: records.length === 0 ? initialState() : migrateState(records[0]),
      snapshots: validated,
    };
  }
  async save(
    input: AppState,
    expectedRevision: number,
    snapshot?: SealedSnapshot,
  ) {
    const parsed = migrateState(input);
    const validatedSnapshot = snapshot ? await validateSeal(snapshot) : undefined;
    const t = this.db.transaction(["state", "snapshots"], "readwrite", { durability: "strict" }),
      done = completed(t);
    try {
      const store = t.objectStore("state"), records = await req(store.getAll("current"));
      const old = records.length === 0 ? initialState() : migrateState(records[0]);
      if (old.revision !== expectedRevision)
        throw new Error("STATE_CONFLICT: another tab saved newer data; reload before editing");
      const state = { ...parsed, revision: nextRevision(old.revision) };
      store.put(state, "current");
      if (validatedSnapshot) t.objectStore("snapshots").put(validatedSnapshot);
      await done;
      return state;
    } catch (error) {
      // Synchronous request-construction failures do NOT automatically abort IDB.
      // Explicit rollback prevents an earlier put from committing on its own.
      try { t.abort(); } catch { /* Transaction already completed/aborted. */ }
      await done.catch(() => {});
      throw error;
    }
  }
  async backup() {
    const data = await this.load();
    return JSON.stringify(
      {
        format: "EQUINOX_BACKUP_V1",
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        ...data,
      },
      null,
      2,
    );
  }
  async rawBackup() {
    const t = this.db.transaction(
        ["state", "snapshots", "recovery"],
        "readonly",
      ),
      done = completed(t);
    const [records, snapshots, recovery] = await Promise.all([
      req(t.objectStore("state").getAll("current")),
      req(t.objectStore("snapshots").getAll()),
      req(t.objectStore("recovery").getAll()),
    ]);
    await done;
    const raw = { format: "EQUINOX_RAW_RECOVERY", ...(records.length === 0 ? {} : { state: records[0] }), snapshots, recovery };
    try {
      requireRecoveryJSON(raw);
      return JSON.stringify(raw, null, 2);
    } catch {
      // Do not echo potentially sensitive corrupt values in the error.
      throw new Error('RAW_RECOVERY_NOT_JSON_SAFE');
    }
  }
  async recoveryCopies() {
    const t = this.db.transaction("recovery"),
      done = completed(t);
    const result = await req(t.objectStore("recovery").getAll());
    await done;
    return result;
  }
  async restore(text: string, expectedRevision: number) {
    const data: unknown = JSON.parse(text);
    requireThat(
      data &&
        typeof data === "object" &&
        "format" in data &&
        data.format === "EQUINOX_BACKUP_V1" &&
        "schemaVersion" in data &&
        data.schemaVersion === 1 &&
        "state" in data &&
        "snapshots" in data &&
        Array.isArray(data.snapshots),
      "INVALID_BACKUP",
    );
    const state = migrateState(data.state),
      snapshots: SealedSnapshot[] = [];
    for (const snapshot of data.snapshots)
      snapshots.push(await validateSeal(snapshot));
    requireThat(
      new Set(snapshots.map((x) => x.id)).size === snapshots.length,
      "DUPLICATE_SNAPSHOT",
    );
    const t = this.db.transaction(
        ["state", "snapshots", "recovery"],
        "readwrite",
        { durability: "strict" },
      ),
      done = completed(t);
    try {
      const records = await req(t.objectStore("state").getAll("current")), raw = records[0];
      const revision = revisionOf(raw);
      if (revision !== expectedRevision) throw new Error("STATE_CONFLICT");
      const restored = { ...state, revision: nextRevision(expectedRevision) };
      const oldSnapshots = await req(t.objectStore("snapshots").getAll());
      t.objectStore("recovery").add({
        savedAt: new Date().toISOString(), ...(records.length === 0 ? {} : { state: raw }), snapshots: oldSnapshots,
      });
      t.objectStore("state").put(restored, "current");
      const ss = t.objectStore("snapshots");
      ss.clear();
      snapshots.forEach((s) => ss.add(s));
      await done;
      return restored;
    } catch (error) {
      try { t.abort(); } catch { /* Transaction already completed/aborted. */ }
      await done.catch(() => {});
      throw error;
    }
  }
}
