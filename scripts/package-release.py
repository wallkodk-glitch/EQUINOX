"""Checksummed v1.1.2 data-layer release; never certify unexecuted browsers.

Run current final checks, clean-rebuild comparison and structural secret scan.
Use --status-only before the final scan, then package. --check-only checks gates
without writes. Native local-key browser acceptance and UI activation are separate.
"""
from pathlib import Path
from hashlib import sha256
from datetime import datetime, timezone
from zipfile import ZipFile, ZIP_DEFLATED
import argparse
import json


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("target", nargs="?")
mode = parser.add_mutually_exclusive_group()
mode.add_argument("--status-only", action="store_true")
mode.add_argument("--check-only", action="store_true")
args = parser.parse_args()


def load(name):
    return json.loads((root / "validation" / name).read_text())


checks = load("closure-final-checks.json")
audit = load("closure-final-audit.json")
rebuild = load("reproducibility.json")
cors = load("cors-probe.json")
scan = load("credential-scan.json")
raw = load("closure-final-provider-rows.json")
fx = load("closure-final-fx.json")
tsm = load("closure-final-tsm.json")
risk = load("closure-final-synchronized.json")
reference = load("closure-final-independent-reference.json")
snapshots = load("closure-final-snapshots.json")
app_version = json.loads((root / "package.json").read_text())["version"]
require(app_version == "1.1.2", "Gate scoped to audited v1.1.2 release")
require(audit["appVersion"] == app_version and audit["engineVersion"] == "1.0.1"
        and audit["marketDataModelVersion"] == "1.1.2"
        and audit["snapshotSchemaVersions"] == [1, 2], "Version/audit mismatch")
commands = [s["command"] for s in checks["steps"]]
require(len(commands) == 8 and commands[:7] == [
    ["npm", "run", "lint"], ["npm", "run", "typecheck"],
    ["npm", "run", "test:reference"], ["npm", "test"],
    ["npm", "run", "build"], ["node", "scripts/check-final-risk.mjs"],
    ["python3", "reference/final-risk.py"],
] and commands[7][:2] == ["node", "scripts/audit-final-closure.mjs"],
        "All current mandatory commands need actual execution evidence")
require(all(s["exitCode"] == 0 and s["startedAt"] and s["finishedAt"]
            for s in checks["steps"]), "Current final verification failed")
require("152 passed (152)" in checks["steps"][3]["output"], "Unexpected final test scope")
require(audit["status"] == "PASS" and all(audit[k] for k in [
    "frozenFilesIdentical", "kernelFilesIdentical", "snapshotNumericsUnchanged",
    "dataMathematicsUnchanged", "noDependencyChanges", "originalTestsPreserved",
]) and not audit["deleted"], "Frozen kernel/baseline regression")
require(rebuild["identicalLockfile"] and rebuild["identicalDist"]
        and not rebuild["differences"] and len(rebuild["distSHA256"]) == 11,
        "Clean rebuild must match exactly, with no stale assets")
require(scan["status"] == "PASS" and not scan["findings"], "Credential scan failed")

# EACCES at launch is NOT a provider rejection or browser PASS.
prior = load("release-checks.json")
browser = next((s for s in prior["steps"] if "test:browser" in s["command"]), None)
require(browser is not None and browser["exitCode"] != 0
        and "EACCES" in browser["output"] and "15 failed" in browser["output"],
        "Missing actual browser-permission evidence")
require(cors["status"] == "NOT TESTED"
        and cors["reason"] == "BROWSER_EXECUTABLE_PERMISSION_DENIED"
        and cors["launchFailures"] == 15
        and cors["browserApplicationTestsExecuted"] == 0
        and cors["probeRequestsExecuted"] == 0
        and checks["browserRuntime"] == "NOT TESTED",
        "Browser evidence must remain explicitly NOT TESTED")
require(raw["format"] == "EQUINOX_AUTHENTICATED_TYPED_PROVIDER_PROJECTION_V1"
        and raw["complete"] and raw["barsComplete"] and raw["corporateActionsComplete"]
        and len(raw["grid"]) == 253 and raw["totalPages"] == 33
        and raw["requested"]["adjusted"] is False
        and raw["originalNativeHTTPEnvelope"] == "NOT EXPOSED BY CONNECTOR",
        "Incomplete/misclassified actual provider evidence")
require(sum(s["rowsValidated"] for s in raw["summaries"]) == 1556366,
        "Unexpected actual full-row verification scope")
for instrument in ["GOOGL", "ISRG", "TSM", "BTC", "ETH"]:
    entry = raw["data"][instrument]
    require(len(entry["bars"]) == 253
            and all(p["invalidRows"] == 0 and p["nonmonotonicRows"] == 0
                    and p["uniqueTimestamps"] for p in entry["pages"]),
            "Provider numeric/schema/ordering gate failed")
for instrument in ["GOOGL", "ISRG", "TSM"]:
    require(raw["actions"][instrument]["complete"], "Incomplete corporate-action book")
