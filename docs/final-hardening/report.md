# EQUINOX 1.3.2 — final hardening report

**FINAL STATUS: BLOCKED**

De reproducerede fejl er rettet, og lokale ikke-browser-gates er kørt. Dette er en konkret patched source-leverance, ikke en godkendt deployment. Chromium/WebKit kan ikke starte i arbejdsruntime. GitHub Actions, hosted origin, provider-CORS og fysisk iPhone er derfor fortsat åbne gates. Ingen af disse kaldes PASS.

## Baseline og versioner

| Felt | Verificeret værdi |
|---|---|
| Faktiske input | `EQUINOX-v1.3.1-GitHub-ready(3).zip`, `pages(4).yml`, `import-release(3).yml` |
| Uploadnavne kontra bestilling | Vedhæftningerne har næste download-suffiks; indhold og versionsmetadata blev kontrolleret direkte. |
| Input ZIP SHA-256 | `c3965e1d93224fab1d23e68c0c9fdd7207c5b9598c63940d811e195639028231` |
| Inputstruktur | `EQUINOX/`, 211 filer inkl. manifest; 210 hash-/bytekontroller og ZIP CRC PASS |
| Input App → final App | **1.3.1 → 1.3.2**; shipped persistence/UI/PWA/network-kode kræver patchversion |
| Engine | **1.0.1**; finansiel matematik byte-identisk |
| MarketDataModel | **1.1.2**; model, normalisering, calendar, FX, corporate actions og TSM-evidens byte-identisk |
| Operational exceptions | `store.ts`, market `cache.ts` og `network.ts`: reproducerede lagrings-/transportfejl. Versionsbump af den matematiske model er ikke relevant for disse rettelser. |
| Workflows | Standalone importer med `--checksum` var autoritativ; embedded importer er opdateret. Begge endelige workflowkopier leveres byte-identisk. |

Ingen nye production dependencies. Playwright er opdateret fra 1.63.0 til præcis 1.64.0 på grund af upstream WebKit/service-worker/offline-fejlen #42775, rettet i #42894. Der er ingen ændring af assets, DKK, buy-only, zero-fee-kontrakt, kapitalinvariant, ERC/IV/EW eller return-semantik. TSM tillades fortsat kun gennem **2026-10-08**; senere datoer afvises.

## Rodårsager, rettelser og evidens

