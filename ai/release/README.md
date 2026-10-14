# EQUINOX — RELEASE, CI AND DELIVERY

This file describes the artifact-identity, source-import, CI,
deployment, hosted-verification, and release-evidence contract for EQUINOX.

Use it for tasks involving release ZIPs, RELEASE-MANIFEST,
GitHub import workflows, GitHub Actions, GitHub Pages,
artifact integrity, build/deploy ordering, hosted smoke validation,
or release status.

Do not use this file as a substitute for current workflow source,
actual workflow runs, generated artifacts, hosted-byte evidence,
or physical iPhone/PWA validation.

## Release ownership

The release domain owns the transition from a working project candidate
to a verified deployed artifact.

It includes:
- release archive structure,
- release manifest coverage,
- source-byte identity,
- product versus repository-infrastructure boundaries,
- import validation,
- Git commit identity,
- CI validation order,
- production artifact construction,
- deployment,
- exact hosted-byte verification,
- release-status classification.

It does not own:
- financial mathematics,
- market-data semantics,
- persistence semantics,
- ordinary UI behavior,
- physical-device runtime behavior.

Read the owning domain when those contracts are involved.

## Release state machine

A release progresses through explicit states.

Do not collapse or skip them.

### Candidate

A project or ZIP exists.

It has not yet been trusted by the release pipeline.

Candidate status does not imply:
- manifest validity,
- complete source coverage,
- successful import,
- passing tests,
- build correctness,
- deployment,
- hosted identity,
- device validation.

### Verified archive

The archive has passed the importer’s archive-level checks.

This may include:
- safe path validation,
- ZIP structure checks,
- regular-file checks,
- complete manifest coverage,
- byte counts,
- SHA-256 verification,
- package/version consistency,
- frozen model identity checks,
- CRC validation.

Verified archive means the archive is internally consistent under the
declared release contract.

It does not mean application correctness has been proven.

### Imported

The verified product source has been synchronized into the repository
and committed to `main`.

Import success is not release success.

### Source verified

CI has verified that the repository source matches the manifest-covered
release identity before generating new validation evidence.

### Validated

All required validation gates for that release have passed.

The exact gate set depends on the release contract, but may include:
- lint,
- typecheck,
- independent mathematical references,
- unit/integration tests,
- synchronized-risk validation,
- snapshot replay,
- frozen-boundary checks,
- production build,
- Chromium browser tests,
- WebKit browser tests.

Do not call a source validated if required gates are blocked, skipped,
unexecuted, or failed.

### Built

The production deployment artifact has been generated from the validated
source for the intended deployment base path.

Build success is not deployment success.

### Deployed

GitHub Pages or another approved target has accepted the production artifact.

Deployment success is not hosted-byte identity.

### Hosted verified

The served files have been checked against the exact artifact produced
by the validated workflow run.

Hosted verification must bind the served application to the expected
release identity.

### Device verified

The required physical iPhone / installed-PWA gates have been executed
for the release and device context being claimed.

Browser validation is not physical-device validation.

Never promote a release candidate to a later state without evidence for
that state.

## Evidence terminology

Keep these concepts distinct:

ARCHIVE VERIFIED
≠ IMPORTED
≠ SOURCE VERIFIED
≠ TESTED
≠ BUILT
≠ DEPLOYED
≠ HOSTED VERIFIED
≠ PHYSICAL IPHONE VERIFIED

A lower-level PASS does not imply a higher-level PASS.

Blocked or unavailable validation is BLOCKED or NOT TESTED, not PASS.

## Working artifact versus GitHub source

During AI or local editing, the supplied working artifact may be the
authoritative candidate baseline for the task.

Do not ignore a supplied newer ZIP in favor of an older repository state.

Once that candidate has been successfully imported, the resulting GitHub
`main` commit becomes the release source identity used by CI.

Conceptually:

WORKING PROJECT / ZIP
↓
VALIDATED IMPORT
↓
GITHUB MAIN COMMIT
↓
VALIDATED RELEASE PIPELINE
↓
DEPLOYED ARTIFACT

Do not continue treating an older local candidate as authoritative after
a newer imported repository state exists.

## Release identity

Several identities coexist.

Keep them explicit.

### Archive identity

The release ZIP itself has byte identity.

A ZIP filename is not sufficient identity.

When archive identity matters, use its actual cryptographic digest.

### Source-file identity

Every release-covered regular source file has:
- relative path,
- byte count,
- SHA-256 digest.

