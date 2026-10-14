# EQUINOX — MATHEMATICS AND ALLOCATION

This file describes the mathematical ownership, invariants, evidence,
and change discipline for EQUINOX.

Use it for tasks involving portfolio valuation/accounting, risk
calculations, portfolio targets, policy constraints, buy-only allocation,
execution mathematics, or mathematical correctness.

Do not use this file as a substitute for production source,
independent reference calculations, or executable tests.

## Mathematical layers

EQUINOX separates three mathematical layers:

RAW MATHEMATICAL TARGET
↓
POLICY-CONSTRAINED TARGET
↓
BUY-ONLY EXECUTABLE TARGET

These layers must not be collapsed into one concept.

### Raw mathematical target

Owns the unconstrained model output.

Current model families are:
- Equal Weight,
- Inverse Volatility,
- Equal Risk Contribution / Risk Parity.

Primary source:
- `src/optimization/targets.ts`

Risk mathematics used by these models lives in:
- `src/risk/math.ts`

Raw model output is not a human policy result.

### Policy-constrained target

Owns the transformation from a raw mathematical target into a target
that satisfies the configured portfolio policy.

Policy constraints and raw mathematical targets are separate concepts.

A constrained ERC result must not be described as raw ERC.

Primary source:
- `src/optimization/targets.ts`

### Buy-only executable target

Owns the deployment of new capital without selling existing holdings.

This is a mathematical allocation problem, not an underweight heuristic.

The continuous allocator determines nonnegative buys subject to the
available capital constraint.

The discrete execution layer then applies quantity increments,
minimum orders, price precision, deterministic ordering, spend,
fees, and residual cash.

Primary source:
- `src/execution/allocator.ts`

Do not replace this process with proportional underweight allocation,
manual redistribution, or another heuristic unless the mathematical
contract is explicitly changed.

## Risk mathematics

Primary source:
- `src/risk/math.ts`

This layer owns:
- DKK-normalized level calculations,
- arithmetic simple returns,
- sample covariance,
- annualization,
- covariance diagnostics,
- correlation,
- portfolio volatility,
- marginal risk contribution,
- absolute risk contribution,
- risk-contribution shares.

Risk calculations must preserve their declared units and conventions.

When risk is mathematically undefined, return an explicit unavailable
or failure state.

Do not replace undefined risk with:
- zero,
- equal percentages,
- NaN,
- Infinity,
- or another fabricated fallback.

Covariance validity, positive-semidefiniteness, repair behavior,
conditioning policy, and optimizer acceptance are related but distinct.

Do not silently regularize covariance or change the optimization problem
to make a solver succeed.

## Core mathematical invariants

Preserve these unless the task explicitly changes the mathematical contract:

- portfolio weights sum to one within the declared numerical tolerance,
- buy amounts are nonnegative,
- no sell quantity is introduced into the buy-only allocator,
- raw target and constrained target remain distinct,
- continuous allocation and discrete execution remain distinct,
- residual cash is legitimate output,
- residual cash is not silently redistributed into risky weights,
- fees are explicit,
- capital reconciliation is explicit,
- full-precision calculations precede presentation rounding,
- undefined mathematical quantities remain undefined rather than fabricated.

Capital reconciliation follows the system invariant:

`sum(Buy_i) + sum(Fee_i) + ResidualCash = NewCapital`

If the current fee model is zero-fee, zero is still an explicit fee value,
not an omitted concept.

## Raw target versus policy

Do not present policy constraints as mathematical model output.

Conceptually:

`w_raw -> policy constraint operator -> w_constrained`

The raw model answers:
"What target does the mathematical model produce?"

The policy layer answers:
"What target is allowed under the configured human portfolio policy?"

These are different questions.

A binding policy may make exact equal-risk contribution impossible.
A nonzero constrained ERC objective can therefore be correct.

Do not manufacture equal-risk output when constraints prevent it.

## Buy-only allocation

The buy-only allocator is an optimization model.

It is not:
- "buy the most underweight asset",
- proportional redistribution of positive deficits,
- a rebalance-completion percentage,
- or an implicit sell-and-rebuy system.

Existing holdings may leave some assets above target because selling is prohibited.

That residual deviation is a valid mathematical result.

Continuous allocation and executable orders are separate stages:

TARGET
↓
CONTINUOUS BUY-ONLY SOLUTION
↓
DISCRETE EXECUTION
↓
SPEND + FEES + RESIDUAL CASH
↓
POST-TRADE DEVIATION

Do not force the discrete result to equal the continuous solution when
instrument increments, minimum orders, or available cash make that impossible.

## Precision and numerical semantics

Keep units, precision, tolerances, and rounding explicit.

Do not round model weights, covariance values, risk contributions,
or intermediate allocation values for presentation and then reuse those
rounded values as calculation inputs.

Display rounding belongs at the presentation boundary.

Execution may use a different precision mechanism from analytical math
when required for exact cash reconciliation.

Do not change a numerical tolerance merely to make a failing test pass.