| ID | Fejl / rodårsag | Minimal rettelse og verificeret afgrænsning |
|---|---|---|
| D01 | Gamle browserflows skrev direkte i kapitalfeltet efter navigation, mens appen kunne være `inert` under LaunchIntro. Playwright fill garanterer ikke, at introen er fuldført. | Fælles readiness-helper kræver synlig `.app`, ingen inert-attribut og fjernet intro. Alle oprindelige 1234/4321/aria-invalid-assertions bevares. De tre rapporterede CI-fejl er **ikke lokalt reproduceret i browser**; den identificerede synchronization-fejl er rettet, men endelig kausal bekræftelse kræver CI. |
| D02 | NumberField beholdt ugyldig lokal draft, mens global status stadig sagde Gemt lokalt. Ekstern parent-opdatering under focus kunne efterlade en gammel gyldig visning efter blur. | Ugyldige drafts registreres til statuslinjen; blur viser seneste accepterede parent-værdi. Nye browserregressioner for tomt/negativt/overflow/decimal/rapid edit/focused external update; typecheck PASS, browser runtime BLOCKED. |
| D03 | En synkron exception efter første IndexedDB put/clear aborterede ikke transaktionen. Save/restore kunne melde fejl og alligevel committe delvis ny state eller slettet historik. | Begge metoder aborterer hele transaktionen, venter på settlement og rethrower fejlen. Separate save- og restore-injektioner af QuotaExceededError var RED og er GREEN; tidligere state, snapshots og revision bevares. Financial readwrite bruger strict durability. |
| D04 | Ved request-abort afviste request-promisen først; transaction-promisen blev aldrig awaited og gav unhandled rejection. | Transaction rejection observeres straks i begge stores; den returnerede promise forbliver rejected, og operationen fejler stadig. Afbrudte reads reproduceret RED/GREEN. |
| D05 | Save validerede et sealed snapshot, men skrev den oprindelige wrapper i stedet for den rensede valideringsværdi. Ukendte yderfelter kunne følge med i recovery. | Persistér validateSeal-resultatet. Syntetisk ukendt felt reproducerede retention før patch; nu udeladt, snapshot/hash uændret. Ingen rigtige secrets anvendt. |
| D06 | React busy-state er ikke en øjeblikkelig lock. En ekstra submit kunne komme før render; restore/import/backup kunne starte under en igangværende snapshotberegning. | Synkron calculation-ref og tilsvarende operation guards. Seneste normale edits bevares, snapshot gemmer eksakt calculation input. Kontrolleret browser-regression med tilbageholdt digest er tilføjet; runtime BLOCKED. |
| D07 | Recovery-handlinger var tilgængelige efter database-open failure, selv uden en DB-handle; recovery-export kunne afvise uden en lokal fejlmeddelelse. | Disable ved manglende DB/busy og vis eksportfejl. Browserfejlinjektion for storage-open/save tilføjet; runtime BLOCKED. |
| D08 | SW install brugte almindelige requests, som kunne genbruge gamle HTTP-cache-bytes under en ny worker. ACTIVATE_UPDATE ventede ikke på skipWaiting-promisen. | Hvert shell-request bruger cache reload og SHA-256 integrity for de aktuelle buildbytes; update message bruger waitUntil. VM-reproducer RED/GREEN og statiske PWA-gates PASS. Failed install sletter kun nyoprettet cache; eksisterende cache med samme navn bevares (se D14). Faktisk Safari cache/update/offline kræver browser/device. |
| D09 | 16 MiB body-check lå efter response.text(), så et vilkårligt stort providersvar blev bufferet før afvisning. | Stream læses med bytebudget og annulleres ved overskridelse. 32 MiB fixture blev før læst helt; nu stopper den efter den 17. 1 MiB chunk. RED/GREEN; ingen fallback-data. |
| D10 | Importeren kunne acceptere hash-konsistente arkiver med forkert source Engine/model, manglende appversion eller NUL-trunkerede paths. Metadata blev ikke tilstrækkeligt krydstjekket. | Source/package/lock/manifest/version/entry-count kontroller, JSON object/duplicate/nonfinite checks og orig_filename-kontrol. Adversarial importer tests og rigtig rsync/git-run. Hashes er integritet, ikke en digital signatur. |
| D11 | Den gamle embedded importer manglede checksum og kunne bevare stale filer med samme størrelse/mtime. Dette var allerede rettet i standalone input. | Det autoritative fix er bevaret: `rsync -a --checksum --delete`. Regression bruger faktisk rsync på forskellige bytes med ens size/mtime; workflows bevares og stale produktfiler slettes. |
| D12 | WebKit offline-tests havde early-return-bypasses, så et flow kunne registreres bestået uden at kontrollere offline. Upstream 1.63 havde samtidig en dokumenteret runtime-regression. | Early returns fjernet; samme fulde offline-assertions for begge projekter. Låst Playwright 1.64.0 indeholder upstream-fix. Dette er ikke et lokalt browser-PASS. |
| D13 | Aktuelle packaging-/audit-scripts refererede ældre baseline, hardkodede versioner og et genbrugt ZIP-navn; tidligere validator ændrede test-timeouts og kunne returnere succes ved manglende browser. | Faktisk ZIP-baseline med frozen hashes; standard npm test; begge browser-runtimeprobes; BLOCKED med nonzero exit; no-clobber content-navn; komplet manifest og re-open plus rigtig importvalidator. Historiske rapporter bevares som historik. |
| D14 | Failed SW install kunne efterlade en ny tom/orphan cache efter addAll-fejl. | RED/GREEN for cleanup. Install registrerer, om cachen fandtes i forvejen, og sletter kun en ny cache ved fejl. En code-only worker-update kan dele det aktive cache-navn; denne eksisterende offline-cache bevares og rejection propagates. |
| R01 | Det friske review reproducerede en blind plet i den nye source-kontrol: en ekstra unlisted vite.config.js kunne ændre Vites valgte config, mens alle kendte hashes bestod. | Eksakt source-inventory kræves nu, med eksplicitte build/git/test-output-exclusions. Yderligere repository-owned workflows er bevidst bevaret uden for leverede workflowhashes. Valid control + unlisted config/public asset/env: 3 RED før første rettelse; follow-up fandt også nested public/dist- og public/test-results-bypass (2 RED). Root-only exclusions i checker/pakker lukker varianten; 6 GREEN efter. |
| R02 | Det friske review fik den første identity-smoke til at bestå med ny release.json og gammel HTML/worker. Metadata alene bandt ikke siden til buildet. | Hashes/bytes fra det verificerede final Pages-build overføres som separat artifact til deploy og sammenlignes med hver hostet shell-fil. Fixture med stale HTML, worker eller JS afvises nu, mens præcise bytes består. Ingen faktisk hosted execution påstås. |
| H01 | CI-condition var svær at vurdere; hosted smoke kontrollerede kun generisk appindhold og kunne ikke identificere en stale deployment. | Eksplicit uafhængig browsercondition efter succesfuld install, ingen failure suppression; deploy kun efter verify. Build identity indeholder appversion og GitHub SHA; hosted smoke sammenligner identity og alle shell-bytes med det aktuelle runs proof-artifact. Dette er workflow-hardening, ikke påstand om en observeret forkert deployment. |

