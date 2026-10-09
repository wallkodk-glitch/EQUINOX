import { spawnSync } from 'node:child_process';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const baseline = process.argv[2];
if (!baseline) throw new Error('PASS_VERIFIED_GITHUB_BASELINE_DIRECTORY');
const startedAt = new Date().toISOString(), checks = [];
function run(name, command, args, env = {}) {
  console.log('Checking ' + name);
  const started = Date.now(), result = spawnSync(command, args, { encoding: 'utf8', env: { ...process.env, ...env }, timeout: 180000 });
  const output = (result.stdout ?? '') + (result.stderr ?? '');
  const unavailable = name.includes('BROWSER') && /Executable doesn't exist|spawn .* EACCES|spawn .* EPERM/.test(output);
  const status = result.status === 0 ? 'PASS' : unavailable ? 'NOT TESTED' : 'FAIL';
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
run('INSTALL', 'npm', ['ci']);
run('LINT', 'npm', ['run', 'lint']);
run('TYPECHECK', 'npm', ['run', 'typecheck']);
run('PYTHON_REFERENCE', 'npm', ['run', 'test:reference']);
// The original 5 s test deadline also cuts off the unchanged v1.3.0 cache test
// in this runtime. Bound local work explicitly without dropping assertions or
// altering application/provider timeouts. The default-command failures remain
// in v1.3-tsm-renewal-checks.json; actual GitHub workflow execution is pending.
run('UNIT_INTEGRATION', 'npm', ['test', '--', '--maxWorkers=1', '--testTimeout=30000']);
run('ACCEPTED_PROVIDER_REPLAY', 'node', ['scripts/check-final-risk.mjs']);
run('PYTHON_RAW_DATA_REFERENCE', 'python3', ['reference/final-risk.py']);
run('SNAPSHOT_NODE_REPLAY', 'node', ['scripts/check-ui-snapshots.mjs', baseline, 'validation/v1.3-snapshot-replay.json']);
run('FROZEN_SOURCE', 'node', ['scripts/audit-v13.mjs', baseline]);
const builds = [];
for (const base of ['/EQUINOX/', '/', '/equinox-v13-path-check/']) {
  if (run('BUILD_' + base, 'npm', ['run', 'build'], { BASE_PATH: base }) === 'PASS') builds.push(await inspectBuild(base));
}
// Restore the default production path expected by the two browser projects.
run('PRODUCTION_BUILD', 'npm', ['run', 'build'], { BASE_PATH: '/EQUINOX/' });
await writeFile('validation/v1.3-builds.json', JSON.stringify({ checkedAt: new Date().toISOString(), builds,
  defaultBuild: await inspectBuild('/EQUINOX/'), runtimePerformance: 'NOT TESTED', note: 'Vite single-chunk warning is retained, not hidden by changing the warning threshold.' }, null, 2));
run('CHROMIUM_BROWSER', 'npm', ['run', 'test:browser', '--', '--project=chromium-mobile', '--max-failures=1']);
run('WEBKIT_BROWSER', 'npm', ['run', 'test:browser', '--', '--project=webkit-mobile', '--max-failures=1']);
run('CREDENTIAL_SCAN', 'node', ['scripts/scan-release-secrets.mjs', 'validation/v1.3-credential-scan.json']);
const failures = checks.filter(check => check.status === 'FAIL'), pending = checks.filter(check => check.status === 'NOT TESTED');
const report = { format: 'EQUINOX_V13_VALIDATION_V1', startedAt, finishedAt: new Date().toISOString(),
  status: failures.length ? 'FAIL' : pending.length ? 'PASS WITH LIMITATIONS' : 'LOCAL GATES PASS',
  node: process.version, checks, hostedDeployment: 'PENDING', physicalIPhone: 'PENDING',
  localTestBudget: {workers: 1, testTimeoutMs: 30000, changesApplicationTimeouts: false,
    default5000msProbe: 'FAIL also on unchanged delivered v1.3.0; diagnostic history retained in validation/v1.3-tsm-renewal-checks.json'},
  liveProviderAuthAndCORS: 'NOT TESTED — no real provider key supplied, no browser request executed',
  liveSynchronizedRefresh: 'TSM evidence permits 2025-01-01–2026-10-08 only; later/wider windows FAIL CLOSED. Actual authenticated refresh NOT TESTED.',
  browserInstallation: 'Normal install --with-deps attempted; OS package permissions denied. No permission/security bypass.',
  packageStatus: 'Verify archive/manifest separately after reports are finalized' };
await writeFile('validation/v1.3-checks.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ status: report.status, checks: checks.map(({ name, status }) => ({ name, status })) }, null, 2));
if (failures.length) process.exitCode = 1;
