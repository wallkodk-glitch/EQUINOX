# EQUINOX — PWA, SAFARI AND RUNTIME LIFECYCLE

This file describes the browser-runtime, installability, offline-shell,
service-worker, viewport, standalone-mode, and physical iPhone contract
for EQUINOX.

Use it for tasks involving Safari/WebKit, Home Screen installation,
service workers, cache/update lifecycle, offline startup, safe areas,
viewport/keyboard behavior, standalone mode, browser suspension,
force-close/reopen, or physical iPhone validation.

Do not use this file as a substitute for generated-artifact inspection,
browser execution, hosted-origin testing, or physical-device evidence.

## Runtime ownership

The PWA domain owns runtime behavior that exists between the built
application and the browser/device environment.

It includes:
- generated PWA manifest,
- generated service worker,
- service-worker registration,
- shell caching,
- update lifecycle,
- navigation fallback,
- offline startup,
- installability,
- standalone execution,
- viewport behavior,
- safe areas,
- browser lifecycle,
- physical iPhone runtime validation.

It does not own:
- financial mathematics,
- market-data semantics,
- persistence schema,
- financial snapshot identity,
- ordinary visual design,
- release packaging or GitHub deployment policy.

Read the owning domain when one of those contracts is involved.

## Runtime evidence gates

PWA claims must match the evidence actually executed.

Keep these gates distinct:
- STATIC SOURCE REVIEW
- GENERATED ARTIFACT CHECK
- SERVICE-WORKER VM / UNIT TEST
- CHROMIUM BROWSER
- WEBKIT BROWSER
- HOSTED HTTPS ORIGIN
- PHYSICAL IPHONE SAFARI
- INSTALLED PHYSICAL PWA

This list is not a single strength ranking. The gates prove different,
partly independent properties.

For material claims, record or identify:
- the artifact or revision,
- runtime/environment,
- mock-versus-real boundary,
- executed scope,
- PASS / FAIL / BLOCKED / NOT TESTED status.

Do not infer one gate from another.

Examples:

A correct manifest file does not prove successful Home Screen installation.

A service-worker VM test does not prove browser lifecycle behavior.

A WebKit automation pass does not prove physical iPhone safe-area behavior.

Safari browser-mode success does not prove installed standalone-PWA success.

Browser evidence is not installed-PWA evidence.

Installed-PWA evidence is not automatically evidence for every iOS or
device version.

## PWA build architecture

Primary source:
- `scripts/build-pwa.mjs`

The PWA artifacts are generated after the normal Vite production build.

Conceptually:

TYPECHECK
↓
VITE BUILD
↓
GENERATE RELEASE IDENTITY
↓
GENERATE MANIFEST
↓
HASH SHELL FILES
↓
GENERATE SERVICE WORKER
↓
PRODUCTION ARTIFACT

Do not create a competing static service worker or manifest merely because
those generated files are not present in the source `public/` directory.

Generated PWA artifacts have one canonical build path.

## Base-path contract

The deployed application uses one coherent base/scope boundary.

The effective relationship is:

VITE BASE PATH
=
MANIFEST ID
=
MANIFEST START URL
=
MANIFEST SCOPE
=
SERVICE-WORKER SCOPE
=
HOSTED APPLICATION PATH

Primary sources:
- `vite.config.ts`
- `scripts/build-pwa.mjs`

A mismatch may produce a successful JavaScript build while still creating
a broken install, navigation, asset, or service-worker runtime.

Do not diagnose a Pages/PWA path failure as an application logic problem
before verifying the complete base-path chain.

Read:
- `ai/release/README.md`

when the deployed origin/path or GitHub Pages artifact is involved.

## Manifest contract

The generated manifest defines the installable EQUINOX application shell.

Primary source:
- `scripts/build-pwa.mjs`

Related source:
- `index.html`
- `public/icon-192.png`
- `public/icon-512.png`
- `public/apple-touch-icon.png`

Preserve consistency between:
- application name,
- language,
- application identity,
- start URL,
- scope,
- display mode,
- theme/background colors,
- icon paths and dimensions.

Do not change manifest scope or start URL as a cosmetic cleanup.

Those fields affect runtime identity and navigation ownership.

## Standalone contract

The intended installed experience uses standalone display behavior.

Standalone mode is not equivalent to browser mode.

Differences may include:
- browser chrome,
- safe-area geometry,
- lifecycle,
- navigation behavior,
- storage behavior,
- update timing,
- viewport dimensions,
- keyboard behavior.

When a bug appears only after Add to Home Screen, investigate the
standalone runtime rather than assuming the same behavior as Safari tabs.