Primary file:
- `RELEASE-MANIFEST.json`

### Application version

The application version must remain consistent across the declared
package and manifest boundaries.

Primary sources:
- `package.json`
- `package-lock.json`
- `RELEASE-MANIFEST.json`

Version equality is not byte identity.

Two artifacts can share a version string while containing different bytes.

### Mathematical/data model identity

Frozen or protected model identities are separate from app version.

Primary canonical sources include:
- `src/domain/core.ts`
- `src/market-data/live/model.ts`

Do not infer a model upgrade from an application version change.

Do not change frozen model identity as a packaging convenience.

### Git source identity

The imported repository commit SHA identifies the exact source state
validated by GitHub Actions.

### Built artifact identity

Generated production files have their own byte identity.

The production artifact must be associated with the source commit and app
version that produced it.

### Hosted identity

The deployed origin must serve the exact bytes expected from the validated
build.

HTTP availability alone is not hosted identity.

## Release manifest

Primary file:
- `RELEASE-MANIFEST.json`

The release manifest defines complete source coverage for the packaged
release contract.

Every included regular release file except the manifest itself must be
covered exactly once by the appropriate manifest domain.

Do not leave new source files unlisted.

Do not list files that are not actually present.

Do not accept hash or byte-count mismatch.

When files are added, removed, or changed, regenerate the manifest from the
actual candidate source.

The manifest must not be edited by hand to preserve stale hashes.

## Integrity versus provenance

Manifest hashes prove internal byte consistency.

They do not prove authorship, trust, or external provenance.

Integrity answers:

"Are these the bytes described by this manifest?"

Integrity does not answer:

"Who created these bytes?"
"Are these bytes semantically correct?"
"Was this code reviewed?"
"Should this artifact be trusted merely because it hashes correctly?"

Integrity is not provenance or authorship.

## Product source versus repository infrastructure

EQUINOX separates product source from repository execution authority.

Manifest domains:

PRODUCT SOURCE
→ normal release payload

REPOSITORY INFRASTRUCTURE
→ `.github/workflows/`

These domains must not overlap.

Primary source:
- `RELEASE-MANIFEST.json`

Primary import behavior:
- `.github/workflows/` is preserved during product-source synchronization.

A product ZIP must not silently replace repository execution authority.

Workflow changes are a separate reviewed release-infrastructure action.

Do not move workflows into ordinary product payload simply to simplify
packaging.

## Import workflow

Primary source:
- `.github/workflows/import-release.yml`

The importer validates the archive before repository mutation.

It must fail before extraction/import when the archive violates the
release contract.

Validation includes as applicable:
- exact safe ZIP selection,
- path safety,
- entry-count limits,
- expanded-size limits,
- duplicate-path rejection,
- symlink/special-file rejection,
- reserved-directory rejection,
- credential-file rejection,
- nested-ZIP rejection,
- source-root validation,
- required-file validation,
- manifest format validation,
- complete hash coverage,
- exact bytes and SHA-256 validation,
- package/lock/manifest version consistency,
- frozen Engine identity,
- frozen MarketDataModel identity,
- ZIP CRC validation.

Do not weaken an archive gate merely because a generated candidate fails it.

Fix the candidate or change the release contract explicitly.

## Safe extraction

Untrusted release code must not execute before validation.

Verified regular files are extracted into a runner-owned temporary
directory only after archive checks pass.

Do not execute scripts from the uploaded ZIP during archive validation.

Do not extract unsafe paths into the repository and validate afterward.

Validate first.

Mutate second.

## Exact source replacement

After validation, the product source is synchronized into the repository.

The current importer uses content-aware synchronization.

Source replacement must compare actual content when correctness depends on
exact bytes.

Do not remove checksum-based comparison merely as a performance optimization.

File size and modification time are not sufficient proof of byte identity.

## Stale-file removal

The imported product tree replaces the previous product tree.

A file absent from the validated new product source may need to be deleted.

Do not preserve stale product files automatically.

Stale source can:
- remain a build input,
- alter test scope,
- alter runtime output,
- invalidate manifest completeness,
- create ambiguous behavior.

Repository-owned workflow infrastructure is an explicit preservation
exception.

## Uploaded ZIP lifecycle

The uploaded release ZIP is a transport artifact.

It is not part of the installed source tree after successful import.

Do not retain old release ZIPs inside the product source merely for
convenience.

Do not nest previous release ZIPs inside new release ZIPs.

