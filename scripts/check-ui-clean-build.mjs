import { spawn } from 'node:child_process';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const directory = resolve(process.argv[2] ?? '');
assert.notEqual(directory, process.cwd(), 'Independent build must use a separate source copy');
assert.equal((await readFile('package-lock.json')).equals(await readFile(resolve(directory, 'package-lock.json'))), true);
const report = { format: 'EQUINOX_UI_CLEAN_BUILD_V1', startedAt: new Date().toISOString(), node: process.version,
  scope: 'Separately npm-ci-installed copy without baseline dist; checksum comparison follows in reproducibility.json.',
  commands: [], status: 'RUNNING' };
await rm(resolve(directory, 'dist'), { recursive: true, force: true });
for (const args of [['ci', '--ignore-scripts'], ['run', 'build']]) {
  const startedAt = new Date().toISOString(); let output = '';
  const exitCode = await new Promise(resolveCode => {
    const child = spawn('npm', args, { cwd: directory, env: process.env });
    const collect = data => { const chunk = data.toString(); output += chunk; process.stdout.write(chunk); };
    child.stdout.on('data', collect); child.stderr.on('data', collect);
    child.on('error', error => { output += 'COMMAND_START_FAILED: ' + error.code; resolveCode(1); });
    child.on('close', code => resolveCode(code ?? 1));
  });
  report.commands.push({ command: ['npm', ...args], startedAt, finishedAt: new Date().toISOString(), exitCode, output });
  if (exitCode !== 0) { report.status = 'FAIL'; process.exitCode = exitCode; break; }
}
if (report.status !== 'FAIL') report.status = 'PASS';
report.finishedAt = new Date().toISOString();
await writeFile('validation/ui-clean-build.json', JSON.stringify(report, null, 2));