If a tolerance changes, explain:
- which quantity it applies to,
- why the previous tolerance is incorrect,
- what numerical error source is being bounded,
- and whether mathematical semantics change.

## Solver semantics

A solver result is valid only under the contract of the problem it solves.

Do not make stronger claims than the evidence supports.

In particular:
- deterministic convergence is not the same as global optimality,
- first-order stationarity is not a global-optimum certificate,
- a nonconvex constrained ERC problem must not be described as globally solved
  unless an actual proof exists,
- a rejected covariance matrix is not proof that no mathematical solution exists;
  it may reflect the production numerical-stability policy.

When solver behavior changes, inspect both the mathematical objective
and the declared acceptance criteria.

## Mathematical orchestration

Primary orchestration:
- `src/snapshots/calculate.ts`

This file connects:
- portfolio valuation,
- risk preparation,
- covariance and diagnostics,
- raw target generation,
- policy-constrained target generation,
- continuous buy-only allocation,
- discrete execution,
- post-trade analytics,
- validation,
- snapshot construction.

It orchestrates the mathematical pipeline.

It does not own every underlying equation.

Do not move domain mathematics into the orchestrator merely because it
has access to all intermediate values.

Change the owning module instead.

## Mathematical evidence

### Production implementation

Read:
- `src/domain/core.ts`
- `src/portfolio/accounting.ts`
- `src/risk/math.ts`
- `src/optimization/targets.ts`
- `src/execution/allocator.ts`
- `src/snapshots/calculate.ts`

`src/portfolio/accounting.ts` owns mathematical valuation/accounting
transformations such as market value, cost basis, P/L, and current portfolio
weights. Provider provenance is still DATA; editable/durable financial input
is still UI/PERSISTENCE.

### Production regression tests

Start with:
- `tests/engine.test.ts`
- `tests/reference.test.ts`

`tests/reference.test.ts` is the direct production-versus-independent-reference
comparison entrypoint.

Then inspect execution-, snapshot-, risk-, accounting-, or integration-specific
tests relevant to the task.

Production tests protect behavior but are not the only mathematical oracle.

### Independent mathematical reference

Read:
- `reference/reproduce.py`
- `reference/reference.json`
- `docs/reference-audit.md`

The independent reference layer must remain implementation-independent.

Do not rewrite reference calculations to call or mirror production
TypeScript merely to make them agree.

### Additional independent risk evidence

Read when synchronized historical risk calculations are affected:
- `reference/final-risk.py`

### Historical mathematical decisions

Read:
- `docs/audit.md`

Historical documents explain why mathematical choices exist.
They do not automatically authorize changing current semantics.

## Math Change Gate

Before changing mathematical code, classify the change.

### A — Presentation only

Examples:
- labels,
- formatting,
- display precision,
- explanatory text.

Mathematical inputs, equations, objective functions, constraints,
failure semantics, and outputs remain unchanged.

This should normally be owned by the UI domain.

### B — Implementation-preserving mathematical change

Examples:
- performance improvement,
- numerically safer equivalent calculation,
- bug fix where the intended mathematical contract remains unchanged,
- refactoring that preserves model semantics and accepted outputs.

Requirements:
- identify the existing mathematical contract,
- demonstrate equivalence or correctness,
- keep independent reference results valid,
- run relevant production and reference tests,
- check edge cases and numerical stability.

Do not regenerate expected values merely because the implementation changed.

### C — Mathematical contract change

This includes any change to:
- equations,
- objective functions,
- units,
- return definitions,
- covariance semantics,
- model meaning,
- policy semantics,
- constraints,
- buy-only objective,
- fee semantics,
- precision semantics,
- failure semantics,
- solver acceptance criteria,
- or other externally meaningful mathematical behavior.

Do not implement this as an ordinary bug fix.

A contract change requires:
1. explicit task scope or decision,
2. clearly defined old and new semantics,
3. independent reference calculations or test vectors,
4. edge-case analysis,
5. versioning/replay impact review,
6. regression analysis,
7. documentation of the mathematical reason for the change.

Never change golden reference values first and use the new values as proof
that the new implementation is correct.

## Failure discipline

Mathematical failures must fail explicitly.

Do not:
- catch a mathematical correctness error and substitute a plausible value,
- silently switch models,
- silently regularize inputs,
- silently discard constraints,
- silently sell assets,
- silently consume residual cash,
- or continue with partial mathematical inputs as if the result were complete.

A plausible number is not evidence of a correct calculation.

## Cross-domain boundaries

Read `ai/data/README.md` when the issue concerns:
- market-data provenance,
- FX source semantics,
- corporate actions,
- synchronized history,
- return-series construction before mathematical consumption.

Read `ai/persistence/README.md` when the issue concerns:
- stored snapshots,
- replay,
- migrations,
- restore,
- persisted model results.

Read `ai/ui/README.md` when:
- mathematics is correct but presentation is misleading or rounded incorrectly.

Read `ai/release/README.md` when:
- mathematical source identity,
- frozen boundaries,
- packaging,
- release validation,
- or artifact reproducibility is the actual issue.

Do not patch mathematics to compensate for a defect owned by another domain.
