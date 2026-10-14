# EQUINOX 1.3.3 — AI claim ↔ implementation parity

Auditdato: 2026-10-13. Leverancestatus: **BLOCKED**. Dette er en komplet, lokalt kontrolleret source-handoff til næste GitHub-validering; det er ikke deploy- eller iPhone-godkendelse.

## 1. Executive verdict

AI-laget er overordnet troværdigt som kontrakt- og navigationslag, når claims læses med deres konkrete evidensgrænse. Auditten fandt to produktfejl, én release-tooling-fejl og dokumentationsuklarheder, som er rettet i deres ejende lag. Der er ikke fundet grundlag for at ændre finansiel matematik, Engine, MarketDataModel eller accepteret TSM-semantik.

**Det er ikke bevist, at alle runtime-contracts virker i browseren eller på iPhone.** 37 material claims har implementation, men utilstrækkelig udført runtime-evidens. Begge browserprojekter er blokeret før applikationsassertions. Ingen historiske PASS-resultater bruges som nye testresultater.

Authoritative working baseline er den komplette `EQUINOX-v1.3.2-hardened-96fee561cdd34a92.zip`: **30e5ba825b00e1f16f531c945d668148ecca3ca1864559fb40f10f0f991eba3d**, 1.294.165 bytes, 240 filer. En eventuel chat-upload-suffiks er ikke et repository-filename-fund. Da en midlertidig arbejdskopi ikke var bevaret, blev kandidaten genskabt fra denne byte-identiske ZIP, og reproduktioner/tests blev kørt igen.

| Identitet | Input | Slutkandidat |
|---|---|---|
| App | 1.3.2 | **1.3.3** |
| Engine | 1.0.1 | **1.0.1** |
| MarketDataModel | 1.1.2 | **1.1.2** |
| Financial state schema | 1 | 1 |
| Snapshot schemas | 1 / 2 | 1 / 2 |
| Assets / currency | GOOGL, ISRG, TSM, BTC, ETH / DKK | Uændret |

Patch-versionen er nødvendig, fordi to shipped produktadfærd ændres. Model- og state-schema-versioner ændres ikke: gyldige beregninger, snapshots, normal backup og restore har samme semantik.

## 2. Complete claim parity summary

[CSV-matrixen](claim-matrix.csv) og `validation/claim-parity.json` indeholder **223 poster**. Hver post identificerer AI-fil/sektion, paraphraseret claim, klasse A–E, ejende domain, canonical source, relevante tests, om assertions rammer claimen, evidensgrænse og input-/slutstatus. JSON inkluderer hashes af de konkrete source- og testfiler. Manifestet er udeladt fra denne sekundære hash-map for at undgå cirkulær self-reference.

Tællingen gælder domæneplacerede claims/regler, ikke 223 uafhængige runtime-features. Tværgående guardrails kan optræde i flere ejerskabs-/evidenskontekster. Pure engineering guidance, evidence rules og historical context tælles separat fra implementation.

| Parity-status | Input | Efter patch |
|---|---:|---:|
| VERIFIED IMPLEMENTED | 147 | **155** |
| IMPLEMENTED BUT UNDERTESTED | 40 | **37** |
| DOCUMENTATION OVERCLAIM | 1 | **0** |
| IMPLEMENTATION VIOLATES CONTRACT | 3 | **0** |
| AMBIGUOUS / CANNOT PROVE | 1 | **0** |
| GUIDANCE ONLY | 24 | **24** |
| HISTORICAL ONLY | 7 | **7** |
| Total | 223 | **223** |

`VERIFIED IMPLEMENTED` er altid afgrænset af postens `currentEvidenceLevel`. Eksempelvis beviser en worker-VM-test den udførte JavaScript-handler under fixtures, ikke native service-worker-lifecycle. En statisk fraværsclaim om brokerintegration er source-inventory-evidens, ikke en udført penetrationstest. At en testfil findes, tæller ikke som udført browser-evidens.

A = current implementation claim; B = architecture invariant; C = future change rule; D = evidence rule; E = historical context. C/D skal ikke have en tilsvarende runtime-feature. Der er 192 material implementation/contract-poster og 31 guidance/history-poster.

## 3. Product defects found and fixed

