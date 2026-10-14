# EQUINOX — UI, PRESENTATION AND INTERACTION

This file describes the presentation, interaction, UI-state,
accessibility, and orchestration contract for EQUINOX.

Use it for tasks involving React components, navigation, forms,
numeric input, snapshot presentation, financial formatting,
accessibility, responsive behavior, visual design, or user workflows.

Do not use this file as a substitute for domain source, browser evidence,
or the owning math, data, persistence, or PWA contracts.

## UI ownership

The UI may orchestrate domain operations.

The UI must not redefine their semantics.

`src/ui/App.tsx` is a composition and workflow layer.
Its access to persistence, calculations, snapshots, market data,
and service-worker state does not make it the owner of those domains.

Do not reimplement:
- mathematical rules,
- market-data acceptance rules,
- persistence semantics,
- snapshot identity,
- service-worker lifecycle,
- or release behavior

inside presentation code merely because the required values are available there.

## UI state classes

Several state classes coexist in the application.

They must remain distinct.

### Persistent editable state

The user's current financial application state intended to survive reload.

Examples include:
- holdings,
- manual DKK prices,
- cost basis,
- capital,
- model selection,
- policy,
- execution rules,
- accepted historical dataset,
- theme.

Primary ownership:
- persistence/domain state

UI may edit and display this state.

### Transient draft state

Temporary interaction state that exists while a user is editing.

Examples include:
- the text currently typed into a numeric field,
- an invalid partial draft,
- a focused field's local text,
- temporary dialog state,
- local control selection.

Transient drafts are UI state, not financial state.

Do not persist invalid drafts.

Do not treat what the user is currently typing as accepted domain state
until it satisfies the field contract.

### Demo state

Demo state is isolated synthetic state.

It is not personal financial state.

Demo edits, calculations, and snapshots must not mutate:
- persistent holdings,
- persistent capital,
- saved snapshots,
- accepted personal datasets,
- backups,
- recovery state.

Demo must remain observationally incapable of mutating personal
persistent state.

### Sealed snapshot state

A sealed snapshot is immutable historical calculation evidence.

It may be displayed alongside newer editable state.

Changed current input invalidates applicability, not historical identity.

Do not rewrite or visually merge a historical snapshot with newer
current financial inputs.

If current inputs no longer match the selected snapshot, show that
relationship explicitly.

### Derived presentation state

Presentation-only values include:
- formatted DKK strings,
- percentage strings,
- freshness labels,
- visual positions,
- chart domains,
- status labels,
- layout state,
- display-only transformations.

Derived presentation state must not become computational truth.

### Operation state

Examples include:
- saving,
- calculating,
- market-data request in progress,
- risk-data commit,
- file import/restore,
- approved app update,
- storage failure,
- online/offline state.

Operation state often controls correctness-sensitive UI locks.

Do not remove an operation guard merely because a disabled control appears
less convenient.

## Primary navigation

The current primary navigation is:

- Overview
- Allocate
- Risk
- Settings

These are the four primary tabs.

Secondary views include:
- Portfolio,
- Calculation Details,
- dialogs,
- sheets,
- nested settings groups.

Do not promote secondary views into new primary tabs without explicit
task scope.

When navigating between primary or secondary views, preserve the user's
navigation context and accessibility behavior.

## Editable state versus historical result

The current editable portfolio and a selected sealed calculation are
different objects.

A calculation captures the exact calculation input at the time the user
starts the calculation.

Later valid edits may become the new current editable state without
changing the historical calculation.

Conceptually:

USER STARTS CALCULATION
↓
capture exact calculation input
↓
produce and seal snapshot
↓
later edits may continue
↓
current editable state and historical snapshot may diverge

When they diverge:
- keep the snapshot unchanged,
- preserve its original capital, orders, risk, and timestamp,
- mark that current input has changed,
- require recalculation for a new applicable plan.

Do not silently recompute displayed historical values from current state.

## Numeric input contract

Numeric inputs may hold local text drafts while focused.

A draft becomes financial state only after it satisfies the declared field
validation contract.

Preserve the distinction:

WHAT THE USER IS TYPING
≠
VALID FINANCIAL STATE

Invalid drafts:
- remain local UI state,
- are marked invalid,
- must not persist,
- must not overwrite the last valid value,
- must have accessible error association.

When focus leaves the field, the displayed value must reconcile with the
actual parent financial state.

External state changes that occur while a field is focused must not be
silently lost when the field later blurs.

Do not parse a visually convenient string and commit it unless the
component's input contract explicitly allows it.

## Formatting boundary

Formatting is one-way presentation.

Conceptually:

RAW DOMAIN VALUE
↓
DISPLAY FORMATTER
↓
USER DISPLAY

