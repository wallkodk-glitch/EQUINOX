# EQUINOX v1.3 — release fra iPhone

Brug det eksisterende EQUINOX-repository og main. Intet nyt repository, PAT, backend eller API-secret i GitHub. Eksportér først finansiel backup i den installerede app; gem den privat, aldrig i repositoryet.

## Filer og rækkefølge

1. Gem de fem leverancefiler i Filer. Erstat `.github/workflows/import-release.yml` med hele den leverede `import-release.yml` og commit til main. Den gamle Pages-workflow må fortsat validere den gamle app; dette er ikke v1.3-evidens.
2. Upload **EQUINOX-v1.3-GitHub-ready.zip** uudpakket til repositoryets rod. Upload ikke backups eller credentials.
3. Actions → **EQUINOX mobile release import** → Run workflow → main. Indtast det eksakte filnavn ovenfor. Blank input må kun bruges, hvis roden indeholder præcis én EQUINOX*.zip. Flere kandidater bliver afvist; intet stiltiende valg.
4. Vent på grønt import-job og kontrollér den nye produktcommit. Importeren verificerer CRC, struktur og alle manifesthashes før ændring, bevarer repository-workflows, force-tracker validation/ og fjerner upload-ZIP'en. En samtidig main-opdatering kan kræve et nyt almindeligt run; ingen force-push.
5. Erstat nu `.github/workflows/pages.yml` med hele den leverede `pages.yml` og commit til main. Dette almindelige bruger-push starter **EQUINOX validated release**. Hvis intet run starter, vælg Actions → samme workflow → Run workflow → main. Importens GITHUB_TOKEN-push starter ikke selv push-triggeret CI.
6. Deploy kræver alle verify-gates grønne, inklusive Chromium og WebKit. Hosted HTML, korrekt scoped manifest og service-worker smoke skal også være grønne. Pages source skal fortsat være GitHub Actions. Brug run/deployment-adressens faktiske URL; ingen hosted PASS før evidens.
7. På fysisk iPhone følges [device release gate](v1.3/device-gate.md). Eksisterende app viser en godkendt opdatering; vent på lokale saves/netværksjobs og brug Opdatér app. Samme origin og path bevarer lokale data; ændring af origin/path kan adskille browserlagringen.

De to workflowfiler skal opdateres separat: produktimport bevarer bevidst .github/workflows/. ZIP'ens manifest adskiller payload og repositoryInfrastructure; sidstnævnte beskriver leverede bytes, ikke en påstand om, at bevarede repo-workflows allerede matcher. Hashkontrol er integritet/completeness, ikke en digital issuer-signatur.

## To trin, ingen ekstra privilege

GitHub understøtter eksplicit workflow_dispatch med GITHUB_TOKEN; automatisk dispatch ville kræve Actions-write-tilladelse og faktisk repository-policy-test. Denne release beholder bevidst to-trins-forløbet med contents-only import, ingen ny secret og ingen recursion. Det er ikke en platformbegrænsning eller et løfte om automatisk release.

Gamle release/mobile-pages.yml og UI/data-statusrapporter i source er historiske; brug kun de to aktuelle workflows og docs/v1.3. En grøn import er ikke test/build/deploy PASS. En grøn deploy er ikke fysisk iPhone- eller live provider-CORS-evidens.
