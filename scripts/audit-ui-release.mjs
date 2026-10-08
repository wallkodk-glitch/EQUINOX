// UI scope audit against the supplied, separately extracted 1.1.2 baseline.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import assert from 'node:assert/strict';

const baseline = process.argv[2];
if (!baseline) throw new Error('PASS_IMMUTABLE_V1_1_2_BASELINE_DIRECTORY');
const root = process.cwd(), base = resolve(baseline);
const sha = data => createHash('sha256').update(data).digest('hex');
const excluded = new Set(['node_modules', '.git', 'dist', 'validation', 'test-results', 'playwright-report', '__pycache__', 'RELEASE-MANIFEST.json']);
async function walk(directory, origin = directory) {
  const out = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (excluded.has(entry.name)) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) out.push(...await walk(path, origin));
    else if (entry.isFile()) out.push(relative(origin, path));
    else throw new Error('UNEXPECTED_SOURCE_FILE_TYPE');
  }
  return out.sort();
}
const original = await walk(base), current = await walk(root);
const added = current.filter(p => !original.includes(p));
const deleted = original.filter(p => !current.includes(p));
const changed = [];
for (const path of original.filter(p => current.includes(p))) {
  if (!(await readFile(resolve(base, path))).equals(await readFile(resolve(root, path)))) changed.push(path);
}
const allowedChanges = new Set([
  'README.md', 'package.json', 'package-lock.json', 'index.html', 'scripts/build-pwa.mjs',
  'src/ui/App.tsx', 'src/ui/Details.tsx', 'src/ui/MarketDataSettings.tsx', 'src/ui/format.ts', 'src/ui/styles.css',
  'public/icon.svg', 'public/icon-192.png', 'public/icon-512.png', 'public/apple-touch-icon.png',
  'tests/browser/app.spec.ts', 'tests/browser/market-settings.spec.ts', 'docs/mobile-release.md', 'release/mobile-pages.yml',
]);
const unexpectedChanges = changed.filter(p => !allowedChanges.has(p));
const unexpectedAdditions = added.filter(p => !/^(src\/ui\/|tests\/ui-|tests\/browser\/ui\.spec\.ts$|docs\/ui-v1\/|scripts\/.*ui.*\.(?:mjs|py)$|public\/brand\/)/.test(p));
const frozenPaths = original.filter(p => (p.startsWith('src/') && (!p.startsWith('src/ui/') || p === 'src/ui/calculation-job.ts')) || p.startsWith('reference/') || (p.startsWith('tests/') && !p.startsWith('tests/browser/')));
const frozen = [];
for (const path of frozenPaths) {
  const a = await readFile(resolve(base, path)), b = await readFile(resolve(root, path));
  frozen.push({ path, baselineSHA256: sha(a), candidateSHA256: sha(b), identical: a.equals(b) });
}
const oldPackage = JSON.parse(await readFile(resolve(base, 'package.json'))), candidatePackage = JSON.parse(await readFile('package.json'));
oldPackage.version = candidatePackage.version;
const oldLock = JSON.parse(await readFile(resolve(base, 'package-lock.json'))), candidateLock = JSON.parse(await readFile('package-lock.json'));
oldLock.version = candidateLock.version;
oldLock.packages[''].version = candidateLock.packages[''].version;
const noDependencyChanges = JSON.stringify(oldPackage) === JSON.stringify(candidatePackage) && JSON.stringify(oldLock) === JSON.stringify(candidateLock);
const oldPWA = await readFile(resolve(base, 'scripts/build-pwa.mjs'), 'utf8'), newPWA = await readFile('scripts/build-pwa.mjs', 'utf8');
const serviceWorkerLogicIdentical = newPWA.replace('background_color: "#071012"', 'background_color: "#101e27"').replace('theme_color: "#0A1417"', 'theme_color: "#101e27"') === oldPWA;