Formatted values must not be written back as:
- engine inputs,
- snapshot values,
- restored financial state,
- provider observations,
- allocation values.

Primary source:
- `src/ui/format.ts`

Financial formatting currently follows Danish display conventions where
appropriate.

Display rounding must not alter full-precision mathematical state.

Do not reuse rounded display values in calculations.

## Presentation truth

Absence, zero, stale, invalid, and error are different presentation states.

Do not collapse them.

Examples:

MISSING VALUE
≠ ZERO

UNCONFIRMED
≠ CONFIRMED

STALE
≠ CURRENT

OFFLINE
≠ FAILED

NEGATIVE FINANCIAL VALUE
≠ APPLICATION ERROR

UNAVAILABLE RISK
≠ 0% RISK

When a held asset is missing a required price, do not present the whole
portfolio as though that asset has zero value.

When risk is undefined or unavailable, use an explicit unavailable state.

Preserve financial signs.

A negative P/L or negative risk contribution is not automatically a
danger/error state.

## Current valuation versus historical risk

Manual current valuation and historical risk are different information
classes.

The UI must communicate that distinction.

Current manual prices may be:
- unconfirmed,
- confirmed,
- stale.

Historical risk belongs to a specific calculation snapshot and source.

Provider reference data does not silently update manual holdings or
manual DKK prices.

Historical risk data does not silently become current valuation data.

A current provider reference does not become historical risk evidence.

UI copy must reflect the actual ownership boundary of the completed
operation.

Do not tell the user that a portfolio, risk dataset, credential, or
financial value was updated when only a different domain operation
completed.

## User consent boundary

Successful acquisition, validation, or provider access is not consent for
unrelated state changes.

Examples:

provider connection verified
≠ manual prices confirmed

risk history accepted
≠ user acknowledgement granted

credential saved
≠ provider permanently verified

reference quote refreshed
≠ holdings updated

Do not infer or set user consent on behalf of the user unless the task and
domain contract explicitly define that behavior.

## Demo isolation

Primary orchestration:
- `src/ui/App.tsx`

Demo state is temporary and synthetic.

Demo mode may:
- edit demo values,
- calculate demo plans,
- display demo risk,
- show temporary demo snapshots.

Demo mode must not:
- persist demo edits into personal financial state,
- add demo snapshots to persistent history,
- alter backups,
- alter accepted personal market data,
- change personal holdings.

Leaving demo or reopening the application must restore the user's actual
persistent state.

File history import and asynchronous snapshot validation retain the editing
session that initiated them. A completion after demo exit/re-entry must not
target the new editor or select its snapshot. This publication/commit guard
does not cancel an already-entered restore transaction or roll back a durable
save. The Node production-closure regressions are in
`tests/ui-session-redteam.test.ts`; native browser evidence remains separate.

## Calculation orchestration

Primary source:
- `src/ui/calculation-job.ts`

The calculation job separates:
- the exact source captured for the calculation,
- the latest editable state that may later be persisted.

Do not change this relationship casually.

A long-running seal/hash operation must not force newer valid edits to be
discarded.

The resulting snapshot must still represent the exact captured
calculation input.

Automatic result selection also belongs to the editing session that started
the job. Entering or leaving demo invalidates that selection, even if the user
returns to the same real/demo mode before completion. A completed real job can
still enter persistent history; a demo job never does. This is a publication
guard, not a general calculation-cancellation mechanism.

## Automatic synchronized risk-data commit boundary

Primary source:
- `src/ui/risk-import.ts`

This commit boundary accepts a fully validated automatically synchronized
historical risk dataset into the latest financial state.

It must not:
- set manual holdings,
- set manual current prices,
- set unrelated acknowledgements,
- publish partial provider results.

If the source context that owns the request has changed materially before
commit, abort rather than applying stale work.

Read:
- `ai/data/README.md`

for acquisition and acceptance semantics.

Manual file-history import instead uses the `fileAction` dataset branch in
`src/ui/App.tsx`, `ImportProvider`, and `prepareRisk` in
`src/market-data/provider.ts`. Its general acceptance contract is separate;
do not route it through the stricter automatic commit gate as a convenience fix.

## Operation locking

The UI coordinates several operations that may conflict.

Examples include:
- calculation,
- financial persistence,
- market-data request,
- risk-data commit,
- file import or restore,
- approved app update.

A disabled control may represent a correctness lock, not a styling
preference.

Before removing or weakening a disabled state, determine:
- which concurrent operation it excludes,
- which race it prevents,
- whether domain state could become stale,
- whether restore/update/save ordering could be violated.

Do not improve apparent responsiveness by allowing incompatible operations
to overlap.

## Persistence feedback