require(fx["transport"] == "NODE_PUBLIC_FETCH" and len(fx["normalized"]) == 255,
        "Actual official historical FX missing")
require(tsm["status"] == "PASS" and tsm["final"]
        and tsm["exDividendDate"] == "2026-09-16" and tsm["ordinarySharesPerADR"] == 5
        and tsm["grossUSDPerADR"] == tsm["matchedMassiveOriginalCashAmount"] == 1.096251
        and tsm["netUSDPerADR"] == 0.866038 and tsm["withholdingPercentage"] == 21,
        "Final official TSM gross ADR evidence missing/mismatched")
require(risk["status"] == "PASS" and risk["coverage"] == 1
        and risk["alignedObservations"] == 253 and len(risk["returns"]) == 252
        and not risk["missingDates"] and risk["normalizedInput"]["schemaVersion"] == 2
        and risk["windowStart"] == "2025-10-03" and risk["windowEnd"] == "2026-10-06"
        and risk["fxPolicy"] == "NATIONALBANK_RETROSPECTIVE_DATE_ONLY_PREVIOUS_COPENHAGEN_DATE_MAX_6D_V1"
        and risk["frozenEngine"] == "1.0.1"
        and all(risk[k] for k in ["sameNormalizedInputSameOutput",
                                 "allThreeModelSnapshotsReplayed", "legacySnapshotReplayed"]),
        "Synchronized quality/replay/determinism gate failed")
require(reference["status"] == "PASS" and reference["returns"] == 252
        and reference["maxReturnDifference"] == 0
        and reference["maxCovarianceDifference"] < 1e-15,
        "Independent real-data reference failed")
require(set(snapshots) == {"equal", "inverse", "erc"}, "Missing actual model snapshots")
for model, sealed in snapshots.items():
    require(sealed["sha256"] == risk["snapshotHashes"][model]
            and sealed["snapshot"]["schemaVersion"] == 2
            and sealed["snapshot"]["versions"]["engine"] == "1.0.1",
            "Snapshot evidence/version mismatch")
require(risk["legacySnapshotSHA256"] ==
        "e491090dd7e2cf8a81bd33c23d67460158aab62bac455d2f177de25038c50891",
        "Legacy hash compatibility failed")

# Check the exact audited/rebuilt files, not just stale PASS booleans.
excluded = {"node_modules", ".git", "dist", "validation", "test-results", "__pycache__"}
source_files = {}
for directory, subdirs, filenames in root.walk():
    subdirs[:] = [p for p in subdirs if p not in excluded]
    for name in filenames:
        path = directory / name
        source_files[str(path.relative_to(root))] = path
require(set(source_files) == set(audit["sourceHashes"]), "Source set changed since audit")
for name, path in source_files.items():
    require(not path.is_symlink()
            and sha256(path.read_bytes()).hexdigest() == audit["sourceHashes"][name],
            "Source changed since audit: " + name)
dist_files = {str(p.relative_to(root / "dist")): p for p in (root / "dist").rglob("*") if p.is_file()}
require(set(dist_files) == set(rebuild["distSHA256"]), "Build file set changed after rebuild")
for name, path in dist_files.items():
    require(sha256(path.read_bytes()).hexdigest() == rebuild["distSHA256"][name],
            "Production artifact changed after rebuild")

