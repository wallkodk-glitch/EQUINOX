# EQUINOX — PERSISTENCE, SNAPSHOTS AND RECOVERY

This file describes the durable-state, snapshot-integrity, backup,
restore, migration, concurrency, and recovery contract for EQUINOX.

Use it for tasks involving IndexedDB, persistent financial state,
snapshots, backup/restore, recovery copies, migrations, corruption,
multi-tab conflicts, or storage failure behavior.

Do not use this file as a substitute for current source, regression tests,
snapshot replay evidence, or physical browser/device validation.

## Storage ownership

Not all browser storage belongs to the same domain.

EQUINOX separates storage responsibilities.

### Financial persistence

Owns:
- current financial application state,
- calculation snapshots,
- recovery copies,
- validated backup/restore behavior.

Primary sources:
- `src/persistence/schema.ts`
- `src/persistence/store.ts`

### Market-data cache

Owns normalized provider observations used by the data layer.

Primary source:
- `src/market-data/live/cache.ts`

This is not financial persistence.

Read:
- `ai/data/README.md`

### Provider credentials

Own provider access credentials in a separate browser-local store.

Primary source:
- `src/market-data/live/credentials.ts`

The application-managed credential store is not copied into:
- financial state,
- snapshots,
- backups,
- recovery copies,
- market evidence.

This is a storage-ownership boundary, not a redaction guarantee for already
corrupt records. Raw recovery deliberately preserves unknown stored fields,
which could include sensitive material from an old or corrupt record. Do not
sanitize that forensic original to make a blanket credential-exclusion claim.

### Service-worker cache

Owns application-shell and PWA runtime caching.

This is not financial persistence.

Read:
- `ai/pwa/README.md`

Do not merge these storage boundaries merely because they all exist
inside the browser.

## Persistent financial state

Primary source:
- `src/persistence/schema.ts`

Persistent state includes the validated application data required to
continue the user's financial workflow across reloads and restarts.

The stored schema is strict.

Unknown, unsupported, malformed, or structurally inconsistent state
must not be silently accepted.

Asset ordering is computational state and must remain validated.

## Absent state versus corrupt state

These are different conditions.

NO STORED STATE
→ fresh initial state is valid

CORRUPTED OR UNSUPPORTED STORED STATE
→ fail explicitly

Never turn corrupted persistent state into fresh initial state as a
convenience fallback.

Record presence must be checked independently of its value. An existing
`current` record containing `undefined` is corrupt, not absent; ordinary load
and save must fail. Raw JSON export rejects it, while explicit restore keeps
an own `state: undefined` field in the IndexedDB recovery copy.

A silent reset can become permanent financial data loss.

If valid recovery material exists, use the explicit recovery path rather
than pretending corrupt data never existed.

## Schema and migration discipline

Primary source:
- `src/persistence/schema.ts`

`migrateState()` defines the accepted state boundary.

Do not assume its name authorizes:
- guessed repair,
- lossy conversion,
- dropping unknown financial fields,
- automatic reset,
- or unsupported future-schema coercion.

A persistence migration must be:

- explicit,
- deterministic,
- idempotent,
- validated,
- failure-safe,
- covered by representative old-state fixtures,
- and designed with recovery in mind.

Unknown future state must fail rather than being interpreted according to
the current schema.

Do not increment or alter persistence schema versions without an actual
stored-data contract change.

## Version boundaries

Several version concepts exist and must remain separate.

Examples include:

FINANCIAL STATE SCHEMA VERSION
≠ DATASET SCHEMA VERSION
≠ SNAPSHOT VERSION
≠ ENGINE / MODEL VERSION

Do not migrate, increment, or equate one version boundary merely because
another boundary changed.

A market-data schema change does not automatically require a financial
state migration.

A snapshot model-version change does not automatically redefine the
IndexedDB state schema.

Before changing any version boundary, identify exactly which stored
contract changed.

## Revision and concurrency

Persistent financial state uses revision-based optimistic concurrency.

The revision is not display metadata.

It protects against stale writers overwriting newer data.

Conceptually:

READ revision N
↓
EDIT
↓
SAVE expecting revision N
↓
stored revision still N?
    YES → commit revision N+1
    NO  → conflict

Do not bypass the expected-revision check.

Do not silently overwrite newer data from another tab or runtime context.

A stale editor must reload or reconcile with the newer state.

Recovery coordination accepts only nonnegative safe-integer revisions.
Unsupported corrupt revision values are not authority to write an unsupported
replacement state. A next revision outside the safe-integer range fails with
`STATE_REVISION_EXHAUSTED` before any writes; it must not wrap/reset a valid
revision counter or report a corrupt new state as saved.

Primary source:
- `src/persistence/store.ts`

## Atomic save

Financial state and an optional snapshot are saved within one write
transaction.

A failed save must not become a partially successful save.

The operation is successful only when the IndexedDB transaction itself
has completed successfully.

Do not report "saved" merely because individual requests were queued.

