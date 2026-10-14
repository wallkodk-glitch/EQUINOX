# EQUINOX v1.3.4 — Mineral Instrument

Matematisk buy-only kapitalallokering i DKK, med en lokal React/TypeScript PWA. EQUINOX Engine er uafhængig af React. EQUINOX App viser portefølje, targets, ordrer, risiko og det immutable beregningsgrundlag.

**Aktuel status: BLOCKED.** App **1.3.4**, Engine **1.0.1**, MarketDataModel **1.1.2**; financial schema 1 og snapshot schemas 1/2 er uændrede. Det uafhængige red team reproducerede fire problemer: en eksisterende undefined-state-record blev behandlet som fravær, en demo-filimport kunne ramme reel state efter demo-exit, et stale update-banner blev stående efter anden klients worker-activation, og unsafe/exhausted revisioner kunne producere state, som det eksisterende schema afviser. Kun `store.ts` og `App.tsx` ændrer produktkode. **314/314** unit/integration-tests og runnable non-browser gates består; Chromium/WebKit er miljøblokeret, hosted og fysisk iPhone er NOT TESTED. Se [aktuel red-team-rapport](docs/claim-parity/report.md), [claim-overlay](docs/claim-parity/claim-matrix.csv), [changelog](docs/claim-parity/CHANGELOG.md) og [device-gates](docs/iphone-checklist.md). Original Astra-evidence er bevaret som historisk v1.3.3-materiale, ikke som nye v1.3.4-runtime-PASS.

Den accepterede **DATA-INTEGRATION PASS** fra v1.1.2 er bevaret for det verificerede historiske vindue. Faktiske Massive-observationer, officiel Nationalbank-FX og endelig TSM ADR-dividend er genafspillet gennem gate og Engine uden ændrede hashes. Dette UI-arbejde er ikke en ny live provider-verifikation. Native browser/local-key transport og deployed-origin CORS er stadig NOT TESTED.

Den tidligere verificerede faktiske historik er **2025-10-03–2026-10-06**, 253 observationer og 252 returns. Efter separat brugeraccept og fornyet primærkilde-review dækker TSM issuer-evidensen **2025-01-01–2026-10-08**; 9. oktober og bredere ikke-dokumenterede perioder afvises fortsat. Dette er ikke ny autentificeret market acquisition eller CORS-evidens. De syv gross-beløb, ex-datoer og return-semantik er uændrede; betalingsdatoen 8. oktober giver ikke endnu et dividend-return. FX og final ADR-konvertering er eksplicit **retrospective**, ikke point-in-time backtest-evidens. Ældre release-/UI-/data-rapporter og scripts er historisk evidens; aktuel status findes under `docs/claim-parity`.

## Brug appen

1. Åbn den deployede HTTPS-adresse. Der er ingen konto, backend, cloud sync, telemetry eller brokerforbindelse.
2. Fra **Overview → Redigér portefølje** indtastes antal, samlet cost basis og aktuel pris **i DKK** for alle fem aktiver. Cost basis er ikke markedsværdi. Bekræft kun priser, som faktisk er aktuelle; de udløber efter 24 timer. Overview viser manuelle værdier separat fra providerreferencer og historisk beregnet risiko.
3. Indstil quantity increments og minimumskøb efter din platforms faktiske regler. Defaults er hele aktier og 0,00000001 BTC/ETH. Dette er antagelser, ikke verificerede brokerregler.
4. Under **Overview / Allocate** indtastes ny kapital og vælges model. Equal Weight kræver ingen historik. Inverse Volatility/ERC kræver accepteret historik efter den relevante kontrakt: [aktuel schema 2](docs/final-data-closure/data-semantics.md) eller [legacy schema 1](docs/data-contract.md). **Risk** viser tallene fra det valgte snapshot; ændrede input er tydeligt mærket.
5. Egne importerede data er **ikke uafhængigt verificerede**. Appen kræver eksplicit accept af denne begrænsning. Syntetisk demo er tydeligt mærket og ændrer ikke den personlige portefølje.
6. **Calculation Details** åbnes fra købsplan, Risk eller snapshot-historik. Det viser datagrundlag, full-precision targets, solver, covariance/correlation, execution, risiko, advarsler og hash. Købsplanen er afledt af snapshot; intet handles automatisk.
7. Under **Settings → Backup og historik** eksporteres backup til Filer. Ved restore valideres alt før en atomisk ændring; den gamle database bevares som recovery-kopi. Credentials er et separat storage-domæne og indgår ikke i normal finansiel backup eller nye validerede snapshots. Raw recovery bevarer ukendte gamle felter og kan derfor være følsom. Kan en rå record ikke repræsenteres tabsfrit som JSON, stopper eksporten med `RAW_RECOVERY_NOT_JSON_SAFE`; de lagrede records og recovery-kopier bevares.