The UI must distinguish:
- saving,
- saved,
- not saved,
- storage unavailable,
- recovery required.

Do not display successful persistence before the underlying persistence
contract reports completion.

A failed financial save must not leave the UI implying that the changed
value is durable.

When persistent storage cannot be validated, recovery actions must respect
the persistence contract.

Read:
- `ai/persistence/README.md`

for state, restore, and recovery semantics.

## Snapshot presentation

Views that render a sealed snapshot must treat it as immutable.

Rendering must not mutate:
- snapshot input,
- snapshot output,
- hash-covered data,
- replay identity.

When current state differs from the snapshot, make that relationship
visible without modifying the historical result.

Primary views:
- `src/ui/BuyPlan.tsx`
- `src/ui/RiskView.tsx`
- `src/ui/Details.tsx`

## Financial display rules

Canonical implementation:
- `src/ui/presentation.ts`
- `src/ui/format.ts`

Preserve explicit display semantics for:
- DKK values,
- quantities,
- weights,
- volatility,
- risk-contribution shares,
- L1/L2 distance,
- missing values,
- timestamps,
- freshness,
- source labels.

Do not invent display precision from intuition when a canonical formatter
or design rule already exists.

Do not describe a display-only transformation as a change to underlying
financial mathematics.

## Accessibility contract

Accessibility is interaction correctness, not cosmetic polish.

Preserve as applicable:
- semantic headings,
- explicit labels,
- skip navigation,
- visible focus,
- page-title focus after navigation,
- `aria-current`,
- `aria-pressed`,
- `aria-invalid`,
- `aria-describedby`,
- table scopes and captions,
- labeled scrollable regions,
- native dialog semantics,
- Escape/cancel behavior,
- initiating-control focus return,
- reduced-motion behavior,
- keyboard operability,
- touch target sizing,
- text scaling and reflow.

Do not rely on color alone to communicate:
- selection,
- state,
- target/current/projected identity,
- error,
- availability.

Do not require hover to discover essential financial information.

Static source checks are not proof of:
- VoiceOver correctness,
- physical touch behavior,
- real keyboard viewport behavior,
- actual iPhone reflow,
- installed-PWA behavior.

Those require runtime/device evidence.

## Responsive and iPhone-first behavior

The UI is iPhone-first.

Visual changes should account for:
- narrow widths,
- text scaling,
- touch targets,
- safe areas,
- keyboard appearance,
- scrollable data regions,
- bottom navigation clearance,
- standalone mode,
- Safari/WebKit behavior.

Do not solve overflow by hiding essential financial information.

Prefer wrapping or bounded horizontal scrolling for dense tabular/charts
when that preserves meaning.

Read:
- `ai/pwa/README.md`

when the problem involves browser lifecycle, standalone mode, keyboard,
safe-area, service-worker, or physical iPhone behavior.

## Launch presentation

Primary source:
- `src/ui/LaunchIntro.tsx`
- `src/ui/launch-state.ts`

The launch intro owns brand presentation and handoff timing.

It does not own storage initialization or service-worker correctness.

If startup appears stuck, identify whether the root cause belongs to:
- intro presentation,
- storage readiness,
- service-worker/runtime lifecycle,
- application initialization.

Do not lengthen or alter intro timing to hide a readiness failure.

Reduced-motion behavior must remain explicit.

## Mineral Instrument visual language

Preserve the established EQUINOX visual identity unless the task
explicitly redesigns it.

Canonical documentation:
- `docs/ui-v1/design-system.md`
- `docs/ui-v1/visual-strategy.md`

High-level characteristics include:
- dark mineral / blue-black foundation,
- restrained mineral teal,
- restrained violet,
- matte surfaces,
- data-first hierarchy,
- tabular financial numerals,
- sparse decorative motion,
- direct numeric labels,
- quiet geometry,
- clear target/current/projected distinction,
- no dependency on hover for understanding.

Do not duplicate the full design token set here.

Read the canonical design docs and current CSS before changing visual
semantics.

## Visual implementation

Primary sources:
- `src/ui/styles.css`
- `src/ui/browser-hardening.css`

Do not treat historical design documentation as proof of the current
rendered UI.

Inspect the current CSS and components for implementation truth.

Avoid introducing:
- unnecessary runtime dependencies,
- remote fonts,
- chart packages,
- icon packages,
- heavy animation systems

unless a concrete requirement justifies them.

## UI evidence map

### Composition and workflows

Read:
- `src/ui/App.tsx`

### Presentation semantics

Read:
- `src/ui/presentation.ts`
- `src/ui/format.ts`

### Calculation workflow

Read:
- `src/ui/calculation-job.ts`
- `tests/calculation-job.test.ts`

