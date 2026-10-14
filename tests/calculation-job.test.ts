import { it, expect } from "vitest";
import { finishCalculation } from "../src/ui/calculation-job";
import { initialState, type AppState } from "../src/persistence/schema";
import { calculate, inputFromState } from "../src/snapshots/calculate";
import { seal, validateSeal, type SealedSnapshot } from "../src/snapshots/integrity";
const now = "2026-10-02T06:00:00.000Z";
function source() {
  const s = initialState();
  s.holdings.forEach((h) => {
    h.priceDKK = 100;
    h.priceAsOf = now;
  });
  return s;
}
it('a delayed real factory seals the captured input and hands newer editor state to persistence', async () => {
  const original = source(); original.capital = 1234;
  let latest = original, release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let saved: AppState | undefined, savedSnapshot: SealedSnapshot | undefined;
  const job = finishCalculation(original, false, now, () => latest, async (state, snapshot) => {
    saved = state; savedSnapshot = snapshot;
  }, async input => { await held; return seal(calculate(input)); });
  latest = structuredClone(original); latest.capital = 4567; latest.holdings[0].units = 9;
  release();
  const result = await job;
  expect(result.snapshot.input).toEqual(inputFromState(original, now));
  expect(saved).toEqual(latest);
  expect(savedSnapshot).toBe(result);
  expect(await validateSeal(result)).toEqual(result);
});
it("a delayed real calculation persists the latest draft, never rolls back later edits", async () => {
  const original = source();
  let latest = original;
  const result = await seal(calculate(inputFromState(original, now)));
  let release!: (s: SealedSnapshot) => void;
  const delayed = new Promise<SealedSnapshot>((r) => (release = r));
  let saved: AppState | undefined;
  const job = finishCalculation(
    original,
    false,
    now,
    () => latest,
    async (s) => {
      saved = s;
    },
    () => delayed,
  );
  latest = { ...original, capital: 999 };
  release(result);
  await job;
  expect(saved?.capital).toBe(999);
});
it("a calculation started in demo never writes real state when mode changes while hashing", async () => {
  const demo = source();
  const result = await seal(calculate(inputFromState(demo, now)));
  let release!: (s: SealedSnapshot) => void;
  const delayed = new Promise<SealedSnapshot>((r) => (release = r));
  let writes = 0;
  const job = finishCalculation(
    demo,
    true,
    now,
    () => initialState(),
    async () => {
      writes++;
    },
    () => delayed,
  );
  release(result);
  await job;
  expect(writes).toBe(0);
});