### P1 — HIGH — Raw recovery kunne eksportere ændrede forensic values

**AI-contract:** Raw recovery bevarer lagrede records, herunder ukendte corrupt felter; nye writes må saniteres uden at saniteringsreglen ødelægger gamle originals.

**Faktisk adfærd:** `Store.rawBackup()` sendte rå IndexedDB-records direkte gennem `JSON.stringify`. Det omdanner NaN/Infinity til null, Date til streng, Map til tomt object, udelader undefined-felter, fylder array-huller med null, omdanner negativt nul til nul og mister delt object-identitet. Eksporten kunne derfor se succesfuld ud uden at bevare den oprindelige forensic struktur.

**Reproduceret:** Før rettelse fejlede syv målrettede cases, fordi eksporten resolved i stedet for at afvise. En efterfølgende adversarial case reproducerede desuden tab af shared object identity. Disse er forventede pre-fix FAIL-reproduktioner, ikke slutkandidatens teststatus; detaljer er i `validation/claim-parity-audit.json`.

**Root cause / minimal fix:** `src/persistence/store.ts` kontrollerer JSON-repræsentérbarhed før eksport og returnerer `RAW_RECOVERY_NOT_JSON_SAFE`, hvis eksporten ville ændre værdier/struktur. Det skriver ikke records om. Cykliske eller delte object-grafer afvises også. En fraværende state-record udelades fra recovery-envelope i stedet for at opfinde et undefined-felt. Restore bevarer fortsat de rå tidligere records i samme atomiske replacement-transaktion.

**Regression:** `tests/persistence.test.ts` kontrollerer de otte tabsformer, uændrede recovery-kopier, bevaret shared identity inde i IndexedDB, JSON-safe ukendte gamle felter, fresh-state absence samt en gyldig risikohistorik med sealed beregning. Normal backup virker stadig efter restore af gyldige data. Dette er fake-indexeddb/Node-evidens; ikke fysisk iPhone-durabilitet.

**Begrænsning:** Rettelsen indfører ikke et nyt binært eksportformat for vilkårlige IndexedDB-grafer. Hvis raw JSON-eksport afvises, ligger originalen og recovery-kopierne fortsat i IndexedDB. De må ikke slettes eller saniteres som workaround.

### P2 — MEDIUM — Demo A kunne publicere et resultat ind i demo B

**AI-contract:** Demo-session og sealed beregning må ikke sammenblandes med et andet current editing context; nye input ændrer applicability, ikke historisk identitet.

**Faktisk adfærd / konkret source-counterexample:** `App.run()` huskede kun `wasDemo`. Sekvensen demo A → beregn → afvent hash → afslut demo → start demo B → A afsluttes giver `wasDemo === (demoRef.current !== null)` lig true. Dermed kunne A vælge sit snapshot i B. Den eksisterende personlige persistence-isolation var korrekt: demo skrev ikke real state.

**Minimal fix:** `src/ui/App.tsx` identificerer calculation context med en sessionstæller, der ændres ved demo-entry/exit. Et gammelt job kan ikke automatisk vælge sit resultat i en senere session. Et real job kan fortsat gemmes i historik; et demo job bliver fortsat ikke persisted. Det er en publication guard, ikke generel job-cancellation eller ændret matematik.

**Regression:** Ny held-digest-test i `tests/browser/hardening.spec.ts` kører demo A med 1234, forlader den, starter demo B med 9876 og slipper først derefter A. Den kræver ingen gammel købsplan i B og uændret real kapital 4321/historik. Testen bruger faktisk readiness og event-betingelser, ingen arbitrary sleeps.

**Evidensgrænse:** Fejlen er et deterministisk counterexample i den faktiske source. Browser-reproduktionen og post-fix browser-regressionen er **NOT TESTED LOCALLY — ENVIRONMENT BLOCKED**. Slutstatus for denne claim er derfor IMPLEMENTED BUT UNDERTESTED, ikke browser-PASS.

## 4. Release-tooling and AI-documentation defects

