# EQUINOX 1.3.2 — 2026-10-12

Patch fra den verificerede App 1.3.1-baseline. Engine 1.0.1 og MarketDataModel 1.1.2 er uændret; financial math, TSM-evidens og normalized/replayed results bevares.

- Atomisk rollback også ved synkrone IndexedDB-fejl i save/restore; observerede abort-rejections, sanitized snapshot-writes og strict durability.
- Korrekt status for ugyldige numeric drafts og reconciliation efter ekstern ændring under focus.
- Umiddelbar calculation-lock og udelukkelse af overlappende restore/import/backup; sikre recovery-knapper ved utilgængelig storage.
- Bounded provider-response streaming med eksplicit afvisning; uændret financial/provider-model.
- Worker install med cache reload og build-integrity; approval message holder eventet aktivt; failed install rydder ny cache uden at slette en eksisterende offline-shell.
- Browser-tests venter på reel interaktivitet; ingen WebKit offline-bypass. Playwright 1.64.0 for upstream offline-fix.
- Content-safe importer bevarer checksum og får yderligere archive-/source-/version-/JSON-kontroller.
- Begge browsergates er obligatoriske; source-gate afviser unlisted build-inputs; hosted smoke verificerer præcise buildbytes og commit/appversion.
- Aktuel reproducerbar validator, frozen audit mod faktisk ZIP, unikt no-clobber release-navn og efterfølgende archive/import-verifikation.

Status: **BLOCKED** for browser/runtime og efterfølgende GitHub/hosted/iPhone-verifikation. Detaljer, ændrede filer og faktiske resultater: [report.md](report.md). Historiske changelogs beskriver tidligere versioner.
