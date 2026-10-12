"""Check the exact manifest-covered source before a release's validation mutates reports.
Integrity/consistency only: a self-contained manifest is not a signature of provenance.
"""
import hashlib
import json
from pathlib import Path, PurePosixPath
import re

root = Path(__file__).resolve().parents[1]

def unique(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('Duplicate JSON key: ' + key)
        result[key] = value
    return result

def read(path):
    return json.loads(path.read_bytes(), object_pairs_hook=unique,
                      parse_constant=lambda _: (_ for _ in ()).throw(ValueError('Non-finite JSON')))

m = read(root / 'RELEASE-MANIFEST.json')
assert m['format'] == 'EQUINOX_RELEASE_MANIFEST_V3'
assert m['repositoryInfrastructure']['policy'] == 'PRESERVE_EXISTING_UPLOAD_SEPARATELY'
product, infra = m['files'], m['repositoryInfrastructure']['files']
assert not product.keys() & infra.keys()
assert all(not n.startswith('.github/workflows/') for n in product)
assert all(n.startswith('.github/workflows/') for n in infra)
files = {**product, **infra}
assert m['entryCount'] == len(files) + 1
excluded = {'.git', '.superpowers', 'node_modules', 'dist', 'test-results', 'playwright-report', '__pycache__', '.pytest_cache'}
actual = set()
for path in root.rglob('*'):
    relative = path.relative_to(root)
    # Generated outputs are excluded only at the repository root. A public/dist
    # file is a real Vite input and must never disappear from source coverage.
    if relative.parts[0] in excluded:
        continue
    assert not path.is_symlink(), 'Source symlink: ' + relative.as_posix()
    if path.is_dir():
        continue
    assert path.is_file(), 'Source special file: ' + relative.as_posix()
    name = relative.as_posix()
    # Import intentionally preserves extra repository-owned workflows. They are
    # not delivered app build inputs; delivered workflow copies are still hashed.
    if name.startswith('.github/workflows/') and name not in infra:
        continue
    actual.add(name)
expected_files = set(files) | {'RELEASE-MANIFEST.json'}
assert not actual - expected_files, 'Unlisted source files: ' + ', '.join(sorted(actual - expected_files))
assert actual == expected_files, 'Missing source files: ' + ', '.join(sorted(expected_files - actual))
for name, expected in files.items():
    p = PurePosixPath(name)
    assert name and not p.is_absolute() and all(c not in ('', '.', '..') for c in name.split('/'))
    assert '\\' not in name and ':' not in name and all(ord(c) >= 32 and ord(c) != 127 for c in name)
    path = root / name
    assert not any(part.is_symlink() for part in [path, *path.parents])
    body = path.read_bytes()
    assert type(expected['bytes']) is int and len(body) == expected['bytes'], 'Byte count mismatch: ' + name
    assert hashlib.sha256(body).hexdigest() == expected['sha256'], 'Hash mismatch: ' + name
package, lock = read(root / 'package.json'), read(root / 'package-lock.json')
assert re.fullmatch(r'(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)', m['appVersion'])
assert package['name'] == lock['name'] == 'equinox'
assert m['appVersion'] == package['version'] == lock['version'] == lock['packages']['']['version']
engine = re.findall(r'\bengine\s*:\s*["\x27]([^"\x27]+)["\x27]', (root / 'src/domain/core.ts').read_text())
model = re.findall(r'\bMARKET_DATA_MODEL_VERSION\s*=\s*["\x27]([^"\x27]+)["\x27]', (root / 'src/market-data/live/model.ts').read_text())
assert engine == [m['engineVersion']] == ['1.0.1']
assert model == [m['marketDataModelVersion']] == ['1.1.2']
print(json.dumps({'status': 'PASS', 'scope': 'manifest-covered source bytes and versions', 'fileCount': len(files) + 1}))