function syntax(source, path) { return ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); }
function collect(tree, predicate) {
  const result = [];
  function visit(node) { if (predicate(node)) result.push(node); ts.forEachChild(node, visit); }
  visit(tree); return result;
}
function declaration(tree, name) {
  const nodes = collect(tree, n => (ts.isFunctionDeclaration(n) || ts.isVariableDeclaration(n)) && n.name?.getText(tree) === name);
  assert.equal(nodes.length, 1, 'Ambiguous protected UI handler: ' + name);
  return nodes[0].getText(tree);
}
const oldApp = syntax(await readFile(resolve(base, 'src/ui/App.tsx'), 'utf8'), 'App.tsx');
const newApp = syntax(await readFile('src/ui/App.tsx', 'utf8'), 'App.tsx');
const handlerChecks = ['persist', 'edit', 'startDemo', 'run', 'exportBackup', 'fileAction'].map(name => {
  const a = declaration(oldApp, name), b = declaration(newApp, name).replace('openDetails("data");', 'setTab("details");');
  return { name, identical: a === b, baselineSHA256: sha(a), normalizedCandidateSHA256: sha(b) };
});
function originalEffectsPreserved(a, b) {
  const calls = tree => collect(tree, n => ts.isCallExpression(n) && n.expression.getText(tree) === 'useEffect').map(n => n.getText(tree));
  const before = calls(a), after = calls(b);
  return before.every(effect => after.includes(effect));
}
function changesPreserved(a, b) {
  const handlers = tree => collect(tree, n => ts.isJsxAttribute(n) && n.name.getText(tree) === 'onChange').map(n => n.getText(tree));
  const before = handlers(a), after = handlers(b);
  return before.every(handler => after.includes(handler));
}
const oldSettings = syntax(await readFile(resolve(base, 'src/ui/MarketDataSettings.tsx'), 'utf8'), 'MarketDataSettings.tsx');
const newSettings = syntax(await readFile('src/ui/MarketDataSettings.tsx', 'utf8'), 'MarketDataSettings.tsx');
for (const name of ['probe', 'syncCredentials', 'testProvider', 'test']) {
  const a = declaration(oldSettings, name), b = declaration(newSettings, name).replace('Testen opdaterer ikke risikohistorik.', 'Risikointegration er fortsat blokeret.');
  handlerChecks.push({ name: 'MarketDataSettings.' + name, identical: a === b, baselineSHA256: sha(a), normalizedCandidateSHA256: sha(b) });
}
const originalUIEffectsPreserved = originalEffectsPreserved(oldApp, newApp) && originalEffectsPreserved(oldSettings, newSettings);
const originalFormChangeHandlersPreserved = changesPreserved(oldApp, newApp) && changesPreserved(oldSettings, newSettings);
const browserCases = [];
for (const path of ['tests/browser/app.spec.ts', 'tests/browser/market-settings.spec.ts', 'tests/browser/nationalbank.spec.ts']) {
  const a = syntax(await readFile(resolve(base, path), 'utf8'), path), b = syntax(await readFile(path, 'utf8'), path);
  const names = tree => collect(tree, n => ts.isCallExpression(n) && n.expression.getText(tree) === 'test').map(n => n.arguments[0]?.getText(tree));
  const assertions = tree => collect(tree, n => ts.isCallExpression(n) && (n.expression.getText(tree) === 'expect' || n.expression.getText(tree).startsWith('expect.poll'))).length;
  const before = names(a), after = names(b);
  browserCases.push({ path, originalNamesPreserved: JSON.stringify(before) === JSON.stringify(after), originalTests: before.length, currentTests: after.length, baselineAssertions: assertions(a), currentAssertions: assertions(b) });
}
const primaryBrand = sha(await readFile('public/brand/equinox-primary.jpeg'));
const sourceHashes = {};
for (const path of current) sourceHashes[path] = sha(await readFile(path));
const report = {
  format: 'EQUINOX_UI_SCOPE_AUDIT_V1', checkedAt: new Date().toISOString(),
  baselineZIP_SHA256: '7e03482d95f64ab341c948961d4d9c30451434b3092e75a3cbf4594b5b5764fe',
  appVersion: candidatePackage.version, engineVersion: '1.0.1', marketDataModelVersion: '1.1.2', snapshotSchemaVersions: [1, 2],
  frozenFilesIdentical: frozen.every(f => f.identical), noDependencyChanges, serviceWorkerLogicIdentical,
  originalUIHandlersPreserved: handlerChecks.every(h => h.identical), originalUIEffectsPreserved, originalFormChangeHandlersPreserved,
  originalBrowserCasesPreserved: browserCases.every(c => c.originalNamesPreserved && c.currentAssertions >= c.baselineAssertions),
  primaryBrandIdentical: primaryBrand === '38a25d27acef97382fd287033869f4fbff82f35abec0870bc417649cd43c4551',
  scope: 'Presentation-only source audit, not executed browser/device or visual screenshot evidence.',
  allowedExceptions: ['App 1.2.0 only; frozen subsystem versions unchanged.', 'Primary navigation and details return route only in fileAction.', 'Credential draft test status copy now says it does not update risk history; handler behavior identical.', 'Static shell manifest colors/icon/brand assets; worker request policy untouched.', 'Browser selectors follow navigation; original cases and assertions retained.'],
  frozen, handlerChecks, browserCases, primaryBrandSHA256: primaryBrand, changed, added, deleted, unexpectedChanges, unexpectedAdditions, sourceHashes,
};
report.status = report.appVersion === '1.2.0' && report.frozenFilesIdentical && report.noDependencyChanges && report.serviceWorkerLogicIdentical && report.originalUIHandlersPreserved && report.originalUIEffectsPreserved && report.originalFormChangeHandlersPreserved && report.originalBrowserCasesPreserved && report.primaryBrandIdentical && !deleted.length && !unexpectedChanges.length && !unexpectedAdditions.length ? 'PASS' : 'FAIL';
await writeFile('validation/ui-frozen-audit.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ status: report.status, frozenFiles: frozen.length, changed, added, deleted, unexpectedChanges, unexpectedAdditions, failedHandlers: handlerChecks.filter(h => !h.identical), serviceWorkerLogicIdentical, originalUIEffectsPreserved, originalFormChangeHandlersPreserved, browserCases, noDependencyChanges, primaryBrandIdentical: report.primaryBrandIdentical }, null, 2));
if (report.status !== 'PASS') process.exitCode = 1;
