// Extends the baseline static scan to the current UI release reports.
// Never print matched values. Public header names/code are not secret values.
import { readdir, readFile, writeFile } from 'node:fs/promises';
const forbidden = /^(api[_-]?key|authorization|x-cg-demo-api-key|credentialStorageKey|access_token|secret|token)$/i;
const findings = [];
function inspect(value, file, path = '') {
  if (Array.isArray(value)) value.forEach((v, i) => inspect(v, file, path + '.' + i));
  else if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
    if (forbidden.test(key)) findings.push({ file, category: 'SERIALIZED_SECRET_FIELD', fieldPath: path + '.' + key });
    inspect(child, file, path + '.' + key);
  }
  else if (typeof value === 'string' && /[?&](api[_-]?key|access_token|secret|authorization)=/i.test(value)) findings.push({ file, category: 'SERIALIZED_CREDENTIAL_URL' });
}
const reports = (await readdir('validation')).filter(name => name.startsWith('ui-') && name.endsWith('.json') && name !== 'ui-secret-scan.json');
for (const file of reports) inspect(JSON.parse(await readFile('validation/' + file)), file);
const base = JSON.parse(await readFile('validation/credential-scan.json'));
const result = { format: 'EQUINOX_UI_RELEASE_SECRET_SCAN_V1', checkedAt: new Date().toISOString(),
  status: base.status === 'PASS' && !findings.length ? 'PASS' : 'FAIL', baseScan: 'validation/credential-scan.json',
  scope: 'Baseline source/build/provider-fixture scan plus current UI serialized-report fields/URLs. No actual provider key supplied; no runtime browser exclusion claim.',
  reportsScanned: reports.length, findings,
};
await writeFile('validation/ui-secret-scan.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (result.status !== 'PASS') process.exitCode = 1;