## Service-worker state model

Service-worker lifecycle states must remain distinct.

For an update waiting while the existing worker controls clients:

NEW WORKER DISCOVERED
↓
INSTALLING
↓
INSTALLED / WAITING
↓
USER APPROVES UPDATE
↓
ACTIVATING
↓
ACTIVE
↓
CLIENT CONTROLLED

Installed, waiting, active, and controlling are different states.

Do not use those terms interchangeably.

Do not assume a worker that installed successfully is already controlling
the current page.

This update path is not the first-install lifecycle. The first worker can
activate normally without an update prompt; a waiting worker can also activate
when no clients remain controlled by the old worker. The app does not interpose
an approval gate on those browser-managed transitions.

## User-approved update policy

EQUINOX requires approval before the app asks a waiting worker to replace the
shell of an open, controlled client.

A newly installed worker may wait.

The app must not force activation simply because a newer shell exists.

The user-facing update flow coordinates activation with current application
work.

Primary sources:
- `scripts/build-pwa.mjs`
- `src/ui/App.tsx`

Activation is requested through the explicit update message contract.

Do not add unconditional `skipWaiting()` during install unless the task
explicitly changes the update contract.

Automatic activation could replace the shell during an unfinished
financial, persistence, file, or provider operation.

## Update correctness lock

App update is a state transition, not an ordinary refresh button.

Before activating a waiting worker, preserve the current correctness
boundaries.

Do not activate a new shell across unfinished work such as:
- financial persistence,
- calculation,
- market-data request,
- risk-data commit,
- file restore/import,
- another approved update transition.

If pending durable writes exist, wait for the persistence boundary to
complete before activation.

These guards coordinate operations in the approving App instance. They are
not a cross-tab lock: approval in another client can activate the shared
worker while this client has work in progress. A client reloads on
`controllerchange` only after its own approval. Do not infer global client
quiescence or an all-tab persistence barrier from the local guards.

Read:
- `ai/persistence/README.md`
- `ai/ui/README.md`

when update activation interacts with durable or UI operation state.

## Service-worker shell ownership

The service worker owns the immutable application shell.

It does not own market-data caching or financial persistence.

Keep these domains separate:

SERVICE-WORKER SHELL CACHE
≠ MARKET-DATA CACHE
≠ INDEXEDDB FINANCIAL STATE
≠ CREDENTIAL STORAGE

Do not merge them merely because all are browser storage mechanisms.

Read:
- `ai/data/README.md`
- `ai/persistence/README.md`

for those other storage boundaries.

## Shell contents

The generated worker precaches the production shell selected by the PWA
builder.

The shell may include:
- production HTML,
- production JavaScript,
- production CSS,
- public images/icons,
- other explicitly generated static build assets.

Source maps and the worker itself are not ordinary precached shell assets.

Do not broaden the shell set casually.

Every added runtime-cached class changes:
- install behavior,
- integrity scope,
- cache size,
- offline semantics,
- update behavior.

## Immutable shell identity

The generated shell cache identity is derived from the production artifact.

Changing the built shell changes its cache identity.

Do not introduce a manually chosen long-lived cache version that can drift
from the actual production bytes.

Cache identity must remain tied to the shell that was built.

## Shell integrity

Shell installation uses integrity-bound requests for generated build files.

The worker requests current build bytes rather than silently trusting an
older HTTP cache entry.

A failed shell install must not become a partially trusted new shell.

If a newly created shell cache cannot be populated completely, installation
must fail and the incomplete new cache must not remain as accepted runtime
state.

Do not delete a valid pre-existing shell merely because another install
attempt failed.

Primary sources:
- `scripts/build-pwa.mjs`
- `tests/service-worker-security.test.ts`

## Fetch interception boundary

The service worker is intentionally conservative.

Do not intercept requests merely because they originate from the application.

The shell worker must not become a general HTTP cache.

Requests outside the shell contract must continue to the network/browser
normally.

Protected classes include as applicable:
- external origins,
- non-GET requests,
- authenticated requests,
- credential-bearing requests,
- query-bearing requests,
- unknown same-origin application/API requests.

Do not cache provider traffic through the shell worker.

Do not cache authorization material.

Do not allow an offline-shell optimization to change market-data semantics.

## Navigation fallback

Navigation within the owned application scope may use the cached application
shell when appropriate.

The fallback must stay within the configured application base/scope.

Do not turn the service worker into a catch-all origin-wide navigation
handler.

Do not serve the EQUINOX shell for unrelated paths outside its owned scope.