On failure:
- abort the transaction when still possible,
- preserve the previous committed state,
- surface the failure,
- do not pretend partial writes are usable.

Synchronous request-construction failures must receive the same rollback
discipline as asynchronous request failures.

## Transaction completion

IndexedDB request success and transaction success are not equivalent.

A request may succeed while the containing transaction later aborts.

Always distinguish:

REQUEST COMPLETED
from
TRANSACTION COMMITTED

Persistence success requires the latter.

Observe transaction rejection paths so failures do not become unhandled
background errors.

Do not swallow an aborted transaction while reporting a successful
operation.

## Durability

Financial write operations request strict durability.

Do not weaken durability merely for performance unless the task
explicitly changes the persistence contract and the browser/device
implications are understood.

A lower-latency write is not an improvement if committed financial state
becomes less reliable.

Runtime/device support must be evaluated separately from unit-test
behavior.

## Snapshot identity

Primary source:
- `src/snapshots/integrity.ts`

A sealed snapshot consists of:
- a snapshot payload,
- a SHA-256 digest,
- an ID tied to that digest.

Snapshot integrity is not advisory metadata.

A stored snapshot must pass:
- structural validation,
- model/version compatibility,
- replay validation,
- hash verification.

Do not accept a snapshot merely because its outer shape looks correct.

## Canonical snapshot hashing

Snapshot hashes are computed from canonical serialization.

Do not change canonical serialization casually.

Changing canonicalization may change snapshot identity even when economic
content appears equivalent.

If canonical serialization changes, treat the impact on:
- stored snapshot IDs,
- backup compatibility,
- replay,
- duplicate detection,
- historical verification

as a persistence-contract concern.

## Replay semantics

Primary source:
- `src/snapshots/calculate.ts`

Replay verifies that a historical snapshot can still be regenerated under
its supported model semantics.

Replay does not rewrite history.

Conceptually:

STORED HISTORICAL SNAPSHOT
↓
REGENERATE EXPECTED RESULT
↓
COMPARE UNDER DECLARED REPLAY RULES
↓
VERIFY
↓
RETURN ORIGINAL HISTORICAL SNAPSHOT

Do not replace the original stored snapshot with the current runtime's
recalculated values merely because replay succeeded.

Historical hash-covered values must retain their identity.

## Replay tolerance

Replay tolerance exists only where explicitly permitted.

It must not authorize material changes to:
- original inputs,
- executable order quantities,
- configuration,
- money values that require exact comparison,
- model identity,
- or materially different portfolio targets.

Small cross-runtime floating-point differences in derived analytics may
be tolerated only under the declared replay contract.

Do not widen replay tolerance merely to make an incompatible snapshot
pass.

## Snapshot sanitization

Validate and normalize a newly supplied snapshot before persistence.

Persist the validated snapshot representation.

Do not write the original untrusted wrapper after validation merely
because validation succeeded.

Unknown outer fields from newly supplied/untrusted snapshot wrappers must
not silently enter:
- normal financial storage,
- normal backups,
- newly written validated snapshot records,
- or future replay state.

This ingress-sanitization rule does not authorize rewriting or sanitizing
already stored corrupt records that raw recovery preserves for forensic or
recovery purposes.

Validation is both a correctness and storage-boundary step.

## Normal backup

Primary source:
- `src/persistence/store.ts`

A normal backup represents validated portable application data.

Its state and snapshots must pass their normal validation boundaries.

Normal backup must not include:
- provider credentials,
- service-worker cache state,
- arbitrary browser cache contents,
- unknown snapshot wrapper fields.

A backup is not proof that external market data was authentic.
It preserves the application state accepted under the relevant contracts.

## Raw recovery

Raw recovery is different from normal backup.

Conceptually:

NORMAL BACKUP
= validated portable application data

RAW RECOVERY
= forensic/emergency preservation of stored records

Raw recovery may contain material that normal application validation
rejects, including unknown fields already present in stored corrupt records.

Preserving such material is forensic preservation, not validation or
sanitization.

The JSON raw-export path rejects records that JSON cannot represent without
changing or dropping values. `RAW_RECOVERY_NOT_JSON_SAFE` leaves the original
IndexedDB records and recovery copies intact; it does not produce a lossy
export. JSON export and preservation inside IndexedDB are distinct operations.

Treat raw recovery as potentially unvalidated and sensitive.

Do not treat raw recovery as automatically valid financial state.

Do not feed raw recovery directly into ordinary restore unless an
explicit validated recovery process exists.

Raw recovery exists to preserve evidence and recovery options, not to
weaken validation.

## Restore discipline

Restore is a potentially destructive state replacement.

Validate replacement data before destructive mutation.

Before opening the replacement write transaction, validate as applicable:

- backup envelope,
- backup format,
- state schema,
- every snapshot,
- snapshot integrity,
- duplicate snapshot IDs.

Do not clear current state first and validate later.

## Restore transaction

A restore must remain atomic.

Within the restore transaction:

