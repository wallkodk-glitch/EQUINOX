import { requireThat } from "../domain/core";
import { initialState, migrateState, type AppState } from "./schema";
import { validateSeal, type SealedSnapshot } from "../snapshots/integrity";
const req = <T>(r: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error("STORAGE_READ_FAILED"));
  });
const completed = (t: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onabort = () =>
      reject(t.error ?? new Error("STORAGE_TRANSACTION_ABORTED"));
    t.onerror = () => reject(t.error ?? new Error("STORAGE_WRITE_FAILED"));
  });
const revisionOf = (raw: unknown) =>
  raw &&
  typeof raw === "object" &&
  "revision" in raw &&
  typeof raw.revision === "number" &&
  Number.isInteger(raw.revision) &&
  raw.revision >= 0
    ? raw.revision
    : 0;
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
    const [raw, snapshots] = await Promise.all([
      req(t.objectStore("state").get("current")),
      req(t.objectStore("snapshots").getAll()),
    ]);
    await done;
    const validated: SealedSnapshot[] = [];
    for (const snapshot of snapshots)
      validated.push(await validateSeal(snapshot));
    return {
      state: raw === undefined ? initialState() : migrateState(raw),
      snapshots: validated,
    };
  }
  async save(
    input: AppState,
    expectedRevision: number,
    snapshot?: SealedSnapshot,
  ) {
    const parsed = migrateState(input);
    if (snapshot) await validateSeal(snapshot);
    const t = this.db.transaction(["state", "snapshots"], "readwrite"),
      done = completed(t);
    done.catch(() => {});
    const store = t.objectStore("state"),
      raw = await req(store.get("current"));
    let old: AppState;
    try {
      old = raw === undefined ? initialState() : migrateState(raw);
    } catch (e) {
      t.abort();
      await done.catch(() => {});
      throw e;
    }
    if (old.revision !== expectedRevision) {
      t.abort();
      await done.catch(() => {});
      throw new Error(
        "STATE_CONFLICT: another tab saved newer data; reload before editing",
      );
    }
    const state = { ...parsed, revision: old.revision + 1 };
    store.put(state, "current");
    if (snapshot) t.objectStore("snapshots").put(snapshot);
    await done;
    return state;
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
    const [state, snapshots, recovery] = await Promise.all([
      req(t.objectStore("state").get("current")),
      req(t.objectStore("snapshots").getAll()),
      req(t.objectStore("recovery").getAll()),
    ]);
    await done;
    return JSON.stringify(
      { format: "EQUINOX_RAW_RECOVERY", state, snapshots, recovery },
      null,
      2,
    );
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
      ),
      done = completed(t);
    done.catch(() => {});
    const raw = await req(t.objectStore("state").get("current"));
    const revision = revisionOf(raw);
    if (revision !== expectedRevision) {
      t.abort();
      await done.catch(() => {});
      throw new Error("STATE_CONFLICT");
    }
    const oldSnapshots = await req(t.objectStore("snapshots").getAll());
    t.objectStore("recovery").add({
      savedAt: new Date().toISOString(),
      state: raw,
      snapshots: oldSnapshots,
    });
    const restored = { ...state, revision: expectedRevision + 1 };
    t.objectStore("state").put(restored, "current");
    const ss = t.objectStore("snapshots");
    ss.clear();
    snapshots.forEach((s) => ss.add(s));
    await done;
    return restored;
  }
}
