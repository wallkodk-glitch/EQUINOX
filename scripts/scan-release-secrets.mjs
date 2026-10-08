// Structural release scan. Never print matched values or record credentials.
// Runtime exclusion is separately covered by tests; this is not browser proof.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const findings = [], production = [], sources = [], fixtures = [];
async function walk(dir, out) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await walk(p, out);
    else if (e.isFile()) out.push(p);
    else throw new Error('UNEXPECTED_SCAN_FILE_TYPE');
  }
}
await walk('dist', production); await walk('src', sources); await walk('tests/fixtures/providers', fixtures);
for (const e of await readdir('.')) if (/^\.env(?:\.|$)/.test(e)) findings.push({ category: 'ENV_FILE_PRESENT', file: e });
// Require assignment/object-field context: the documented header-name ternary
// 'Authorization':'x-cg-demo-api-key' is public code, not a credential value.
const literal = /(?:^\s*|\b(?:const|let|var)\s+|[,{;]\s*)["']?(?:api[_-]?key|x-cg-demo-api-key|authorization|credentials?)["']?\s*[:=]\s*["'](?:Bearer\s+)?[^"'\n]{8,}["']/im;
const bundledEnvironment = /import\.meta\.env\.[A-Z_]*(?:API_KEY|SECRET|TOKEN)/;
for (const file of [...production, ...sources]) {
  if (!/\.(?:js|ts|tsx|map|html|json|webmanifest|css)$/.test(file)) continue;
  const text = await readFile(file, 'utf8');
  if (literal.test(text)) findings.push({ category: 'HARDCODED_CREDENTIAL_LITERAL', file });
  if (bundledEnvironment.test(text)) findings.push({ category: 'BUNDLED_SECRET_ENVIRONMENT_ACCESS', file });
}
const forbidden = /^(?:api[_-]?key|authorization|x-cg-demo-api-key|credentials?|credentialStorageKey|access_token|secret|token)$/i;
function inspect(value, file) {
  if (Array.isArray(value)) value.forEach(v => inspect(v, file));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) {
    if (forbidden.test(k)) findings.push({ category: 'CREDENTIAL_FIELD_IN_SERIALIZED_DATA', file });
    inspect(v, file);
  }
  else if (typeof value === 'string' && /[?&](?:api[_-]?key|access_token|authorization|secret)=/i.test(value)) findings.push({ category: 'CREDENTIAL_URL_IN_SERIALIZED_DATA', file });
}
const finalReports=(await readdir('validation')).filter(p=>p.startsWith('closure-final-')&&p.endsWith('.json')).map(p=>join('validation',p));
const serialized = [...fixtures.filter(p => p.endsWith('.json')), 'validation/node-snapshot.json', 'tests/legacy-snapshot.json',...finalReports];
for (const file of serialized) inspect(JSON.parse(await readFile(file, 'utf8')), file);
const report = {
  checkedAt: new Date().toISOString(), status: findings.length ? 'FAIL' : 'PASS',
  scope: 'Static structural scan of production/source and committed fixture/snapshot data; no real provider credentials were supplied. Not runtime browser exclusion evidence.',
  productionFiles: production.length, sourceFiles: sources.length, serializedFiles: serialized.length,
  findings
};
await writeFile('validation/credential-scan.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (findings.length) process.exitCode = 1;
