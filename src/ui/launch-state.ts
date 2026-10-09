export type LaunchPhase = 'brand' | 'initializing' | 'handoff' | 'complete';
export function launchPhase(elapsed: number, ready: boolean, reduced: boolean): LaunchPhase {
  const duration = reduced ? 120 : 1440;
  if (elapsed < duration) return 'brand';
  if (!ready) return 'initializing';
  return elapsed < duration + 160 ? 'handoff' : 'complete';
}
