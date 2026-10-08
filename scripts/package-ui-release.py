"""Package only the current, checked UI release; no browser/device PASS inference."""
import argparse
import json
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

parser = argparse.ArgumentParser()
parser.add_argument("--status-only", action="store_true")
parser.add_argument("--check-only", action="store_true")
parser.add_argument("--target")
args = parser.parse_args()
root = Path.cwd()


def require(condition, message):
    if not condition:
        raise SystemExit(message)


def load(name):
    return json.loads((root / "validation" / name).read_text())


checks = load("ui-release-checks.json")
audit = load("ui-frozen-audit.json")
accessibility = load("ui-accessibility.json")
pwa = load("ui-pwa.json")
rebuild = load("reproducibility.json")
clean_build = load("ui-clean-build.json")
scan = load("credential-scan.json")
snapshots = load("ui-snapshot-compatibility.json")
browser = load("ui-browser-evidence.json")
reference = load("closure-final-independent-reference.json")
package = json.loads((root / "package.json").read_text())
require(package["version"] == audit["appVersion"] == "1.2.0", "Wrong App release")
expected_commands = [
    ["npm", "run", "lint"], ["npm", "run", "typecheck"], ["npm", "test"],
    ["npm", "run", "test:reference"], ["node", "scripts/check-final-risk.mjs"],
    ["python3", "reference/final-risk.py"],
    ["node", "scripts/check-ui-snapshots.mjs"],
    ["npm", "run", "build"], ["node", "scripts/check-ui-pwa.mjs"],
    ["node", "scripts/check-ui-accessibility.mjs"],
    ["node", "scripts/audit-ui-release.mjs"], ["node", "scripts/scan-release-secrets.mjs"],
]
require(checks["status"] == "PASS" and len(checks["steps"]) == len(expected_commands), "Missing final command evidence")
for step, command in zip(checks["steps"], expected_commands):
    require(step["command"][:len(command)] == command and step["exitCode"] == 0, "Final command failed or changed")
require("172 passed (172)" in checks["steps"][2]["output"], "Full 172-test suite evidence missing")
require(audit["status"] == "PASS" and len(audit["frozen"]) == 67 and all(f["identical"] for f in audit["frozen"]), "Frozen baseline differs")
for field in ["noDependencyChanges", "serviceWorkerLogicIdentical", "originalUIHandlersPreserved",
              "originalUIEffectsPreserved", "originalFormChangeHandlersPreserved", "originalBrowserCasesPreserved", "primaryBrandIdentical"]:
    require(audit[field], "Scope guard failed: " + field)
require(not audit["deleted"] and not audit["unexpectedChanges"] and not audit["unexpectedAdditions"], "Unreviewed source changes")
require(accessibility["status"] == "PASS" and all(c["pass"] for c in accessibility["colorChecks"]), "Static accessibility check failed")
require(pwa["status"] == "PASS" and pwa["noStaleBuildAssets"] and pwa["authRequestsNeverIntercepted"], "Static PWA/asset check failed")
require(rebuild["identicalLockfile"] and rebuild["identicalDist"] and not rebuild["differences"], "Separate clean rebuild differs")
require(clean_build["status"] == "PASS" and len(clean_build["commands"]) == 2
        and all(c["exitCode"] == 0 for c in clean_build["commands"]), "Missing actual independent install/build evidence")
require(scan["status"] == "PASS" and not scan["findings"], "Credential scan failed")
require(snapshots["status"] == "PASS" and snapshots["normalizedInputAndResultsIdentical"]
        and len(snapshots["snapshots"]) == 5 and all(s["replayed"] and s["sameBaselineResultAndHash"] for s in snapshots["snapshots"]), "Snapshot compatibility regression")
require(reference["status"] == "PASS" and reference["maxReturnDifference"] == 0
        and reference["maxCovarianceDifference"] < 1e-15, "Independent data reference failed")
require(browser["browserRuntime"] == "NOT TESTED" and browser["reason"] == "BROWSER_EXECUTABLE_PERMISSION_DENIED"
        and browser["applicationTestsExecuted"] == 0 and browser["providerRequestsExecuted"] == 0
        and "EACCES" in browser["output"] and browser["exitCode"] != 0, "Browser status/evidence misclassified")

excluded = {"node_modules", ".git", "dist", "validation", "test-results", "playwright-report", "__pycache__", "RELEASE-MANIFEST.json"}
source = {}
for directory, directories, filenames in root.walk():
    directories[:] = [name for name in directories if name not in excluded]
    for name in filenames:
        if name in excluded:
            continue
        path = directory / name
        require(not path.is_symlink(), "Symlink rejected")
        source[str(path.relative_to(root))] = path
require(set(source) == set(audit["sourceHashes"]), "Source file set changed after audit")
for name, path in source.items():
    require(sha256(path.read_bytes()).hexdigest() == audit["sourceHashes"][name], "Source changed after audit: " + name)
production = {str(p.relative_to(root / "dist")): p for p in (root / "dist").rglob("*") if p.is_file()}
require(set(production) == set(rebuild["distSHA256"]), "Production file set changed after rebuild")
for name, path in production.items():
    require(not path.is_symlink() and sha256(path.read_bytes()).hexdigest() == rebuild["distSHA256"][name], "Production changed after rebuild: " + name)

