import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
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
type Entry = { name: string; text: string; mode?: number };
function entries(prefix = 'EQUINOX/'): Entry[] {
  const files: Record<string, string> = {
    '.gitignore': 'validation/\n',
    'package.json': '{"name":"equinox","version":"1.3.0"}',
    'package-lock.json': '{"name":"equinox","version":"1.3.0","packages":{"":{"version":"1.3.0"}}}',
    'src/main.tsx': 'source', 'tests/smoke.test.ts': 'tests',
    'validation/node-snapshot.json': '{}', 'docs/v1.3/audit.md': 'audit',
    '.github/workflows/pages.yml': 'verified repository infrastructure',
    '.github/workflows/import-release.yml': 'verified import infrastructure',
  };
  const digest = (text: string) => ({ bytes: Buffer.byteLength(text), sha256: createHash('sha256').update(text).digest('hex') });
  const manifest = { format: 'EQUINOX_RELEASE_MANIFEST_V3', appVersion: '1.3.0', engineVersion: '1.0.1',
    files: Object.fromEntries(Object.entries(files).filter(([name]) => !name.startsWith('.github/workflows/')).map(([name, text]) => [name, digest(text)])),
    repositoryInfrastructure: { policy: 'PRESERVE_EXISTING_UPLOAD_SEPARATELY', files: Object.fromEntries(Object.entries(files).filter(([name]) => name.startsWith('.github/workflows/')).map(([name, text]) => [name, digest(text)])) } };
  return [...Object.entries(files).map(([name, text]) => ({ name: prefix + name, text })), { name: prefix + 'RELEASE-MANIFEST.json', text: JSON.stringify(manifest) }];
}
function archive(path: string, values: Entry[]) {
  const result = spawnSync('python3', ['-c', `import json,sys,zipfile
with zipfile.ZipFile(sys.argv[1],'w') as z:
 for entry in json.load(sys.stdin):
  info=zipfile.ZipInfo(entry['name']);info.create_system=3
  info.external_attr=entry.get('mode',0o100644)<<16
  z.writestr(info,entry['text'])` , path], { input: JSON.stringify(values), encoding: 'utf8' });
  expect(result.status, result.stderr).toBe(0);
}
function run(values: Entry[], input = '', extraZip = false) {
  const root = mkdtempSync(join(tmpdir(), 'equinox-import-test-'));
  mkdirSync(join(root, 'runner')); const output = join(root, 'outputs'); writeFileSync(output, '');
  archive(join(root, 'EQUINOX-v1.3-GitHub-ready.zip'), values);
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
    expect(git('ls-remote', 'origin', 'refs/heads/main').split('\t')[0]).toBe(git('rev-parse', 'HEAD').trim());
  } finally { rmSync(r.root, { recursive: true }); }
});
