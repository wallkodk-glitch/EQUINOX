# EQUINOX v1.3 — audit før patch

Baseline: GitHub HEAD `9deaef0e207615cded6fb2f961133ee3f11bbd2a`.
Uafhængig re-indeksering af 183 filer, normal add + force-add validation,
gav præcis træ `8f46a030b6058800601566509dd833778c3c6897`.
Begge standalone workflows matcher de oplyste Git blob-hashes.
Uændret baseline: npm ci, 172/172 unit/integration-tests og production build bestået.

## Konkrete fund

1. **Visuals:** teal-fyldt primærknap, 28/20 px standardradier og meget
   uppercase/tracking. Bevar mineralpalet, akse, Balance Rail og originale assets;
   dæmp fill, wash og geometri. Ingen ny dependency.
2. **Hierarki:** Overview har allerede en brugbar beslutningsrækkefølge.
   Settings viser interne fejlkoder som primærtekst, åbne reference-detaljer og
   en deaktiveret refresh. Risk Summary gentager teknisk provenance. Forenkling
   er præsentation/disclosure, ikke ændring af økonomisk betydning.
3. **Aktivering:** eksisterende refreshSynchronizedRisk/buildSynchronizedRisk
   findes og har coverage/provenance/FX/corporate-action/prepareRisk-gates.
   UI mangler acquisition/validation/accept/cancel og lagret atomisk accept.
   Provider-test må fortsat kun opdatere separat reference-cache.
4. **Persistens:** finansiel Store er revisionstjekket og transaktionel;
   credentials og cache er separate. UI skal fastholde dette også ved langsom
   refresh, tab-skift, credential-change, reload, cache-korruption og save-fejl.
   Cache-korruption kræver eksplicit recovery; ikke automatisk sletning.
5. **PWA:** eksisterende safe-area, viewport-fit, numeric keyboard og RC2
   fastForward-test bevares. Update skal også vente på market-job og endelig
   financial commit; nye writes må ikke starte mellem approval og reload.
   WebKit offline-navigation har en allerede dokumenteret test-undtagelse;
   dette er ikke fysisk iPhone-evidens.
6. **Workflows:** importens gamle default er en mobilfælde. ZIP-kontrol mangler
   duplicate/symlink/backslash/manifest-hash checks; rootvalget kan være tvetydigt.
   workflows skal fortsat bevares under import. Der mangler import-concurrency
   og main-branch guard. Pages-gates bevares; tilføj konkret evidens/artifacts og
   stærkere hosted root/manifest/SW-check. Mobilvejledning beskriver en ældre vej.
7. **Kontraktkonflikt:** den godkendte plan ønsker aktiveret refresh, men TSM's
   accepterede issuer-evidens gælder kun 2025-01-01 til 2026-10-07. Nyere sessioner
   og længere windows fail-closed. v1.3 udvider ikke evidens eller datakontrakt.
   Aktivering kan testes med kontrollerede fulde provider-fixtures, men er ikke
   bevis for en live refresh på dags dato. Brugerdata-acknowledgment bevares.

## Afgrænset implementation

Følg den godkendte plan opgavevis: test-first launch/presentation, så UI-job og
atomisk accept gennem eksisterende gates; cache recovery og update-lås; til sidst
workflow/import/manifest-tests og komplette nye release-checks. Ingen ændring af
Engine, snapshot schema, providerroller eller accepteret markedskalender.
Ældre scripts/statusrapporter i arkivet er historisk evidens, ikke v1.3-PASS.

Manifestets gamle workflow-hashmismatch skyldes bevaret repo-infrastruktur,
ikke forkert baseline. Ny manifestversion adskiller payload-filer fra workflow-
infrastruktur og kræver ikke, at importerens bevarede workflows har ZIP'ens bytes.

## Efterfølgende afgrænset brugeraccept — 1.3.1

Ovenstående er den bevarede pre-patch audit, ikke en ny påstand om den aktuelle
datogrænse. Brugeren godkendte særskilt forlængelse af TSM-evidensen til
2026-10-08. Primærkilder blev genlæst 2026-10-09; syv endelige gross-beløb
og alle handling-/return-regler er uændrede. Den eksakte kilde-diff må kun være
auditdatoen og øvre datogrænse. Audit-scriptet håndhæver dette særskilt fra
byte-identiske frozen filer. 2026-10-09 og bredere historik afvises fortsat.
Dette er ikke browser-, provider-auth-, hosted- eller fysisk iPhone-evidens.
