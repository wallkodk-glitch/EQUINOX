// One standard smoke launch; never changes permissions or browser security.
// Full browser acceptance still requires `npm run test:browser` on a working runner.
import { spawn } from 'node:child_process';
import { stat, writeFile } from 'node:fs/promises';
const executable = process.argv[2];
if (!executable) throw new Error('PASS_EXISTING_CHROMIUM_EXECUTABLE');
const info = await stat(executable);
const startedAt = new Date().toISOString();
const args = ['run', 'test:browser', '--', 'tests/browser/ui.spec.ts', '--project=chromium-mobile', '-g', 'primary navigation', '--retries=0'];
let output = '';
const exitCode = await new Promise(resolve => {
  const child = spawn('npm', args, { env: { ...process.env, EQUINOX_CHROMIUM_EXECUTABLE: executable } });
  const collect = data => { const chunk = data.toString(); output += chunk; process.stdout.write(chunk); };
  child.stdout.on('data', collect); child.stderr.on('data', collect);
  child.on('error', error => { output += 'COMMAND_START_FAILED: ' + error.code; resolve(1); });
  child.on('close', code => resolve(code ?? 1));
});
const launchDenied = exitCode !== 0 && /browserType\.launch: Failed to launch: Error: spawn[^\n]+EACCES/.test(output);
const report = { format: 'EQUINOX_UI_BROWSER_EVIDENCE_V1', startedAt, finishedAt: new Date().toISOString(),
  command: ['npm', ...args], exitCode, output, executableMode: (info.mode & 0o777).toString(8),
  browserRuntime: launchDenied ? 'NOT TESTED' : exitCode === 0 ? 'ONE_SMOKE_EXECUTED; FULL_SUITE_PENDING' : 'FAILURE_REQUIRES_INVESTIGATION',
  reason: launchDenied ? 'BROWSER_EXECUTABLE_PERMISSION_DENIED' : null,
  applicationTestsExecuted: launchDenied ? 0 : null, providerRequestsExecuted: launchDenied ? 0 : null,
  browserCORS: 'NOT TESTED', safariWebKit: 'NOT TESTED', physicalIPhone: 'NOT TESTED',
  installedPWA: 'NOT TESTED', hostedDeployment: 'NOT TESTED',
  security: 'No chmod, executable relocation, alternate runtime, proxy, CORS/TLS disable or permission bypass.',
};
await writeFile('validation/ui-browser-evidence.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ browserRuntime: report.browserRuntime, reason: report.reason, applicationTestsExecuted: report.applicationTestsExecuted }));
if (!launchDenied && exitCode !== 0) process.exitCode = 1;