## Cache cleanup

After activation, obsolete EQUINOX shell caches may be removed.

Cleanup must remain scoped to caches owned by this PWA.

Do not delete:
- unrelated origin caches,
- market-data stores,
- IndexedDB financial state,
- credential storage,
- arbitrary browser storage.

A naming prefix is an ownership boundary, not merely a convenience.

## Offline capability classes

Offline is not one boolean capability.

Keep the following classes distinct.

### Offline shell

The application shell can launch without a network connection after a
successful prior installation/cache population.

### Local financial state

Previously committed local financial state and snapshots may remain
available through the persistence layer.

### Accepted historical data

Previously accepted local historical/risk data may remain available,
subject to its original data semantics.

### Local calculations

Operations whose required inputs are already local may continue to work
when their owning contracts permit it.

### Live provider access

Provider refresh, remote validation, and other live acquisition require
network/provider availability.

Offline shell availability is not proof that every application feature is
available offline.

Do not represent network-dependent features as live merely because the
application itself opened successfully.

## Offline truth

Offline state must remain visible where relevant.

Do not relabel stale or cached information as current merely because the
application can run offline.

Reconnect must not automatically imply:
- live prices confirmed,
- provider request succeeded,
- dataset refreshed,
- manual prices updated,
- risk state refreshed.

Network connectivity is transport availability, not data acceptance.

Read:
- `ai/data/README.md`

for freshness and provider truth.

## Online/reconnect behavior

Transitioning from offline to online may enable network operations again.

It must not silently mutate financial state simply because connectivity
returned.

A reconnect event is not permission for an automatic financial or
historical-data refresh unless an explicit product contract defines one.

Preserve the current manual-refresh behavior where applicable.

## iPhone viewport contract

Primary source:
- `index.html`

The application uses a mobile viewport designed for full-screen iPhone
layout.

Preserve the viewport contract required for edge-to-edge safe-area use.

Do not disable pinch zoom or text scaling as an overflow workaround.

Do not change viewport configuration casually to fix a single component.

First identify whether the root cause is:
- safe-area layout,
- component overflow,
- keyboard viewport,
- standalone geometry,
- browser chrome,
- text scaling.

## Safe areas

Primary sources:
- `src/ui/styles.css`
- `src/ui/browser-hardening.css`

Important controls and content must respect actual device safe areas.

Relevant edges include:
- top sensor/status area,
- left/right unsafe areas,
- bottom home-indicator region.

Use the existing safe-area strategy rather than hard-coded device pixels.

Safe-area CSS proves intent.

Only runtime/device observation proves the actual iPhone result.

Do not declare physical safe-area behavior PASS from source review or
desktop emulation alone.

## Edge-to-edge presentation

The application intentionally supports edge-to-edge iPhone presentation.

Do not remove `viewport-fit=cover` or safe-area handling merely to make
desktop browser screenshots simpler.

When changing edge-to-edge behavior, verify both:
- Safari browser mode,
- installed standalone mode.

They may expose different geometry.

## Bottom navigation

The fixed bottom navigation must remain reachable without colliding with
the device home-indicator region.

Content must retain sufficient bottom clearance so the final actionable
element is not hidden behind:
- navigation,
- safe-area inset,
- keyboard,
- modal sheet.

Do not fix a local overlap by globally adding arbitrary fixed pixel
padding without testing narrow and installed-PWA layouts.

## Keyboard and dynamic viewport

Keyboard-open behavior is a runtime concern.

Test relevant forms with the actual mobile keyboard when the change can
affect:
- numeric entry,
- focus,
- scrolling,
- sheets/dialogs,
- viewport height,
- bottom navigation,
- save/blur behavior.

`vh`, `svh`, and `dvh` are not semantically identical.

Preserve the current bounded/fallback strategy where used.

Do not assume desktop viewport resizing is complete evidence for iPhone
keyboard behavior.

## Numeric keyboard boundary

The PWA domain owns whether the actual mobile runtime allows the control to
remain usable with the keyboard visible.

It does not own the financial parsing contract.

Read:
- `ai/ui/README.md`

for invalid drafts, numeric commit semantics, and blur behavior.

A keyboard bug must not be "fixed" by weakening financial input validation.

## Launch lifecycle

Launch presentation and runtime readiness have separate ownership.

Conceptually:

LAUNCH PRESENTATION
→ UI

PERSISTENT STATE INITIALIZATION
→ persistence/runtime

SERVICE-WORKER REGISTRATION
→ PWA runtime

PHYSICAL COLD LAUNCH
→ device evidence

