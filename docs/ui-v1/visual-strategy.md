# EQUINOX UI v1 — visual strategy

Scope: presentation of the accepted EQUINOX 1.1.2 release. App release 1.2.0; Engine 1.0.1, MarketDataModel 1.1.2, snapshot and financial persistence contracts remain unchanged. The supplied JPEG is the primary brand source, not a request for a new logo.

## Research decisions (7 October 2026)

**A — Production techniques.** Static layered CSS gradients, ordinary SVG paths, CSS variables, tabular system numerals, semantic tables and native modal dialogs. Use `viewport-fit=cover` with safe-area padding; `svh` for a stable minimum page height and bounded `dvh` for a scrolling sheet, with ordinary viewport fallbacks. Animate short opacity/transform transitions. The small infinity path may animate its stroke only during genuine work; it is deliberately not described as a compositor-only effect. Reduced motion stops it.

**B — Avoid on iPhone.** No full-screen blur, animated gradients, filters in motion, masks on scrolling containers, canvas/WebGL loops, blanket `will-change`, scroll-jacking, fixed-height application wrapper or spring/bounce effects. Backdrop blur is optional on the small credential sheet only, behind `@supports` with an opaque fallback. Dynamic viewport units do not prove correct behavior with every iOS keyboard or installed-PWA version. Those require device testing.

**C — Existing DNA.** The blue-black/mineral palette becomes a shared token system. Off-white numbers dominate; teal marks targets and selection, slate marks current state, and violet remains a quiet secondary undertone. Existing forms, calculation handlers, local storage, credentials and sealed snapshots stay in place. Detailed financial proof remains available as a drill-down.

**D — Signature.** The Equilibrium Axis organizes separators and comparison geometry. Balance Rail centers the constrained Target on a common, symmetric percentage-point scale and uses a circle for Current and a diamond for Projected. It includes direct numeric labels; missing weights have no marker. Infinity Motion is a single thin SVG path used only while opening, calculating or testing a provider. One restrained Mineral Wash belongs to the portfolio hero. The icon simplifies the supplied upper teal hemisphere, lower violet crescent and central axis.

**E — Restraint.** An 8 px spacing rhythm, 28 px hero radius, consistent typographic roles, aligned tabular numerals, section rules and compact rows replace the previous repeated card layout. Body and useful labels remain readable; the locked muted color is not used for small essential text where it fails contrast. Financial display rounding affects presentation only. No remote fonts, icon library or chart library are needed.

**F — Freestyle boundary.** Refine the Overview decision loop, compact buy-plan rows, the centered Balance Rail, risk contribution graphic, correlation matrix, provider action layout and sheet geometry. Do not reinterpret the hidden symbolic anchors, change the logo concept, activate new data features, change calculation inputs, or alter stored data/snapshots.

## Sources and effect on the implementation

- [WebKit: Designing Websites for iPhone X](https://webkit.org/blog/7929/designing-websites-for-iphone-x/) — safe areas supplement ordinary spacing; use `max()`/`env()` around page and navigation edges.
- [WebKit: New WebKit Features in Safari 15.4](https://webkit.org/blog/12445/new-webkit-features-in-safari-15-4/) — `svh`/`dvh`, focus-visible and native dialog support guide the progressive enhancement baseline.
- [web.dev: High-performance CSS animations](https://web.dev/articles/animations-guide) — prefer opacity/transform; avoid blanket layer promotion and animations that repeatedly lay out the page.
- [MDN: font-variant-numeric](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/font-variant-numeric) — tabular lining numbers in data, inputs and tables.
- [MDN: dialog](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog) — retain `showModal()`, initial input focus, Escape cancellation and return focus to the initiating control.
- [MDN: prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion) — static infinity and immediate view/state changes under reduced motion.
- [MDN: backdrop-filter](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/backdrop-filter) — keep blur local and optional; do not put a filtered/transformed wrapper around fixed navigation.
- [MDN: mask-image](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/mask-image) and [clip-path](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/clip-path) — available tools, but unnecessary for the final identity and charts; ordinary SVG is simpler.
- [Apple: Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility) and [Motion](https://developer.apple.com/design/human-interface-guidelines/motion) — system accessibility and restrained feedback inform the direction. Apple pages are script-rendered; this report does not claim exhaustive retrieval of their contents.
- [WebKit keyboard/viewport issue 292603](https://bugs.webkit.org/show_bug.cgi?id=292603) and [issue 300523](https://bugs.webkit.org/show_bug.cgi?id=300523) — evidence that CSS units alone cannot establish physical iPhone keyboard correctness. No device PASS is inferred from implementation.

## Behavioral boundaries

Overview, Allocate, Risk and Settings are presentation routes only. Holdings, history, backup/restore and Calculation Details remain accessible. A sealed calculation remains historical if its inputs differ from the current editable state. Manual DKK valuation is explicitly separate from provider reference prices and risk history. A saved key is not labeled as an authenticated connection until the existing connection test actually succeeds. Automatic risk refresh remains in its accepted baseline state; UI polish does not activate it.

Verification will compare every frozen source file byte-for-byte with the supplied 1.1.2 ZIP. Existing mathematical/data/persistence tests stay intact. Browser selectors may be adjusted only to follow the requested navigation, with the existing behavioral assertions preserved. Browser, Safari, physical iPhone, Add to Home Screen, standalone safe areas, installed service-worker updates and deployed-origin CORS each require their own actual runtime evidence.