## Workflowændringer

**pages.yml:** Låste actions, også upload-pages-artifact. Source-/manifest-/workflowbytes kontrolleres før rapporter genereres. Node 24.19.0 og Python 3.12 bevares. Standard npm ci/lint/typecheck/Python/unit/risk/replay/build; frozen boundary audit er tilføjet. Chromium og WebKit har hver sin fulde gate og JSON-diagnostik; WebKit kører også efter Chromium-fejl. Ingen continue-on-error, skip eller svækket assertion. Browserdiagnostik kan uploades ved failure; produktartefakt og deploy kan ikke. Pages-path bygges for repository-navnet. Hosted smoke henter et separat checksum-artifact fra verify og kontrollerer eksakte hostede HTML/worker/manifest/JS/CSS/icon-bytes plus commit/appversion og scope. Upload/download-actions er SHA-pinned; sourcemaps og .nojekyll er ikke funktionelle shell-gates. Permissions/concurrency/timeouts bevares begrænsede.

**import-release.yml:** Autoritativ standalone baseline og checksum bevares. Exact filename/én-kandidat, zip-størrelse, expanded size, ratio, entry size/count, paths, symlink/special-file/encryption, duplicates, JSON, komplette hashes/bytes, versionskrydstjek og CRC før sikker ekstraktion. Ingen arkivkode eksekveres. Repository-workflows bevares; validation force-add og non-force push bevares. Endelig workflow er identisk inde i ZIP og som standalone. Opdatér begge workflows separat før source-import; kør release-CI manuelt på importcommit.

## Testmatrix

Den autoritative maskinrapport er `validation/final-checks.json`; archive-resultat er separat `ARCHIVE-VERIFICATION.json`. Tidligere rapporter under `validation/v1.3-*`, `docs/v1.3` og andre historiske mapper er **ikke** evidens for denne patch.

| Gate | Status | Evidens / afgrænsning |
|---|---|---|
| npm ci | PASS | Se faktisk kommando/output i final-checks.json. |
| Lint | PASS | Se faktisk kommando/output i final-checks.json. |
| Typecheck | PASS | Se faktisk kommando/output i final-checks.json. |
| Python Engine-referencer | PASS | Se faktisk kommando/output i final-checks.json. |
| Unit/integration | PASS | **276/276** tests i 31 filer, standard npm test fra clean npm ci. |
| Synchronized-history replay | PASS | Se faktisk kommando/output i final-checks.json. |
| Uafhængig raw-data Python-reference | PASS | Se faktisk kommando/output i final-checks.json. |
| Immutable snapshot-replay | PASS | Se faktisk kommando/output i final-checks.json. |
| Frozen financial source | PASS | Exact hashes, med tre dokumenterede operational exceptions. |
| Root production build | PASS | Se faktisk kommando/output i final-checks.json. |
| Repository Pages-path build | PASS | Se faktisk kommando/output i final-checks.json. |
| Default production build | PASS | Se faktisk kommando/output i final-checks.json. |
| PWA statisk/Node VM | PASS | Se faktisk kommando/output i final-checks.json. |
| Browser discovery | PASS | 86 cases / 43 per projekt; discovery er ikke runtime. |
| Chromium mobile | BLOCKED | NOT TESTED LOCALLY — ENVIRONMENT BLOCKED |
| WebKit mobile | BLOCKED | NOT TESTED LOCALLY — ENVIRONMENT BLOCKED |
| Credential structural scan | PASS | Se faktisk kommando/output i final-checks.json. |
| Source inventory / hosted stale-byte fixtures / worker security | PASS | 6 + 4 + 4 målrettede regressions, inkluderet i 276 total. Ikke faktisk hosted runtime. |
| Import adversarial + rsync/git | PASS | 38 tests; plus den faktiske ZIP efter creation. |
| Workflows, statisk | PASS | YAML parse, bash syntax, Python AST og manuel condition-/permissions-review. |
| GitHub Actions execution | NOT TESTED | Ingen repository-run udført i denne opgave. |
| Hosted smoke | NOT TESTED | Skal køres efter faktisk deployment. |
| Live provider/local key/CORS | NOT TESTED | Ingen rigtige nøgler anmodet om eller brugt. |
| Fysisk iPhone | NOT TESTED | Separate PASS/FAIL-gates i device-checklisten. |