| ID / severity | Faktisk problem og evidens | Rettelse / contract-impact |
|---|---|---|
| R1 / MEDIUM | `package-v13.py` brugte de historiske `inputArchive/inputSHA256` fra 1.3.1 som `authoritativeBaseline`, også når working ZIP var 1.3.2. Den eksisterende input-manifest viser fejlen direkte. | Separat `workingBaseline` i `validation/final-baseline.json`; pakkeren bruger dette til current archive identity. Originale frozen-source hashes og dependency-ancestry bevares. Metadatarettelse; manifest V3 og trust model uændret. |
| D1 / HIGH | AI PERSISTENCE sagde ubetinget, at credentials ikke indgår i recovery-kopier, samtidig med at raw corrupt records skal bevares. Ukendte gamle felter kan indeholde følsomt materiale. | Afgrænset til appens separate credential store og nye validerede writes. Raw recovery er ingen redaction-garanti. Test med syntetisk gammelt credential-felt bevarer originalen. Documentation overclaim rettet; ingen sanitering af gamle records. |
| D2 / MEDIUM | AI PWA's unfinished-work-regel kunne læses som en global all-tab activation barrier. `App.tsx` har lokale refs og reload-flag, ingen tværgående mutex. | Scope præciseret til den godkendende App-instans. En anden klient kan godkende fælles worker-activation; denne klient auto-reloader kun efter egen approval. Ingen runtime-policy ændret. |
| D3 / MEDIUM | Canonical root README placerede `portfolio/` under provider/Data Truth og beskrev App som kun input/præsentation. Det strider mod `accounting.ts` og faktisk App-orkestrering. | Accounting routes til MATH, App beskrives som workflow-orkestrering uden domæneregel-ownership. Ingen kode flyttet. |
| D4 / MEDIUM | Canonical README linkede almindelig aktuel risk-brug til legacy schema1-doc og mærkede gammel hardeningrapport som current. | Current schema2, legacy schema1, historisk research og aktuel parity-evidens er eksplicit adskilt. Version/changelog/mobile/device-header konsistente. |

UI-/DATA-README-routes er også opdateret til de konkrete nye race-tests med eksplicit forbehold for manglende browserkørsel. Der er ingen fuld omskrivning af AI-laget; AGENTS, router, SYSTEM, MATH og RELEASE AI-filerne er uændrede.

## 5. Evidence gaps and added regressions

| Gap | Tidligere evidens | Tilføjet evidens / resterende grænse |
|---|---|---|
| E1 — actual calculation capture | En delayed testfactory ignorerede inputargumentet. Den beviste latest-state forwarding, men ikke input-capture gennem den faktiske beregner. | Ny `calculation-job.test.ts` bruger rigtig calculate+seal efter hold, verificerer originalt input samt nyere capital/holdings sendt til persistence. PASS. Stubbens persistence-assertion udlægges ikke som IDB-atomicitet. |
| E2 — replaced key, late response | Sekventiel replace/remove beviser ikke et gammelt in-flight resultats publication guard. | Ny browser-case holder et svar, ignorerer transport-abort med vilje, erstatter key gennem anden tabs UI, kræver ingen connected/status/cache-commit. NOT TESTED LOCALLY. Ingen produktdefekt opfundet. |
| E3 — simultaneous stale writers | Eksisterende test dækkede sekventiel stale revision. | To faktiske separate fake-IDB Store-forbindelser skriver samtidigt med revision 0; præcis én fuld state/snapshot-pakke committer. PASS. |
| E4 — corrupt forensic originals | Nye wrappers blev saniteret, men det beviste ikke bevaring af gamle ukendte corrupt felter. | Raw export/recovery-copy-assertions med JSON-safe ukendte felter og syntetisk gammel credential-markør. PASS. |
| E5 — install versus requested activation | Worker-test kontrollerede activation promise, ikke antal skipWaiting-kald før godkendelse. | VM kræver 0 efter install, 0 efter ukendt message, 1 efter ACTIVATE_UPDATE samt waitUntil-promise. PASS. Native first-install transition er stadig ikke testet. |

Alle 289 unit/integration-tests er kørt. Begge nye browser-tests er typechecked og discovered, men ingen browser-applikationstests er kørt. De 90 opdagede cases svarer til **45 Chromium mobile + 45 WebKit mobile**; discovery er ikke 90 PASS.

## 6. Adversarial race / failure audit