Do not lengthen the intro to hide slow or failed initialization.

Do not declare launch lifecycle correct merely because the intro animation
completed.

Primary sources:
- `src/ui/LaunchIntro.tsx`
- `src/ui/launch-state.ts`
- `src/ui/App.tsx`

## Reduced motion

Reduced-motion behavior must remain compatible with successful launch and
interaction.

A user preference for reduced motion must not:
- block startup,
- create a multi-second artificial delay,
- leave the application inert,
- prevent update or navigation controls.

Read:
- `ai/ui/README.md`

for presentation semantics.

## Suspension and resume

Mobile Safari and installed PWAs may be suspended and later resumed.

Do not assume:
- timers continued precisely,
- network requests stayed alive,
- React component lifetime means process lifetime,
- an in-memory flag survived termination.

On resume/reopen, durable truth must come from the proper durable stores and
domain contracts.

If an operation was interrupted, determine its actual committed state before
retrying.

Do not blindly repeat:
- persistence writes,
- restore operations,
- provider actions,
- update activation.

## Force-close and reopen

Force-close survival is a separate validation gate.

For important persistent data, validate the real sequence:

VALID EDIT
↓
DURABLE SAVE CONFIRMED
↓
FORCE-CLOSE INSTALLED PWA
↓
REOPEN
↓
STATE AND SNAPSHOT RETAINED

Passing IndexedDB unit tests is not physical force-close evidence.

Passing Playwright reload tests is not physical force-close evidence.

Read:
- `ai/persistence/README.md`

for durable-state semantics.

## Storage persistence request

Browser persistent-storage APIs may reduce normal eviction risk.

They do not replace backup.

Do not describe a granted persistence request as guaranteed permanent
storage.

Do not describe installed Home Screen status as guaranteed permanent
storage.

Local-first still requires:
- backup,
- recovery,
- validation,
- failure handling.

Read:
- `ai/persistence/README.md`

for financial backup and recovery.

## Installability

Installability depends on the complete deployed PWA environment.

Relevant conditions include:
- valid HTTPS origin,
- reachable manifest,
- correct manifest scope/start URL,
- usable icons,
- successful production shell,
- compatible browser/platform behavior.

Do not infer successful installation from generated files alone.

Physical installation must be tested on the target device when installation
behavior is part of the acceptance criteria.

## Icons and launch identity

Primary assets:
- `public/apple-touch-icon.png`
- `public/icon-192.png`
- `public/icon-512.png`

Do not change dimensions, paths, or manifest linkage without checking the
generated manifest and installed appearance.

A source asset existing in the repository is not proof that the installed
Home Screen icon uses it correctly.

## Safari/WebKit compatibility

The production build explicitly targets Safari compatibility.

Primary source:
- `vite.config.ts`

Do not assume that successful Chromium execution proves WebKit behavior.

When a change touches browser APIs, verify:
- syntax/runtime support,
- service-worker support,
- IndexedDB behavior,
- dialog/viewport behavior,
- CSS support

in the relevant WebKit environment.

Prefer progressive enhancement and explicit fallbacks when they reduce
runtime risk without adding unnecessary complexity.

## Physical iPhone gate

Canonical checklist:
- `docs/iphone-checklist.md`

Physical iPhone validation is required for claims involving actual:
- Add to Home Screen,
- standalone launch,
- safe areas,
- home indicator,
- keyboard,
- large text,
- force-close persistence,
- credential lifecycle,
- offline reopen,
- reconnect,
- restore/recovery,
- approved worker update.

Record the actual device/iOS/release context when treating device evidence
as a release gate.

An unexecuted device item is BLOCKED or NOT TESTED, not PASS.

## Provider behavior on deployed origin

Provider success from Node or mocked browser tests is not proof that the
deployed browser origin can access the provider.

When provider runtime behavior is involved, distinguish:
- parser correctness,
- Node/network probe,
- browser mock,
- deployed-origin CORS/auth/entitlement behavior,
- physical iPhone behavior.

Read:
- `ai/data/README.md`

for provider semantics.

Read:
- `ai/release/README.md`

for hosted-release evidence.

## PWA failure discipline

Do not:
- automatically activate waiting workers against the established policy,
- cache authenticated/provider requests in the shell worker,
- broaden service-worker scope without explicit review,
- claim offline support for network-dependent features,
- confuse browser and standalone behavior,
- treat safe-area CSS as physical-device proof,
- erase valid old shell caches after a failed new install,
- use a stale shell as though it were the new release,
- infer durable storage from installation alone,
- hide lifecycle failures behind launch animation,
- or claim iPhone PASS from emulation.