Fees er eksplicit **0**. Spread, slippage, valutavekslingsomkostninger, skat og ADR-gebyrer er ikke modelleret. Beløb er indikative; restkontanter er legitime. Browserlagring er ikke en erstatning for backup og er ikke krypteret af EQUINOX.

## Reproducerbar lokal build

Forudsætninger: Node **24.19.0**, Python **3.12** og en platform understøttet af Playwright. Alle npm-afhængigheder og Python-referenceafhængigheder er låst. Runtime bruger ingen ekstern CDN.

```sh
npm ci
python3 -m pip install -r reference/requirements.txt
npx playwright install --with-deps chromium webkit
npm run verify
npm run preview -- --host 127.0.0.1 --port 4173
```

Åbn `http://127.0.0.1:4173/EQUINOX/`. `npm run verify` geninstallerer låste dependencies og kører de aktuelle gates med standard-testindstillinger. Resultater gemmes i `validation/final-checks.json`. Begge browserprojekter er obligatoriske; en snævert identificeret manglende runtime registreres **BLOCKED**, giver nonzero exit og er aldrig releasegodkendelse. Installer Python-/browserforudsætninger med kommandoerne ovenfor.

Den medfølgende faktiske, offentlige og credential-frie risikohistorik kan genkontrolleres uden provider-key:

```sh
node scripts/check-final-risk.mjs
python3 reference/final-risk.py
```

Det er et replay af gemte observationer ved deres oprindelige acquisition-clock. `node scripts/audit-v13.mjs` kontrollerer frosne kildefiler mod de bevarede hashes fra den oprindelige 1.3.1-ZIP. `validation/final-baseline.json` identificerer den aktuelle 1.3.3 working ZIP separat og bevarer dens 1.3.2-parent; ingen af dem erstatter frozen-referencehashes. `node scripts/validate-v13.mjs /sti/til/udpakket-baseline/EQUINOX` kan desuden sammenligne snapshots direkte med en udpakket baseline. Uden argument bruges de medleverede immutable fixtures. Historiske rapporter og andre ældre UI/data-packagere er arkivevidens, ikke de aktuelle gates.

Aktuel pakning: `python3 scripts/package-v13.py /sti/udenfor/source`. Ved miljøblokerede browsere kræver en tydeligt BLOCKED handoff eksplicit `--allow-blocked`; et FAIL i correctness-gates afvises altid. Pakkeren skaber et nyt content-baseret filnavn med no-clobber, komplet manifest og efterfølgende ZIP/import-verifikation. Genpak efter kildeændringer: CI afviser ændrede bytes i manifest-dækkede filer.
## GitHub Pages

**Kun iPhone?** Brug [ZIP-release fra Safari](docs/mobile-release.md). Den kræver ingen lokal Node eller PC. Nedenstående er den almindelige filbaserede Git-arbejdsgang.