Runtime-blokering: Chromium-download leverede 195 bytes HTML i stedet for browser-ZIP. WebKit-binary blev hentet, men kræver bl.a. GTK/GStreamer-libraries. Den normale systemdependency-installation afvises med seteuid/setgroups permissions. Ingen sikkerheds-/rettighedsomgåelse. Begge browserprojekter er discoverable; discovery er kun statisk inventory, ikke udført browser-test. Ingen browserassertions påstås bestået lokalt.

## Systemaudit og bevarede kontrakter

- Startup/lifecycle: intro state machine, reduced motion, visibility/reload, inert og initialization-consumers gennemgået; launch-unit tests kørt. Browser- og force-close deviceadfærd er ikke udledt deraf.
- Persistence: revision/conflict, queued edits, empty/corrupt state, schema/migration refusal, sealed snapshots, duplicate restore, recovery retention, asynchronous abort og synchronous rollback testet. Strict durability er en browser-anmodning, ikke en garanti mod al OS/eviction-dataloss. Ekstern privat backup er fortsat nødvendig.
- Demo: state/cache/credentials isoleres; eksisterende tests udvidet med demo-edit og close/reopen. Lokal browserudførelse af isolation er BLOCKED.
- Calculation: EW uden historik, IV/ERC accepted synchronized dataset, invalid/missing/stale input, repeated calculation og immutable replay dækkes af tests. Snapshot input/resultater/hash er bevaret. Matematiske references er oracle; ingen forventede finansielle beløb ændret for at gøre tests grønne.
- Market: timeout, cancel, statuscodes, malformed/schema/duplicates/missing/stale/pagination/order, canonical sessions/DST/holidays/FX/corporate actions, retrospective FX-kontrakt og TSM-grænse gennemgået og unit/reference-testet. Synchronized accept forbliver atomic og fail closed; failed refresh bevarer tidligere data. Ingen nuværende live acquisition er påstået.
- Credentials: separate lokale credentials, syntetiske keys i tests, ingen credentials i finansiel backup/snapshots/fejl. Static release scan er kørt; det er ikke bevis for live browser-CORS.
- PWA/UI/accessibility: request guards, generated assets/integrity, update approval/write guards, offline cases, 320/390/430 layouts, safe-area CSS, focus/dialoger, numeric descriptions, 200% og themes er gennemgået. De faktiske rendering-/browser-/iPhone-gates er fortsat åbne.

## Ændrede filer og konkret årsag

