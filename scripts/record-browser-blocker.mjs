// Convert actual failed launch evidence into explicit NOT TESTED statuses.
// This does not retry, move an executable or change browser security/permissions.
import { readFile, writeFile } from 'node:fs/promises';
const checks = JSON.parse(await readFile('validation/release-checks.json', 'utf8'));
const browser = checks.steps.find(s => s.command.includes('test:browser'));
if (!browser || browser.exitCode === 0 || !browser.output.includes('EACCES')) {
  throw new Error('NO_MATCHING_BROWSER_PERMISSION_BLOCKER');
}
const launchFailures = (browser.output.match(/Error: browserType\.launch: Failed to launch: Error: spawn[^\n]+EACCES/g) || []).length;
if (launchFailures !== 15 || !browser.output.includes('15 failed')) throw new Error('UNEXPECTED_BROWSER_FAILURE_SCOPE');
const evidence = {
  recordedAt: new Date().toISOString(),
  status: 'NOT TESTED',
  reason: 'BROWSER_EXECUTABLE_PERMISSION_DENIED',
  browserCommandStartedAt: browser.startedAt,
  browserCommandFinishedAt: browser.finishedAt,
  browserCommandExitCode: browser.exitCode,
  launchFailures,
  browserApplicationTestsExecuted: 0,
  probeRequestsExecuted: 0,
  browserIntegration: 'NOT TESTED — launch blocked',
  providerCORS: 'NOT TESTED — launch blocked',
  validCredentials: 'NOT PROVIDED / NOT TESTED',
  safariWebKit: 'NOT TESTED',
  physicalIPhone: 'NOT TESTED',
  results: [],
  evidence: ['validation/release-checks.json'],
  security: 'No permission, TLS or CORS bypass; failed launch is not provider rejection.'
};
await writeFile('validation/cors-probe.json', JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
