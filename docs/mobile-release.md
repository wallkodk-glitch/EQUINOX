# EQUINOX 1.3.4 — release fra iPhone

Aktuel leverancestatus: **BLOCKED** indtil Chromium/WebKit faktisk er bestået i GitHub. En grøn import er kun archive/import-integritet. Brug det eksisterende repository og `main`. Eksportér først finansiel backup i appen og gem den privat.

1. Gem ZIP'en med dens fulde nye `EQUINOX-v1.3.4-hardened-<content-id>.zip`-navn og de to standalone workflows i Filer. Brug det konkrete navn fra `ARCHIVE-VERIFICATION.json`; genbrug ikke tidligere releasenavne.
2. Erstat `.github/workflows/import-release.yml` og `.github/workflows/pages.yml` med hele de leverede filer. Commit begge til `main`. En eventuel mellemliggende CI på gammel source er ikke slutvalidering og kan fejle, fordi workflow/manifest ikke matcher endnu.
3. Upload den nye ZIP uudpakket til repositoryets rod. Ingen personlige backups, data eller keys i GitHub.
4. Actions → **EQUINOX mobile release import** → Run workflow → `main`. Indtast ZIP'ens eksakte navn. Blank input accepteres kun med præcis én kandidat. Importeren validerer alle paths/hashes/bytes/versioner/CRC før ekstraktion, synkroniserer med `rsync -a --checksum --delete`, bevarer repositoryets workflows og force-tracker `validation/`.
5. Vent på den nye importcommit. Start derefter **EQUINOX validated release** manuelt på `main`: et `GITHUB_TOKEN`-push starter ikke selv push-triggeret release-CI. Importen ændrer aldrig workflows; begge leverede workflows skal være installeret separat og matche manifestet.
6. Kontrollér hele `verify`: source/manifest, npm ci, lint, typecheck, Python, unit/integration, synchronized history, snapshot replay, frozen boundaries, build og **begge fulde browserprojekter**. Ingen continue-on-error. Browserdiagnostik uploades også ved browserfejl; Pages-artifact/deploy kræver succes.
7. Pages source skal være **GitHub Actions**. Hosted smoke skal verificere den konkrete commit og appversion fra `release.json`, scoped manifest og worker. Åbn den faktiske deployment-URL i Safari og udfør [iPhone-gates](iphone-checklist.md).

Importens push er non-force. Hvis `main` er ændret samtidigt, fejler push sikkert; kontrollér nyeste `main` før nyt almindeligt run. Importen fjerner stale produktfiler og upload-ZIP'er som del af sin source replacement. Upload derfor kun releasekilden i dette app-repository.

Workflow-hashes dokumenterer integritet af de leverede bytes, ikke en digital udstedersignatur. En ny ZIP efter ændringer skal regenerere manifest og alle workflowkopier. Gamle rapporter og scripts under historiske v1/UI/data-dokumentmapper beskriver tidligere releases; brug `docs/claim-parity/report.md` for denne patch. Workflows er byte-identiske med working baseline; allerede installerede identiske kopier kræver ingen ny ændring.

Samme origin og path er nødvendigt for adgang til den eksisterende browserlagring. Ved opdatering: vent på gemte ændringer, brug **Opdatér app**, og kontrollér både finansiel state og lokale credentials efter reload. TSM-refresh efter 2026-10-08 skal fortsat afvises; brug ikke denne release som godkendelse til at udvide issuer-evidensen.