## Git safety

Import commits use normal non-force Git semantics.

A concurrent newer change on `main` must cause a safe push failure rather
than being overwritten.

Never force-push over a newer repository state to "finish" an import.

If repository state is uncertain:
1. inspect current `main`,
2. identify whether the prior import committed,
3. compare the intended candidate with the actual repository state,
4. only then retry or create a new candidate.

Do not blindly rerun a release write with unknown prior outcome.

## Import workflow versus validated release workflow

These are separate operations.

A successful import commit does not prove that the validated release
workflow ran.

The import workflow may create a commit using GitHub automation credentials
without causing the normal push-triggered release workflow to run.

Therefore:

IMPORT COMMIT EXISTS
≠
VALIDATED RELEASE RAN

Verify the actual validated-release workflow run for the imported commit.

## Source verification before new evidence

Primary source:
- `scripts/check-release-source.py`

The validated release pipeline verifies the exact manifest-covered source
before generating new validation outputs.

This prevents newly generated reports from masking source drift.

Do not generate fresh PASS evidence first and only afterward ask whether
the source being tested matches the intended release.

Source identity comes first.

## Complete source inventory

Source coverage must include the actual release-relevant file inventory.

Unlisted source/build inputs are release failures.

Generated local output such as:
- `dist/`,
- dependencies,
- temporary test output,
- caches

must remain outside source-manifest coverage unless the release contract
explicitly says otherwise.

A file under a normally generated-name directory can still be a real source
input if that directory exists inside a source-controlled path.

Do not exclude files based only on a path substring without understanding
their role.

## Validation pipeline

Primary source:
- `.github/workflows/pages.yml`

The release pipeline is ordered evidence.

Preserve the distinction between:

SOURCE VERIFICATION
↓
DEPENDENCY INSTALL
↓
LINT
↓
TYPECHECK
↓
INDEPENDENT REFERENCES
↓
UNIT / INTEGRATION TESTS
↓
RISK / SNAPSHOT / FROZEN-BOUNDARY GATES
↓
PRODUCTION BUILD
↓
CHROMIUM MOBILE
↓
WEBKIT MOBILE
↓
PAGES-SPECIFIC BUILD
↓
ARTIFACT CREATION
↓
DEPLOYMENT
↓
HOSTED BYTE VERIFICATION

Do not move deployment ahead of required release validation merely to
shorten pipeline duration.

Do not disable release-critical gates with `continue-on-error`.

Do not replace a failing test with a weaker gate unless the contract itself
is explicitly changed and justified.

## Dependency reproducibility

The validated release installs dependencies from the committed lockfile.

Do not remove or casually regenerate the lockfile during an unrelated
release change.

Dependency changes are source changes.

When dependency versions change, review:
- runtime impact,
- browser compatibility,
- build reproducibility,
- bundle output,
- security boundary,
- package-lock consistency.

## Frozen boundaries

Release validation may enforce frozen mathematical or data-model identities.

Do not update manifest identity or source constants merely to satisfy a
version mismatch.

First determine whether:
- the release candidate is wrong,
- the manifest is stale,
- or an explicit model-version change is intended.

A model-version change belongs to the owning domain before it becomes a
release change.

## Browser gates

Release browser validation includes separate mobile Chromium and WebKit
projects.

A Chromium PASS does not imply WebKit PASS.

A browser-install failure is not application-test success.

If browser execution is blocked before application assertions run, report
the browser gate as NOT TESTED or BLOCKED according to evidence.

Do not convert environment-launch failure into a passing browser result.

## Failure diagnostics

Failure artifacts are part of the release system.

When browser/runtime tests fail, preserve relevant diagnostics where the
pipeline is designed to do so.

Do not discard:
- browser JSON reports,
- test-results,
- traces/screenshots when configured,
- relevant generated validation evidence

merely because the release failed.

Failure evidence supports root-cause analysis.

## Production Pages build

The GitHub Pages build must use the repository's actual deployment base.

A successful generic production build does not prove a correct Pages build.

Read:
- `ai/pwa/README.md`

for manifest/service-worker/base-path semantics.

The release pipeline owns generating the final artifact for the real hosted
path.

## Build versus artifact

`npm run build` producing `dist/` is not itself a deployed release.

The deployment artifact must be created from the validated Pages-specific
build.

Do not substitute a stale local `dist/`.

Do not deploy an artifact from a different commit or earlier workflow run.

