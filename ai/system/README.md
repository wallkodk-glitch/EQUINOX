# EQUINOX — SYSTEM AND ARCHITECTURE

This file describes the architectural ownership model for EQUINOX.

Use it when the task affects system boundaries, crosses multiple domains,
or when it is unclear where behavior should live.

Do not use this file as a substitute for domain-specific source, tests,
references, or runtime evidence.

## Purpose

EQUINOX is a local-first, iPhone-first mathematical buy-only capital
allocation PWA.

The system separates financial truth, mathematical targeting, executable
allocation, proof/persistence, presentation, browser runtime, and release
delivery.

Correctness, data integrity, reproducibility, and explicit failure are
preferred over convenience or hidden fallback behavior.

EQUINOX does not automatically trade, sell, rebalance through a broker,
or silently mutate user financial state from provider data.

## Architectural boundaries

The core conceptual flow is:

DATA TRUTH
↓
MATHEMATICAL TARGET
↓
EXECUTABLE TARGET
↓
PROOF / PERSISTENCE
↓
PRESENTATION / PWA
↓
RELEASE / DELIVERY

These boundaries are related, but they do not own the same decisions.

### Data Truth

Owns:
- asset identity,
- entered financial facts as inputs to downstream calculations,
- market-data provenance,
- FX,
- corporate actions,
- calendar alignment,
- return construction,
- data-quality gating,
- accepted synchronized historical inputs.

Primary source areas:
- `src/domain/`
- `src/market-data/`

Portfolio accounting is not provider/data provenance.
`src/portfolio/accounting.ts` owns mathematical transformations such as
market value, cost basis, P/L, and current portfolio weights and should route
to `ai/math/README.md`.

Editable financial input behavior routes to UI; durable schema/storage routes
to PERSISTENCE.

Continue with:
- `ai/data/README.md`

### Mathematical Target

Owns:
- risk calculations,
- covariance-dependent analytics,
- portfolio target models,
- policy constraints,
- mathematical diagnostics,
- target-weight semantics.

Primary source areas:
- `src/risk/`
- `src/optimization/`

Continue with:
- `ai/math/README.md`

### Executable Target

Owns:
- conversion from target state to buy-only capital deployment,
- quantity increments,
- deterministic executable orders,
- spend,
- fees,
- residual cash,
- execution invariants.

Primary source area:
- `src/execution/`

Continue with:
- `ai/math/README.md`

### Proof and Persistence

Owns:
- calculation snapshots,
- replayability,
- snapshot integrity,
- durable local financial state,
- backup and restore,
- recovery,
- migrations,
- storage failure behavior.

Primary source areas:
- `src/snapshots/`
- `src/persistence/`

Continue with:
- `ai/persistence/README.md`

### Presentation

Owns:
- React composition,
- tabs and navigation,
- forms,
- numeric input behavior,
- visual presentation,
- accessibility,
- calculation and risk presentation.

Primary source area:
- `src/ui/`

Continue with:
- `ai/ui/README.md`

### PWA and browser runtime

Owns:
- Safari/WebKit behavior,
- standalone PWA lifecycle,
- service-worker behavior,
- shell caching,
- offline behavior,
- approved updates,
- viewport, keyboard and safe-area behavior,
- physical-device validation.

Continue with:
- `ai/pwa/README.md`

### Release and delivery

Owns:
- source packaging,
- release manifest,
- ZIP integrity,
- import workflow,
- GitHub Actions,
- GitHub Pages,
- deployment gates,
- hosted release verification.

Continue with:
- `ai/release/README.md`

## Ownership rule

Before adding or changing behavior, identify the subsystem that owns it.

Do not place logic in the nearest convenient file merely because that
file already has access to the required data.

Examples:

- presentation requirement → UI
- portfolio target or risk equation → mathematics
- provider or return-series behavior → data
- durable state or recovery behavior → persistence
- Safari/service-worker lifecycle → PWA
- artifact/import/deployment behavior → release

`src/ui/App.tsx` is a composition and orchestration layer.
Its access to multiple domains does not make it the owner of their
business rules.

Do not reimplement mathematical, data, persistence, or release semantics
inside presentation code.

## Dependency direction

Prefer dependencies that preserve domain ownership.

Presentation may call lower-level domain functionality.

Persistence may store validated domain results.

Snapshots may seal and replay validated calculation results.

Release tooling may package and verify the application.

The reverse does not automatically follow.

Core mathematical or data modules should not depend on React presentation
behavior.

Financial correctness must not depend on visual state.

Provider data must not silently become accepted user financial state.

Release tooling must not redefine financial semantics.

If a proposed dependency crosses these boundaries, verify that the owning
domain remains authoritative.

## Cross-domain changes

Some changes legitimately affect more than one subsystem.

For cross-domain work:

1. identify the primary owning domain,
2. identify the secondary dependency,
3. read both domain README files,
4. inspect the relevant source and evidence on both sides,
5. make the smallest change that preserves ownership.

Do not solve a cross-domain defect by duplicating logic into both domains.

## Architecture-change rule

Do not introduce:
- a backend,
- cloud state,
- new service infrastructure,
- new permanent dependency,
- new abstraction layer,
- new cross-domain coupling,
- or broad structural refactoring

unless the task has a concrete requirement that cannot be solved robustly
within the existing architecture.

Local/static solutions are preferred when they preserve correctness.

## Canonical architecture evidence

Start with:
- `README.md`
- `src/domain/core.ts`
- `src/main.tsx`
- `src/ui/App.tsx`

Then inspect the owning source directories for the task.

For mathematical design decisions:
- `docs/audit.md`
- `docs/reference-audit.md`
- `reference/`

For data contracts, follow current source/tests through `ai/data/README.md`:
- CURRENT CONTRACT, schema 2: `docs/final-data-closure/data-semantics.md`
- LEGACY COMPATIBILITY, schema 1: `docs/data-contract.md`

The legacy document's UI-activation status is historical, not the current UI
contract. Provider research is classified separately in the DATA evidence map.

For current or historical hardening evidence:
- `docs/final-hardening/`

Historical reports explain why parts of the system were changed.
They do not automatically define the current release status.

When status matters, verify the current artifact, workflow run,
deployment, or device evidence instead of inheriting a historical label.

## Boundary conflict rule

If source, tests, documentation, historical reports, or current task
instructions imply different ownership or behavior:

1. identify the conflict explicitly,
2. determine which subsystem owns the behavior,
3. inspect that subsystem's canonical evidence,
4. resolve the conflict before changing architecture.

Do not patch across an uncertain boundary.