Runtime uncertainty must stay explicit.

## PWA evidence map

### Production base and browser target

Read:
- `vite.config.ts`
- `playwright.config.ts`

`vite.config.ts` owns production base/build targeting.
`playwright.config.ts` owns automated Chromium/WebKit project configuration;
it is not physical-device evidence.

### HTML/mobile install metadata

Read:
- `index.html`

### PWA generation

Read:
- `scripts/build-pwa.mjs`

### Runtime registration and update orchestration

Read:
- `src/ui/App.tsx`

### Safe areas and responsive runtime layout

Read:
- `src/ui/styles.css`
- `src/ui/browser-hardening.css`

### Launch lifecycle

Read:
- `src/ui/LaunchIntro.tsx`
- `src/ui/launch-state.ts`

### Static/generated PWA validation

Read:
- `scripts/check-ui-pwa.mjs`

### Service-worker regressions

Read:
- `tests/service-worker-security.test.ts`

### Browser runtime regressions

Shared interactive-readiness helper:
- `tests/browser/helpers.ts`

Normal browser flows should use the established interactive-readiness
boundary. Launch tests may intentionally observe the pre-interactive
transition instead.

Select as relevant:
- `tests/browser/app.spec.ts`
- `tests/browser/hardening.spec.ts`
- `tests/browser/launch.spec.ts`
- `tests/browser/ui.spec.ts`
- provider/browser tests when network behavior is involved.

`tests/browser/app.spec.ts` separates first shell installation/offline reload
from the waiting-worker approval flow. Keep both paths when changing updates.

### Physical iPhone validation

Read:
- `docs/iphone-checklist.md`

### Historical device/runtime documentation

Read when useful:
- `docs/ui-v1/device-release-gate.md`
- `docs/final-hardening/engineering-ledger.md`

Historical documents explain prior evidence and design decisions.
They do not automatically prove the current build or device state.

## PWA Change Gate

Before changing PWA/runtime behavior, classify the change.

### A — Shell or presentation change

Examples:
- icon update,
- manifest presentation metadata,
- safe-area styling,
- install copy,
- mobile layout adjustment.

Core cache/update/offline semantics remain unchanged.

Requirements:
- inspect generated artifact,
- preserve base/scope consistency,
- preserve accessibility,
- test relevant viewport/runtime behavior.

### B — Runtime-preserving PWA change

Examples:
- Safari compatibility hardening,
- safer lifecycle handling,
- shell-integrity improvement,
- viewport/keyboard fix,
- offline reliability improvement

while existing:
- service-worker ownership,
- update policy,
- scope,
- install identity,
- offline capability model

remain unchanged.

Requirements:
- identify the existing runtime contract,
- test generated worker behavior,
- run targeted Chromium/WebKit tests,
- verify no provider or financial storage boundary was widened,
- use device validation when the defect is device-specific.

### C — PWA contract change

This includes changes to:
- manifest ID,
- start URL,
- scope,
- service-worker scope,
- caching strategy,
- navigation fallback,
- offline coverage,
- activation/update policy,
- shell-cache ownership,
- persistent-storage behavior,
- standalone lifecycle assumptions,
- install identity.

Do not implement this as a routine UI or build cleanup.

A PWA contract change requires:
1. explicit task scope or decision,
2. old and new runtime semantics,
3. base/scope impact analysis,
4. offline impact analysis,
5. update/lifecycle analysis,
6. cache ownership review,
7. persistence/data boundary review,
8. generated-artifact validation,
9. Chromium and WebKit regression coverage,
10. hosted-origin validation where relevant,
11. physical iPhone validation when the change affects installed behavior.

## Cross-domain boundaries

Read `ai/ui/README.md` when:
- layout,
- navigation,
- focus,
- numeric input,
- launch presentation,
- reduced motion,
- status messaging

is the primary defect.

Read `ai/persistence/README.md` when:
- IndexedDB,
- durable saves,
- force-close retention,
- backup,
- restore,
- migration,
- recovery

is involved.

Read `ai/data/README.md` when:
- provider requests,
- freshness,
- cache truth,
- offline data status,
- reconnect behavior,
- CORS,
- credentials

is involved.

Read `ai/release/README.md` when:
- GitHub Pages path,
- deployed artifact,
- hosted smoke,
- release identity,
- packaging,
- workflow deployment

is involved.

Read `ai/math/README.md` only when a runtime symptom reveals a possible
mathematical/result defect.

Do not patch PWA/runtime behavior to hide a defect owned by another domain.
