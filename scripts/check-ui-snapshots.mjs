import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const baseline = process.argv[2];
if (!baseline) throw new Error('PASS_IMMUTABLE_V1_1_2_BASELINE');
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { canonical } = await server.ssrLoadModule('/src/snapshots/calculate.ts');
  const { validateSeal } = await server.ssrLoadModule('/src/snapshots/integrity.ts');
  const snapshots = [];
  for (const path of ['tests/legacy-snapshot.json', 'validation/node-snapshot.json']) {
    const before = JSON.parse(await readFile(resolve(baseline, path))), after = JSON.parse(await readFile(path));
    assert.equal(canonical(after), canonical(before));
    assert.equal(canonical(await validateSeal(after)), canonical(before));
    snapshots.push({ path, engine: after.snapshot.versions.engine, schema: after.snapshot.schemaVersion, sha256: after.sha256, sameBaselineResultAndHash: true, replayed: true });
  }
  const before = JSON.parse(await readFile(resolve(baseline, 'validation/closure-final-snapshots.json')));
  const after = JSON.parse(await readFile('validation/closure-final-snapshots.json'));
  assert.deepEqual(Object.keys(after).sort(), ['equal', 'erc', 'inverse']);
  for (const model of Object.keys(after)) {
    assert.equal(canonical(after[model]), canonical(before[model]));
    assert.equal(canonical(await validateSeal(after[model])), canonical(before[model]));
    snapshots.push({ model, engine: after[model].snapshot.versions.engine, schema: after[model].snapshot.schemaVersion, sha256: after[model].sha256, sameBaselineResultAndHash: true, replayed: true });
  }
  const oldRisk = JSON.parse(await readFile(resolve(baseline, 'validation/closure-final-synchronized.json'))), currentRisk = JSON.parse(await readFile('validation/closure-final-synchronized.json'));
  for (const field of ['validationAsOf', 'normalizedInput', 'returns', 'levelsDKK', 'returnDates', 'covariance', 'correlation', 'snapshotHashes']) assert.equal(canonical(currentRisk[field]), canonical(oldRisk[field]), 'Accepted risk input/result changed: ' + field);
  const report = { format: 'EQUINOX_UI_SNAPSHOT_COMPATIBILITY_V1', checkedAt: new Date().toISOString(), status: 'PASS',
    scope: 'Frozen Engine Node replay and exact canonical comparison to supplied accepted snapshots/data. Not Node-to-browser replay.',
    snapshots, normalizedInputAndResultsIdentical: true, browserReplay: 'NOT TESTED' };
  await writeFile('validation/ui-snapshot-compatibility.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await server.close(); }
