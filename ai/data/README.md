# EQUINOX — DATA TRUTH AND PROVENANCE

This file describes the data ownership, provenance, time semantics,
acceptance rules, and change discipline for EQUINOX.

Use it for tasks involving market-data acquisition, provider adapters,
FX, corporate actions, calendar alignment, synchronized historical risk
data, cache behavior, provenance, freshness, or data-quality gates.

Do not use this file as a substitute for provider-specific source,
tests, independent references, or runtime evidence.

## Data truth classes

EQUINOX distinguishes several different classes of data.

They must not be silently promoted into one another.

### Provider raw data

External provider responses before normalization and validation.

Provider JSON, XML, timestamps, field names, or labels are not
automatically trusted economic semantics.

Provider field names do not define EQUINOX's data contract.

### Normalized observation

A provider response that has been parsed into EQUINOX's explicit
observation model with validated:

- provider,
- instrument,
- unit,
- observation date,
- observation timestamp when one exists,
- provider timestamp when one exists,
- acquisition time,
- observation kind,
- source identity,
- declared semantics.

Primary source:
- `src/market-data/live/model.ts`

A normalized observation is still not automatically an accepted
synchronized risk dataset.

### Validated and provenanced data

Normalized observations whose timestamps, prices, source identities,
corporate actions, FX, and other declared semantics are consistent with
their provenance and intended economic meaning.

Primary sources:
- `src/market-data/live/risk-provenance.ts`
- `src/market-data/live/risk-actions.ts`

Provenance is part of the acceptance contract.

Do not treat provenance fields as decorative metadata.

### Accepted synchronized risk data

A complete historical dataset that passes all required acquisition,
calendar, corporate-action, FX, provenance, schema, completeness,
and risk-integration gates.

Primary source:
- `src/market-data/live/synchronized.ts`

Partial provider success is not accepted synchronized data.

If one required part of the synchronized dataset fails, do not expose
the remaining subset as a valid replacement dataset.

### Manual user-supplied historical import

A user-imported historical file is a separate data class from automatic
synchronized acquisition.

It may pass the general structural, numerical, calendar, return, and coverage
checks in `src/market-data/provider.ts` without becoming independently
verified market evidence.

Manual import:
- remains user-supplied,
- may preserve gaps that still satisfy the general coverage/minimum-history
  contract,
- must not be silently upgraded to synchronized-provider status,
- resets acknowledgement when newly accepted,
- requires the existing acknowledgement boundary before calculations that
  depend on unverified user-supplied history.

Primary sources:
- `src/market-data/provider.ts`
- `src/ui/App.tsx`
- `src/snapshots/calculate.ts`

Targeted regressions:
- `tests/data.test.ts` for general coverage, gaps, and minimum history;
- `tests/synchronized-import.test.ts` for manual schema-2 versus automatic
  provenance identity;
- `tests/browser/risk-refresh.spec.ts`, the manual file-history import case,
  for the `fileAction` dataset branch in `src/ui/App.tsx`.

`src/ui/risk-import.ts` and `tests/risk-import.test.ts` cover the automatic
synchronized commit path, not the manual file-import handler.

Do not apply the synchronized builder's stricter all-required-session
acceptance contract to every manual historical import unless the product
contract is explicitly changed.

Numerical acceptance is not proof of market authenticity.

### Current reference data

Current or near-current provider observations used for reference or
sanity purposes.

This is distinct from synchronized historical risk data.

Current reference data must not silently replace historical risk
observations or user-entered financial state.

### Manual financial input

User-entered holdings, current valuation prices, capital, policy,
and other financial state are not provider-derived market truth.

Provider data must not silently mutate these values.

### Synthetic demo data

Synthetic data is explicitly synthetic.

It must remain isolated from personal financial state and must not
be described as verified market evidence.

## Time semantics

Time fields have different meanings.

Do not collapse them.

Conceptually:

ECONOMIC OBSERVATION DATE
≠ MARKET OBSERVATION TIMESTAMP
≠ PROVIDER TIMESTAMP
≠ ACQUISITION TIMESTAMP
≠ PUBLICATION AVAILABILITY

The presence or absence of one time field does not authorize inventing
another.

Never invent a timestamp merely to make data fit an existing schema.

If a source provides only a date, preserve date-only semantics unless
the actual contract explicitly defines a timestamp.

If a source provides a market bucket start, do not relabel it as a
bucket end.

If acquisition time is known, do not treat it as economic observation
or historical publication time.

## Schema boundaries

EQUINOX preserves distinct historical data contracts.

Schema 1 and schema 2 are not interchangeable.

Schema 1 retains its legacy timestamp-qualified FX semantics.

