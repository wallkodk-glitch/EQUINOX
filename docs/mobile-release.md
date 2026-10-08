# Release fra iPhone — ingen lokal Node eller PC

Denne alternative vej er for et **nyt EQUINOX-repository**. Brug ikke Logic-Core eller et andet projekts repository. Den kræver din normale GitHub-adgang og rettigheder til Actions/Pages. Et hosted run er endnu ikke udført; workflowet skal være grønt, før deploy kan kaldes PASS.

## Engangsopsætning i Safari

1. Gem `EQUINOX-v1.2.0.zip` i Filer. Opret et GitHub-repository med navnet **EQUINOX**, branch **main**. Brug ikke private finansielle oplysninger i repositoryet.
2. I repositoryets webinterface vælges **Add file → Upload files**. Upload selve `EQUINOX-v1.2.0.zip` til roden; den skal **ikke** udpakkes i repositoryet.
3. I Filer kan en separat kopi af ZIP'en udpakkes, så du kan læse `EQUINOX/release/mobile-pages.yml`. Kopiér hele denne tekst.
4. I GitHub: **Add file → Create new file**. Navn: `.github/workflows/mobile-pages.yml`. Indsæt den kopierede tekst og commit til **main**. Brug eventuelt Safari-visningen til skrivebordssite, hvis kontrollerne ikke vises.
5. Under repositoryets **Settings → Pages** vælges **GitHub Actions** som source. Dette er en repository-indstilling, ikke noget ZIP'en kan ændre uden din adgang.
6. Under **Actions** åbnes **EQUINOX mobile ZIP release**, vælg **Run workflow** fra main. Workflowet kontrollerer alle filhashes, bygger fra kildekode, kører matematik-, reference- og browsertests og deployer kun efter bestået verifikation.
7. Når både verify og deploy/smoke er grønne, åbn den konkrete URL fra deployment. Først her findes en faktisk iPhone-åbningsadresse. I Safari: **Del → Føj til hjemmeskærm**.
8. Følg `docs/ui-v1/device-release-gate.md` og `docs/iphone-checklist.md`. Demo eller Equal Weight med manuelle priser kan afprøves. En grøn deployment er ikke fysisk iPhone-evidens eller provider-CORS-verifikation.

Der kræves ikke en API key. GitHub kan kræve sædvanlige kontobekræftelser, tilladelser eller en plan med Pages-understøttelse; disse er ikke omgået eller testet her. Der oprettes ikke automatisk en betalt konto eller service.

## Senere ZIP-opdateringer

Eksportér først en backup i EQUINOX. Ved en ny release uploades den nye versionerede ZIP, og `release/mobile-pages.yml` fra samme ZIP kopieres til workflowet, så filnavn og manifestversion passer sammen. Kør workflowet igen. ZIP med source, lockfile og manifest er kodegrundlaget; deploy bygger den. Efter hosted smoke tilbydes opdateringen i PWA'en.

Den normale filbaserede Git-workflow er stadig tilgængelig i `.github/workflows/pages.yml` inde i ZIP'en. Vælg enten filbaseret kildekode eller denne ZIP-baserede struktur for et repository; bland dem ikke utilsigtet.
