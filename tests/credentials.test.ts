import { it, expect } from 'vitest';
import 'fake-indexeddb/auto';
import { CredentialStore } from '../src/market-data/live/credentials';
import { Store } from '../src/persistence/store';
import { initialState } from '../src/persistence/schema';
import { calculate, inputFromState } from '../src/snapshots/calculate';
class MemoryStorage {
  values = new Map<string,string>();
  getItem(k:string){return this.values.get(k) ?? null;}
  setItem(k:string,v:string){this.values.set(k,v);}
  removeItem(k:string){this.values.delete(k);}
}
it('missing, save, replace, remove credentials persist in their isolated domain', () => {
  const storage = new MemoryStorage(), s = new CredentialStore(storage);
  expect(s.has('massive')).toBe(false);
  const first = crypto.randomUUID(), second = crypto.randomUUID();
  s.save('massive', first);
  expect(new CredentialStore(storage).read('massive')).toBe(first);
  s.save('massive', second);
  expect(s.read('massive')).toBe(second);
  expect(s.has('coingecko')).toBe(false);
  s.remove('massive');
  expect(s.has('massive')).toBe(false);
});
it('rejects empty/header injection keys without reflecting values', () => {
  const s = new CredentialStore(new MemoryStorage());
  for (const v of ['', ' ', 'abc\r\ndef', 'a b']) {
    expect(() => s.save('massive',v)).toThrow('INVALID_CREDENTIAL');
  }
});
it('financial backup, recovery and snapshot exclude credentials; restore cannot replace them', async () => {
  const s = new CredentialStore(new MemoryStorage()), key = crypto.randomUUID();
  s.save('massive',key);
  const db = await Store.open(crypto.randomUUID()), state = initialState();
  state.holdings.forEach(h=>{h.priceDKK=100;h.priceAsOf='2026-10-02T12:00:00.000Z';});
  await db.save(state,0);
  const backup = await db.backup();
  expect(backup).not.toContain(key);
  expect(await db.rawBackup()).not.toContain(key);
  expect(JSON.stringify(calculate(inputFromState(state,'2026-10-02T12:00:00.000Z')))).not.toContain(key);
  const poisoned = {...JSON.parse(backup), credentials:{massive:crypto.randomUUID()}};
  await db.restore(JSON.stringify(poisoned),1);
  expect(s.read('massive')).toBe(key);
  db.close();
});