Schema 2 uses an explicit retrospective date-only FX contract.

Do not "simplify" the system by forcing both schemas into one time model.

Old snapshots must remain reproducible under the contract they were
created with.

When changing schema semantics, inspect replay and snapshot compatibility
before implementation.

Primary source:
- `src/market-data/provider.ts`

Canonical documentation:
- `docs/data-contract.md`
- `docs/final-data-closure/data-semantics.md`

## DKK investor perspective

Risk inputs are constructed from the DKK investor perspective.

Historical USD market observations and the applicable FX reference must
be transformed according to the declared data contract before risk
estimation.

Do not calculate risk from USD-only returns when the accepted contract
requires DKK-normalized returns.

Do not substitute a current FX quote for the historical FX observation
selected by the applicable contract.

FX units must remain explicit.

A provider value expressed per 100 foreign-currency units must not be
treated as DKK per single USD without the defined conversion.

## Historical FX semantics

Historical FX selection is part of the economic model.

For retrospective date-only FX, preserve:

- economic observation dates,
- official source identity,
- explicit unit conversion,
- the declared strict as-of selection policy,
- maximum permitted age,
- the original historical FX book,
- the selected date/rate reference for each canonical session.

Do not fabricate:
- publication timestamps,
- intraday availability,
- weekend observations,
- same-day availability,
- forward-filled daily observations,
- or historical information that the source does not provide.

Reusing a valid older reference does not create a new observation.

Primary sources:
- `src/market-data/retrospective-fx.ts`
- `src/market-data/live/nationalbank-history.ts`

## Calendar and market-close semantics

Historical observations must align to the canonical session calendar.

Primary sources:
- `src/market-data/calendar.ts`
- `src/market-data/sessions.json`
- `src/market-data/live/timestamps.ts`

Respect:
- canonical US trading sessions,
- holidays,
- extraordinary closures represented by the bundled calendar,
- early closes,
- DST,
- the exact canonical close instant.

Do not substitute:
- a generic daily close,
- a later minute,
- a weekend value,
- a nearby timestamp,
- or a synthetic observation

for a missing required canonical close.

Missing data must remain missing.

Do not manufacture continuity.

## Market observation semantics

The synchronized historical risk layer uses explicit observation roles.

A provider's raw timestamp and close field must be interpreted according
to the adapter contract, not by intuition.

When the contract requires the close-ending one-minute bucket, preserve
the exact bucket semantics.

Do not reinterpret the last eligible trade in a bucket as proof that a
trade occurred exactly at the canonical close instant.

Provider data must first become a valid normalized observation before it
can participate in synchronized risk construction.

## Corporate actions

Corporate actions are part of return construction.

For supported equity instruments, the system requires compatible
split and dividend evidence for the declared historical window.

Primary sources:
- `src/market-data/live/risk-actions.ts`
- `src/market-data/live/tsm-adr.ts`

Do not mix:
- raw prices with already adjusted dividend semantics,
- gross cash with net-after-withholding cash,
- per-ADR values with per-ordinary-share values,
- original cash values with unsupported split-adjusted substitutes.

Unsupported or ambiguous corporate-action combinations must fail closed.

Do not guess a correction.

## TSM ADR boundary

TSM ADR corporate-action evidence is intentionally bounded.

The currently verified source window is not blanket certification of:

- future dividends,
- future splits,
- other TSM events,
- other instruments,
- or general corporate-action completeness.

Before changing or extending TSM semantics, read:
- `src/market-data/live/tsm-adr.ts`
- `src/market-data/live/risk-actions.ts`
- `tests/tsm-final-dividend.test.ts` for the accepted window and rejected
  extensions, distinct from `tests/tsm-adr.test.ts`'s earlier event fixtures;
- `validation/v1.3-tsm-evidence-renewal.json` for the bounded historical
  source review; it does not certify a later window.

Do not extrapolate beyond the verified window.

Unknown or future events require new evidence and an explicit model/data
decision.

## Return construction

The historical data layer constructs returns from validated economic
inputs.

For equities, total-return construction combines:
- raw close prices,
- supported split ratios,
- supported gross cash dividends,
- FX conversion under the active data contract.

For crypto, the supported historical observation is the declared USD
spot close-bucket observation, combined with the applicable FX reference.

Do not add a dividend term to an already adjusted provider series.

Do not mix provider-adjusted data with the raw-input return contract.

Return construction semantics are economically meaningful behavior.

Changing them is a data-contract change, not a parser cleanup.

## Synchronized risk acceptance

Primary source:
- `src/market-data/live/synchronized.ts`

The synchronized builder must remain all-or-nothing.

Before accepting a new risk dataset, required inputs must pass their
declared gates, including as applicable:

