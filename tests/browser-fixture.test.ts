import { mkdir, writeFile } from "node:fs/promises";
import { it, expect } from "vitest";
import { initialState } from "../src/persistence/schema";
import { calculate, inputFromState } from "../src/snapshots/calculate";
import { seal, validateSeal } from "../src/snapshots/integrity";
import { demoDataset } from "../src/market-data/demo";

it("exports a Node-generated snapshot for cross-runtime browser regeneration", async () => {
  const timestamp = "2026-10-02T06:00:00.000Z",
    state = initialState();
  state.model = "erc";
  state.dataset = demoDataset(timestamp);
  state.holdings.forEach((h) => {
    h.priceDKK = 100;
    h.units = 1;
    h.priceAsOf = timestamp;
  });
  const snapshot = await seal(calculate(inputFromState(state, timestamp)));
  expect(await validateSeal(snapshot)).toEqual(snapshot);
  await mkdir("validation", { recursive: true });
  await writeFile("validation/node-snapshot.json", JSON.stringify(snapshot));
});
