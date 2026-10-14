# EQUINOX v1.3.3 red-team verification — corrected App v1.3.4

Auditdato: 2026-10-14. **Input-verdict: PATCH REQUIRED.** Korrigeret handoff: **App 1.3.4, releaseStatus BLOCKED**. Ingen deploy-, browser-, live-provider- eller iPhone-godkendelse.

Den leverede v1.3.3-kandidat overlevede ikke angrebet: tre material correctness-problemer og ét mindre UI-problem er reproduceret og rettet. Astras P2 og R1 er korrekte inden for deres erklærede scope. P1 løser de rigtige generelle JSON-problemer, men har et overset presence-hul og en recovery-copy-regression. Defensiv revision/recovery havde desuden en uafhængig safe-integer-fejl.

## 1. RED-TEAM VERDICT og kandidatidentitet

**PATCH REQUIRED**, ikke NO PATCH REQUIRED. De nødvendige fixes er med i én komplet v1.3.4-ZIP. Integritet er separat fra release-godkendelse.

Authoritative input: `EQUINOX-v1.3.3-hardened-5a7ea73cd604bbeb.zip`.

SHA-256: `f481df7c1fa7d6ba404dddf406c6e2f3d10269309038833999b7dd7d273994db`.

Uafhængigt verificeret mod ZIP-bytes før correctness-review:

| Kontrol | Resultat |
|---|---|
| SHA-256 / størrelse | Exact match / 1.370.636 bytes |
| Entries / CRC / duplicate paths | 246 / PASS / ingen duplicates |
| Root / file types | Én `EQUINOX/`-root, kun regular files |
| Symlinks, special files, nested ZIP, node_modules, .env | Ingen |
| Manifest coverage | 245 filer = 243 product + 2 infrastructure; hashes og bytes match for alle |
| App / Engine / MarketDataModel | 1.3.3 / 1.0.1 / 1.1.2; package, lock og manifest enige |
| Input releaseStatus | BLOCKED |
| Standalone workflows | Begge byte-identiske med ZIP-kopierne og working baseline |
| Source gate på input | Faktisk udført PASS, 246 filer |
| Alle 223 source/test-hash bindings | Match; dette er integritet, ikke semantisk bevis |

Den præcise v1.3.2-working baseline blev hentet og hashet: `30e5ba825b00e1f16f531c945d668148ecca3ca1864559fb40f10f0f991eba3d`. Uafhængig ZIP-diff bekræfter, at Astra kun ændrede produktkode i `src/persistence/store.ts` og `src/ui/App.tsx`. Alle øvrige 42 source-filer er byte-identiske. Lockfile entries er uændrede bortset fra root-version. Frozen 1.3.1-ancestry er ikke omskrevet.

Den nye handoff har App 1.3.4, men stadig Engine 1.0.1, MarketDataModel 1.1.2, financial schema 1 og snapshot schemas 1/2. Assets, DKK, TSM-vindue, allocation-matematik, dependencies og workflows er uændrede. Den aktuelle workingBaseline er nu den præcise v1.3.3-input-ZIP; både dens v1.3.2-parent og frozen 1.3.1-reference er bevaret separat.

## 2. DID ASTRA MISS ANY PRODUCT DEFECT?

**Ja.** RT1, RT2 og RT4 er material correctness-fund. RT3 er et mindre, allerede eksisterende UI-fund. Ingen ny numerical, synchronized-data-gate, importer-security eller secret-exposure-defekt er påvist.

## 3. DID ASTRA PATCH ANYTHING INCORRECTLY?

**P1 er PARTIAL og introducerer en snæver recovery-regression.** `get("current") === undefined` beviser ikke, at recorden mangler. Astras nye betingede `state`-felt fjerner også en eksisterende corrupt `undefined`-record fra recovery-copyen. P2 og R1 er ikke fundet forkert patched.

## 4. DID ASTRA WEAKEN ANY CONTRACT?

Ingen påvist svækkelse af math, data, schemas, validators, replay, revisions, workflow-trust eller CI-gates. D1 afgrænser app-managed credential isolation fra raw forensic records; det er korrekt, ikke en redaction-feature. D2 beskriver den eksisterende klientlokale update-lock, ikke en ny global mutex. Et ønsket globalt all-tab-safety-krav ville fortsat kræve særskilt design og evidens; det er ikke løst ved prose.