## Hosted proof artifact

Before deployment, the validated workflow records the expected hosted file
set and byte identities from that run's production build.

That proof binds:
- release identity,
- file paths,
- byte counts,
- SHA-256 hashes.

Do not regenerate expected hosted hashes from the already deployed site.

Expected identity must come from the validated build, not from the thing
being verified.

## Deployment

Deployment publishes the artifact produced by the validated workflow.

Deployment acceptance alone is not proof that the expected bytes are
actually being served.

Do not mark release verification complete immediately after the deploy
action returns success.

Proceed to hosted verification.

## Hosted smoke

The hosted smoke verifies the actual served deployment against the exact
proof artifact produced by the same validated run.

Primary source:
- `.github/workflows/pages.yml`

It verifies as applicable:
- expected app version,
- expected Git source revision,
- required shell files,
- exact byte counts,
- SHA-256 hashes,
- release identity,
- manifest standalone identity,
- manifest scope,
- manifest start URL,
- manifest ID,
- expected service-worker/update contract.

HTTP success is not deployment identity.

A deployment is verified only when the hosted bytes match the artifact
produced by the validated run.

## Cache-busting hosted verification

Hosted verification may add a revision query to fetch the current served
bytes.

That query exists for verification transport.

It must not alter the release identity being checked.

Do not confuse the verification URL with the application's canonical
manifest/start URL.

## Historical status metadata

Release packages and documentation may contain status captured at package
creation time.

That status is historical evidence.

It does not automatically define current release truth after later CI,
deployment, hosted verification, or device validation.

Do not retroactively rewrite an old package's manifest merely because a
later validation state changed.

Package-time status is historical evidence, not automatically current
release truth.

Current status must be derived from the evidence for the actual release
identity being discussed.

## Release-status claims

When reporting release status, identify the evidence scope.

Examples:

"Archive verified"
"Imported to commit <sha>"
"Validated release workflow PASS"
"Chromium PASS"
"WebKit PASS"
"Pages deployed"
"Hosted byte verification PASS"
"Physical iPhone gate not yet executed"

Avoid vague statements such as:
- "everything is green",
- "fully released",
- "production ready"

unless the required gates for that claim are actually complete.

## Physical iPhone boundary

GitHub release validation cannot substitute for physical iPhone testing.

Read:
- `ai/pwa/README.md`
- `docs/iphone-checklist.md`

for device-specific gates.

A release may be:

HOSTED VERIFIED
but
PHYSICAL IPHONE NOT YET VERIFIED

That is a valid, explicit release state.

Do not relabel it as fully device-validated.

## One-ZIP mobile workflow

The supported mobile workflow keeps the product handoff simple:

AI / WORKING PROJECT
↓
ONE RELEASE ZIP
↓
UPLOAD TO REPOSITORY ROOT
↓
RUN SAFE IMPORT
↓
IMPORT COMMIT ON MAIN
↓
RUN VALIDATED RELEASE
↓
DEPLOY / HOSTED VERIFY
↓
IPHONE GATES

Do not require manual assembly of large source patches when a complete
release artifact can preserve the established mobile workflow.

GitHub remains the durable source after successful import.

## AI knowledge files in release packages

The AI navigation layer is product source.

Files such as:
- `AGENTS.md`
- `ai/README.md`
- `ai/system/README.md`
- `ai/math/README.md`
- `ai/data/README.md`
- `ai/persistence/README.md`
- `ai/ui/README.md`
- `ai/pwa/README.md`
- `ai/release/README.md`

must follow the same manifest-coverage rules as other product source.

When these files are added or changed:
- include their exact bytes in the release source,
- include them in manifest coverage,
- regenerate hashes and byte counts,
- keep them outside repository-infrastructure ownership,
- validate them through the normal source gate.

Do not bypass release integrity merely because a file is documentation or
AI guidance.

## Workflow changes

Workflow changes are repository-infrastructure changes.

They are not ordinary product-source changes.

When `.github/workflows/` changes:
- review the actual workflow semantics,
- update the infrastructure hashes in the release contract where required,
- install the workflow through the explicit repository-infrastructure path,
- do not rely on ordinary product rsync to replace it.

A release ZIP may describe reviewed workflow bytes for integrity purposes,
but product import must not silently install new execution authority.

## Release evidence map

### Release manifest

Read:
- `RELEASE-MANIFEST.json`

### Source identity gate

Read:
- `scripts/check-release-source.py`