status = {
    "format": "EQUINOX_FINAL_DATA_RELEASE_STATUS_V1", "appVersion": app_version,
    "engineVersion": "1.0.1", "marketDataModelVersion": "1.1.2",
    "snapshotSchemaVersions": [1, 2], "financialBackupSchemaVersion": 1,
    "dataIntegrationStatus": "DATA-INTEGRATION PASS",
    "releaseScope": "VERIFIED_252_RETURN_DATA_LAYER_PRE_UI",
    "riskWindow": {"from": risk["windowStart"], "to": risk["windowEnd"],
                   "observations": 253, "returns": 252, "coverage": 1,
                   "acquiredAt": raw["acquiredAt"]},
    "TSMEvidenceWindow": tsm["issuerEvidenceWindow"],
    "canonicalStockCryptoClose": "PASS", "corporateActions": "PASS",
    "historicalFXContract": "PASS — retrospective date-only, NOT point-in-time",
    "synchronizedBuilderAndQualityGate": "PASS — all-or-nothing",
    "automaticImportAPI": "IMPLEMENTED; unmocked local-key HTTP refresh NOT TESTED",
    "automaticImportUI": "NOT ACTIVATED — intentionally outside pre-UI scope",
    "authenticatedMassiveTransport": "PASS — configured connector typed public rows only",
    "nativeMassiveHTTPEnvelope": "NOT EXPOSED BY CONNECTOR; live native adapter NOT TESTED",
    "nationalbankPublicNodeHTTP": "PASS", "coinGeckoNativeBrowserHTTP": "NOT TESTED",
    "credentialSecurity": "Existing local-client tradeoff; not cryptographically secure secret storage",
    "credentialExclusion": "PASS — deterministic tests and structural scan; no real key supplied",
    "mathematicalRegression": "PASS — frozen Engine 1.0.1, no formula changes",
    "snapshotReplay": "PASS — schema 1 compatibility and deterministic schema 2",
    "lint": "PASS", "typecheck": "PASS", "tests": "152/152 PASS",
    "pythonReferences": "PASS — original goldens and independent real-data reference",
    "productionBuild": "PASS", "cleanRebuild": "PASS — 11 byte-identical files",
    "browserRuntime": "NOT TESTED", "browserCORS": "NOT TESTED",
    "browserReason": "EACCES at 15 launches; zero app assertions/provider requests",
    "safariWebKit": "NOT TESTED", "physicalIPhone": "NOT TESTED",
    "offlinePWARuntime": "NOT TESTED", "hostedDeployment": "NOT TESTED",
    "remainingLimits": [
        "Future/wider TSM periods fail closed outside official evidence; no ongoing certification.",
        "Retrospective FX/final ADR conversion is not historical intraday information availability.",
        "Run native HTTP/CORS and Chromium/WebKit/iPhone/Pages verification before UI activation.",
    ],
    "evidence": ["validation/closure-final-checks.json", "validation/closure-final-audit.json",
                 "validation/closure-final-provider-rows.json", "validation/closure-final-fx.json",
                 "validation/closure-final-tsm.json", "validation/closure-final-synchronized.json",
                 "validation/closure-final-snapshots.json", "validation/closure-final-independent-reference.json",
                 "validation/reproducibility.json", "validation/credential-scan.json", "validation/cors-probe.json"],
}
status_path = root / "validation/closure-final-status.json"
if args.check_only:
    print(json.dumps({"status": "PASS", "scope": status["releaseScope"], "writes": False}))
elif args.status_only:
    status["checkedAt"] = datetime.now(timezone.utc).isoformat()
    status_path.write_text(json.dumps(status, indent=2) + "\n")
    print(json.dumps({"status": "PASS", "statusFile": str(status_path), "packaged": False}))
else:
    recorded = json.loads(status_path.read_text())
    require(recorded.pop("checkedAt", None) is not None and recorded == status,
            "Record current status before the final structural scan/package")
    folders = ["src", "public", "reference", "scripts", "tests", "docs", "release", ".github", "dist"]
    files = ["README.md", ".gitignore", "package.json", "package-lock.json", "tsconfig.json",
             "vite.config.ts", "vitest.config.ts", "playwright.config.ts", "eslint.config.js", "index.html",
             "validation/release-checks.json", "validation/node-snapshot.json",
             "validation/reproducibility.json", "validation/v1.1-audit.json",
             "validation/cors-probe.json", "validation/credential-scan.json", "validation/critical-audit.json"]
    files.extend(str(p.relative_to(root)) for p in (root / "validation").glob("closure-*.json") if p.is_file())
    paths = [root / f for f in files]
    for folder in folders:
        paths.extend(p for p in (root / folder).rglob("*") if p.is_file() and "__pycache__" not in p.parts)
    require(all(p.is_file() and not p.is_symlink() for p in paths), "Missing/unexpected release file")
    paths = sorted(set(paths))
    manifest = {str(p.relative_to(root)): {"sha256": sha256(p.read_bytes()).hexdigest(),
                                         "bytes": p.stat().st_size} for p in paths}
    target = Path(args.target).resolve() if args.target else root.parent / f"EQUINOX-v{app_version}.zip"
    require(not target.exists() and target.parent.is_dir(), "Refusing to overwrite an existing artifact")
    with ZipFile(target, "x", compression=ZIP_DEFLATED, compresslevel=9) as archive:
        for p in paths:
            archive.write(p, "EQUINOX/" + str(p.relative_to(root)))
        archive.writestr("EQUINOX/RELEASE-MANIFEST.json", json.dumps({
            **recorded, "format": "EQUINOX_RELEASE_V2",
            "fullBrowserPWAReleaseAcceptance": False, "files": manifest,
        }, indent=2))
    with ZipFile(target) as archive:
        require(archive.testzip() is None, "ZIP integrity failure")
        require(set(archive.namelist()) == {"EQUINOX/" + name for name in manifest}
                | {"EQUINOX/RELEASE-MANIFEST.json"}, "Unexpected archive contents")
        for name, item in manifest.items():
            body = archive.read("EQUINOX/" + name)
            require(len(body) == item["bytes"] and sha256(body).hexdigest() == item["sha256"],
                    "Manifest verification failed")
    print(json.dumps({"file": str(target), "files": len(paths) + 1,
                      "bytes": target.stat().st_size,
                      "sha256": sha256(target.read_bytes()).hexdigest(),
                      "dataIntegrationStatus": recorded["dataIntegrationStatus"],
                      "browserRuntime": recorded["browserRuntime"]}, indent=2))
