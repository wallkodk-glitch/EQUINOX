"""Deterministic GitHub source package; never includes installed dependencies,
browser traces, financial exports, credentials or a stale production dist.
Manifest product hashes and preserved workflow infrastructure are separate.
"""
import hashlib
import json
from pathlib import Path
import shutil
import sys
import zipfile

root = Path(__file__).resolve().parents[1]
output = Path(sys.argv[1]).resolve()
assert output != root and root not in output.parents, 'Output must be outside product source'
output.mkdir(parents=True, exist_ok=True)
exclude = {'.git', 'node_modules', 'dist', 'test-results', 'playwright-report', '__pycache__', '.pytest_cache'}
paths = []
for path in sorted(root.rglob('*')):
    relative = path.relative_to(root)
    if any(part in exclude for part in relative.parts):
        continue
    assert not path.is_symlink(), 'Do not package symlinks'
    if not path.is_file() or relative.as_posix() == 'RELEASE-MANIFEST.json':
        continue
    assert not any(part.startswith('.env') for part in relative.parts), 'Credential/environment file present'
    assert path.suffix.lower() != '.zip', 'Nested release archive present'
    paths.append(path)
package = json.loads((root / 'package.json').read_text())
checks = json.loads((root / 'validation/v1.3-checks.json').read_text())
assert package['version'] == '1.3.1'
assert checks['status'] in ('PASS WITH LIMITATIONS', 'LOCAL GATES PASS')
assert not any(check['status'] == 'FAIL' for check in checks['checks'])
assert json.loads((root / 'validation/v1.3-frozen-audit.json').read_text())['status'] == 'PASS'
assert json.loads((root / 'validation/v1.3-snapshot-replay.json').read_text())['status'] == 'PASS'

def digest(path):
    data = path.read_bytes()
    return {'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)}

product, infrastructure = {}, {}
for path in paths:
    name = path.relative_to(root).as_posix()
    (infrastructure if name.startswith('.github/workflows/') else product)[name] = digest(path)
manifest = {
    'format': 'EQUINOX_RELEASE_MANIFEST_V3', 'appVersion': '1.3.1',
    'engineVersion': '1.0.1', 'marketDataModelVersion': '1.1.2',
    'snapshotSchemaVersions': [1, 2], 'releaseStatus': 'RELEASE CANDIDATE — PASS WITH LIMITATIONS',
    'authoritativeBaseline': {'head': '9deaef0e207615cded6fb2f961133ee3f11bbd2a',
                              'tree': '8f46a030b6058800601566509dd833778c3c6897'},
    'scope': 'Complete archive product payload; excludes this manifest itself and infrastructure. No dist/node_modules/traces/financial backups/secrets.',
    'files': product,
    'repositoryInfrastructure': {'policy': 'PRESERVE_EXISTING_UPLOAD_SEPARATELY',
        'scope': 'Hashes of delivered workflow bytes only; importer intentionally preserves repository-owned workflows. Upload these separately.',
        'files': infrastructure},
    'evidence': ['validation/v1.3-checks.json', 'validation/v1.3-frozen-audit.json',
                 'validation/v1.3-snapshot-replay.json', 'validation/v1.3-builds.json',
                 'validation/v1.3-credential-scan.json', 'validation/v1.3-tsm-evidence-renewal.json',
                 'validation/v1.3-tsm-renewal-checks.json'],
    'browserRuntime': 'NOT TESTED in this environment; actual GitHub browser gates required',
    'physicalIPhone': 'PENDING', 'hostedDeployment': 'PENDING',
    'currentRiskRefresh': 'TSM evidence renewed through 2026-10-08 only; later/wider history FAIL CLOSED. Real authenticated refresh NOT TESTED.',
}
manifest_path = root / 'RELEASE-MANIFEST.json'
manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
paths.append(manifest_path)
archive = output / 'EQUINOX-v1.3-GitHub-ready.zip'
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for path in sorted(paths):
        info = zipfile.ZipInfo('EQUINOX/' + path.relative_to(root).as_posix(), date_time=(2026, 10, 9, 0, 0, 0))
        info.create_system = 3
        info.external_attr = 0o100644 << 16
        info.compress_type = zipfile.ZIP_DEFLATED
        z.writestr(info, path.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert len(z.namelist()) == len(set(z.namelist())) == len(paths)
    expected = {**product, **infrastructure}
    assert set(z.namelist()) == {'EQUINOX/' + name for name in expected} | {'EQUINOX/RELEASE-MANIFEST.json'}
    for name, metadata in expected.items():
        data = z.read('EQUINOX/' + name)
        assert hashlib.sha256(data).hexdigest() == metadata['sha256'] and len(data) == metadata['bytes']
for source, name in [('.github/workflows/pages.yml', 'pages.yml'), ('.github/workflows/import-release.yml', 'import-release.yml'),
                     ('docs/v1.3/EQUINOX-v1.3-CHANGELOG.md', 'EQUINOX-v1.3-CHANGELOG.md'),
                     ('docs/v1.3/EQUINOX-v1.3-VALIDATION.md', 'EQUINOX-v1.3-VALIDATION.md')]:
    target = output / name
    shutil.copyfile(root / source, target)
    assert target.read_bytes() == (root / source).read_bytes()
print(json.dumps({'status': 'PACKAGE STRUCTURE / HASHES PASS', 'files': len(paths),
                  'product': len(product), 'infrastructure': len(infrastructure),
                  'archive': str(archive), **digest(archive)}, indent=2))
