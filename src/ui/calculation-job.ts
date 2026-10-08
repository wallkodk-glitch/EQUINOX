import type { AppState } from "../persistence/schema";
import {
  calculate,
  inputFromState,
  type CalculationInput,
} from "../snapshots/calculate";
import { seal, type SealedSnapshot } from "../snapshots/integrity";
type SnapshotFactory = (input: CalculationInput) => Promise<SealedSnapshot>;
// Mode and calculation input belong to the job. The draft being persisted
// belongs to the editor and may have changed while hashing was in flight.
export async function finishCalculation(
  source: AppState,
  isDemo: boolean,
  timestamp: string,
  latest: () => AppState,
  persist: (state: AppState, snapshot: SealedSnapshot) => Promise<unknown>,
  create: SnapshotFactory = (input) => seal(calculate(input)),
) {
  const snapshot = await create(inputFromState(source, timestamp));
  if (!isDemo) await persist(latest(), snapshot);
  return snapshot;
}