## 5. DID ANY TEST PASS FOR THE WRONG REASON?

Én eksisterende test er svag for sin titel: `tests/engine.test.ts`, “full precision survives display formatting”, kalder `.toFixed(2)` men bruger ikke resultatet. Den tester dermed ikke den faktiske UI-formatting pipeline. Faktisk rendering/canonical-preservation i `tests/ui-presentation.test.ts` giver bedre, separat Node-evidens; ingen product precision-defekt er påvist.

Astras P1-cases, simultaneous-writer test, delayed calculate/seal-test og SW counters rammer reelle paths og består i deres fixtures. De dækkede dog ikke top-level stored `undefined` eller demo-file ownership. Den manuelle browser-import-case kontrollerer notice/dataset, ikke hele acknowledgement-reset/rejection-flowet. Ingen skjulte skips, loosened validators, forlængede timeouts eller nye arbitrary sleeps er fundet/tilføjet for at fremtvinge PASS.

## 6. DID ANY CLAIM RECEIVE TOO STRONG AN EVIDENCE STATUS?

**Ja.** CP089, CP103, CP105, CP108 og CP109 var VERIFIED IMPLEMENTED, men RT1 giver et konkret counterexample til deres brede presence/preservation-kontrakter. CP119/CP120 var allerede UNDERTESTED, men RT2 viser faktisk kontraktbrud i inputkandidaten. De skal ikke blot kaldes “manglende browserbevis”.

CP110 var også VERIFIED IMPLEMENTED, men unsafe corrupt revision metadata kunne få restore til at skrive en state, som det eksisterende schema derefter afviser; se RT4.

CP041 har et scope-problem: manual import kan bevare en eksplicit `synthetic-demo`-klassifikation og beregne med `DEMO_NOT_MARKET_DATA` uden user-data acknowledgement. `docs/data-contract.md` tillader netop et mærket syntetisk eksempel. Ingen authentication-upgrade er påvist; “user-supplied” skal derfor defineres præcist før en ubetinget classification-claim. Dette er AMBIGUOUS / CANNOT PROVE, ikke mandat til at ændre accepteret importsemantik.

## 7. DID DOCUMENTATION BECOME COSMETICALLY TRUE?

D1–D4 er source-konsistente afgrænsninger: credential-store kontra forensic record, lokal update-approval, MATH/accounting kontra provider-provenance, App orchestration og current schema2 kontra legacy schema1. De skjuler ikke nye kodeændringer. Blanket demo-isolation og rå preservation var derimod ikke fuldt implementation-true i v1.3.3; de konkrete huller er her rettet i kode, ikke ved at svække teksten.

## 8. P1 RAW RECOVERY VERDICT

**Input: PARTIAL, med snæver recovery-copy REGRESSION. Korrigeret: Node/fake-IDB regressions PASS; native browser/device BLOCKED.**

Alle centrale JSON-loss classes afvises: NaN, ±Infinity, -0, Date, Map, Set, BigInt, undefined fields/elements, sparse arrays, cycles og shared object graphs. Repeated primitive values og JSON-safe ukendte fields accepteres. Getter/prototype/function/Symbol-surprises skal vurderes efter IndexedDB structured cloning: unsupported functions/Symbol values når ikke denne lagrede path; accessors/custom prototypes er ikke bevaret som sådanne. Eligibility-checket arbejder på læste clones og skriver ikke originaler om. Pathologisk JSON/recursion-failure giver en generisk fejl, ikke en lossy success.