status = {
    "format": "EQUINOX_UI_RELEASE_STATUS_V1", "appVersion": "1.2.0", "engineVersion": "1.0.1",
    "marketDataModelVersion": "1.1.2", "snapshotSchemaVersions": [1, 2], "financialBackupSchemaVersion": 1,
    "verdict": "UI v1 — PASS WITH LIMITATIONS", "fullBrowserPWAReleaseAcceptance": False,
    "implementation": "COMPLETE — requested presentation scope; browser visual polish review pending",
    "mathematicalRegression": "PASS — frozen files, references and replay unchanged",
    "dataLayerRegression": "PASS — byte-identical accepted data semantics and identical risk/snapshot outputs",
    "acceptedDataIntegrationBaseline": "DATA-INTEGRATION PASS — v1.1.2 accepted historical window; no new live transport verification",
    "lint": "PASS", "typecheck": "PASS", "tests": "172/172 PASS", "pythonReferences": "PASS — both",
    "snapshots": "PASS — 5 exact baseline hashes/results replayed in Node",
    "productionBuild": "PASS", "cleanRebuild": "PASS — all " + str(len(production)) + " production files byte-identical",
    "staticAccessibility": "PASS — declared colors/source contracts; no full WCAG claim",
    "staticPWA": "PASS — manifest/icons and Node worker guards; no browser lifecycle claim",
    "credentialExclusion": "PASS — existing deterministic tests and source/artifact scan; browser cases NOT TESTED",
    "credentialStorage": "Client-side local browser storage; not cryptographically secure secret storage",
    "dependencyChanges": "NONE", "browserCasesPrepared": 24, "browserRuntime": "NOT TESTED", "browserCORS": "NOT TESTED",
    "browserReason": "EACCES before app assertions or provider requests", "safariWebKit": "NOT TESTED",
    "physicalIPhone": "NOT TESTED", "addToHomeScreen": "NOT TESTED", "standaloneSafeAreas": "NOT TESTED",
    "installedOfflineRuntime": "NOT TESTED", "installedServiceWorkerUpdate": "NOT TESTED", "hostedDeployment": "NOT TESTED",
    "automaticRiskRefreshUI": "NOT ACTIVATED — accepted baseline behavior preserved",
    "performanceRuntime": "NOT TESTED — sizes and animation architecture documented only",
    "remainingLimits": [
        "No rendered UI screenshot approval; run real mobile browser and device review.",
        "Run all 24 cases in each configured Chromium/WebKit project on a working runner.",
        "Verify deployed-origin provider auth/CORS using actual access; mocked UI tests are insufficient.",
        "Retrospective FX/final ADR and bounded TSM evidence limitations remain those of accepted 1.1.2.",
    ],
    "exactNextStep": "Run version-matched GitHub Pages verification, then the physical iPhone/deployed-origin gate in docs/ui-v1/device-release-gate.md",
    "evidence": ["validation/ui-release-checks.json", "validation/ui-frozen-audit.json", "validation/ui-snapshot-compatibility.json",
                 "validation/ui-accessibility.json", "validation/ui-pwa.json", "validation/ui-browser-evidence.json",
                 "validation/reproducibility.json", "validation/ui-clean-build.json", "validation/credential-scan.json",
                 "validation/closure-final-synchronized.json", "validation/closure-final-independent-reference.json"],
}
status_path = root / "validation/ui-release-status.json"
if args.check_only:
    print(json.dumps({"status": "PASS", "packaged": False, "sourceFiles": len(source), "productionFiles": len(production)}))
elif args.status_only:
    status["checkedAt"] = datetime.now(timezone.utc).isoformat()
    status_path.write_text(json.dumps(status, indent=2) + "\n")
    print(json.dumps({"status": "PASS", "statusRecorded": True, "packaged": False}))
else:
    secret_scan = load("ui-secret-scan.json")
    require(secret_scan["status"] == "PASS" and not secret_scan["findings"], "UI release report secret scan failed")
    recorded = json.loads(status_path.read_text())
    require(recorded.pop("checkedAt", None) is not None and recorded == status, "Record final release status before packaging")
    paths = set(source.values()) | set(production.values())
    paths.update(p for p in (root / "validation").rglob("*.json") if p.is_file())
    require(all(not p.is_symlink() for p in paths), "Unexpected release symlink")
    manifest = {str(p.relative_to(root)): {"sha256": sha256(p.read_bytes()).hexdigest(), "bytes": p.stat().st_size} for p in sorted(paths)}
    target = Path(args.target).resolve() if args.target else root.parent / "EQUINOX-v1.2.0.zip"
    require(target.name == "EQUINOX-v1.2.0.zip" and not target.exists() and target.parent.is_dir(), "Invalid target or refusing overwrite")
    with ZipFile(target, "x", compression=ZIP_DEFLATED, compresslevel=9) as archive:
        for path in sorted(paths):
            archive.write(path, "EQUINOX/" + str(path.relative_to(root)))
        archive.writestr("EQUINOX/RELEASE-MANIFEST.json", json.dumps({**recorded, "format": "EQUINOX_UI_RELEASE_V1", "files": manifest}, indent=2))
    with ZipFile(target) as archive:
        require(archive.testzip() is None, "ZIP CRC failure")
        require(set(archive.namelist()) == {"EQUINOX/" + name for name in manifest} | {"EQUINOX/RELEASE-MANIFEST.json"}, "ZIP manifest coverage differs")
        for name, meta in manifest.items():
            data = archive.read("EQUINOX/" + name)
            require(len(data) == meta["bytes"] and sha256(data).hexdigest() == meta["sha256"], "ZIP checksum differs: " + name)
    print(json.dumps({"file": str(target), "files": len(paths) + 1, "bytes": target.stat().st_size,
                      "sha256": sha256(target.read_bytes()).hexdigest(), "verdict": status["verdict"], "browserRuntime": "NOT TESTED"}, indent=2))