| Sekvens | Source protection / root-cause owner | Targeted evidens | Resterende runtime-gate |
|---|---|---|---|
| Calculation A → nye input → A afsluttes | UI job capturer input og sender latest editor state til persistence; snapshot ændres ikke. Session-publication-fix P2 ved demo-skift. | `calculation-job.test.ts` PASS; App held-hash browser case findes. | Browser interaction/session-P2 NOT TESTED. |
| Credential A request → key B → A svarer | UI captured key, storage-event abort, alive/signal/key guard før publication/cache. DATA ejer transport. | Credentials/network unit PASS; ny held-response browser regression. | Browser race NOT TESTED; ingen live auth/CORS. |
| Market refresh → lokale financial edits | UI `finishRiskImport` bruger latest holdings/prices/consent; lookback/dataset-context change afviser. | `risk-import.test.ts`: actual fake-IDB save/reopen, abort/stale-context og failed save PASS. | Browser orchestration NOT TESTED. |
| Persistence pending → approve update | PWA/UI lokal pending/ref/disabled-guard; queue afventes før activation message. | Store commit/abort tests PASS; App source reviewed. | End-to-end pending native save + update NOT TESTED. Ingen global all-tab barrier. |
| Update/reload → restore/recovery | SW ændrer shell-cache; PERSISTENCE validerer restore og bevarer gamle records atomisk. | Store restore/failure/recovery tests PASS; SW VM PASS separat. | Den samlede installed-PWA-sekvens NOT TESTED. |
| To stale-revision writes | PERSISTENCE serialiserer overlappende IDB readwrite transactions og checker revision inde i transaktionen. | Ny samtidig to-connection test: én winner, én conflict, komplet winner-pair PASS. | Native browser concurrency NOT TESTED. |
| Restore med duplicate snapshot IDs | PERSISTENCE afviser hele backup før replacement transaction. | `persistence.test.ts` unchanged raw state/recovery efter afvisning PASS. | Native restore UI NOT TESTED. |
| Provider delvist succesfuld | DATA kræver alle assets/actions/FX/provenance; ingen partial accepted replacement. | `synchronized-import`, `refresh-network`, `risk-import` fixtures PASS. | Live deployed origin NOT TESTED. |
| Offline → reconnect med stale data | PWA online-event ændrer transportstatus; DATA freshness og manuelle refresh-knapper ejer datastatus. | Cache/presentation pure tests PASS; event wiring static. | Browser/installed offline-reopen NOT TESTED. |
| Failed worker install med valid gammel shell | PWA install afviser og rydder kun ny incomplete cache; gammel cache bevares. | Begge VM-branches PASS. | Native fetch SRI/install lifecycle NOT TESTED. |
| Waiting worker findes under andet job | PWA registrerer update banner; UI correctness guards blokerer approval under lokalt arbejde. | Source reviewed; eksisterende worker/provider browser flow unrun. | Browser timing NOT TESTED. |
| Force-close før/efter durable boundary | PERSISTENCE success venter på transaction completion og anmoder strict durability. Uafsluttede edits loves ikke bevaret. | Abort/strict durability/fake-IDB reopen PASS. | Fysisk force-close efter bekræftet save NOT TESTED. |

Refresh-cancellation efter en allerede valideret cache-write kan efterlade validerede cachedata. Contracten er, at ingen ready/accepted financial dataset publiceres efter cancellation; det er ikke en garanti om rollback af al normaliseret cache. Cache og accepteret financial state er forskellige domæner.

## 7. Routing and architecture verification

Alle ni AI-filer findes og indgår i produktmanifestet. AGENTS → router → alle syv domains er tilgængelig. **353 literal repository path-references** og relevante Markdown-links er kontrolleret uden missing paths; ingen orphaned domain. Se `validation/claim-parity-paths.json`. Domain-shorthand og `ai/<domain>/README.md` behandles som deklareret routing-template, ikke opdigtede filer.