Hullet var record-presence: IndexedDB `get()` giver samme `undefined` for fravær og en eksisterende undefined-værdi. Se [MDN get()](https://developer.mozilla.org/en-US/docs/Web/API/IDBObjectStore/get). Ny code bruger exact-key `getAll("current")`: `[]` er fravær, `[undefined]` er corrupt. Normal load/save fejler for sidstnævnte, raw export afviser den, og explicit restore bevarer en own `state: undefined` i IndexedDB recovery.

Positive regressions dækker fresh absence, normal backup/restore, JSON-safe unknown fields, accepteret synchronized history, gyldigt sealed snapshot samt corrupted snapshot preservation. Der indføres ikke binary raw-export eller et relaxed restore-format. Originaler saniteres/slettes ikke som workaround.

## 9. P2 DEMO RACE VERDICT

**CORRECT i det reviewede source/Node-scope. Native browserregression er ikke udført.**

Det faktiske App-handler-probe dækkede Demo A→real, Demo A→Demo B, real→Demo A og real→demo→real: ingen stale automatic selection; demo writes 0; real job writes 1. Same-session positive control bevarede editable capital 4567/units 9, mens snapshot beholdt captured capital 1234/units 0. Duplicate submit blev undertrykt. Counteren er instance-local, og praktisk wrap/reuse er ikke plausibel. Reload/remount kan ikke genbruge den gamle closures result-selection i den nye instance.

RT2 er en anden ownership-path, ikke fejl i P2: `fileAction()` ventede på `File.text()` og valgte derefter current editor via `edit()`. Den nye session-guard beskytter dataset commit og snapshot selection efter deres asynchronous boundaries. Den er ikke generel cancellation af en allerede-entered restore eller rollback af committed real work.

## 10. RELEASE TOOLING R1 VERDICT

**CORRECT for det leverede input.** Manifestets authoritativeBaseline matcher præcis v1.3.2; frozen reference-hashes/dependencies er bevaret. Pakkeren vælger workingBaseline, og importer/source gate/workflows er byte-identiske med baseline. Metadatafeltet autentificerer ikke en vilkårlig fremtidig baseline; manifest integrity er ikke provenance/signature.

48 targeted release/import/source/hosted tests blev udført PASS: unsafe archive rejection, real lokal checksum-rsync/Git fixtures, stale-file deletion, workflow preservation og mocked hosted stale-byte rejection. De er ikke remote push-, GitHub-, deploy- eller faktisk HTTPS-smoke-evidens. Ingen trust boundary er svækket.

## 11. CLAIM MATRIX VERDICT

223 unique poster og alle oprindelige source/test-digests blev verificeret. A=65, B=127, C=17, D=7, E=7. C/D er kun GUIDANCE; E er kun HISTORY. Metoden tæller domæneplacerede kontrakter, ikke 223 selvstændige runtime-features.

| Status | Astra slutstatus | Red-team input-overlay | Efter fixes, scoped overlay |
|---|---:|---:|---:|
| VERIFIED IMPLEMENTED | 155 | 148 | 154 |
| IMPLEMENTED BUT UNDERTESTED | 37 | 35 | 37 |
| IMPLEMENTATION VIOLATES CONTRACT | 0 | 8 | 0 |
| AMBIGUOUS / CANNOT PROVE | 0 | 1 | 1 |
| GUIDANCE ONLY | 24 | 24 | 24 |
| HISTORICAL ONLY | 7 | 7 | 7 |
| Total | 223 | 223 | 223 |

Dette er en konservativ overlay, ikke et nyt bevis for samtlige tænkelige executions. CSV har eksplicitte `astra*`, `redTeamInputStatus`, `redTeamCorrectedStatus`, `redTeamReviewScope` og `redTeamEvidence`-kolonner. Carried rows er mærket som carried; full-suite success er ikke automatisk per-claim runtime-certification. Original report/matrix er bevaret byte-identisk som `ASTRA-REPORT-v1.3.3.md` / `ASTRA-CLAIM-MATRIX-v1.3.3.csv`. `validation/claim-parity*.json` er historisk v1.3.3-evidence, ikke de aktuelle v1.3.4-gates.

Broad source/assertion review omfattede alle syv domæner:

| Domain / samples | Uafhængig kontrol / begrænsning |
|---|---|
| SYSTEM CP001–006 | Static/local-first, ingen broker/backend, React dependency direction, accounting/App ownership |
| MATH CP007–034 | EW/IV/ERC, n−1 covariance×252, DKK/simple returns, negative/undefined RC, separate constrained targets, continuous L2, deterministic discrete execution, fees=0/residual/capital invariant, accounting/current vs projected. Python/SciPy references og replay bestod. Ingen global-optimizer-påstand tilføjet. |
| DATA CP037–066,075–085 | Five-asset all-or-nothing kontra manual coverage, Massive history/Nationalbank FX/CoinGecko reference roles, corporate actions, TSM boundary, freshness, acknowledgement, key/store/network separation. Fixtures er ikke live entitlement/CORS. |
| PERSISTENCE CP086–112 | Revision/atomicity/strict request/abort/reopen, canonical hash/replay, duplicate IDs, backup/restore/forensics, credential/cache exclusion. Presence-hole bevist/fixed; durability er stadig ikke fysisk. |
| UI CP119/120/124 + numeric/presentation | Drafts kontra valid state, current kontra captured/sealed, demo/file/result ownership, unavailable kontra zero. React rendering/native timing er ikke bevist af closure-harness. |
| PWA CP144–159 | VM approval/install/cache failure/previous-cache/auth/query/navigation guards; local approval versus shared worker. Native lifecycle/offline/install mangler. |
| RELEASE CP168–190 | Trusted pre-extraction validator, manifest/infrastructure scope, checksum/delete/non-force Git, gate order/Pages build, same-run hosted byte expectations. Hosted verifier uses mocked curl, ikke actual deployment. |

## 12. NEW FINDINGS — reproduction, root cause og fix

| ID / severity / owner | Source og counterexample | Root cause / mindste fix / evidens |
|---|---|---|
| RT1 / MEDIUM / PERSISTENCE | `store.ts` load/save/rawBackup/restore. Seed `current=undefined`, ikke delete key. Raw export omits state; load returns fresh; save overwrites; restore copy lacks own state. | Value brugt som presence-test. Exact-key getAll+length i de fire paths. 4 red failures før fix; targeted original+new persistence 34 PASS, efterfølgende full suite inkl. 3 ekstra positive/forensic cases PASS. |
| RT2 / MEDIUM / UI | `App.tsx` fileAction/edit. Start import i demo, hold text(), klik enabled Afslut demo, release. Original probe persistede den importerede dataset i real state, capital 4321, revision 2, og reopen viste ændringen. Også stale snapshot validation kunne select efter exit. | Async file handler havde ingen session ownership. Capture samme existing context-counter; guard før dataset edit og efter snapshot validation; stale error publication afvises; finally unlock. 4 red / 2 positive file tests før fix; alle 6 grønne efter. Native held-file case tilføjet men IKKE KØRT. |
| RT3 / LOW / UI/PWA | `App.tsx` controllerchange/update banner. Waiting worker aktiveres af anden klient; registration.waiting bliver null, men update-state forblev truthy, banner stod og button no-op. Pre-existing, ikke Astra-regression. | Manglende state reconciliation. Unapproved controllerchange fjerner kun registration uden waiting-worker; approved reload og newer waiting-worker bevares. 1 red / 2 positive controls før fix, 3 PASS efter. Native lifecycle ikke udført. |
| RT4 / MEDIUM / PERSISTENCE | `store.ts` revisionOf/save/restore. Stored corrupt revision `1e20` blev accepteret som metadata; restore skrev unsafe revision og følgende load afviste state. Safe MAX revision blev ved save/restore inkrementeret til en unsupported værdi. | Number.isInteger matcher ikke schemaets eksisterende safe-integer-grænse. Defensive extraction bruger Number.isSafeInteger; næste revision valideres før writes, med explicit STATE_REVISION_EXHAUSTED uden wrap/reset. Corrupt original bevares. 3 faktiske red failures før fix; 40 persistence-tests PASS efter. Ingen schema-ændring. |

Det nye `ui-session-redteam.test.ts` parser og eksekverer faktiske App-handlers, bruger rigtige validators og Store/fake-IDB, og styrer React-publications/async boundaries. Det er implementeringskoblet ved handler discovery og fejler, hvis handler flyttes; det er en eksplicit Node orchestration harness, ikke en mounted React/browser-test. Browserregressionerne holdes separat.

### Re-evaluerede race/failure-sekvenser

| Sekvens | Faktisk guard og udført evidens | Resterende gap |
|---|---|---|
| 1. Calculation A → edit → finish | Captured input + latest editable persistence; actual calculate/seal, App closure og Store reopen PASS | Native browser/keyboard timing |
| 2. Demo A → exit → Demo B → A finish | Counter mismatch blocks selection; real/demo write semantics tested PASS | Held-digest browser case unrun |
| 3. Credential A → B → late A | Captured key + abort/alive before cache and after async cache; source handler controls discard late response, A→B→A also tested | Browser storage event/CORS/entitlement |
| 4. Market refresh → financial edit | Captured acceptance context, latest-state merge; risk-import fake-IDB PASS; partial dataset rejected | Native combined refresh/edit |
| 5. Two stale writers | Revision read inside serialized write transaction; simultaneous separate connections PASS; RT4 safe-integer/exhaustion gates preserve original on failure | Native multi-tab IndexedDB |
| 6. Save pending → approve update | pending refs + button/action guards + awaited queue, source-reviewed | Native pending save + worker lifecycle unrun |
| 7. Waiting worker during operation | Local update lock; message only after approval; VM handler PASS; RT3 reconciliation PASS | Shared multi-client lifecycle, no global mutex |
| 8. Update reload → restore/recovery | Store validation/revision/atomic recovery + immutable replay PASS separately | No actual combined installed update/restore |
| 9. Partial provider acquisition | All required components + builder gates; partial cases fail under fixture tests | Live partial auth/CORS failures |
| 10. Offline → reconnect/stale history | Online flag is not financial consent/freshness; no automatic financial refresh; source/parser tests | Browser/installed offline reopen unrun |
| 11. Failed SW install | VM failure cleans newly created cache, retains pre-existing cache; PASS | Native SRI/install rollback unrun |
| 12. Force-close before commit | Completed transaction boundary; abort/injected failure tests roll back | Real process interruption before durable commit NOT TESTED |
| 13. Force-close after save | strict requested + reopen in fake-IDB PASS | Physical confirmed-save durability NOT TESTED |
| 14. Restore duplicate IDs | Validates all seals/duplicate IDs before replacement; unchanged raw state PASS | Native transaction timing |
| 15. Corrupt legacy raw recovery | JSON eligibility + revised presence handling + original recovery copies PASS | Native arbitrary corrupted DB graphs |

Cache data that was already valid may survive cancellation; that is not financial acceptance or credential verification. An already-entered restore is not cancelled by a later session transition. These limits are not silently upgraded to protection guarantees.

## 13. VALIDATION ACTUALLY EXECUTED

Current gate command: `node scripts/validate-v13.mjs` with the freshly extracted exact v1.3.3 baseline as argument. Current full result in `validation/final-checks.json`: **BLOCKED**, no correctness FAIL. Its nonzero exit is caused by missing browser runtimes, not test failure.

| Gate | Faktisk resultat / scope |
|---|---|
| Input identity, CRC, full coverage, source gate | PASS, actual supplied ZIP/source |
| Original v1.3.3 suite | 289/289 PASS, 31 files |
| Red/green counterexamples | 4 presence/recovery + 4 file + 1 worker + 3 unsafe/exhausted-revision negative cases failed for expected reasons before their fixes; green receipts preserved |
| Current clean npm ci / lint / typecheck | PASS; exact lock, current source and browser spec types |
| Python reproduce/reference + raw-data reference | PASS; no golden financial values edited |
| Current full unit/integration | **314/314 PASS, 33 files** |
| Accepted synchronized history | PASS at original acquisition-clock; 253 observations/252 returns, not new acquisition |
| Immutable snapshot replay | Five supported snapshots preserve original canonical results/hash; comparison to exact v1.3.3 input PASS |
| Frozen-source audit | PASS; protected math/data/TSM sources and ancestry unchanged; operational Store exception remains explicit |
| Builds `/`, `/equinox-path-check/`, `/EQUINOX/` | PASS plus static manifest/id/scope/asset checks; last is Pages-style, not actual deploy |
| Generated PWA / SW VM | PASS; exact shell assets, icons, protected request guards; no native installation inference |
| Release/import/source/hosted tests | 48 targeted tests PASS and included again in full suite; real isolated local rsync/Git, mocked curl for hosted verifier |
| Credential structural scan | PASS; no real credentials supplied, not universal penetration/secret-detection proof |
| Browser discovery | 94 cases = 47 per project; ZERO application assertions executed |
| Completed ZIP/source/import check | Actual regenerated manifest, CRC/hash/bytes/source equality and trusted import validator; final counts/digest are in delivered archive receipt |

Den første post-change fulde run havde to test-fixture/version-FAILs: expected UI version var stadig 1.3.3, og en ny accepted-history fixture manglede den eksisterende krævede acknowledgement. Begge testinputs/metadata er rettet uden at ændre/relaxe production validation. En efterfølgende run bestod 311 tests; efter RT4 og tre ekstra cases er den sidste friske fulde run 314 PASS. Den tidligere FAIL-record er bevaret som superseded historik i `validation/red-team-first-gates.json`, ikke skjult eller genmærket PASS.

## 14. VALIDATION NOT EXECUTED / BLOCKED og iPhone checklist

Chromium launch: BLOCKED, pinned executable unavailable efter download ikke gav en usable archive. WebKit pinned binary blev hentet, men launch er BLOCKED af manglende GTK/GStreamer/andre host libraries. Ingen permissions blev omgået. Der er ikke kørt nye demo/credential/file browser cases, selv om de er typechecked/discovered.

NOT TESTED: faktisk GitHub Actions, remote import/push, deployment, actual hosted HTTPS exact-byte smoke, live Massive/CoinGecko auth/CORS/entitlement, fysisk Safari, installed PWA, Add to Home Screen, force-close durability og real waiting-worker lifecycle. Node mocks ≠ browser; browser ≠ physical iPhone; mocked hosted verifier ≠ hosted origin.

IPHONE-checklisten dækker fresh Safari/standalone, reduced motion, safe areas, keyboard/drafts, large text/themes, saved-state force-close, demo, credentials, provider fail-closed, offline/reconnect, restore/recovery og approved waiting update. Intet punkt var udført. Suppleret med eksplicit pending demo-file ownership, two-client update/banner og failed-install/previous-shell survival; alle står NOT TESTED. Global all-tab mutex er ikke lovet. VoiceOver/native interruption-varianter og andre iOS-versioner må ikke udledes af disse gates.

## 15. FILES CHANGED BY THIS RED TEAM

Produktkode: **kun `src/persistence/store.ts` og `src/ui/App.tsx`**. Ingen `src/risk`, `optimization`, `execution`, `portfolio`, `market-data`, `snapshots` eller schemas ændret. `MarketDataSettings.tsx`, calculation-job og service-worker builder er også uændrede.

Tests: nye `tests/persistence-redteam.test.ts` (16 cases), `tests/ui-session-redteam.test.ts` (9 cases); to native-browser cases tilføjet til `tests/browser/hardening.spec.ts`; den eksakte UI version-assertion i `tests/ui-presentation.test.ts` følger 1.3.4. Ingen eksisterende test slettet/skipped eller tolerance/timeout svækket.

Metadata/docs: package/lock root-version, exact app version i `scripts/audit-v13.mjs`, workingBaseline metadata, README, current report/matrix/changelog, de to berørte AI ownership-noter, mobile release og iPhone-gate. Fresh final-* validation receipts og red/green/red-team receipts er inkluderet. Original Astra report/matrix bevares som historiske kopier. Manifest regenereres fra faktiske bytes, ikke håndjusterede hashes. `scripts/package-v13.py`, importer, Pages workflow og infrastructure authority er uændrede.

## 16. PATCHED DELIVERY

Én komplet content-ID v1.3.4-ZIP, ikke en omdøbt/repacked uændret kandidat. Exact ZIP SHA-256, entry count, covered file count og import/CRC-verdict står i den eksterne `ARCHIVE-VERIFICATION.json`; en ZIP kan ikke hash-dække sin egen færdige digest. ReleaseStatus forbliver **BLOCKED**.

De konkrete genkørte commands og outputs står i `validation/final-checks.json`; red/green JSON og scope i `validation/red-team.json`. Uafhængige reviewers fandt ingen Critical/Important fejl i de målrettede corrections; deres testkørsler er også Node-only. GitHub/hosted/device-gates skal gennemføres mod den præcise importerede commit før en senere release-PASS. Dette audit giver ikke mandat til at ændre TSM-vinduet eller nogen financial/data-model.
