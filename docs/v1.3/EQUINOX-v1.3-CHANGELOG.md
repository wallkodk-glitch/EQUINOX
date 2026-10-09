# EQUINOX v1.3.1 — changelog

Verified baseline: GitHub HEAD `9deaef0e207615cded6fb2f961133ee3f11bbd2a`; independently reconstructed tree `8f46a030b6058800601566509dd833778c3c6897`. App 1.3.1; Engine 1.0.1, MarketDataModel 1.1.2, state/snapshot schemas unchanged. No dependency additions/version upgrades.

## 1.3.1 — explicitly approved bounded TSM renewal

- Re-reviewed official TSMC issuer history, the final Citibank ADR announcement and current depositary history on 2026-10-09. Extended only the upper coverage date from 2026-10-07 to **2026-10-08**; lower bound remains 2025-01-01. Record: validation/v1.3-tsm-evidence-renewal.json.
- All seven gross USD/ADR amounts, ex/pay dates, exact-match/cardinality/duplicate checks and retrospective rules remain identical. October 8 is payment of the September dividend, not a second dividend-return. October 9, preliminary future amounts, net cash, extra/missing actions and wider history still fail closed.
- Added four dividend-boundary regressions and one full synchronized-builder/gate test with explicitly synthetic prices/FX. No real market acquisition or provider/CORS PASS is claimed.
- Settings disclosure, app patch version, audit and packaging metadata updated. No UI design, workflow, dependency, mathematical or other provider/data-gate changes in this patch.

## Retained 1.3.0 changes

- Mineral Instrument: quieter wash, matte primary actions, tighter panel/control radii, fewer boxed secondary sections, restrained tracking and consistent financial numerics. Locked four tabs, original brand assets, axis, Balance Rail and Infinity Motion retained; no opaque status-bar strip.
- Branded equilibrium intro: 1.44 s + 160 ms handoff, concurrent real initialization, truthful continuation when storage is slow, short reduced-motion handoff, no ordinary tab replay or artificial five-second delay.
- Settings manual synchronized risk refresh reuses the existing Massive + Nationalbank pipeline. Acquisition/synchronization/validation/save states, cancellation, safe human-readable errors and technical disclosure. Acceptance is atomic and gated; partial/failed/cancelled results do not replace accepted financial state.
- Provider references remain separate. CoinGecko never enters canonical risk history; no automatic holdings/manual DKK price writes or silent consent. Keys remain local and excluded from financial backups/snapshots/cache/evidence.
- Explicit corrupt-market-cache recovery, request-busy update gating, financial commit/file-import guards, and corrected restore state refs. Cancelling during final validated cache write cannot return a ready dataset. These are operational/UI fixes, not mathematical/data-contract changes.
- Importer: blank default, exact single-ZIP/explicit-name selection, path/duplicate/symlink/special-file/size/CRC/full-hash validation, deterministic root, main guard/concurrency, workflow preservation, forced validation tracking, safe non-force commit/push and upload removal.
- Pages: preserved all release/deploy gates; pip caching/timeouts, additional real-data Python reference/snapshot replay, separate mandatory Chromium/WebKit runs and stronger hosted manifest/SW smoke. No PAT/new secret/recursive dispatch. Manifest V3 separates product from preserved repository infrastructure.
- Added risk-based regression tests and browser cases; legacy suites/reference fixtures retained. New command evidence under validation/v1.3-*; older reports are historical.

Risk windows through **2026-10-08** can now pass the bounded TSM action gate, but require every other gate and actual authenticated acquisition. Later/wider history still fails closed. Actual browser/provider/device/deployment verification remains pending; see validation report and docs/mobile-release.md.

Changed areas: src/ui/{App,MarketDataSettings,LaunchIntro,launch-state,risk-import,presentation,styles,Overview,Details,RiskView,Glyph}; live/{cache,synchronized}; package/version metadata; workflows; release/audit/validation scripts; tests; README and v1.3/mobile docs. Exact machine-readable file list: validation/v1.3-frozen-audit.json.