### Current local verification and packaging

Start with:
- `README.md`
- `scripts/verify.mjs`
- `scripts/validate-v13.mjs`
- `scripts/package-v13.py`

`README.md` is the current command router for the v1.3.x local verification
and packaging flow.

Treat these older packagers as historical release tooling unless a task
explicitly targets their archived release line:
- `scripts/package-release.py`
- `scripts/package-ui-release.py`

Do not choose a historical packager merely because its filename is generic.

### Import pipeline

Read:
- `.github/workflows/import-release.yml`

### Validated release / Pages pipeline

Read:
- `.github/workflows/pages.yml`

### Import security and replacement regressions

Read:
- `tests/release-import.test.ts`

### Complete source coverage

Read:
- `tests/release-source.test.ts`

### Hosted identity regression

Read:
- `tests/hosted-release.test.ts`

This runs the workflow verifier against fixture responses via a mocked `curl`.
It is TEST evidence for stale-byte rejection, not execution against a deployed
HTTPS origin. Actual hosted evidence comes from the deployment workflow run.

### Mobile release procedure

Read:
- `docs/mobile-release.md`

### Historical release evidence

Read as relevant:
- `docs/final-hardening/report.md`
- `docs/final-hardening/engineering-ledger.md`
- `docs/final-hardening/CHANGELOG.md`

Historical documents explain prior state and root causes.
They do not automatically define the current release status.

### Device release evidence

Read:
- `docs/iphone-checklist.md`

## Release Change Gate

Before changing release or delivery code, classify the change.

### A — Documentation or release-metadata change

Examples:
- release instructions,
- evidence indexing,
- non-executable release documentation,
- AI release guidance.

No archive, import, trust, CI, build, deploy, or hosted-verification
semantics change.

Requirements:
- preserve factual status/evidence scope,
- avoid stale release claims,
- update manifest coverage when packaged source changes.

### B — Pipeline-preserving release change

Examples:
- validator hardening,
- improved diagnostics,
- additional reproducibility checks,
- safer error handling,
- implementation improvement

while preserving:
- archive trust model,
- manifest semantics,
- infrastructure boundary,
- source replacement semantics,
- required release gates,
- artifact identity,
- deployment ordering.

Requirements:
- identify the preserved release contract,
- test failure paths,
- verify exact source/artifact identity behavior,
- preserve fail-closed behavior,
- preserve diagnostics.

### C — Release contract change

This includes changes to:
- archive format,
- manifest format,
- source inventory rules,
- hash coverage,
- product/infrastructure security boundary,
- import validation,
- source replacement semantics,
- Git source-of-truth flow,
- required CI gates,
- browser gate policy,
- artifact construction,
- deployment ordering,
- hosted byte verification,
- release-state definitions.

Do not implement this as a routine workflow cleanup.

A release-contract change requires:
1. explicit task scope or decision,
2. old and new trust model,
3. threat/failure analysis,
4. backward/upgrade compatibility review,
5. importer regression coverage,
6. source-inventory coverage review,
7. CI ordering review,
8. artifact identity review,
9. deployment/hosted-verification review,
10. mobile workflow impact review,
11. recovery plan for interrupted or partially completed releases.

## Failure recovery

After timeout, cancellation, network failure, or uncertain workflow outcome:

1. inspect the actual repository state,
2. inspect the relevant workflow run,
3. determine whether a commit/deployment occurred,
4. compare actual source identity with the intended candidate,
5. retry only from the verified current state.

Do not blindly repeat:
- import commits,
- workflow installation,
- release packaging,
- deploys,
- destructive source replacement.

Unknown outcome is not equivalent to failure-before-write.

## Cross-domain boundaries

Read `ai/math/README.md` when:
- frozen mathematical identity,
- reference validation,
- engine outputs,
- model versioning

is involved.

Read `ai/data/README.md` when:
- MarketDataModel identity,
- synchronized risk evidence,
- provider validation,
- data-contract versioning

is involved.

Read `ai/persistence/README.md` when:
- backup compatibility,
- migration evidence,
- snapshot replay,
- durable-state release gates

is involved.

Read `ai/ui/README.md` when:
- the deployed UI differs from intended presentation or workflow behavior.

Read `ai/pwa/README.md` when:
- Pages base path,
- manifest,
- service worker,
- offline behavior,
- installed-PWA update,
- physical iPhone validation

is involved.

Do not patch the release pipeline to hide a defect owned by another domain.