| Fil | Konkret årsag |
|---|---|
| `.github/workflows/import-release.yml` | Checksum-baseline reconciliation; archive-, JSON- og source/version-hardening. |
| `.github/workflows/pages.yml` | Separate obligatoriske browsergates, diagnostik, source-integritet og exact deployment identity. |
| `README.md` | Aktuel 1.3.2-status, korrekte verify/package-kommandoer og tydelige resterende gates. |
| `RELEASE-MANIFEST.json` | Regenererede komplette hashes/bytes, entryCount, versionsmetadata, baseline og ærlig BLOCKED-status. |
| `docs/final-hardening/CHANGELOG.md` | Aktuel patch-changelog; historiske changelogs bevares. |
| `docs/final-hardening/engineering-ledger.md` | Observerede reproducerbare fejl, testspor og beslutninger. |
| `docs/final-hardening/report.md` | Denne fulde baseline-/defect-/fil-/test-/release-rapport. |
| `docs/iphone-checklist.md` | Konkrete fysiske PASS/FAIL-gates, adskilt fra emulering. |
| `docs/mobile-release.md` | Eksakt unikt ZIP-navn, begge workflowopdateringer, manuel CI efter import. |
| `docs/release-status.md` | Historisk status peger tydeligt på aktuel 1.3.2-rapport. |
| `docs/superpowers/plans/2026-10-11-final-hardening.md` | Dependency-aware execution-plan og completion-spor. |
| `package-lock.json` | Konsistente root/lock-versioner og låste Playwright 1.64.0-pakker/integrity. |
| `package.json` | Patchversion 1.3.2 og development-only Playwright 1.64.0. |
| `scripts/audit-v13.mjs` | Sammenligner frozen source med faktisk 1.3.1-ZIP; præcise operational exceptions. |
| `scripts/build-pwa.mjs` | Shell cache reload/integrity, update event lifetime og release identity. |
| `scripts/check-browser-runtime.mjs` | Snæver runtime-preflight; BLOCKED kan ikke omklassificere udførte testfejl. |
| `scripts/check-release-source.py` | Eksakt source-inventory, versioner og bytes før CI muterer rapporter; afviser unlisted build-inputs. |
| `scripts/check-ui-pwa.mjs` | Forstår nye Request-objekter og kræver cache/integrity; aktuel rapportsti. |
| `scripts/package-v13.py` | Unik no-clobber ZIP, aktuelle gates, manifest, re-open/CRC/hash og faktisk importvalidator. |
| `scripts/scan-release-secrets.mjs` | Medtager de nye final-rapporter i credential structural scan. |
| `scripts/validate-v13.mjs` | Standardtests, begge browsere, faktiske statusser/nonzero ved BLOCKED og aktuelle rapporter. |
| `scripts/verify.mjs` | Ét current verify-entrypoint; ingen Chromium-only succes eller tidlig skjult gate-afslutning. |
| `src/market-data/live/cache.ts` | Observerer abort-rejection uden at undertrykke operationsfejlen. |
| `src/market-data/live/network.ts` | Begrænser provider-body under læsning, annullerer oversized response. |
| `src/persistence/store.ts` | Atomisk rollback, sanitized snapshot, observeret abort og strict financial durability. |
| `src/ui/App.tsx` | Draft-status/blur, øjeblikkelig calculation-lock, file/export-exclusion og recovery-fejlhandling. |
| `tests/browser/app.spec.ts` | Interactive readiness, stærkere demo-edit, pålidelig pageerror-assertion og fulde WebKit-offline assertions. |
| `tests/browser/hardening.spec.ts` | Nye regressions for calculation/restore/duplicate-submit, storage-failure og close/reopen-demo. |
| `tests/browser/helpers.ts` | Fælles rigtig interactive-state synchronization uden sleeps. |
| `tests/browser/market-settings.spec.ts` | Vent på interaktiv app før field/navigation-handlinger. |
| `tests/browser/risk-refresh.spec.ts` | Interactive readiness ved launch/reload; overflødigt intro-clock-jump fjernet. |
| `tests/browser/ui.spec.ts` | Readiness plus draft-status, numeric-boundary/rapid-edit/focused-external-change regression. |
| `tests/market-cache.test.ts` | Abort-reproducer kontrollerer operation rejection uden unhandled promise. |
| `tests/market-network.test.ts` | Oversized streamed body reproducerer og kontrollerer tidlig cancel. |
| `tests/persistence.test.ts` | Rensning, durability, abort, duplicate-restore og synkron partial-write rollback. |
| `tests/release-import.test.ts` | 38 adversarial/root/metadata/CRC/size/filename/rsync/git-cases; same-size/same-mtime regression. |
| `tests/service-worker-security.test.ts` | Eksakt integrity/cache reload og event-lifetime; failed install rydder kun ny cache, bevarer eksisterende. |
| `tests/release-source.test.ts` | Valid control og fem unlisted-input-afvisninger, inklusive nested public/dist/test-results; kun root-output-dirs undtages, ekstra repo-workflows bevares eksplicit. |
| `tests/hosted-release.test.ts` | Eksekverer hosted gate mod kontrolleret HTTP-stub; current identity plus stale HTML/SW/JS afvises. |
| `tests/ui-presentation.test.ts` | UI-version assertion opdateret til den korrekte patchversion 1.3.2. |
| `validation/closure-final-independent-reference.json` | Genkørt uafhængig reference; kun run-timestamp ændret, resultater bevaret. |
| `validation/closure-final-synchronized.json` | Genkørt accepted-data replay; kun checkedAt ændret, input/resultater/hash bevaret. |
| `validation/final-baseline.json` | Oprindelig ZIP-identitet, frozen source hashes og dependencies som reproducérbar audit-baseline. |
| `validation/final-builds.json` | Faktiske tre build-paths og SHA-/byteinventar. |
| `validation/final-checks.json` | Samlede aktuelle kommandoer, outputs, PASS/BLOCKED og runtime-evidens. |
| `validation/final-credential-scan.json` | Aktuelt static scan-resultat; ingen real-key/runtime-påstand. |
| `validation/final-frozen-audit.json` | 24 byte-identiske finansielle kildefiler og tre dokumenterede operational exceptions. |
| `validation/final-pwa.json` | Generated worker/manifest/icon/assets static og VM-verifikation. |
| `validation/final-snapshot-replay.json` | Eksakt immutable replay og sammenligning med den oprindelige baseline. |
| `validation/final-adversarial-review.json` | Frisk uafhængig reviewrapport med to konkrete modbeviser og initiale fund, bevaret som revisionsspor. |
| `validation/final-adversarial-closure.json` | Efterkontrol af rettelserne og yderligere SW-cache-regression. |
| `validation/final-workflow-static.json` | Faktisk YAML/bash/Python-syntax-review med GitHub execution separat NOT TESTED. |

