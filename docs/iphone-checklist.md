# EQUINOX 1.3.4 — fysisk iPhone-gate

Forudsætning: begge browserprojekter og hosted smoke er grønne på den samme commit. Notér iPhone-model, iOS-version, URL, commit og dato. Brug kun syntetisk testkapital/holdings; gem en privat backup først. Hvert punkt registreres **PASS** eller **FAIL** med en kort observation. Et ikke udført punkt er ikke bestået.

| Gate | Handling og konkret PASS-kriterium | Resultat |
|---|---|---|
| Fresh Safari + PWA | Åbn den verificerede URL i Safari, installér via Føj til hjemmeskærm, åbn fra ikonet. Intro slutter, ingen hvid flash, felter kan først ændres efter intro, appen vises standalone. | PASS / FAIL |
| Reduced motion + lifecycle | Aktivér Reducer bevægelse; genåbn appen. Ingen blokerende animation. Skift til anden app under intro og tilbage; intro fuldføres og navigation virker. | PASS / FAIL |
| Safe areas + scroll | På alle fire tabs og Calculation Details: scroll til sidste element i portræt. Navigation/home-indikator overlapper ingen nødvendige kontroller; intet utilsigtet vandret dokumentscroll. | PASS / FAIL |
| Keyboard + numbers | Sæt kapital 1234, tøm feltet, luk keyboard. Fejl beskrives mens tomt; tomt input siger ikke gemt; blur gendanner 1234. Indtast decimal, skift felt, kontrollér præcis gemt værdi efter reopen. | PASS / FAIL |
| 200% text + themes | Sæt stor tekst/200% og gennemgå tabs/dialoger i lyst og mørkt tema. Alle primære knapper kan nås; tal beskæres ikke uden en tilgængelig scrollregion. | PASS / FAIL |
| Force-close persistence | Gem testkapital 1234, manuelle priser og én beregning; vent på Gemt lokalt. Tvangsluk PWA og genåbn. Værdier og snapshot er uændrede. | PASS / FAIL |
| Demo isolation | Notér reel state/snapshot. Start demo, ændr kapital, beregn, navigér og afslut. Reel state er identisk; gentag med force-close i demo. Ingen demo-snapshot i reel historik. | PASS / FAIL |
| Demo file ownership | I en separat testprofil: start filimport i demo, afslut mens indlæsning/validering pågår, og kontrollér reel database efter reopen. En stale fil må hverken ændre reel historik/dataset eller vælge et snapshot i en ny session. Hvis rækkefølgen ikke faktisk blev nået, er casen NOT TESTED. | NOT TESTED |
| Credential lifecycle | Gem egen nøgle lokalt uden at dele den; genåbn, replace, annullér én ændring og remove. Rigtig status i hvert trin. Finansiel backup/snapshots indeholder ingen nøgle. | PASS / FAIL |
| Provider/CORS + fail closed | Fra den deployede origin udfør relevant provider-test. Gyldig entitlement virker; utilgængelig provider giver eksplicit safe fejl. Risikorefresh uden dækket TSM-vindue afvises og bevarer tidligere dataset. | PASS / FAIL |
| Offline reopen + reconnect | Efter online shell-installation: flytilstand, force-close, genåbn. Shell, gemt historik og manuel Equal Weight virker; offline er synligt. Reconnect fjerner offline-status uden falsk live/prisbekræftelse. | PASS / FAIL |
| Restore/recovery | Eksportér syntetisk backup til Filer, ændr state, restore den. Gammel state kan recovery-eksporteres. Forsøg ugyldig backup: tydelig fejl, eksisterende state/snapshots uændrede. | PASS / FAIL |
| Approved worker update | Med gemt kapital, snapshot og lokal key: deploy en verificeret efterfølgende shell. Opdatering venter på godkendelse; aktive jobs skal afsluttes/annulleres. Godkend én gang: én reload, korrekt ny version, uændret state/key, efterfølgende offline reopen virker. | PASS / FAIL |
| Two-client worker update | Åbn også en Safari-klient på samme origin. Godkend i den ene klient. Den anden må ikke lave en ikke-godkendt reload; et banner uden waiting-worker forsvinder. Lokale guards er ikke en global all-tab mutex; notér faktisk adfærd under pending work. | NOT TESTED |
| Failed worker installation | På en separat test-origin med tidligere gyldig offline shell: lad en efterfølgende shell-fil fejle under install. Den tidligere shell skal stadig åbne offline. Kræver kontrolleret deployment/failure, ikke kun flytilstand efter vellykket install. | NOT TESTED |

Den sidste gate kræver to faktiske deployments på samme origin/path. Browseremulering og et VM-workercheck kan ikke erstatte denne device-gate. En iPhone kan heller ikke bruges til at kalde alle andre iOS-versioner validerede.
