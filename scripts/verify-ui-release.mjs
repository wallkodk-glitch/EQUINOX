import { spawn } from 'node:child_process';
import { writeFile, rm } from 'node:fs/promises';
const baseline = process.argv[2];
if (!baseline) throw new Error('PASS_SUPPLIED_V1_1_2_BASELINE_DIRECTORY');
const commands = [
  ['npm', ['run', 'lint']],
  ['npm', ['run', 'typecheck']],
  ['npm', ['test']],
  ['npm', ['run', 'test:reference']],
  ['node', ['scripts/check-final-risk.mjs']],
  ['python3', ['reference/final-risk.py']],
  ['node', ['scripts/check-ui-snapshots.mjs', baseline]],
  ['npm', ['run', 'build']],
  ['node', ['scripts/check-ui-pwa.mjs']],
  ['node', ['scripts/check-ui-accessibility.mjs']],
  ['node', ['scripts/audit-ui-release.mjs', baseline]],
  ['node', ['scripts/scan-release-secrets.mjs']],
];
const report = { format: 'EQUINOX_UI_RELEASE_CHECKS_V1', startedAt: new Date().toISOString(), node: process.version,
  platform: process.platform, status: 'RUNNING', browserRuntime: 'NOT TESTED', steps: [],
  scope: 'Local checks and replay of already accepted acquired data; no fresh authenticated HTTP or browser result is inferred.',
};
for (const [command, args] of commands) {
  // The supplied ZIP includes historical dist files. Release evidence must be
  // produced from an empty generated directory, never mixed with that baseline.
  if (command === 'npm' && args.join(' ') === 'run build') await rm('dist', { recursive: true, force: true });
  const startedAt = new Date().toISOString();
  let output = '';
  const exitCode = await new Promise(resolve => {
    const child = spawn(command, args, { env: process.env });
    const collect = data => { const chunk = data.toString(); output += chunk; process.stdout.write(chunk); };
    child.stdout.on('data', collect); child.stderr.on('data', collect);
    child.on('error', error => { output += 'COMMAND_START_FAILED: ' + error.code; resolve(1); });
    child.on('close', code => resolve(code ?? 1));
  });
  report.steps.push({ command: [command, ...args], startedAt, finishedAt: new Date().toISOString(), exitCode, output });
  if (exitCode !== 0) report.status = 'FAIL';
  await writeFile('validation/ui-release-checks.json', JSON.stringify(report, null, 2));
  if (exitCode !== 0) { process.exitCode = exitCode; break; }
}
if (report.status !== 'FAIL') {
  report.status = 'PASS'; report.finishedAt = new Date().toISOString();
  await writeFile('validation/ui-release-checks.json', JSON.stringify(report, null, 2));
}
