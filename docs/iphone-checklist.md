# Fysisk iPhone-acceptance — IKKE UDFØRT

Udfyld device, iOS-version, Safari-version, HTTPS-URL, release-hash, dato og faktiske resultater. Chromium med iPhone-viewport er ikke en iPhone eller Safari. Playwright WebKit er heller ikke en fysisk iPhone-test.

1. **Safari / installation:** åbn HTTPS-URL, kontrollér manifest/icons, installér via Føj til hjemmeskærm. Start fra hjemmeskærm; kontrollér standalone og korrekt scope.
2. **Input / layout:** bekræft decimalindtastning på dansk tastatur; prøv 0, 2500 og små BTC/ETH-antal. Kontrollér store trykflader, safe areas, portrait/landscape og at bottom navigation ikke dækker sidste indhold.
3. **Historik / matricer:** kør isoleret demo, gennemse current/raw/constrained/projected, scroll covariance/correlation horisontalt uden at hele siden bliver bred. Prøv lyst/mørkt/systemtema.
4. **Persistence:** gem manuelle beholdninger og priser, genstart app og telefon; kontrollér værdierne. Eksportér backup til Filer, ændr kapital, gendan backup og kontrollér beholdninger og snapshots. Den tidligere database skal være bevaret som recovery-kopi.
5. **Offline:** efter online-opstart slås flytilstand til. Luk/genåbn PWA; shell og gemte snapshots skal åbne. Status skal vise Offline. Cached/manuelle priser må ikke fremstå live. Gamle priser/data skal blokere en ny beregning.
6. **Opdatering:** eksportér backup, deploy en ny shell-version uden modelændring. Den eksisterende app skal tilbyde Opdatér app og bevare holdings, settings, historik og data efter godkendelse. Før en modelændring skal kompatibilitet og backup/recovery prøves særskilt.
7. **Fejl:** stale pris, ufuldstændig import, umulig policy og NewCapital=0 skal give de dokumenterede resultater/fejl, ikke en anden model. Demo må aldrig blive personlige holdings, heller ikke hvis man afslutter den under beregning.

Resultatfelter: Safari PASS/FAIL; standalone PASS/FAIL; offline PASS/FAIL; reload PASS/FAIL; update PASS/FAIL; backup/restore PASS/FAIL; device/iOS; evidence. Indtil dette er faktisk gennemført: **IPHONE PHYSICAL TEST — NOT TESTED**.