| Scenario | Første domain | Næste source / mindste relevante regression | Ejende fix; undgå workaround |
|---|---|---|---|
| ERC weights wrong | MATH | `optimization/targets.ts`, `risk/math.ts`; `tests/reference.test.ts` | MATH hvis accepted input er korrekt; ret ikke DATA/UI for at skjule solverfejl. |
| Provider data stale | DATA | `live/model.ts`, `live/cache.ts`; `tests/market-cache.test.ts` | DATA freshness; ret ikke SW shell-cache eller UI-label til current. |
| Manual history rejected | DATA | `provider.ts`; `tests/data.test.ts`, derefter browser manual-import-case | General/manual contract; brug ikke automatisk 100%-coverage som workaround. |
| Input saved incorrectly | UI | `App.tsx` NumberField; `tests/browser/ui.spec.ts` | UI commit hvis submitted value er forkert; PERSISTENCE hvis korrekt submitted state mistes. |
| Risk zero instead of unavailable | UI | `presentation.ts`, `RiskView.tsx`; `tests/ui-presentation.test.ts` | UI hvis domain-null er korrekt; ændr ikke MATH til falsk nul. |
| Calculation after edits | UI | `calculation-job.ts`, `App.tsx`; `tests/calculation-job.test.ts`, browser held-hash | UI capture/publication; ændr ikke sealed snapshot eller engine input. |
| Key replaced during request | UI | `MarketDataSettings.tsx`; browser held-response test, derefter DATA network | UI lifetime/publication; flyt ikke credentials til financial state. |
| Restore after update fails | PERSISTENCE | `schema.ts`, `store.ts`, `integrity.ts`; `tests/persistence.test.ts` | Store/replay først; SW kun hvis forkert source-version faktisk leveres. |
| PWA old version | PWA | generated worker/build-pwa + App registration; worker/browser update tests | Cache/lifecycle; ændr ikke financial storage eller modelversion som workaround. |
| Pages stale assets | RELEASE | pages workflow exact hosted proof; `tests/hosted-release.test.ts` | Artifact/served bytes; local mocked smoke er ikke HOSTED. |
| iPhone keyboard hides Save | PWA | viewport, CSS, browser-hardening; device checklist, UI browser layout | PWA/UI geometry; svæk ikke numeric validation. |
| Release ZIP rejected | RELEASE | `package-v13.py`, `check-release-source.py`, importer; release-import/source tests | Fix kandidat, ikke validator for at acceptere den. |
| P/L uses cost as value | MATH | `portfolio/accounting.ts`; engine accounting test | Accounting; provider provenance og editable input har andre owners. |
| TSM evidence expansion | DATA | `live/tsm-adr.ts`, `risk-actions.ts`; `tests/tsm-final-dividend.test.ts` | Data/C med nyt source-review; ikke MATH/UI fallback eller ændret cutoff uden evidens. |
| Corrupt raw unknown fields | PERSISTENCE | `store.ts`; nye raw-recovery tests | Bevar originalen, afvis lossy export; saniter ikke forensic records. |
| Visible but inert app | UI/PWA | `LaunchIntro.tsx`, `launch-state.ts`, `App.tsx`, browser helper | Identificér faktisk readiness-ejer; arbitrary sleeps/introforlængelse skjuler ikke init-defekt. |

Source-paths i tabellen uden `src/` er forkortet til den angivne source-del; de fulde, maskinkontrollerede paths står i claim-matrixen. Source/tests har højere implementation-autoritet end historisk research. `docs/final-data-closure/data-semantics.md` er current schema2-contract; `docs/data-contract.md` er legacy schema1-compatibility; provider-research og tidligere release reports er historical evidence.

Change-gates: P1 er Persistence/B med explicit review af eksport-failure-boundary; eksisterende gyldige stored formats/replay ændres ikke. P2 er UI/B, som genopretter session-isolation uden at ændre brugerens tilsigtede workflow. R1 er Release/A metadata-correctness; pakkerens source/ZIP/import trust gates er uændrede. Ingen Math/C eller Data/C gennemføres. A/B i ét domain bruges ikke til at nedklassificere en reel C i et andet.

## 8. Files changed and why