## Final adversarial review

Det friske uafhængige review fandt R01 og R02 med eksekverede counterexamples og kørte 85 målrettede tests uden finansiel/persistence-regression. Begge fund blev rettet. Follow-up fandt yderligere R01-varianten med `public/dist/stale.js`, inklusive en faktisk Vite-build, der kopierede filen; denne variant og `public/test-results/stale.js` er nu reproduceret og rettet med root-only exclusions i både checker og pakker.

Follow-up blev ikke færdiggjort som et andet fuldt uafhængigt review. Den primære agent verificerede den endelige closure: **14/14** source/hosted/worker-regressioner PASS. Initiale fund og præcise closure-hashes bevares i `validation/final-adversarial-review.json` og `validation/final-adversarial-closure.json`. Efter rettelserne er fuld clean regression kørt: npm ci, lint, typecheck, begge Python-referencer, **276/276** tests, synchronized history, immutable replay, frozen source og tre production-path builds PASS; begge browser-runtimeprobes BLOCKED. Browser-/hosted-/devicebegrænsninger er uændrede.

## Leverance og efterkontrol

Den endelige ZIP får et entydigt `EQUINOX-v1.3.2-hardened-<content-id>.zip`-navn. `ARCHIVE-VERIFICATION.json` angiver den endelige SHA-256, byte-/filantal og resultat fra genåbnet ZIP. Manifestet dækker hver arkivfil undtagen sig selv; workflowhashes har separat infrastrukturdomæne. Pakkeren sammenligner hvert genlæst arkiv-byteforløb med den færdige source, kontrollerer versionskonstanter, CRC og begge standalone workflows og kører den leverede importvalidator mod den faktiske ZIP.

Fysiske gates findes i `docs/iphone-checklist.md` og standalone `IPHONE-VALIDATION.md`. Når både GitHub/browser/hosted og iPhone-gates er dokumenteret, kan release-status revurderes. Denne leverance hævder ikke FULL PASS eller fysisk iPhone-parathed uden de manglende resultater.

## Primærkilder for de relevante tekniske beslutninger

- Playwright actionability: https://playwright.dev/docs/actionability
- Inert: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inert
- GitHub status conditions: https://docs.github.com/en/actions/reference/workflows-and-actions/expressions
- WebKit offline regression: https://github.com/microsoft/playwright/issues/42775
- Upstream fix: https://github.com/microsoft/playwright/pull/42894
- Playwright 1.64: https://github.com/microsoft/playwright/releases/tag/v1.64.0
- Request cache/integrity: https://developer.mozilla.org/en-US/docs/Web/API/RequestInit
- IndexedDB durability: https://developer.mozilla.org/en-US/docs/Web/API/IDBDatabase/transaction