- all required instruments,
- complete canonical session coverage,
- normalized observation validation,
- corporate-action validation,
- historical FX validation,
- provenance validation,
- calendar alignment,
- dataset schema validation,
- final risk integration checks.

Do not return a partially synchronized result.

Do not silently use a different provider or fallback observation to fill
a failed required input.

Do not run allocation from an incomplete dataset as if synchronization
succeeded.

## Data-quality gate

Primary source:
- `src/market-data/provider.ts`

The data-quality gate owns validation of the accepted historical risk
series before mathematical consumption.

Preserve explicit failure for conditions such as:

- duplicate dates,
- non-monotonic dates,
- future observations or acquisition inconsistencies,
- missing required latest data,
- calendar misalignment,
- invalid FX selection,
- insufficient history,
- inadequate pair coverage,
- nonfinite returns,
- unsupported discontinuities,
- unknown transformation semantics.

Missing observations must not be bridged through adjacent valid sessions.

No synthetic weekends.

No silent gap interpolation.

A real exceptional observation that violates an existing quality policy
requires evidence and a reviewed policy decision, not automatic bypass.

## Provenance

Primary source:
- `src/market-data/live/risk-provenance.ts`

For automatically provenanced synchronized data, provenance must remain
consistent with the normalized dataset.

Cross-check as applicable:

- instrument identity,
- provider identity,
- source identity,
- canonical date,
- bucket start/end,
- observation time,
- acquisition time,
- normalized price,
- corporate-action transformations.

If provenance and normalized rows disagree, fail.

Do not repair the conflict by silently overwriting one side.

## Cache boundary

Primary source:
- `src/market-data/live/cache.ts`

The market cache is an optimization and recovery aid.

It is not source authority and is not permission to weaken validation.

Cached observations must still satisfy their schema, source, time,
freshness, and canonical-bucket requirements.

Cache reuse must remain explicit.

Conflicting duplicate observations must fail rather than silently replace
one another.

Persist normalized cache data only after the relevant validation boundary
has succeeded.

Cache recovery must remain isolated from financial state and credentials.

## Credentials boundary

Primary source:
- `src/market-data/live/credentials.ts`

Provider credentials enable provider access.

They are not market evidence.

Credentials must remain separate from:
- financial state,
- market datasets,
- market cache semantics,
- calculation snapshots,
- backup payloads,
- logs,
- validation artifacts.

Current browser-local credential storage is not a cryptographic vault.

Do not describe it as one.

Do not move credentials into source code, build artifacts, datasets,
snapshots, or release packages.

Read `ai/persistence/README.md` when credential lifecycle intersects
storage, backup, restore, or recovery behavior.

## Current reference providers

Current provider observations and historical risk observations have
different contracts.

For example, current crypto reference data has its own timestamp and
freshness semantics.

Primary source:
- `src/market-data/live/coingecko.ts`

A valid current quote is not a historical risk observation.

A historical risk observation is not permission to overwrite a user's
current manual valuation.

Do not cross these boundaries for convenience.

## Failure discipline

Data failures must fail explicitly.

Do not:
- invent missing observations,
- silently forward-fill unsupported gaps,
- fabricate timestamps,
- silently downgrade provenance requirements,
- accept partial synchronized datasets,
- substitute stale/current data across roles,
- ignore conflicting duplicates,
- guess unsupported corporate actions,
- reinterpret units without an explicit conversion,
- or silently mutate financial state after a provider refresh.

Provider/network/schema error text must not leak credentials or raw
sensitive request material into user-facing errors or logs.

## Data evidence map

### Core data contract

Read:
- `src/market-data/provider.ts`
- `src/market-data/calendar.ts`
- `src/market-data/retrospective-fx.ts`
- `src/market-data/sessions.json`

### Normalized provider layer

Read:
- `src/market-data/live/model.ts`
- relevant provider adapter under `src/market-data/live/`
- `src/market-data/live/network.ts`

### Synchronized risk layer

Read:
- `src/market-data/live/synchronized.ts`
- `src/market-data/live/risk-provenance.ts`
- `src/market-data/live/risk-actions.ts`

### FX

Read:
- `src/market-data/retrospective-fx.ts`
- `src/market-data/live/nationalbank-history.ts`
- relevant FX tests.

### Corporate actions

Read:
- `src/market-data/live/risk-actions.ts`
- `src/market-data/live/tsm-adr.ts`
- relevant corporate-action tests.

### Cache

Read:
- `src/market-data/live/cache.ts`
- `tests/market-cache.test.ts`

### Credential lifecycle

Read:
- `src/market-data/live/credentials.ts`
- `tests/credentials.test.ts`