The job regressions cover delayed completion preserving the latest editable
state and a demo-started job not persisting real state. They do not test a
general calculation-cancellation mechanism. For duplicate-submit/restore locks,
snapshot input capture, and UI publication, also inspect `src/ui/App.tsx` and
the relevant case in `tests/browser/hardening.spec.ts`.

That browser file also holds a demo calculation across exit and re-entry into
a new demo session. A test being present is not evidence that either browser
project has executed it; check the current run results.

### Historical-data import paths

Select the actual path:
- automatic synchronized commit: `src/ui/risk-import.ts` and
  `tests/risk-import.test.ts`;
- manual file import: `src/ui/App.tsx` (`fileAction`, dataset branch) and the
  manual file-history case in `tests/browser/risk-refresh.spec.ts`.

For dataset rejection semantics, follow `ai/data/README.md` and
`tests/data.test.ts` before changing the UI handler.

### Core financial views

Read as relevant:
- `src/ui/Overview.tsx`
- `src/ui/BuyPlan.tsx`
- `src/ui/RiskView.tsx`
- `src/ui/Details.tsx`
- `src/ui/MarketDataSettings.tsx`
- `src/ui/BalanceRail.tsx`

### Launch UI

Read:
- `src/ui/LaunchIntro.tsx`
- `src/ui/launch-state.ts`

### Visual system

Read:
- `src/ui/styles.css`
- `src/ui/browser-hardening.css`
- `docs/ui-v1/design-system.md`
- `docs/ui-v1/visual-strategy.md`
- `docs/ui-v1/review.md`

### Presentation regressions

Read:
- `tests/ui-presentation.test.ts`

### Browser interaction evidence

Browser project/runtime configuration:
- `playwright.config.ts`

Shared interactive-readiness helper:
- `tests/browser/helpers.ts`

Normal browser flows should reuse the established interactive-readiness
boundary rather than equating visible markup with an interactive app.
Launch-specific tests intentionally test the transition itself.

Select the relevant browser tests, including as appropriate:
- `tests/browser/app.spec.ts`
- `tests/browser/hardening.spec.ts`
- `tests/browser/launch.spec.ts`
- `tests/browser/ui.spec.ts`
- `tests/browser/market-settings.spec.ts`

Do not preload all browser tests for a narrow presentation task.

## UI Change Gate

Before changing UI code, classify the change.

### A — Presentation-only change

Examples:
- color,
- spacing,
- typography,
- layout,
- display formatting,
- non-semantic copy,
- decorative motion.

No financial, data, persistence, navigation, input, or interaction
semantics change.

Requirements:
- preserve domain values,
- preserve action sequencing,
- preserve accessibility,
- verify responsive behavior,
- verify no formatted value becomes domain input.

### B — Interaction-preserving UI change

Examples:
- component restructuring,
- accessibility hardening,
- focus improvements,
- responsive fixes,
- input UX hardening,
- rendering performance improvements.

Existing user and domain semantics remain unchanged.

Requirements:
- identify the interaction contract,
- preserve numeric commit behavior,
- preserve operation locks,
- preserve demo isolation,
- preserve snapshot/current-state distinction,
- run targeted browser regressions.

### C — UI contract or workflow change

This includes changes to:
- primary navigation structure,
- numeric commit semantics,
- demo isolation,
- snapshot/current-state relationship,
- operation locking,
- financial action sequencing,
- restore/import workflows,
- user consent behavior,
- cross-domain orchestration,
- destructive or durable action confirmation.

Do not treat this as a visual-only change.

A UI contract change requires:
1. explicit task scope or decision,
2. old and new user workflow,
3. owning-domain impact analysis,
4. invalid/intermediate-state analysis,
5. concurrency/race analysis,
6. accessibility review,
7. browser regression coverage,
8. iPhone/PWA validation when relevant.

## Cross-domain boundaries

Read `ai/math/README.md` when:
- displayed allocation, risk, target, or execution values appear mathematically wrong.

Read `ai/data/README.md` when:
- provider status,
- freshness,
- provenance,
- current reference data,
- synchronized historical data,
- or data acceptance semantics are involved.

Read `ai/persistence/README.md` when:
- save,
- restore,
- recovery,
- snapshot history,
- concurrency,
- migration,
- or durable state is involved.

Read `ai/pwa/README.md` when:
- standalone mode,
- Safari/WebKit,
- service worker,
- update lifecycle,
- offline behavior,
- safe areas,
- keyboard,
- or physical iPhone behavior is involved.

Read `ai/release/README.md` when:
- visual/build assets,
- release identity,
- deployed UI,
- bundled files,
- or hosted behavior differ from source.

Do not patch UI to hide a defect owned by another domain.