1. verify expected current revision,
2. preserve the previous state and snapshots into recovery,
3. write the validated replacement state,
4. replace the snapshot set,
5. complete the transaction.

If any step fails, the restore must fail as a whole.

Do not leave:
- restored state with old snapshots,
- old state with new snapshots,
- a cleared snapshot store,
- or another mixed partial state.

## Recovery-before-replacement

Before a valid restore replaces current financial state, preserve the
previous committed state and snapshot set in recovery storage.

Recovery history protects against:
- mistaken restore,
- unexpected restored content,
- later discovered incompatibility,
- corruption investigation.

Do not delete the previous state merely because the incoming backup has
already passed validation.

## Recovery of corrupt state

A recovery path may inspect minimal metadata needed to perform recovery.

That does not make the corrupt state valid.

For example, a defensively extracted revision may be used to coordinate
restore while the underlying state remains classified as corrupt.

Preserve the corrupt original in recovery when possible.

Do not sanitize the original in-place and thereby destroy forensic
evidence before a successful replacement is committed.

## Failure discipline

Persistence failures must fail explicitly.

Do not:
- silently reset corrupt state,
- partially save,
- partially restore,
- ignore transaction aborts,
- bypass revision conflicts,
- weaken snapshot integrity,
- rewrite historical snapshots during replay,
- silently drop unsupported fields during a guessed migration,
- or destroy old state before replacement data is validated.

A plausible reconstructed state is not proof of correct recovery.

## Persistence evidence map

### Financial state schema

Read:
- `src/persistence/schema.ts`

### IndexedDB operations

Read:
- `src/persistence/store.ts`

### Snapshot integrity

Read:
- `src/snapshots/integrity.ts`

### Snapshot calculation and replay

Read:
- `src/snapshots/calculate.ts`

### Primary regression tests

Read:
- `tests/persistence.test.ts`
- `tests/snapshots.test.ts`

### Legacy compatibility

Read when historical replay or migrations are involved:
- `tests/legacy-snapshot.json`
- snapshot compatibility tests and validation artifacts relevant to the task.

### Historical hardening evidence

Read:
- `docs/final-hardening/engineering-ledger.md`

Historical reports explain reproduced defects and why safeguards exist.
They do not automatically define current runtime status.

## Persistence Change Gate

Before changing persistence code, classify the change.

### A — Storage implementation change

Examples:
- IndexedDB plumbing,
- request/transaction handling,
- browser API compatibility,
- performance implementation.

Stored financial semantics remain unchanged.

Requirements:
- preserve schema meaning,
- preserve revision behavior,
- preserve atomicity,
- preserve backup/restore meaning,
- run targeted persistence regressions.

### B — Compatibility-preserving persistence change

Examples:
- transaction hardening,
- recovery improvement,
- sanitized storage,
- better corruption diagnostics,
- implementation-preserving migration support,
- safer multi-tab behavior.

Existing valid state, backups, and snapshots retain their meaning.

Requirements:
- prove valid historical data still loads,
- prove failures do not partially mutate storage,
- preserve recovery paths,
- test reload/reopen behavior,
- test representative corrupted inputs.

### C — Persistence contract change

This includes any change to:
- financial state schema,
- migration meaning,
- backup format,
- restore semantics,
- revision/concurrency rules,
- snapshot identity,
- snapshot replay contract,
- recovery retention,
- storage ownership,
- or destructive replacement behavior.

Do not implement this as a routine storage refactor.

A persistence contract change requires:
1. explicit task scope or decision,
2. old and new stored semantics,
3. migration strategy,
4. idempotence analysis,
5. interruption/failure analysis,
6. backup compatibility analysis,
7. snapshot/replay impact review,
8. recovery strategy,
9. regression fixtures from previous formats,
10. browser/PWA lifecycle validation when relevant.

Before shipping such a change, answer:

- What happens to an existing installed PWA?
- What happens after reload?
- What happens after force-close?
- What happens after app update?
- What happens to old backups?
- What happens to old snapshots?
- What happens if migration is interrupted?
- Can the original data still be recovered?

## Cross-domain boundaries

Read `ai/data/README.md` when:
- persisted datasets,
- market-data cache,
- credentials,
- provider state,
- or data schema semantics are involved.

Read `ai/math/README.md` when:
- snapshot replay differences originate from mathematical semantics,
- model versioning,
- solver behavior,
- or allocation outputs.

Read `ai/ui/README.md` when:
- save state, restore state, recovery actions,
- conflict presentation,
- or invalid draft handling are displayed incorrectly.

Read `ai/pwa/README.md` when:
- IndexedDB lifecycle,
- browser suspension,
- standalone mode,
- update behavior,
- storage eviction,
- reload,
- force-close,
- or physical iPhone persistence is involved.

Read `ai/release/README.md` when:
- backup compatibility evidence,
- frozen persistence files,
- migration validation,
- or release packaging are involved.

Do not patch persistence to compensate for a defect owned by another domain.
