import { it, expect } from 'vitest';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

it.each([null, 'index.html', 'sw.js', 'assets/current.js'] as const)('hosted smoke binds every served shell byte to this run, stale=%s', stale => {
  const root = mkdtempSync(join(tmpdir(), 'equinox-hosted-gate-'));
  try {
    const workflow = readFileSync('.github/workflows/pages.yml', 'utf8');
    const block = workflow.slice(workflow.indexOf('      - name: Hosted smoke'));
    const code = /          python3 - <<'PYCODE'\n([\s\S]*?)\n          PYCODE/.exec(block)![1].split('\n').map(line => line.slice(10)).join('\n');
    const release = { appVersion: '1.3.2', sourceRevision: 'a'.repeat(40) };
    const bodies: Record<string, string> = {
      'release.json': JSON.stringify(release),
      'index.html': '<title>EQUINOX</title><script src="/EQUINOX/assets/current.js"></script>',
      'sw.js': '/* EQUINOX ACTIVATE_UPDATE current worker */',
      'assets/current.js': 'current application bytes',
      'manifest.webmanifest': JSON.stringify({ name: 'EQUINOX', display: 'standalone', id: '/EQUINOX/', scope: '/EQUINOX/', start_url: '/EQUINOX/' }),
    };
    mkdirSync(join(root, 'expected-release')); mkdirSync(join(root, 'bin'));
    writeFileSync(join(root, 'expected-release/ci-hosted-manifest.json'), JSON.stringify({ release,
      files: Object.fromEntries(Object.entries(bodies).map(([name, text]) => [name, { sha256: createHash('sha256').update(text).digest('hex'), bytes: Buffer.byteLength(text) }])) }));
    if (stale) bodies[stale] = stale === 'index.html' ? '<title>EQUINOX old app</title>' : '/* EQUINOX ACTIVATE_UPDATE stale bytes */';
    writeFileSync(join(root, 'responses.json'), JSON.stringify(bodies));
    writeFileSync(join(root, 'bin/curl'), '#!/usr/bin/env python3\nimport json,os,sys,urllib.parse\nname=urllib.parse.urlsplit(sys.argv[-1]).path.removeprefix("/EQUINOX/")\nsys.stdout.write(json.load(open(os.environ["FIXTURE_RESPONSES"]))[name])\n', { mode: 0o755 });
    const result = spawnSync('python3', ['-c', code], { cwd: root, encoding: 'utf8', env: { ...process.env, PATH: join(root, 'bin') + ':' + process.env.PATH,
      FIXTURE_RESPONSES: join(root, 'responses.json'), EXPECTED_SHA: release.sourceRevision, EXPECTED_VERSION: release.appVersion, DEPLOY_URL: 'https://example.invalid/EQUINOX/' } });
    if (stale) { expect(result.status).not.toBe(0); expect(result.stderr).toContain('Hosted bytes mismatch: ' + stale); }
    else expect(result.status, result.stderr).toBe(0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
