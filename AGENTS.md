# EQUINOX — AI ENTRYPOINT

EQUINOX is a local-first, iPhone-first mathematical buy-only capital allocation PWA.

This file is the repository entrypoint for AI agents.
It is a navigation and engineering contract, not the complete EQUINOX specification.

## Start here

Before modifying the repository:

1. Read `ai/README.md`.
2. Identify the subsystem affected by the task.
3. Read that subsystem's `ai/<domain>/README.md`.
4. Inspect the corresponding source code, tests, references, and canonical documentation.
5. Expand into other domains only when a dependency or evidence requires it.

Do not preload the entire documentation tree when a smaller relevant context is sufficient.

## Evidence discipline

Treat `ai/` as a navigation and contract layer, not a substitute for implementation evidence.

For each task, distinguish between:
- intended behavior and subsystem contracts,
- current source implementation,
- executable tests and mathematical references,
- build/browser/deployment/runtime/device evidence,
- the user's current task and explicit decisions.

If these sources conflict, identify the conflict before changing behavior.
Do not silently guess which source is correct.

## Change discipline

Root cause before patch.

Preserve working behavior unless the task explicitly changes it.

Prefer the smallest correct change over rewrites, unrelated refactors, new abstractions, dependencies, services, or backend infrastructure.

Do not change financial models, mathematical semantics, data contracts, persistence semantics, release boundaries, or other protected behavior without concrete evidence or explicit task scope.

No silent data loss.

Do not weaken, skip, loosen, or rewrite tests merely to manufacture a passing result.

## Validation discipline

Correctness claims must match the evidence actually executed.

Keep these validation gates distinct:
STATIC REVIEW
LINT
TYPECHECK
TEST
BUILD
BROWSER
DEPLOY
HOSTED/RUNTIME
PHYSICAL IPHONE
INSTALLED PWA

These are separate evidence dimensions, not a single strength ranking.
A PASS in one gate does not automatically imply PASS in another.

Bind important claims to the artifact or revision tested, runtime,
mock-versus-real boundary, executed scope, and status.

Blocked or unavailable validation is BLOCKED or NOT TESTED, not PASS.

Never claim physical iPhone/PWA validation from emulation or browser automation.

## Change-gate precedence

Classify a change by the contract it can affect, not only by the files or
implementation lines it touches.

Use domain-qualified classifications such as `Math/B`, `Persistence/C`,
or `PWA/A`.

For cross-domain changes:
- satisfy the applicable gate requirements of every affected domain;
- use the strictest applicable classification for each affected contract;
- a genuine Type C contract change in one domain cannot be downgraded by
  another domain's Type A or B classification.

When classification is uncertain, use the higher-risk classification as
the working assumption until source and tests justify a lower one.

## Repository knowledge map

System and architecture:
`ai/system/README.md`

Mathematics and allocation:
`ai/math/README.md`

Market data and synchronized risk:
`ai/data/README.md`

Persistence, snapshots, backup, and recovery:
`ai/persistence/README.md`

UI, presentation, forms, accessibility, and interaction:
`ai/ui/README.md`

PWA, Safari, offline, lifecycle, and updates:
`ai/pwa/README.md`

Packaging, GitHub Actions, validation, and release:
`ai/release/README.md`

When a domain README points to canonical source, tests, references, or documentation, follow those references rather than duplicating their content here.
