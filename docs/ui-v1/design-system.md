# EQUINOX UI v1 — design system

App 1.2.0. Presentation only; Engine 1.0.1, MarketDataModel 1.1.2, snapshot 1/2 and financial backup 1 are unchanged.

## Canvas and surfaces

The 18 supplied color tokens are retained verbatim in `src/ui/styles.css`. Blue-black and off-white dominate. Teal belongs to Target, focus and selection; slate to Current; light mineral/off-white to Projected; restrained violet to the negative correlation end and secondary depth. Negative P/L keeps its sign and is not an error color.

The portfolio hero is the only atmospheric wash field: static, low-opacity teal with a trace of violet. Primary data sits on matte mineral canvas. Sections, aligned rows and thin rules carry most information. Cards bound editable holdings; they are not the navigation or chart language. The credential sheet alone has an optional 8 px backdrop blur and a nearly opaque fallback. Navigation is matte.

Locked dark tokens remain available even when the existing light/system preference is selected. Derived readable accents supplement the locked base: teal `#79B8AF`, warning `#C9AF8A`, danger `#D8ADB5`. Essential small labels use the readable secondary token, not the lower-contrast muted token. Light correlation opacity is reduced without changing any correlation value or sign. The dark hero keeps a readable focus outline in both themes.

Spacing follows 8 px steps. Hero/sheet radius 28 px, ordinary holding surface 20 px, inset/controls 12–16 px. Typical padding 20–24 px. There is no remote font, icon package, chart package or new runtime dependency.

## Typography

System stack: `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", sans-serif`. The table gives nominal values at a 16 px root; financial text scales with user text size. The display number has a bounded responsive size. Tabular lining numerals belong to prices, money, weights, risk, tables, history and inputs.

| Role | Token / nominal size | Use |
|---|---|---|
| Display Number | `--type-display`, 40–56 px | Manual portfolio value |
| Hero Metric | `--type-hero`, 40 px | Selected snapshot volatility |
| Page Title | `--type-page`, 36 px | Allocate, Risk, Settings, drill-downs |
| Section Title | `--type-section`, 20 px | Sections and restrained Overview title |
| Section Label | `--type-label`, 11 px | Short uppercase context and navigation |
| Data Label | `--type-data`, 14 px | Assets, form/control labels |
| Data Value | `--type-value`, 20 px | Compact financial metrics |
| Table Number | `--type-table`, 13 px | Risk/correlation and data tables |
| Caption | `--type-caption`, 13 px | Explanations and order amounts |
| Microcopy | `--type-micro`, 12 px | Dates, freshness and provenance |
| Technical/Formula | `--type-technical`, 12 px, ui-monospace | Diagnostics, full-precision JSON |

## Numeric presentation

| Data | Display policy |
|---|---|
| DKK, buys, cash, cost, fees | Danish grouping/decimal comma; two decimals; currency except the explicitly DKK-labeled hero |
| Weights, volatility, RCShare | Two percentage decimals; fractions multiplied only for display |
| P/L | Explicit positive/negative sign; neutral visual treatment |
| L1/L2 distance | Two decimals and `pp`, not percent of a currency value |
| Units / provider prices | Existing `amount`/provider display precision, up to eight decimals; quantity increments unchanged |
| Missing risk/price/weight | `—` or an explicit missing-state label; never a fabricated zero |
| Calculation Details matrices | Six-decimal view, with a caption explaining rounding; immutable snapshot JSON retains full precision |

Formatting is a view concern. No formatted value is written back as an Engine input, snapshot or restored financial state. Valid numeric drafts use the existing commit rule; invalid drafts are described with `aria-invalid`/`aria-describedby` and revert on blur without overwriting the last valid value.

## Signature geometry and charts

**Equilibrium Axis:** a quiet centered horizontal line with a small symmetric diamond on the hero. Target references and separators share its geometry.

**Balance Rail:** each asset's constrained Target is the zero center. A single symmetric percentage-point domain covers all five Current and Projected deviations, rounded outward to five pp with a minimum five pp scale. Current is a circle, Target a line, Projected a diamond. Coincident Current/Projected positions remain visible on separate vertical tracks. Direct numeric labels show their absolute weights. Missing vectors produce no marker. Cash remains separate. This is a signed deviation instrument, not a progress bar.

The rail canvas uses font-responsive minimum width inside an accessible horizontal region. The correlation matrix also scrolls within its own labeled region at narrow width or enlarged text. Legend lines wrap. No chart requires hover. Correlation has a numeric caption and −1/0/+1 key; RCShare preserves negative bars to the left of a zero reference. All values come from the selected sealed calculation.

**Infinity Motion:** one thin SVG path, static track and a restrained moving stroke. Mounted only during real opening/calculation/provider work; 2,800 ms calm cycle. It is not a permanent decorative loop and is not claimed to be compositor-only. Reduced motion stops it.

## Motion, interaction and accessibility

Micro 160 ms, standard 280 ms, large 560 ms; no spring or bounce. Press feedback moves one px; sheet settles eight px. Other motion is opacity/transform. `prefers-reduced-motion` removes animation/transitions and preserves a visible static loader. No canvas, WebGL, JavaScript frame loop or global blur.

Default/pressed/disabled/selected states have consistent control geometry. Selection has `aria-current`/`aria-pressed` plus shape/underline, not color alone. Status text distinguishes unavailable, stale, offline, cached and verified using the accepted contracts. A saved key is not an authenticated connection.

Semantic headings, table scopes/captions, skip link, visible focus, page-title focus on navigation, native `dialog.showModal()`, Escape/cancel, initiating-control focus return and explicit form labels are implemented. Touch controls declare at least 44 px; navigation 56 px and primary action 56 px. Inputs are at least 16 px at default text size and viewport zoom is not disabled. Safe areas supplement ordinary padding; stable `svh` pages and bounded `dvh` sheets have ordinary viewport fallbacks. Text-scale layouts wrap or use bounded chart scroll rather than hiding overflow.

Static color/source checks are not full WCAG or VoiceOver certification. Keyboard viewport, real touch, reflow, contrast over every rendered pixel, energy/frame rate and installed-PWA behavior require the runtime/device gate.

## Hidden symbolic architecture — preserved

| Anchor | Locked meaning | Subtle implementation |
|---|---|---|
| 8 | Structure / empire / continuity | Spacing rhythm, repeated controlled geometry |
| 28 | Growth / capital / form | Hero and sheet radius; 280 ms standard settling |
| Infinity | Continuity / compounding / flow | Genuine-operation monoline loader |
| Balance | Equilibrium / balance | Thin balance glyph and centered Target axis |
| Horizontal axis / symmetry | Mathematical balance | Rail and hero geometry |
| Deep Teal | Balance / rationality / controlled capital | Target and deliberate interaction |
| Blue-black | Depth / potential / foundation | Primary canvas |
| Mineral Violet | Intuition / strategic perspective | Quiet secondary graphical layer |
| Slate/Titanium | Discipline / structure / objectivity | Current and neutral structure |
| Off-white | Clarity / truth | Financial numbers |

These meanings are not product marketing copy. The supplied JPEG remains the byte-identical primary mark in Settings/About; the small SVG/PNG icon simplifies its upper teal arc, lower violet crescent and central axis. No replacement logo was generated.