For a credential change during a running request, follow UI orchestration in
`src/ui/MarketDataSettings.tsx` (captured key, storage-event cancellation, and
publication guards), then the relevant DATA adapter/transport.
`tests/browser/market-settings.spec.ts` covers credential UI flows and holds
an old response across credential replacement in another tab;
`tests/browser/risk-refresh.spec.ts` covers refresh cancellation. A sequential
key-replacement test does not prove that an old in-flight response is discarded:
inspect the assertions and add that specific regression when changing this boundary.
The held-response test intentionally allows transport to finish after abort
to exercise the publication guard. Its presence does not imply browser PASS.

### Contract and historical documentation

Current schema-2 historical semantics:
- `docs/final-data-closure/data-semantics.md`

Legacy schema-1 contract:
- `docs/data-contract.md`

Use `docs/data-contract.md` for preserved schema-1 semantics and compatibility.
Its historical statements about UI activation do not describe the current
application UI.

Historical provider research:
- `docs/data-provider-research.md`

`docs/data-provider-research.md` records research-stage feasibility,
transport, credential, and provider options. It is not the current
implementation architecture and must not override current source, tests,
or the accepted browser-local credential model.

### Independent risk evidence

Read when return-series or synchronized-risk semantics are affected:
- `reference/final-risk.py`

### Relevant regression tests

Select the tests matching the actual boundary, including as appropriate:
- `tests/data.test.ts`
- `tests/market-parsers.test.ts`
- `tests/market-network.test.ts`
- `tests/refresh-network.test.ts`
- `tests/historical-fx.test.ts`
- `tests/retrospective-fx-contract.test.ts`
- `tests/official-fx-holiday-gaps.test.ts`
- `tests/synchronized-import.test.ts`
- `tests/synchronized-risk-boundary.test.ts`
- `tests/risk-import.test.ts`
- `tests/tsm-adr.test.ts`
- `tests/tsm-final-dividend.test.ts`
- `tests/browser/risk-refresh.spec.ts`
- `tests/browser/nationalbank.spec.ts`
- `tests/browser/market-settings.spec.ts`
  when browser/provider behavior is involved.

Do not preload every data test for a narrow task.

## Data Change Gate

Before changing data code, classify the change.

### A — Provider or transport change

Examples:
- endpoint plumbing,
- pagination,
- retry handling,
- bounded response handling,
- request cancellation,
- provider authentication transport.

The accepted normalized economic semantics remain unchanged.

Requirements:
- provider payloads still normalize to the same contract,
- no credential leakage,
- no change to economic meaning,
- parser and network regressions remain covered.

### B — Implementation-preserving data change

Examples:
- cache correctness fix,
- parser hardening,
- validation implementation fix,
- reliability improvement,
- performance improvement,
- equivalent refactor.

The intended data contract remains unchanged.

Requirements:
- identify the existing contract,
- preserve normalization semantics,
- preserve time and unit meaning,
- keep relevant fixtures and acceptance tests valid,
- verify no hidden change to downstream return construction.

Do not rewrite fixtures merely to make a changed parser pass.

### C — Data contract change

This includes any change to:
- time semantics,
- observation roles,
- provider economic meaning,
- units,
- FX policy,
- calendar policy,
- corporate-action basis,
- return construction,
- freshness,
- data completeness,
- provenance,
- acceptance gates,
- fallback behavior,
- dataset schema meaning,
- or synchronization semantics.

Do not implement this as an ordinary provider bug fix.

A data contract change requires:
1. explicit task scope or decision,
2. old and new semantics written clearly,
3. provider/source evidence,
4. downstream mathematical impact analysis,
5. snapshot/replay compatibility review,
6. independent or fixture-based reference evidence,
7. regression coverage,
8. versioning implications reviewed.

A data-contract change can alter returns, covariance, model weights,
allocation, and snapshot outputs.

Treat that downstream effect explicitly.

## Cross-domain boundaries

Read `ai/math/README.md` when:
- accepted return construction,
- covariance inputs,
- DKK risk semantics,
- or model outputs may change.

Read `ai/persistence/README.md` when:
- datasets, cache, credentials, snapshots, backup, restore,
  or recovery behavior interact.

Read `ai/ui/README.md` when:
- provider state, freshness, errors, or data provenance are displayed
  incorrectly but the underlying data is correct.

Read `ai/pwa/README.md` when:
- offline behavior,
- browser networking,
- lifecycle,
- service worker,
- or reconnect behavior affects data access.

Read `ai/release/README.md` when:
- provider credentials,
- bundled validation data,
- frozen source identity,
- artifacts,
- or release evidence are involved.

Do not patch the data model to compensate for a defect owned by another domain.
