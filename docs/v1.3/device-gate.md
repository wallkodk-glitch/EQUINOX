# v1.3 — hosted/iPhone gate (PENDING)

Record actual device/OS, origin/path, UTC time and GitHub deployed commit; do not record provider keys or financial backups.

- GitHub verify: lint/typecheck, both independent references, unit/integration, build, actual Chromium + WebKit, repository-aware Pages build.
- Deploy: actual Actions run; hosted HTML, manifest scope/start URL/icons and sw.js. Confirm About shows App 1.3.1 / Engine 1.0.1.
- Physical Safari and installed PWA separately: launch intro/reduced motion, no tab replay, four locked tabs, safe areas, home indicator, no added opaque status strip, portrait/small width/200% text, no document overflow.
- Numeric input/keyboard, focus/close/cancel, VoiceOver labels/status announcements, scroll and 44 px touch targets. No hover dependency.
- Backup before update. Confirm holdings/manual prices, snapshots and local provider keys survive update/reopen on the same origin/path. Service-worker approval waits for saves, imports, calculations and provider jobs. Verify controllerchange actually reloads without loss.
- Provider browser auth/CORS: Massive minute stock/crypto and actions; Nationalbank historical FX/current feed; CoinGecko BTC/ETH references. Public/direct auth must use documented headers. Never use a public proxy or disable browser security.
- Empty/fresh/stale/corrupt market cache, 401/403/429/outage/offline, cancellation and return-online. Explicit corrupt-cache clearing must preserve financial Store and keys.
- Manual synchronized refresh: full acquisition/gates/save, no automatic manual-price writes. Renewed TSM proof ends 2026-10-08 only; 2026-10-09 onward and wider history still fail closed. This limited evidence renewal is not a substitute for real authenticated full refresh/CORS/device evidence.
- After a successful permitted-window refresh: force-close/reopen, offline launch/replay, stale-data rejection for new calculations. Cached/offline quotes never labelled live.

Known Playwright WebKit 1.63 offline-navigation/SW emulation limitation remains separately documented in the baseline browser tests; a skipped automated navigation test is not physical iPhone evidence.