| Fil | Konkret grund |
|---|---|
| `README.md` | Current version/evidence route; accounting ownership, App orchestration, schema1/2 scope og raw recovery limit. |
| `RELEASE-MANIFEST.json` | Regenereres fra endelige bytes/versioner; product/infrastructure adskilt. |
| `ai/data/README.md` | Route til konkret late-response/key-replacement regression uden browser-overclaim. |
| `ai/persistence/README.md` | Raw recovery er ikke redaction; lossy JSON-export afvises uden at ændre originaler. |
| `ai/pwa/README.md` | Update-guards er per approving App-instans, ikke global all-tab barrier. |
| `ai/ui/README.md` | Sessionbundet calculation-publication og præcis test/cancellation-afgrænsning. |
| `docs/claim-parity/CHANGELOG.md` | Ny 1.3.3 changelog, frozen boundaries og korrekt BLOCKED status. |
| `docs/claim-parity/claim-matrix.csv` | 223 klassificerede claims med source/test/evidens/før-efter status. |
| `docs/claim-parity/report.md` | Komplet parity-, root-cause-, race-, routing- og release-rapport. |
| `docs/iphone-checklist.md` | Header/version til 1.3.3; device-gates uændrede og ikke udført. |
| `docs/mobile-release.md` | Aktuel ZIP-version og rapport; workflowkopier er uændrede. |
| `package-lock.json` | Root package-version følger 1.3.3; dependency entries uændret. |
| `package.json` | Patchversion 1.3.3 for ændret shipped adfærd; dependencies uændret. |
| `scripts/audit-v13.mjs` | Eksakt appversion, korrekt baseline-scope og forklaring af Store-fix; frozen hashes uændret. |
| `scripts/package-v13.py` | Aktuel workingBaseline i manifest og korrekt current-report export; gates uændret. |
| `src/persistence/store.ts` | P1: lossless JSON eligibility check og korrekt fraværende state-envelope; originals bevares. |
| `src/ui/App.tsx` | P2: automatisk snapshotvalg bindes til real/demo editing session. |
| `tests/browser/hardening.spec.ts` | Held demo A/B digest regression; ikke kørt lokalt. |
| `tests/browser/market-settings.spec.ts` | Held credential-A response efter anden tabs key B; ikke kørt lokalt. |
| `tests/calculation-job.test.ts` | Rigtig delayed calculate/seal med exact input og latest state. |
| `tests/persistence.test.ts` | Lossy/raw/unknown-field/fresh/valid-risk og samtidige writer regressioner. |
| `tests/service-worker-security.test.ts` | Ingen skipWaiting på install/ukendt message; én efter approval-message. |
| `tests/ui-presentation.test.ts` | Eksakt appversion-assertion følger 1.3.3. |
| `validation/claim-parity-audit.json` | Baseline, faktiske pre-fix reproduktioner, fund og runtime-grænser. |
| `validation/claim-parity-paths.json` | Faktisk path/link/reachability-evidens for alle9 AI-filer. |
| `validation/claim-parity.json` | Maskinlæsbar fuld matrix med konkrete source/test-hashes. |
| `validation/closure-final-independent-reference.json` | Frisk referencekørsel; kun checkedAt ændret mod baseline. |
| `validation/closure-final-synchronized.json` | Frisk accepteret replay; kun checkedAt ændret mod baseline. |
| `validation/final-baseline.json` | Current working ZIP tilføjet separat; originale ancestry-hashes bevaret. |
| `validation/final-builds.json` | Friske build-byteidentiteter for de tre base paths. |
| `validation/final-checks.json` | Faktisk clean run, 289 PASS tests og BLOCKED browsergates. |
| `validation/final-credential-scan.json` | Frisk strukturel scan; scope og ingen runtime-PASS. |
| `validation/final-frozen-audit.json` | Frisk frozen-source evidence med explicit working/ancestry scope. |
| `validation/final-pwa.json` | Friske generated-artifact checks for 1.3.3. |
| `validation/final-snapshot-replay.json` | Frisk immutable replay; originale hash/results bevaret. |

Workflows er **uændrede**. Embedded `.github/workflows/pages.yml` og `.github/workflows/import-release.yml` bevares byte-identiske med input og de leverede standalone kopier. `rsync -a --checksum --delete` er bevaret. Ingen validator eller workflow-condition er svækket.

## 9. Tests added or changed

