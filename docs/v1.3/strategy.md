# EQUINOX v1.3 — Mineral Instrument

Approved brief/plan applied conservatively to verified GitHub HEAD `9deaef0e207615cded6fb2f961133ee3f11bbd2a`. App 1.3.1; Engine 1.0.1, MarketDataModel 1.1.2, persistence/snapshot schemas unchanged. The patch only renews the explicitly approved TSM coverage date; the original visual/interaction strategy below is unchanged.

## Research → implementation

- [WebKit safe areas](https://webkit.org/blog/7929/designing-websites-for-iphone-x/): retain viewport-fit/edge-to-edge and existing safe-area padding. No opaque status-bar strip. Actual installed-device geometry remains pending.
- [MDN inert](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inert): recovered UI initializes behind the intro but is non-interactive until handoff; approved app update also blocks fresh edits. Native credential dialog keeps focus semantics.
- [MDN reduced motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion): static short handoff, no moving mark; existing Infinity loader fallback retained.
- [Playwright Clock](https://playwright.dev/docs/clock): preserve RC2 `fastForward` freshness-clock test. Date and timers must move together; `setSystemTime` alone is not freshness-test evidence.
- [Playwright CI](https://playwright.dev/docs/ci): keep normal `install --with-deps chromium webkit`, separate mandatory browser gates. Missing local binaries/system-package permissions are NOT TESTED, not application/provider FAIL.
- [Vite static deploy](https://vite.dev/guide/static-deploy): test repository and root base paths; Pages rebuilds source for actual repository name.
- [GitHub workflow triggering](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow): a GITHUB_TOKEN push does not run push-triggered release CI. Explicit workflow_dispatch is supported, but would require additional Actions write authority and real repository-policy verification. This release deliberately retains the reviewed two-step flow with contents-only importer privileges, no PAT/new secret/recursive trigger. This is not a claim that dispatch is unsupported.

## Visual decisions

Keep brand hemisphere/crescent, equilibrium axis, Balance Rail, infinity symbol and the mineral palette. Reduce hero wash opacity, large teal-filled actions, tracking and rounding. Primary action is a matte raised surface with teal signal details, not a brand-colored slab. Holdings editors and secondary risk/reference information use dividers/open rows. Important hero/buy-plan blocks remain defined panels. Technical financial values use tabular/monospaced treatment; ordinary language remains system sans-serif.

The intro uses existing lightweight SVG paths and transform/opacity only: 1440 ms equilibrium movement, 160 ms handoff. Reduced motion: 120 ms static presentation + 160 ms handoff. Real database recovery runs concurrently. Slow recovery gets a truthful local-state continuation, not fake progress or a stretched decorative loop. Intro state belongs to App, not tabs; normal navigation/visibility changes do not replay it.

No dependencies, WebGL, canvas loop, particles, neon trails or ambient animation added. Overlay-only existing small blur retained; no large continuously composited backgrounds. Runtime scrolling/battery/contrast/VoiceOver and rendered visual quality need the browser/device gates; static code review is not that evidence.

## Market-data boundary

Settings explicitly starts the existing synchronized-history path. Acquisition → synchronization → validation → atomic financial save → readiness. Cache is never financial acceptance. Cancel, uncertainty, partial responses and save conflicts cannot publish a dataset. Provider tests/current references are a separate path. Holdings/manual DKK prices, saved calculations, provider roles and user-data consent remain unchanged.

The original baseline's TSM issuer window ended 2026-10-07. After separate explicit user approval and primary-source review, patch 1.3.1 renews it through **2026-10-08 only**. All amounts, action handling, return semantics and other gates are unchanged. October 9 onward and wider unverified periods FAIL CLOSED. No ongoing/future completeness certificate or actual live acquisition is inferred. New date-boundary integration prices/FX are synthetic; retained actual historical data and immutable snapshots remain unchanged.
