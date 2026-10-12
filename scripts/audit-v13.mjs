// Frozen boundary audit against the actual supplied 1.3.1 ZIP, not an older Git HEAD.
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const baseline = JSON.parse(await readFile('validation/final-baseline.json'));
const operational = {
  'src/persistence/store.ts': 'Reproduced partial save/restore rollback, unhandled read abort, sanitized snapshot storage; strict financial durability.',
  'src/market-data/live/cache.ts': 'Reproduced unhandled transaction abort; operation still rejects and preserves previous cache.',
  'src/market-data/live/network.ts': 'Reproduced response-size limit applied only after unbounded buffering; bound streamed bytes and cancel excess.',
};
const frozenFiles = [], operationalFiles = [];
for (const [path, expected] of Object.entries(baseline.sourceHashes)) {
  const sha256 = createHash('sha256').update(await readFile(path)).digest('hex');
  if (path in operational) operationalFiles.push({ path, beforeSHA256: expected, sha256, reason: operational[path] });
  else { assert.equal(sha256, expected, 'Frozen financial source changed: ' + path); frozenFiles.push({ path, sha256, byteIdentical: true }); }
}
for (const path of await readdir('src', { recursive: true })) {
  const name = 'src/' + path;
  if (/^src\/(domain|risk|optimization|execution|portfolio|snapshots|persistence|market-data)\/.*\.(ts|tsx)$/.test(name)) assert(name in baseline.sourceHashes, 'Unreviewed financial source added: ' + name);
}
const packageMetadata = JSON.parse(await readFile('package.json'));
assert.deepEqual(packageMetadata.dependencies, baseline.dependencies);
assert.deepEqual(packageMetadata.devDependencies, { ...baseline.devDependencies, '@playwright/test': '1.64.0' });
assert.equal(packageMetadata.version, '1.3.2');
const report = { format: 'EQUINOX_FINAL_FROZEN_AUDIT_V1', checkedAt: new Date().toISOString(), status: 'PASS',
  inputSHA256: baseline.inputSHA256, inputAppVersion: baseline.inputAppVersion, finalAppVersion: packageMetadata.version,
  engineVersion: '1.0.1', marketDataModelVersion: '1.1.2', frozenFiles, operationalFiles,
  financialMathByteIdentical: true, tsmEvidenceAndSemanticsByteIdentical: true,
  dependencyChanges: [{ name: '@playwright/test', before: '1.63.0', after: '1.64.0', scope: 'Development only; upstream WebKit service-worker offline fix #42894.' }] };
await writeFile('validation/final-frozen-audit.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, frozenFiles: frozenFiles.length, operationalFiles: operationalFiles.length }));