1. Læg kildekoden i roden af dit GitHub-repository, inklusive `.github/workflows/pages.yml` og lockfilen. Upload aldrig personlige backups, egne datasæt eller credentials.
2. Vælg **GitHub Actions** som Pages-kilde i repository-indstillingerne.
3. Push til `main`, eller start workflowet fra `main`. Verifikation skal bestå før deploy.
4. Workflowet bygger automatisk med `/<repository-name>/`, eller `/` for et `*.github.io`-repository. Efter deploy kontrolleres HTML, scoped manifest, service worker og præcis appversion/commit via HTTPS.
5. Åbn den returnerede Pages-adresse i Safari. Vælg **Del → Føj til hjemmeskærm**. Følg [iPhone-checklisten](docs/iphone-checklist.md), før det kaldes iPhone-godkendt.

GitHub-ready ZIP'en indeholder kildekode, ikke en stale `dist/` eller `node_modules/`. Production build er valideret separat og genbygges af Pages-workflowet. Åbn ikke `index.html` via `file://`; service workers og persistence kræver en korrekt origin. Ved et andet repository-navn bruges:

```sh
BASE_PATH=/mit-repository/ npm run build
```

Skift af origin eller repository-path kan adskille appens lokale data. Eksportér backup først. En opdatering aktiveres via **Opdatér app**; den tømmer gamle EQUINOX-shell-caches, ikke IndexedDB. Gamle snapshots med ukendt modelversion afvises og bevares til recovery, ikke stiltiende migreret til ny matematik. Bevar denne release ved senere modelopgraderinger.

## Arkitektur og dokumentation

| Boundary | Kode | Ansvar |
|---|---|---|
| A · Data Truth | `src/domain/`, `src/market-data/` | Asset order, provenance, calendar, FX, corporate actions og kvalitetsgate |
| B · Accounting / Mathematical Target | `src/portfolio/`, `src/risk/`, `src/optimization/` | Markedsværdi, cost basis, P/L, current weights, sample covariance, diagnostik, EW/IV/ERC og separat policy |
| C · Executable Target | `src/execution/` | Eksakt kontinuerlig L2-projektion, deterministiske increments, fees=0 og residual |
| D · Proof | `src/snapshots/`, `src/persistence/` | Genberegning, tolerancer, invariants, immutable snapshots, SHA-256 og atomisk lagring |
| App | `src/ui/`, PWA build-script | Input/præsentation og workflow-orkestrering; lokal navigation, offline shell og godkendte opdateringer uden at eje domænereglerne |

- [Matematisk audit og eksplicitte designvalg](docs/audit.md)
- [Uafhængig referenceaudit](docs/reference-audit.md)
- [Historisk provider-research](docs/data-provider-research.md)
- [Legacy schema-1-importkontrakt](docs/data-contract.md)
- [Aktuel v1.3.4 red-team-validering](docs/claim-parity/report.md)
- [Historisk Astra v1.3.3 parity-audit](docs/claim-parity/ASTRA-REPORT-v1.3.3.md)
- [Historisk v1.3.2-hardening](docs/final-hardening/report.md)
- [v1.3-research og visuel strategi](docs/v1.3/strategy.md)
- [UI-designsystem, numerics og symbolske ankere](docs/ui-v1/design-system.md)
- [Research og visuel strategi](docs/ui-v1/visual-strategy.md)
- [UI-review, ændringer og testafgrænsninger](docs/ui-v1/review.md)
- [Accepteret v1.1.2 data-baseline](docs/final-data-closure/release-status.md)
- [Aktuel FX-/provenance-kontrakt](docs/final-data-closure/data-semantics.md)
- [Historisk Engine-audit](docs/release-status.md)

V1 understøtter præcis GOOGL, ISRG, TSM ADR, BTC og ETH i den rækkefølge. Pure matematiske funktioner er dimensionsbaserede; nye assets kræver en versioneret Asset Master, schema og adapterændring. Der er ingen skjult modelswitch, regularisering, sælgefunktion eller global-optimum-påstand for constrained ERC/discrete execution.
