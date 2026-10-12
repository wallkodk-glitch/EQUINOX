import { it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

it.each([null, 'vite.config.js', 'public/stale.js', 'public/dist/stale.js', 'public/test-results/stale.js', '.env.local'] as const)('source gate verifies complete source inventory: %s', extra => {
  const root = mkdtempSync(join(tmpdir(), 'equinox-source-gate-'));
  try {
    const files: Record<string, string> = {
      'package.json': JSON.stringify({ name: 'equinox', version: '1.3.2' }),
      'package-lock.json': JSON.stringify({ name: 'equinox', version: '1.3.2', packages: { '': { version: '1.3.2' } } }),
      'src/domain/core.ts': 'export const VERSIONS = { engine: "1.0.1" };',
      'src/market-data/live/model.ts': 'export const MARKET_DATA_MODEL_VERSION = "1.1.2";',
      'scripts/check-release-source.py': readFileSync('scripts/check-release-source.py', 'utf8'),
      '.github/workflows/pages.yml': 'fixture', '.github/workflows/import-release.yml': 'fixture',
    };
    const write = (name: string, text: string) => { mkdirSync(dirname(join(root, name)), { recursive: true }); writeFileSync(join(root, name), text); };
    Object.entries(files).forEach(([name, body]) => write(name, body));
    const digest = (body: string) => ({ bytes: Buffer.byteLength(body), sha256: createHash('sha256').update(body).digest('hex') });
    write('RELEASE-MANIFEST.json', JSON.stringify({ format: 'EQUINOX_RELEASE_MANIFEST_V3', appVersion: '1.3.2', engineVersion: '1.0.1', marketDataModelVersion: '1.1.2', entryCount: Object.keys(files).length + 1,
      files: Object.fromEntries(Object.entries(files).filter(([name]) => !name.startsWith('.github/')).map(([name, body]) => [name, digest(body)])),
      repositoryInfrastructure: { policy: 'PRESERVE_EXISTING_UPLOAD_SEPARATELY', files: Object.fromEntries(Object.entries(files).filter(([name]) => name.startsWith('.github/')).map(([name, body]) => [name, digest(body)])) } }));
    if (extra) write(extra, 'unlisted build input');
    // Local outputs are not delivered source. Extra repository-owned workflows
    // are preserved by import and deliberately outside delivered infrastructure.
    write('dist/index.html', 'generated'); write('node_modules/local.js', 'dependency'); write('.github/workflows/repository-owned.yml', 'preserved');
    const result = spawnSync('python3', ['scripts/check-release-source.py'], { cwd: root, encoding: 'utf8' });
    if (extra) { expect(result.status).not.toBe(0); expect(result.stderr).toContain('Unlisted source files'); }
    else expect(result.status, result.stderr).toBe(0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
