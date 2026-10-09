import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const baseline = process.argv[2];
if (!baseline) throw new Error('PASS_VERIFIED_GITHUB_BASELINE_DIRECTORY');
const operational = ['src/market-data/live/cache.ts', 'src/market-data/live/synchronized.ts'];
const renewedEvidencePath = 'src/market-data/live/tsm-adr.ts';
let evidenceRenewal;
const frozen = /^(src\/(domain|risk|optimization|execution|portfolio|snapshots|persistence)\/|src\/market-data\/)/;
async function walk(root, prefix = '') {
  const files = [];
  for (const entry of await readdir(resolve(root, prefix), { withFileTypes: true })) {
    const path = prefix + entry.name;
    if (['.git', 'node_modules', 'dist', 'test-results', 'playwright-report', '__pycache__'].includes(entry.name)) continue;
    if (entry.isDirectory()) files.push(...await walk(root, path + '/'));
    else if (entry.isFile()) files.push(path);
    else throw new Error('UNEXPECTED_SOURCE_FILE_TYPE');
  }
  return files.sort();
}
const before = await walk(baseline), after = await walk('.'), changes = [], frozenFiles = [];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
for (const path of before) {
  assert(after.includes(path), 'Baseline file unexpectedly removed: ' + path);
  const a = await readFile(resolve(baseline, path)), b = await readFile(path);
  if (!a.equals(b)) changes.push(path);
  if (frozen.test(path) && !operational.includes(path)) {
    if (path === renewedEvidencePath) {
      // User-approved coverage renewal only. Never exempt corporate-action logic,
      // cash fields, issuer amounts or any other frozen source from byte comparison.
      const expected = a.toString('utf8')
        .replace('audited 2026-10-07', 'audited 2026-10-09')
        .replace("to > '2026-10-07'", "to > '2026-10-08'");
      assert.notEqual(expected, a.toString('utf8'), 'Original evidence boundary not found');
      assert(b.equals(Buffer.from(expected)), 'TSM change exceeds the authorized coverage/comment renewal');
      const facts = JSON.parse(await readFile('validation/v1.3-tsm-evidence-renewal.json'));
      assert.deepEqual(facts.approvedCoverage, {from: '2025-01-01', through: '2026-10-08'});
      assert.equal(facts.reviewDate, '2026-10-09');
      evidenceRenewal = {path, beforeSHA256: digest(a), sha256: digest(b), exactCoverageAndCommentOnly: true,
        evidence: 'validation/v1.3-tsm-evidence-renewal.json', through: '2026-10-08', rejectsFrom: '2026-10-09'};
      continue;
    }
    assert(a.equals(b), 'Frozen subsystem changed: ' + path);
    frozenFiles.push({ path, sha256: digest(b), byteIdentical: true });
  }
}
for (const path of after) if (!before.includes(path)) changes.push(path);
const oldPackage = JSON.parse(await readFile(resolve(baseline, 'package.json'))), newPackage = JSON.parse(await readFile('package.json'));
assert.deepEqual(newPackage.dependencies, oldPackage.dependencies);
assert.deepEqual(newPackage.devDependencies, oldPackage.devDependencies);
assert.equal(newPackage.version, '1.3.1');
const report = { format: 'EQUINOX_V13_FROZEN_SOURCE_AUDIT_V1', checkedAt: new Date().toISOString(), status: 'PASS',
  authoritativeHEAD: '9deaef0e207615cded6fb2f961133ee3f11bbd2a', authoritativeTree: '8f46a030b6058800601566509dd833778c3c6897',
  engineVersion: '1.0.1', marketDataModelVersion: '1.1.2', dependencyChanges: [], frozenFiles, evidenceRenewal,
  operationalDataChanges: { 'src/market-data/live/cache.ts': 'Explicit user-approved clearing of corrupt market cache only',
    'src/market-data/live/synchronized.ts': 'Progress notifications and final abort check; identical normalized input/output tested' },
  changedOrAdded: changes.sort(), noBaselineFilesRemoved: true };
await writeFile('validation/v1.3-frozen-audit.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ status: report.status, frozenFiles: frozenFiles.length, changedOrAdded: changes.length, dependencies: 'UNCHANGED' }));
