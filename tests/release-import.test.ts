import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, statSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';

// Execute the trusted workflow validator against untrusted archives. Expected
// hashes are produced here independently, not by the release packager.
const workflow = readFileSync('.github/workflows/import-release.yml', 'utf8');
function validator() {
  const match = /          python - <<'PY'\n([\s\S]*?)\n          PY/.exec(workflow);
  if (!match) throw new Error('Missing inline manifest validator');
  return match[1].split('\n').map(line => line.slice(10)).join('\n');
}
type Entry = { name: string; text: string; mode?: number; compress?: boolean };
function entries(prefix = 'EQUINOX/'): Entry[] {
  const files: Record<string, string> = {
    '.gitignore': 'validation/\n',
    'package.json': '{"name":"equinox","version":"1.3.0"}',
    'package-lock.json': '{"name":"equinox","version":"1.3.0","packages":{"":{"version":"1.3.0"}}}',
    'src/main.tsx': 'source', 'tests/smoke.test.ts': 'tests',
    'src/domain/core.ts': 'export const VERSIONS = { engine: "1.0.1" } as const;',
    'src/market-data/live/model.ts': "export const MARKET_DATA_MODEL_VERSION = '1.1.2';",
    'validation/node-snapshot.json': '{}', 'docs/v1.3/audit.md': 'audit',
    '.github/workflows/pages.yml': 'verified repository infrastructure',
    '.github/workflows/import-release.yml': 'verified import infrastructure',
  };
  const digest = (text: string) => ({ bytes: Buffer.byteLength(text), sha256: createHash('sha256').update(text).digest('hex') });
  const manifest = { format: 'EQUINOX_RELEASE_MANIFEST_V3', appVersion: '1.3.0', engineVersion: '1.0.1', marketDataModelVersion: '1.1.2',
    files: Object.fromEntries(Object.entries(files).filter(([name]) => !name.startsWith('.github/workflows/')).map(([name, text]) => [name, digest(text)])),
    repositoryInfrastructure: { policy: 'PRESERVE_EXISTING_UPLOAD_SEPARATELY', files: Object.fromEntries(Object.entries(files).filter(([name]) => name.startsWith('.github/workflows/')).map(([name, text]) => [name, digest(text)])) } };
  return [...Object.entries(files).map(([name, text]) => ({ name: prefix + name, text })), { name: prefix + 'RELEASE-MANIFEST.json', text: JSON.stringify(manifest) }];
}
function rehash(values: Entry[]) {
  const entry = values.find(v => v.name.endsWith('/RELEASE-MANIFEST.json'))!;
  const manifest = JSON.parse(entry.text);
  for (const item of values) {
    const name = item.name.replace(/^EQUINOX\//, '');
    const metadata = manifest.files[name] ?? manifest.repositoryInfrastructure.files[name];
    if (metadata) { metadata.bytes = Buffer.byteLength(item.text); metadata.sha256 = createHash('sha256').update(item.text).digest('hex'); }
  }
  entry.text = JSON.stringify(manifest);
}
function archive(path: string, values: Entry[], mutation = '') {
  const result = spawnSync('python3', ['-c', `import json,sys,zipfile,struct
entries=json.load(sys.stdin)
with zipfile.ZipFile(sys.argv[1],'w') as z:
 for entry in entries:
  info=zipfile.ZipInfo(entry['name'].replace(chr(0),'~'));info.create_system=3
  info.external_attr=entry.get('mode',0o100644)<<16
  z.writestr(info,entry['text'],compress_type=zipfile.ZIP_DEFLATED if entry.get('compress') else zipfile.ZIP_STORED)
raw=open(sys.argv[1],'rb').read()
for entry in entries:
 if chr(0) in entry['name']:raw=raw.replace(entry['name'].replace(chr(0),'~').encode(),entry['name'].encode())
raw=bytearray(raw)
central=raw.index(bytes([80,75,1,2]))
if sys.argv[2]=='encrypted':
 struct.pack_into('<H',raw,6,struct.unpack_from('<H',raw,6)[0]|1)
 struct.pack_into('<H',raw,central+8,struct.unpack_from('<H',raw,central+8)[0]|1)
if sys.argv[2]=='crc':
 struct.pack_into('<I',raw,14,0)
 struct.pack_into('<I',raw,central+16,0)
if sys.argv[2]=='oversized':struct.pack_into('<I',raw,central+24,64000001)
open(sys.argv[1],'wb').write(raw)` , path, mutation], { input: JSON.stringify(values), encoding: 'utf8' });
  expect(result.status, result.stderr).toBe(0);
}
function run(values: Entry[], input = '', extraZip = false, mutation = '') {
  const root = mkdtempSync(join(tmpdir(), 'equinox-import-test-'));
  mkdirSync(join(root, 'runner')); const output = join(root, 'outputs'); writeFileSync(output, '');
  archive(join(root, 'EQUINOX-v1.3-GitHub-ready.zip'), values, mutation);
  if (extraZip) archive(join(root, 'EQUINOX-v1.3-other.zip'), values);
  const result = spawnSync('python3', ['-c', validator()], { cwd: root, encoding: 'utf8',
    env: { ...process.env, RELEASE_ZIP: input, RUNNER_TEMP: join(root, 'runner'), GITHUB_OUTPUT: output } });
  return { root, result, output: readFileSync(output, 'utf8') };
}
it.each(['EQUINOX/', ''])('accepts exactly one complete, hash-verified source root (%s) and extracts no uploaded ZIP', prefix => {
  const r = run(entries(prefix));
  try {
    expect(r.result.status, r.result.stderr).toBe(0);
    expect(r.output).toContain('release_zip=EQUINOX-v1.3-GitHub-ready.zip');
    const src = r.output.split('\n').find(line => line.startsWith('src='))!.slice(4);
    expect(existsSync(join(src, 'validation/node-snapshot.json'))).toBe(true);
    expect(existsSync(join(src, 'EQUINOX-v1.3-GitHub-ready.zip'))).toBe(false);
  } finally { rmSync(r.root, { recursive: true }); }
});
it.each(['tampered', 'extra', 'missing', 'traversal', 'absolute', 'backslash', 'duplicate', 'symlink', 'git', 'node_modules', 'multiple-roots', 'manifest-infrastructure-overlap'] as const)
  ('rejects %s before extraction or any repository mutation', mode => {
    const values = entries();
    if (mode === 'tampered') values[0].text += 'changed';
    if (mode === 'extra') values.push({ name: 'EQUINOX/unhashed.txt', text: 'extra' });
    if (mode === 'missing') values.splice(3, 1);
    if (mode === 'traversal') values.push({ name: '../escape', text: 'x' });
    if (mode === 'absolute') values.push({ name: '/escape', text: 'x' });
    if (mode === 'backslash') values.push({ name: 'EQUINOX\\escape', text: 'x' });
    if (mode === 'duplicate') values.push(values[0]);
    if (mode === 'symlink') values[0].mode = 0o120777;
    if (mode === 'git') values.push({ name: 'EQUINOX/.git/config', text: 'x' });
    if (mode === 'node_modules') values.push({ name: 'EQUINOX/node_modules/a', text: 'x' });
    if (mode === 'multiple-roots') values.push(...entries(''));
    if (mode === 'manifest-infrastructure-overlap') {
      const m = JSON.parse(values.at(-1)!.text); m.files['.github/workflows/pages.yml'] = m.repositoryInfrastructure.files['.github/workflows/pages.yml'];
      values.at(-1)!.text = JSON.stringify(m);
    }
    const r = run(values);
    try { expect(r.result.status).not.toBe(0); expect(r.output).toBe(''); }
    finally { rmSync(r.root, { recursive: true }); }
  });
it.each(['../EQUINOX-v1.3-GitHub-ready.zip', '/tmp/release.zip', 'missing.zip', 'bad\nname.zip'])('rejects unsafe/missing explicit filename %s', input => {
  const r = run(entries(), input);
  try { expect(r.result.status).not.toBe(0); expect(r.output).toBe(''); }
  finally { rmSync(r.root, { recursive: true }); }
});
it('never silently chooses among multiple release ZIPs; an explicit valid basename resolves them', () => {
  const ambiguous = run(entries(), '', true);
  try { expect(ambiguous.result.status).not.toBe(0); expect(ambiguous.output).toBe(''); }
  finally { rmSync(ambiguous.root, { recursive: true }); }
  const explicit = run(entries(), 'EQUINOX-v1.3-GitHub-ready.zip', true);
  try { expect(explicit.result.status, explicit.result.stderr).toBe(0); }
  finally { rmSync(explicit.root, { recursive: true }); }
});
it.each(['engine-source', 'model-source', 'model-manifest', 'missing-app-version', 'entry-count', 'duplicate-json-key', 'special-file', 'directory-collision', 'credential-file', 'nested-zip', 'nul-path'] as const)
 ('rejects internally inconsistent or unsafe %s even when listed hashes are recalculated', mode => {
  const values = entries(), manifestEntry = values.at(-1)!;
  if (mode === 'engine-source') values.find(v => v.name.endsWith('/core.ts'))!.text = 'export const VERSIONS = { engine: "9.0.0" } as const;';
  if (mode === 'model-source') values.find(v => v.name.endsWith('/model.ts'))!.text = "export const MARKET_DATA_MODEL_VERSION = '9.0.0';";
  if (mode === 'model-manifest') { const m = JSON.parse(manifestEntry.text); m.marketDataModelVersion = '9.0.0'; manifestEntry.text = JSON.stringify(m); }
  if (mode === 'entry-count') { const m = JSON.parse(manifestEntry.text); m.entryCount = 999; manifestEntry.text = JSON.stringify(m); }
  if (mode === 'missing-app-version') {
   for (const name of ['package.json', 'package-lock.json', 'RELEASE-MANIFEST.json']) {
    const e = values.find(v => v.name === 'EQUINOX/' + name)!, json = JSON.parse(e.text);
    delete json.version; delete json.appVersion;
    if (json.packages) delete json.packages[''].version;
    e.text = JSON.stringify(json);
   }
  }
  if (mode === 'special-file') values[0].mode = 0o010644;
  if (mode === 'directory-collision') values.push({ name: 'EQUINOX/src', text: 'not a directory' });
  if (mode === 'credential-file') values.push({ name: 'EQUINOX/.env.local', text: 'not a real secret' });
  if (mode === 'nested-zip') values.push({ name: 'EQUINOX/old.zip', text: 'nested' });
  if (mode === 'nul-path') values[0].name += '\0hidden';
  rehash(values);
  if (mode === 'duplicate-json-key') manifestEntry.text = manifestEntry.text.replace('{', '{"appVersion":"ambiguous",');
  const r = run(values);
  try { expect(r.result.status).not.toBe(0); expect(r.output).toBe(''); }
  finally { rmSync(r.root, { recursive: true }); }
 });
it.each(['encrypted', 'crc', 'oversized', 'compression-ratio', 'nonfinite-json', 'nonobject-json', 'lock-version'] as const)
 ('rejects %s archive metadata or manifest before any extraction', mode => {
  const values = entries();
  if (mode === 'compression-ratio') values[0] = { ...values[0], text: '0'.repeat(2 * 1024 * 1024), compress: true };
  if (mode === 'lock-version') { const entry = values.find(v => v.name.endsWith('/package-lock.json'))!; entry.text = entry.text.replaceAll('1.3.0', '9.0.0'); }
  rehash(values);
  if (mode === 'nonfinite-json') values.at(-1)!.text = values.at(-1)!.text.replace('{', '{"extra":NaN,');
  if (mode === 'nonobject-json') values.at(-1)!.text = '[]';
  const r = run(values, '', false, mode);
  try { expect(r.result.status).not.toBe(0); expect(r.output).toBe(''); }
  finally { rmSync(r.root, { recursive: true }); }
 });
it('imports product with real rsync/git, preserving infrastructure, force-tracking validation and removing the upload', () => {
  const r = run(entries());
  try {
    expect(r.result.status, r.result.stderr).toBe(0);
    const repo = join(r.root, 'repository'), remote = join(r.root, 'local-origin.git');
    mkdirSync(join(repo, '.github/workflows'), { recursive: true });
    writeFileSync(join(repo, '.github/workflows/pages.yml'), 'repository-owned current Pages workflow');
    writeFileSync(join(repo, '.github/workflows/import-release.yml'), 'repository-owned current importer');
    writeFileSync(join(repo, 'obsolete.txt'), 'old product');
    archive(join(repo, 'EQUINOX-v1.3-GitHub-ready.zip'), entries());
    const git = (...args: string[]) => {
      const result = spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
      expect(result.status, result.stderr).toBe(0); return result.stdout;
    };
    git('init', '-q', '-b', 'main'); git('config', 'user.name', 'Local fixture'); git('config', 'user.email', 'fixture@example.invalid');
    git('add', '-A'); git('commit', '-qm', 'Synthetic previous source');
    git('init', '-q', '--bare', remote); git('remote', 'add', 'origin', remote); git('push', '-q', 'origin', 'main');
    const src = r.output.split('\n').find(line => line.startsWith('src='))!.slice(4);
    // Reproduce the production import failure: same bytes count and timestamp,
    // different content. rsync's default quick check silently keeps this stale.
    mkdirSync(join(repo, 'src'), { recursive: true });
    writeFileSync(join(repo, 'src/main.tsx'), 'stale!');
    const stamp = new Date(Math.floor(statSync(join(src, 'src/main.tsx')).mtimeMs / 1000) * 1000);
    utimesSync(join(src, 'src/main.tsx'), stamp, stamp);
    utimesSync(join(repo, 'src/main.tsx'), stamp, stamp);
    // Execute both shell steps from the delivered workflow, including the push
    // to an isolated local bare fixture repository, never a network remote.
    const shell = workflow.slice(workflow.indexOf('      - name: Import product')).matchAll(/        run: \|\n([\s\S]*?)(?=\n      - name:|$)/g);
    let count = 0;
    for (const block of shell) {
      count++;
      const script = block[1].split('\n').map(line => line.slice(10)).join('\n');
      const result = spawnSync('bash', ['-c', script], { cwd: repo, encoding: 'utf8', env: {
        ...process.env, SRC: src, RELEASE_ZIP: 'EQUINOX-v1.3-GitHub-ready.zip', GITHUB_STEP_SUMMARY: join(r.root, 'summary'),
      } });
      expect(result.status, result.stderr).toBe(0);
    }
    expect(count).toBe(2);
    expect(readFileSync(join(repo, '.github/workflows/pages.yml'), 'utf8')).toBe('repository-owned current Pages workflow');
    expect(readFileSync(join(repo, '.github/workflows/import-release.yml'), 'utf8')).toBe('repository-owned current importer');
    expect(git('ls-files', 'validation/node-snapshot.json').trim()).toBe('validation/node-snapshot.json');
    expect(existsSync(join(repo, 'EQUINOX-v1.3-GitHub-ready.zip'))).toBe(false);
    expect(existsSync(join(repo, 'obsolete.txt'))).toBe(false);
    expect(readFileSync(join(repo, 'src/main.tsx'), 'utf8')).toBe('source');
    expect(git('ls-remote', 'origin', 'refs/heads/main').split('\t')[0]).toBe(git('rev-parse', 'HEAD').trim());
  } finally { rmSync(r.root, { recursive: true }); }
});
