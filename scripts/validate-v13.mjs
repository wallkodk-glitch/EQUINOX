import { spawnSync } from 'node:child_process';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const baseline = process.argv[2] ?? '.';
const startedAt = new Date().toISOString(), checks = [];
function run(name, command, args, env = {}, runtimeProbe = false) {
  console.log('Checking ' + name);
  const started = Date.now(), result = spawnSync(command, args, { encoding: 'utf8', env: { ...process.env, ...env }, maxBuffer: 16 * 1024 * 1024 });
  const output = (result.stdout ?? '') + (result.stderr ?? '');
  const status = result.status === 0 ? 'PASS' : runtimeProbe && result.status === 2 ? 'BLOCKED' : 'FAIL';
  checks.push({ name, command: [command, ...args].join(' '), status, exitCode: result.status,
    durationMs: Date.now() - started, output: output.slice(-30000), environmentError: result.error?.code ?? null });
  console.log(name + ': ' + status);
  return status;
}
async function inspectBuild(base) {
  const manifest = JSON.parse(await readFile('dist/manifest.webmanifest')), html = await readFile('dist/index.html', 'utf8');
  assert.equal(manifest.start_url, base); assert.equal(manifest.scope, base); assert.equal(manifest.id, base);
  assert.equal(manifest.display, 'standalone'); assert.equal(manifest.name, 'EQUINOX');
  for (const icon of manifest.icons) { assert(icon.src.startsWith(base)); await readFile('dist/' + icon.src.slice(base.length)); }
  for (const [, url] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    assert(url.startsWith(base), 'Asset outside build base path'); await readFile('dist/' + url.slice(base.length));
  }
  const sw = await readFile('dist/sw.js', 'utf8');
  assert(sw.includes('BASE=' + JSON.stringify(base))); assert(sw.includes('ACTIVATE_UPDATE'));
  const artifacts = [];
  for (const entry of await readdir('dist', { recursive: true, withFileTypes: true })) if (entry.isFile()) {
    const path = entry.parentPath + '/' + entry.name, bytes = await readFile(path);
    artifacts.push({ path: path.slice(path.indexOf('dist/')), bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  return { base, status: 'PASS', scope: 'Static compiled paths/manifest/asset availability, NOT hosted runtime', artifacts };
}
run('CLEAN_INSTALL', 'npm', ['ci']);
run('LINT', 'npm', ['run', 'lint']);
run('TYPECHECK', 'npm', ['run', 'typecheck']);
run('PYTHON_REFERENCES', 'npm', ['run', 'test:reference']);
run('UNIT_INTEGRATION', 'npm', ['test']);
run('ACCEPTED_SYNCHRONIZED_HISTORY', 'node', ['scripts/check-final-risk.mjs']);
run('PYTHON_RAW_DATA_REFERENCE', 'python3', ['reference/final-risk.py']);
run('IMMUTABLE_SNAPSHOT_REPLAY', 'node', ['scripts/check-ui-snapshots.mjs', baseline, 'validation/final-snapshot-replay.json']);
run('FROZEN_SOURCE', 'node', ['scripts/audit-v13.mjs']);
const builds = [];
for (const base of ['/', '/equinox-path-check/', '/EQUINOX/']) {
  if (run('BUILD_' + base, 'npm', ['run', 'build'], { BASE_PATH: base }) === 'PASS') {
    try { builds.push(await inspectBuild(base)); }
    catch (error) { checks.push({ name: 'BUILD_INSPECTION_' + base, status: 'FAIL', output: String(error) }); }
  }
}
await writeFile('validation/final-builds.json', JSON.stringify({ builds, scope: 'Static compiled paths and assets; hosted and physical device behavior not inferred.' }, null, 2) + '\n');
run('GENERATED_PWA_STATIC', 'node', ['scripts/check-ui-pwa.mjs']);
run('BROWSER_TEST_DISCOVERY', 'npx', ['playwright', 'test', '--list']);
for (const name of ['chromium', 'webkit']) {
  const status = run(name.toUpperCase() + '_RUNTIME', 'node', ['scripts/check-browser-runtime.mjs', name], {}, true);
  if (status === 'PASS') run(name.toUpperCase() + '_MOBILE', 'npm', ['run', 'test:browser', '--', '--project=' + name + '-mobile']);
  else checks.push({ name: name.toUpperCase() + '_MOBILE', status: status === 'BLOCKED' ? 'BLOCKED' : 'NOT TESTED', output: 'NOT TESTED LOCALLY — browser runtime could not launch; full GitHub project remains mandatory.' });
}
run('CREDENTIAL_SCAN', 'node', ['scripts/scan-release-secrets.mjs', 'validation/final-credential-scan.json']);
const failures = checks.filter(check => check.status === 'FAIL'), blocked = checks.filter(check => check.status === 'BLOCKED');
const report = { format: 'EQUINOX_FINAL_VALIDATION_V1', appVersion: JSON.parse(await readFile('package.json')).version,
  startedAt, finishedAt: new Date().toISOString(), status: failures.length ? 'FAIL' : blocked.length ? 'BLOCKED' : 'PASS', node: process.version, checks,
  physicalIPhone: 'NOT TESTED', hostedDeployment: 'NOT TESTED', githubWorkflowExecution: 'NOT TESTED',
  liveProviderAuthAndCORS: 'NOT TESTED — no real credentials requested or used',
  currentTSMBoundary: 'Accepted through 2026-10-08; later refresh must fail closed until separately verified evidence renewal.',
  archive: 'Reopen and verify independently after generation; see release receipt.' };
await writeFile('validation/final-checks.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, checks: checks.map(({ name, status }) => ({ name, status })) }, null, 2));
if (failures.length || blocked.length) process.exitCode = 1;