- `tests/persistence.test.ts`: 12 ekstra cases — otte lossy representation/graph cases, plain unknown-old-field preservation, fresh absence/restore, valid risk snapshot raw export og samtidig stale-writer atomicitet. I alt 24 persistence-tests PASS.
- `tests/calculation-job.test.ts`: én ekstra case med faktisk calculate/seal og forsinkelse; original input og latest editor state verificeres hver for sig.
- `tests/service-worker-security.test.ts`: eksisterende install/message-case udvidet med skipWaiting-call-counts og unrelated-message assertion. Ingen assertions svækket.
- `tests/browser/hardening.spec.ts`: demo A/B publication race, med readiness helper og held digest.
- `tests/browser/market-settings.spec.ts`: cross-tab key replacement med held late response og uændret state/history/cache.
- `tests/ui-presentation.test.ts`: appversionens eksakte assertion ændret til 1.3.3. Historiske fixture-versioner er fortsat historiske.

## 10. Validation actually executed

Slutkandidatens clean run er dokumenteret i `validation/final-checks.json`: **2026-10-13T17:36:15.194Z–17:37:09.210Z**. `npm run verify` gav nonzero exit, fordi browser-runtime-gates er BLOCKED; correctness-gates gav ingen FAIL.

| Gate | Resultat | Konkret evidensgrænse |
|---|---|---|
| Baseline source/manifest/CRC | PASS | 240 faktiske ZIP-filer, 237 product + 2 workflows + manifest; input-SHA ovenfor. |
| Baseline unit/integration | PASS | 276/276 før ændringer. |
| Root-cause reproduktion | EXPECTED FAIL | Syv raw JSON-tabscases før første fix + én shared-identity case før endeligt graph guard. |
| Clean npm ci | PASS | Lockfile; dependencies uændret fra working ZIP. |
| Lint | PASS | ESLint source/tests/scripts. |
| Typecheck | PASS | TypeScript inkl. nye browser-tests. |
| Python references | PASS | Uafhængige matematiske referenceberegninger, ingen ændrede golden values. |
| Unit/integration | PASS | **289/289**, 31 testfiler. |
| Accepted synchronized history | PASS | Gemte observationer ved oprindelig acquisition-clock; ingen ny live acquisition. |
| Independent raw-data Python reference | PASS | Samme accepterede data/semantik. |
| Immutable snapshot replay | PASS | Fem snapshots: Engine1.0.0/1.0.1 schema1 og schema2 EW/IV/ERC; originale hashes bevaret. Ikke browser replay. |
| Frozen-source audit | PASS | 24 frosne filer mod original 1.3.1-reference; operational exceptions forklares separat. |
| Working-baseline source comparison | PASS | Alle 27 øvrige non-UI source-filer byte-identiske; eneste ændrede non-UI kilde er Store. |
| Production build `/` | PASS | Genererede assets/manifest/worker inspiceret. |
| Path build `/equinox-path-check/` | PASS | Static base/scope/asset inspection. |
| Pages-style build `/EQUINOX/` | PASS | Static base/scope/asset inspection; ikke deploy. |
| Generated PWA / worker VM | PASS | Generated-artifact gate samt worker-unit-tests. |
| Browser discovery | PASS | 90 cases = 45 pr. projekt; **ikke execution**. |
| Chromium runtime + mobile | **BLOCKED** | Download ugyldig/truncated; executable mangler. Ingen app assertions. |
| WebKit runtime + mobile | **BLOCKED** | Engine downloadet; GTK4/GStreamer m.fl. mangler; systeminstaller afvist af miljø-permissions. Ingen app assertions. |
| Credential scan | PASS | Strukturel production/source/fixture-scan; kun syntetiske testværdier. Ikke universel secret-detection eller live browser-bevis. |
| AI paths / domain reachability | PASS | 9 filer, 353 literal source/evidence references; nul missing. |
| Import/source adversarial fixtures | PASS | Faktisk workflow-validator; real lokal rsync/git-fixture, ikke ekstern GitHub-mutation. |
| Hosted verifier regression | PASS | Mocked curl/fixture-bytecheck, ikke faktisk hosted origin. |
| Final source/ZIP/import validator | Se leveret receipt | Pakkeren reåbner den færdige ZIP og kører den leverede trusted importer. `ARCHIVE-VERIFICATION.json` og independent receipt er obligatoriske før levering. |

## 11. Validation not executed

**NOT TESTED LOCALLY — ENVIRONMENT BLOCKED:** Chromium mobile, WebKit mobile, Node-to-browser replay og de to nye browser-races. App assertions blev ikke startet. Installation og dependency setup blev forsøgt; miljøets begrænsninger blev ikke omgået.

