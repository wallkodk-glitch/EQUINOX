# EQUINOX v1.2.0 — UI v1

Matematisk buy-only kapitalallokering i DKK, med en lokal React/TypeScript PWA. EQUINOX Engine er uafhængig af React. EQUINOX App viser portefølje, targets, ordrer, risiko og det immutable beregningsgrundlag.

**UI v1 — PASS WITH LIMITATIONS. BROWSER / SAFARI / IPHONE — NOT TESTED.** App er **1.2.0**; Engine forbliver **1.0.1**, MarketDataModel **1.1.2**, og snapshot schema 1/2 er uændret. Overview, Allocate, Risk og Settings har et fælles mineral-design, Balance Rail, Equilibrium Axis og en restrained infinity-loader. Kildelaget, matematik, kalender, credentials, persistence og data gates er bevaret. Automatisk risk-refresh er fortsat ikke aktiveret i UI. Se [aktuel UI-release-status](docs/ui-v1/release-status.md), [designsystem](docs/ui-v1/design-system.md) og [research/strategi](docs/ui-v1/visual-strategy.md).

Den accepterede **DATA-INTEGRATION PASS** fra v1.1.2 er bevaret for det verificerede historiske vindue. Faktiske Massive-observationer, officiel Nationalbank-FX og endelig TSM ADR-dividend er genafspillet gennem gate og Engine uden ændrede hashes. Dette UI-arbejde er ikke en ny live provider-verifikation. Native browser/local-key transport og deployed-origin CORS er stadig NOT TESTED.

Den verificerede historik er **2025-10-03–2026-10-06**, 253 observationer og 252 returns. TSM issuer-evidens er afgrænset til **2025-01-01–2026-10-07**; senere og bredere ikke-dokumenterede perioder afvises. FX og final ADR-konvertering er eksplicit **retrospective**, ikke point-in-time backtest-evidens. Dokumenterne under `docs/v1.1`, `docs/blocker-closure`, `docs/final-data-closure` og den gamle rod-releaseaudit er historisk evidens; denne releases aktuelle status findes under `docs/ui-v1`.

## Brug appen

1. Åbn den deployede HTTPS-adresse. Der er ingen konto, backend, cloud sync, telemetry eller brokerforbindelse.
2. Fra **Overview → Redigér portefølje** indtastes antal, samlet cost basis og aktuel pris **i DKK** for alle fem aktiver. Cost basis er ikke markedsværdi. Bekræft kun priser, som faktisk er aktuelle; de udløber efter 24 timer. Overview viser manuelle værdier separat fra providerreferencer og historisk beregnet risiko.
3. Indstil quantity increments og minimumskøb efter din platforms faktiske regler. Defaults er hele aktier og 0,00000001 BTC/ETH. Dette er antagelser, ikke verificerede brokerregler.
4. Under **Overview / Allocate** indtastes ny kapital og vælges model. Equal Weight kræver ingen historik. Inverse Volatility/ERC kræver historik efter [datakontrakten](docs/data-contract.md). **Risk** viser tallene fra det valgte snapshot; ændrede input er tydeligt mærket.
5. Egne importerede data er **ikke uafhængigt verificerede**. Appen kræver eksplicit accept af denne begrænsning. Syntetisk demo er tydeligt mærket og ændrer ikke den personlige portefølje.
6. **Calculation Details** åbnes fra købsplan, Risk eller snapshot-historik. Det viser datagrundlag, full-precision targets, solver, covariance/correlation, execution, risiko, advarsler og hash. Købsplanen er afledt af snapshot; intet handles automatisk.
7. Under **Settings → Backup og historik** eksporteres backup til Filer. Ved restore valideres alt før en atomisk ændring; den gamle database bevares som recovery-kopi. Credentials er et separat storage-domæne og indgår ikke i finansiel backup eller snapshots.

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

Åbn `http://127.0.0.1:4173/EQUINOX/`. `verify` kører lint, typecheck, uafhængig Python-reference, unit tests, produktion build og browserflows. Den gemmer faktisk kommandooutput i `validation/release-checks.json`. Unit tests genererer det syntetiske Node-snapshot til browser-replay. Den aktuelle UI-kontrol med **172/172 tests**, begge Python-referencer og build findes i `validation/ui-release-checks.json`. Et nyt UI-browserforsøg stoppede ved **EACCES**, før nogen app-assertion eller providerrequest; se `validation/ui-browser-evidence.json`. De 24 browsercases per projekt er klar, men er ikke udført her.

Den medfølgende faktiske, offentlige og credential-frie risikohistorik kan genkontrolleres uden provider-key:

```sh
node scripts/check-final-risk.mjs
python3 reference/final-risk.py
```

Det er et replay af de gemte observationer ved deres oprindelige acquisition-clock. Det historiske `verify-final-closure.mjs`/`package-release.py` er specifikt for den tidligere data-release og er ikke UI-release-gates. UI-kildeaudit kan køres med `node scripts/audit-ui-release.mjs /sti/til/original-v1.1.2/EQUINOX`; `verify-ui-release.mjs` bruger samme baselineargument. På en fungerende browser-runner bruges fortsat `npm run verify`; launch-fejlen må ikke bruges til at springe browser-verifikation over.

`EQUINOX_CHROMIUM_EXECUTABLE` kan pege på en lokalt installeret Chromium-binary i et begrænset testmiljø. I den situation kører `verify` kun Chromium og registrerer afgrænsningen; det er ikke Safari-test. Standard CI kører både Chromium og WebKit.

## GitHub Pages

**Kun iPhone?** Brug [ZIP-release fra Safari](docs/mobile-release.md). Den kræver ingen lokal Node eller PC. Nedenstående er den almindelige filbaserede Git-arbejdsgang.

1. Læg kildekoden i roden af dit GitHub-repository, inklusive `.github/workflows/pages.yml` og lockfilen. Upload aldrig personlige backups, egne datasæt eller credentials.
2. Vælg **GitHub Actions** som Pages-kilde i repository-indstillingerne.
3. Push til `main`, eller start workflowet fra `main`. Verifikation skal bestå før deploy.
4. Workflowet bygger automatisk med `/<repository-name>/`, eller `/` for et `*.github.io`-repository. Efter deploy kontrolleres HTML, manifest og service worker via HTTPS.
5. Åbn den returnerede Pages-adresse i Safari. Vælg **Del → Føj til hjemmeskærm**. Følg [iPhone-checklisten](docs/iphone-checklist.md), før det kaldes iPhone-godkendt.

Det medfølgende `dist/` er bygget til **`/EQUINOX/`**. Åbn ikke `index.html` via `file://`; service workers og persistence kræver en korrekt origin. Ved et andet repository-navn skal der rebuildes:

```sh
BASE_PATH=/mit-repository/ npm run build
```

Skift af origin eller repository-path kan adskille appens lokale data. Eksportér backup først. En opdatering aktiveres via **Opdatér app**; den tømmer gamle EQUINOX-shell-caches, ikke IndexedDB. Gamle snapshots med ukendt modelversion afvises og bevares til recovery, ikke stiltiende migreret til ny matematik. Bevar denne release ved senere modelopgraderinger.

## Arkitektur og dokumentation

| Boundary | Kode | Ansvar |
|---|---|---|
| A · Data Truth | `domain/`, `market-data/`, `portfolio/` | Asset order, provenance, calendar, FX, corporate actions, kvalitetsgate, beholdninger |
| B · Mathematical Target | `risk/`, `optimization/` | Sample covariance, diagnostik, EW/IV/ERC, separat policy og constrained target |
| C · Executable Target | `execution/` | Eksakt kontinuerlig L2-projektion, deterministiske increments, fees=0 og residual |
| D · Proof | `snapshots/`, `persistence/` | Genberegning, tolerancer, invariants, immutable snapshots, SHA-256 og atomisk lagring |
| App | `ui/`, PWA build-script | Kun input/præsentation, lokal navigation, offline shell og godkendte opdateringer |

- [Matematisk audit og eksplicitte designvalg](docs/audit.md)
- [Uafhængig referenceaudit](docs/reference-audit.md)
- [Provider-research og begrænsninger](docs/data-provider-research.md)
- [Importkontrakt og prissemantik](docs/data-contract.md)
- [Aktuel UI v1 release-status](docs/ui-v1/release-status.md)
- [UI-designsystem, numerics og symbolske ankere](docs/ui-v1/design-system.md)
- [Research og visuel strategi](docs/ui-v1/visual-strategy.md)
- [UI-review, ændringer og testafgrænsninger](docs/ui-v1/review.md)
- [Accepteret v1.1.2 data-baseline](docs/final-data-closure/release-status.md)
- [Aktuel FX-/provenance-kontrakt](docs/final-data-closure/data-semantics.md)
- [Historisk Engine-audit](docs/release-status.md)

V1 understøtter præcis GOOGL, ISRG, TSM ADR, BTC og ETH i den rækkefølge. Pure matematiske funktioner er dimensionsbaserede; nye assets kræver en versioneret Asset Master, schema og adapterændring. Der er ingen skjult modelswitch, regularisering, sælgefunktion eller global-optimum-påstand for constrained ERC/discrete execution.
