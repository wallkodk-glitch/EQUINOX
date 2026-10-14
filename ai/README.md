# EQUINOX — AI KNOWLEDGE ROUTER

This directory contains the AI navigation layer for EQUINOX.

Repository AI entrypoint:
`AGENTS.md`

Use it to find the smallest relevant context for the current task.
Do not treat these files as a replacement for source code, tests, references, or runtime evidence.

## Routing rule

Choose the primary domain from the task first.

Read that domain's `README.md` before following secondary dependencies.

Expand into another domain only when the implementation boundary, dependency graph, or evidence requires it.

If the owning domain is unclear, start with `ai/system/README.md`.

Repository source/evidence paths written in backticks are repository-root
relative unless a section explicitly says otherwise. Short labels such as
`ui/`, `math/`, or `pwa/` in routing examples are domain shorthand, not
filesystem paths.

For repository-wide audits, map the affected domains first and inspect them systematically rather than treating the task as a single-domain change.

## Domains

### System and architecture
Read:
`ai/system/README.md`

Use for:
- project purpose,
- architectural boundaries,
- ownership between subsystems,
- cross-domain dependencies,
- scope decisions,
- repository-level reasoning.

### Mathematics and allocation
Read:
`ai/math/README.md`

Use for:
- portfolio mathematics,
- market value, cost basis, P/L, and current portfolio weights,
- covariance and volatility,
- Equal Weight,
- Inverse Volatility,
- ERC / Risk Parity,
- constraints,
- buy-only allocation,
- execution mathematics,
- mathematical invariants and reference calculations.

### Market data and synchronized risk
Read:
`ai/data/README.md`

Use for:
- market-data acquisition,
- provider behavior,
- FX,
- corporate actions,
- TSM ADR semantics,
- return construction,
- synchronized history,
- manual historical import acceptance,
- normalized market-data cache and freshness,
- provider credentials and authentication transport,
- data-quality gates,
- risk-input provenance.

### Persistence and recovery
Read:
`ai/persistence/README.md`

Use for:
- financial IndexedDB transactions,
- persistent financial state,
- snapshots,
- backup and restore,
- migrations,
- recovery,
- credential isolation,
- corrupted or partial state.

### UI and presentation
Read:
`ai/ui/README.md`

Use for:
- React components,
- navigation and tabs,
- forms and numeric inputs,
- calculation presentation,
- visual system,
- accessibility,
- layout,
- interaction behavior.

### PWA and iPhone runtime
Read:
`ai/pwa/README.md`

Use for:
- Safari and WebKit,
- standalone PWA behavior,
- launch lifecycle,
- service worker,
- service-worker shell cache,
- offline behavior,
- installability,
- update flow,
- safe areas,
- keyboard and viewport behavior,
- physical iPhone validation.

### Release and delivery
Read:
`ai/release/README.md`

Use for:
- ZIP packaging,
- release manifest,
- import workflow,
- GitHub Actions,
- GitHub Pages,
- CI gates,
- artifact integrity,
- deployment,
- hosted smoke validation.

## Cross-domain change gates

Domain Change Gates are domain-qualified.

Classify a change by the contract it can affect, not only by the files it
touches. For a cross-domain task, satisfy every affected domain's applicable
requirements. A genuine Type C change in one domain cannot be downgraded by
another domain's Type A or B category.

When classification is uncertain, begin with the stricter applicable gate
until source and tests justify otherwise.

## Cross-domain tasks

Some tasks legitimately cross boundaries.

Examples:
- service-worker update button → `pwa/` first, then `ui/` if needed;
- stale provider cache → `data/`; stale application-shell cache → `pwa/`; an unspecified cache → `system/` to identify its owner first;
- wrong numeric draft or commit → `ui/` first; correct submitted state lost during storage → `persistence/`;
- credential replacement during a running request → `ui/` for request lifetime/publication, then `data/` for credential and transport semantics;
- displayed risk number looks wrong → `ui/` first, then `math/` or `data/` only if the underlying value is suspect;
- restore corrupts a snapshot → `persistence/` first, then `math/` only if replay semantics are involved;
- release artifact differs from deployed behavior → `release/` first, then the domain owning the changed runtime behavior.

Do not load unrelated domains merely because they exist.

## Escalation rule

If investigation shows that the task is owned by a different domain than initially assumed:

1. stop treating the original domain as authoritative,
2. read the newly relevant domain README,
3. inspect its source and evidence,
4. continue from the corrected ownership boundary.

Do not patch across an uncertain boundary.

## Source-of-truth rule

Domain README files are routing and contract documents.

They should point to the canonical implementation, tests, references, and deeper documentation.

When a domain file and executable evidence disagree, surface the conflict and resolve it from the actual task, implementation intent, tests, references, and observed behavior rather than silently copying one source over another.
