"""Create a unique, verified source handoff; BLOCKED never becomes release approval.
Usage: python scripts/package-v13.py /absolute/output [--allow-blocked]
"""
import hashlib
import json
from pathlib import Path
import os
import re
import subprocess
import sys
import tempfile
import textwrap
import zipfile

root = Path(__file__).resolve().parents[1]
output = Path(sys.argv[1]).resolve()
assert output != root and root not in output.parents, 'Output must be outside product source'
output.mkdir(parents=True, exist_ok=True)
package = json.loads((root / 'package.json').read_bytes())
lock = json.loads((root / 'package-lock.json').read_bytes())
version = package['version']
assert re.fullmatch(r'\d+\.\d+\.\d+', version)
assert version == lock['version'] == lock['packages']['']['version']
checks = json.loads((root / 'validation/final-checks.json').read_bytes())
assert checks['appVersion'] == version and checks['status'] in ('PASS', 'BLOCKED')
assert not any(c['status'] == 'FAIL' for c in checks['checks']), 'Cannot package failed correctness gates'
if checks['status'] == 'BLOCKED':
    assert '--allow-blocked' in sys.argv[2:], 'Blocked handoff requires explicit --allow-blocked; never deploy approval'
for name in ('final-frozen-audit', 'final-snapshot-replay', 'final-pwa', 'final-credential-scan'):
    assert json.loads((root / ('validation/' + name + '.json')).read_bytes())['status'] == 'PASS', name
exclude = {'.git', '.superpowers', 'node_modules', 'dist', 'test-results', 'playwright-report', '__pycache__', '.pytest_cache'}
paths = []
for path in sorted(root.rglob('*')):
    relative = path.relative_to(root)
    # Generated outputs are excluded only at the repository root. A public/dist
    # file is a real Vite input and must never disappear from source coverage.
    if relative.parts[0] in exclude:
        continue
    assert not path.is_symlink(), 'Do not package symlinks'
    if path.is_dir():
        continue
    assert path.is_file(), 'Do not package special files'
    if relative.as_posix() == 'RELEASE-MANIFEST.json':
        continue
    assert not any(part.startswith('.env') for part in relative.parts), 'Credential/environment file present'
    assert path.suffix.lower() not in ('.zip', '.local', '.log'), 'Unexpected local or nested artifact'
    paths.append(path)

def digest(body):
    return {'sha256': hashlib.sha256(body).hexdigest(), 'bytes': len(body)}

product, infrastructure = {}, {}
for path in paths:
    name = path.relative_to(root).as_posix()
    (infrastructure if name.startswith('.github/workflows/') else product)[name] = digest(path.read_bytes())
