# UI v1 review and corrections

The initial research/strategy preceded product edits. Review covered the Overview decision hierarchy, three-state rail, risk sources, compact settings, source boundaries and mobile accessibility. The separate readonly reviewer supplied concrete findings but its turn ended at a usage limit; this is a partial review, not a completed independent approval. Root closed the findings and verified the resulting source/tests. No browser screenshot of the new interface was obtained.

| Finding | Result and evidence |
|---|---|
| Summary risk beside editable current valuation could imply the same inputs | RiskSummary states the historical snapshot timestamp and changed-input notice; the snapshot supplies the values. Added regression. |
| Missing held-asset price looked like a zero valuation | Hero and editor show missing value/price explicitly; last valid financial state and gates unchanged. Added presentation regression. |
| Light correlation color could reduce small-text contrast | Lower alpha for existing light/system-light mode; 101 magnitudes checked independently for each palette end. |
| Light global focus outline on always-dark hero | Local readable outline for the hero in both themes. |
| Selected risk control boundary relied on a faint border | Readable boundary and underline plus existing `aria-pressed`. |
| Enlarged text could collide in weights/matrix | Font-responsive chart widths inside focusable scroll regions, wrapping legend/metrics/controls and font-responsive bottom clearance. Browser reflow cases prepared. |
| Numeric errors lacked an accessible association | Stable `useId`, invalid state and error description; parsing/commit/blur behavior unchanged. Browser case prepared. |
| Correlation detail carried covariance-like corner text | Asset header and explicit six-decimal caption; full precision in immutable JSON. Added regression. |
| Historical baseline bundle files remained in the first candidate dist | Final release tree/build created without historical dist; strict referenced-asset set and separate clean-build checksum gate reject stale bundles. |

The designer pass reduced repeated cards to canvas sections, separated editable valuation from historical proof, retained one hero wash, and kept direct numbers over decorative graphics. Target/current/projected do not rely on color alone. No asset list, palette, hidden symbolic anchor or market-data meaning was changed. Visual cohesion remains subject to actual browser/device inspection.

## Test harness correction

The first UI-only legacy assertion used the hash of the separate Node Engine 1.0.1 fixture for the Engine 1.0.0 fixture. The immutable supplied baseline was independently checked. The assertion now uses the actual old fixture hash; production code, fixture bytes and financial output were unchanged.

- `tests/legacy-snapshot.json`, Engine 1.0.0: `9d114db13ee5dd700208cb1fe93f709521484b20b6bcf0ce2a6e1d1423d7f633`.
- `validation/node-snapshot.json`, Engine 1.0.1: `e491090dd7e2cf8a81bd33c23d67460158aab62bac455d2f177de25038c50891`.

No new mathematical correctness defect was found or fixed. No data-layer correctness change was made.

## Scope controls

`audit-ui-release.mjs` checks 67 frozen source/reference/non-browser-test files byte-for-byte against the supplied v1.1.2, package/lock equality apart from App version, original business handlers/effects/form change handlers, unchanged worker template apart from manifest colors, original browser case names/assertion counts and primary brand hash. Two explicit display-copy/route exceptions are normalized and recorded. The changed-file set is enumerated, not hidden.

The mobile ZIP workflow change only selects the new App release filename/manifest contract and checks frozen version identity; action pins, build/test/deploy sequence, path safety and checksum verification remain intact. This does not establish hosted success. The original data-release audit/packager remain historical, not acceptance gates for UI 1.2.0.