**NOT RUN / NOT TESTED:** faktisk GitHub Actions run, remote import/push, deployment, faktisk hosted HTTPS smoke, live Massive/CoinGecko authentication/entitlement/CORS, fysisk iPhone Safari, Add to Home Screen og installeret PWA. Browser automation kan under ingen omstændigheder erstatte sidste gruppe.

GitHub CI er næste authoritative browser-validator. Release må ikke deployes ved correctness- eller browserfailure. Efter faktisk hosted verification skal Jakob udføre `docs/iphone-checklist.md` på den samme commit og registrere PASS/FAIL, device/iOS/URL/dato. Ingen af disse device-gates er allerede bestået i denne leverance.

## 12. Release manifest and archive integrity

Manifest-formatet er fortsat `EQUINOX_RELEASE_MANIFEST_V3`. Pakkeren regenererer produkt- og repositoryInfrastructure-hashes fra de endelige bytes. Every regular file except manifest er dækket præcis én gang, med bytes/SHA-256 og korrekt entryCount. AI-filer er product; de to workflows er infrastructure; ingen overlap.

Den komplette ZIP har én sikker `EQUINOX/`-root, ingen duplicate entries, nested ZIP, `.env`, credentials, dependencies, generated dist, symlinks eller special files. Synthetic fixture-markører er testdata, ikke bruger-secrets. Alle source-/test-/doc-/workflow-bytes sammenlignes igen efter åbning af den færdige ZIP, og den faktisk leverede importer-validator køres uden at eksekvere untrusted archive-kode.

Manifestets `authoritativeBaseline` peger nu på den korrekte 1.3.2 working ZIP. Frozen-reference ancestry forbliver i `validation/final-baseline.json`; den omskrives ikke. `releaseStatus` er **BLOCKED** og `physicalIPhone`/`hostedDeployment` er NOT TESTED.

## 13. Complete ZIP and SHA-256

Der leveres **én komplet** ny ZIP med almindeligt sikkert, entydigt navn `EQUINOX-v1.3.3-hardened-<content-id>.zip`. Det konkrete filnavn, ZIP-byteantal og SHA-256 findes i den leverede `ARCHIVE-VERIFICATION.json` og `ZIP-SHA256.txt`; en ZIP kan ikke indeholde sin egen færdige SHA uden cirkulær self-reference.

Archive receipt og independent re-verification receipt skal begge vise PASS for integritet. Det løfter ikke BLOCKED til releasegodkendelse. Standalone `pages.yml` og `import-release.yml` er identiske med embedded kopier og den oprindelige working baseline.

## 14. Remaining limitations and final adversarial review

- Ingen ny udført browser-, hosted-, live-provider- eller physical-iPhone-evidens. Den nye demo-publication-test og credential-race-test skal køres i begge browserprojekter.
- Raw recovery JSON kan afvise records, der ikke kan repræsenteres tabsfrit. Originale data og recovery-kopier forbliver lagret; der indføres ikke en ny arbitrary-IDB eksport-/import-feature.
- Update-locken er lokal for den godkendende klient. Dokumentationen lover ikke en global all-tab barrier eller garanti for uafsluttede writes ved browser/process termination.
- Browserlagring, persistent-storage request og Home Screen-installation er ikke garanti mod eviction. Fysisk durability efter bekræftet save er en separat device-gate.
- TSM er stadig begrænset til accepteret evidens gennem **2026-10-08**. Senere historik skal afvises; dette patch forlænger ikke vinduet eller ændrer gross dividend/return semantics.
- Integrity hashes beviser bytekonsistens, ikke authorship, uafhængig markedsauthenticity eller global matematisk optimalitet.

Egne patches er efterlæst mod failure boundaries: ingen finansiel referenceværdi ændret, intet testskip, ingen større timeout, arbitrary sleep, universal reload eller catch-and-ignore-success. Den yderligere shared-reference reproduktion og den gyldige risk raw-export-regression blev tilføjet under denne adversarial kontrol. Alle runnable gates er derefter kørt fra clean install. Browserbegrænsningen er synlig i både rapport, manifest og valideringsartifact.
