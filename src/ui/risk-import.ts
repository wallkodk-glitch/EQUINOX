import type { AppState } from '../persistence/schema';
import { retrospectiveDatasetSchema, prepareRisk, type RetrospectiveDataset } from '../market-data/provider';
import { MarketError } from '../market-data/live/network';
import { canonical } from '../snapshots/calculate';

// UI commit boundary only; acquisition/normalization remains the existing pipeline.
// App serializes this with financial writes and locks editing during the commit.
// Return only after persistence; the caller never publishes partial/failed input.
export async function finishRiskImport(
  dataset: RetrospectiveDataset, source: AppState, latest: () => AppState,
  signal: AbortSignal, persist: (next: AppState) => Promise<AppState>, now: string,
): Promise<AppState> {
  const current = latest();
  if (signal.aborted || current.lookback !== source.lookback || canonical(current.dataset) !== canonical(source.dataset))
    throw new MarketError('ABORTED');
  let validated: RetrospectiveDataset;
  try {
    validated = retrospectiveDatasetSchema.parse(dataset);
    if (validated.provider !== 'MASSIVE_NATIONALBANK_SYNCHRONIZED_RETROSPECTIVE_V1' || !validated.provenance)
      throw new MarketError('RISK_INTEGRATION_BLOCKED');
    const gate = prepareRisk(validated, now, source.lookback);
    if (gate.coverage !== 1 || gate.missingDates.length || gate.returns.length !== source.lookback)
      throw new MarketError('RISK_INTEGRATION_BLOCKED');
  } catch { throw new MarketError('RISK_INTEGRATION_BLOCKED'); }
  if (signal.aborted) throw new MarketError('ABORTED');
  // Holdings, manual prices, acknowledgment, policy and saved calculations stay
  // in their original domains. Never set consent or current prices for the user.
  return persist({ ...current, dataset: validated });
}