assert set(infrastructure) == {'.github/workflows/pages.yml', '.github/workflows/import-release.yml'}
baseline = json.loads((root / 'validation/final-baseline.json').read_bytes())
manifest = {
    'format': 'EQUINOX_RELEASE_MANIFEST_V3', 'appVersion': version,
    'engineVersion': '1.0.1', 'marketDataModelVersion': '1.1.2', 'snapshotSchemaVersions': [1, 2],
    'releaseStatus': 'BLOCKED' if checks['status'] == 'BLOCKED' else 'RELEASE CANDIDATE — IPHONE VALIDATION PENDING',
    'authoritativeBaseline': {'archive': baseline['inputArchive'], 'sha256': baseline['inputSHA256'], 'appVersion': baseline['inputAppVersion']},
    'entryCount': len(paths) + 1,
    'scope': 'Every archived regular file except this manifest; workflows hashed separately. No dist, dependencies, traces or financial exports.',
    'files': product,
    'repositoryInfrastructure': {'policy': 'PRESERVE_EXISTING_UPLOAD_SEPARATELY',
        'scope': 'Delivered workflow bytes must be uploaded separately before import. The source importer preserves repository workflows.', 'files': infrastructure},
    'evidence': ['validation/final-checks.json', 'validation/final-frozen-audit.json', 'validation/final-snapshot-replay.json', 'validation/final-pwa.json', 'validation/final-builds.json', 'validation/final-credential-scan.json'],
    'physicalIPhone': 'NOT TESTED', 'hostedDeployment': 'NOT TESTED',
    'currentRiskRefresh': 'TSM coverage through 2026-10-08 only; subsequent dates remain rejected. No live authenticated connectivity claim.',
}
manifest_path = root / 'RELEASE-MANIFEST.json'
manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
subprocess.run([sys.executable, str(root / 'scripts/check-release-source.py')], cwd=root, check=True)
paths.append(manifest_path)
content_id = hashlib.sha256(manifest_path.read_bytes()).hexdigest()[:16]
archive = output / f'EQUINOX-v{version}-hardened-{content_id}.zip'
with zipfile.ZipFile(archive, 'x', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for path in sorted(paths):
        info = zipfile.ZipInfo('EQUINOX/' + path.relative_to(root).as_posix(), date_time=(2026, 10, 12, 0, 0, 0))
        info.create_system = 3
        info.external_attr = 0o100644 << 16
        info.compress_type = zipfile.ZIP_DEFLATED
        z.writestr(info, path.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
# Re-open the completed ZIP. Check actual bytes against both manifest and source;
# this covers patched source, tests, docs, evidence and workflows, not only metadata.
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert len(z.namelist()) == len(set(z.namelist())) == len(paths) == manifest['entryCount']
    actual = json.loads(z.read('EQUINOX/RELEASE-MANIFEST.json'))
    assert actual == manifest
    expected = {**product, **infrastructure}
    assert set(z.namelist()) == {'EQUINOX/' + n for n in expected} | {'EQUINOX/RELEASE-MANIFEST.json'}
    for name, metadata in expected.items():
        body = z.read('EQUINOX/' + name)
        assert digest(body) == metadata and body == (root / name).read_bytes(), name
    archived_package = json.loads(z.read('EQUINOX/package.json'))
    archived_lock = json.loads(z.read('EQUINOX/package-lock.json'))
    assert archived_package['version'] == archived_lock['version'] == archived_lock['packages']['']['version'] == actual['appVersion'] == version
    assert re.findall(r'\bengine\s*:\s*["\x27]([^"\x27]+)["\x27]', z.read('EQUINOX/src/domain/core.ts').decode()) == ['1.0.1']
    assert re.findall(r'\bMARKET_DATA_MODEL_VERSION\s*=\s*["\x27]([^"\x27]+)["\x27]', z.read('EQUINOX/src/market-data/live/model.ts').decode()) == ['1.1.2']
    for name in ('pages.yml', 'import-release.yml'):
        target = output / name
        with target.open('xb') as f:
            f.write(z.read('EQUINOX/.github/workflows/' + name))
        assert target.read_bytes() == (root / '.github/workflows' / name).read_bytes()
# Execute the *delivered trusted workflow's* validator against the actual ZIP.
# It never executes any code from the archive and extracts only validated files.
workflow = (root / '.github/workflows/import-release.yml').read_text()
code = textwrap.dedent(workflow.split("          python - <<'PY'\n", 1)[1].split('\n          PY', 1)[0])
with tempfile.TemporaryDirectory(prefix='equinox-package-import-') as scratch:
    result = subprocess.run([sys.executable, '-c', code], cwd=output,
        env={**os.environ, 'RELEASE_ZIP': archive.name, 'RUNNER_TEMP': scratch, 'GITHUB_OUTPUT': str(Path(scratch) / 'output')},
        check=True, text=True, capture_output=True)
    extracted = Path(next(line[4:] for line in (Path(scratch) / 'output').read_text().splitlines() if line.startswith('src=')))
    for name in expected:
        assert (extracted / name).read_bytes() == (root / name).read_bytes(), name
    assert (extracted / 'RELEASE-MANIFEST.json').read_bytes() == manifest_path.read_bytes()
receipt = {'status': 'PASS', 'scope': 'Archive re-verification and delivered import validator, not browser/device release approval',
    'releaseStatus': manifest['releaseStatus'], 'archive': archive.name, **digest(archive.read_bytes()),
    'appVersion': version, 'engineVersion': '1.0.1', 'marketDataModelVersion': '1.1.2',
    'fileCount': len(paths), 'hashedFileCount': len(expected), 'crc': 'PASS', 'allBytesEqualToSource': True,
    'embeddedPagesEqualsStandalone': True, 'embeddedImporterEqualsStandalone': True, 'contentSafeRsync': '--checksum' in workflow,
    'actualZipImportValidator': 'PASS'}
with (output / 'ARCHIVE-VERIFICATION.json').open('x') as f:
    f.write(json.dumps(receipt, indent=2) + '\n')
for source, name in [('docs/final-hardening/report.md', 'EQUINOX-v1.3.2-FINAL-REPORT.md'), ('docs/iphone-checklist.md', 'IPHONE-VALIDATION.md')]:
    with (output / name).open('xb') as f:
        f.write((root / source).read_bytes())
print(json.dumps(receipt, indent=2))
