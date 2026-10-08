// Deterministic source/color checks. These do not certify rendered/device accessibility.
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const css = await readFile('src/ui/styles.css', 'utf8');
const baseBlock = css.match(/:root \{([\s\S]*?)\n\}/)[1];
const lightBlock = css.match(/:root\[data-theme="light"\] \{([\s\S]*?)\n\}/)[1];
function tokens(block) { return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(m => [m[1], m[2].trim()])); }
const base = tokens(baseBlock), light = { ...base, ...tokens(lightBlock) };
function value(theme, name) {
  const v = theme[name], reference = v.match(/^var\(--(.+)\)$/);
  return reference ? value(theme, reference[1]) : v;
}
function rgb(hex) { assert.match(hex, /^#[0-9a-f]{6}$/i); return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255); }
function luminance(color) {
  return color.map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
}
function contrast(a, b) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
function blend(fg, bg, alpha) { return fg.map((c, i) => c * alpha + bg[i] * (1 - alpha)); }
const checks = [];
function check(name, ratio, minimum) { checks.push({ name, contrast: ratio, minimum, pass: ratio >= minimum }); }
for (const [mode, theme] of [['dark', base], ['light', light]]) {
  for (const surface of ['bg', 'surface']) for (const text of ['text', 'muted', 'accent', 'warning-readable', 'danger-readable']) {
    check(mode + ' ' + text + ' on ' + surface, contrast(rgb(value(theme, text)), rgb(value(theme, surface))), 4.5);
  }
  for (const source of ['teal-primary', 'violet-mineral']) {
    const ratios = [];
    for (let magnitude = 0; magnitude <= 100; magnitude++) {
      const bg = blend(rgb(value(theme, source)), rgb(value(theme, 'bg')), magnitude / 100 * .7 * Number(value(theme, 'correlation-factor')));
      ratios.push(contrast(rgb(value(theme, 'text')), bg));
    }
    check(mode + ' correlation ' + source + ' worst of 101 magnitudes', Math.min(...ratios), 4.5);
  }
  const selectedBackground = blend(rgb(value(theme, 'teal-primary')), rgb(value(theme, 'surface')), .1);
  check(mode + ' selected Risk boundary', contrast(rgb(value(theme, 'teal-readable')), selectedBackground), 3);
}
check('primary button text', contrast(rgb(base['text-primary']), rgb(base['teal-primary'])), 4.5);
check('hero dark text', contrast(rgb(base['text-secondary']), rgb(base['surface-1'])), 4.5);
check('hero focus outline, both themes', contrast(rgb('#79B8AF'), rgb(base['surface-1'])), 3);

const app = await readFile('src/ui/App.tsx', 'utf8'), sheet = await readFile('src/ui/MarketDataSettings.tsx', 'utf8');
const index = await readFile('index.html', 'utf8');
const contracts = {
  focusVisible: css.includes(':focus-visible'),
  reducedMotionStopsAllAnimations: /prefers-reduced-motion: reduce[\s\S]*animation: none !important/.test(css),
  inputZoomAllowed: !/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/.test(index),
  safeAreaProgressiveEnhancement: css.includes('env(safe-area-inset-top)') && css.includes('env(safe-area-inset-bottom)') && css.includes('100svh') && css.includes('100dvh'),
  formErrorAssociated: app.includes('aria-invalid={invalid}') && app.includes('aria-describedby={invalid ? errorId : undefined}') && app.includes('<small id={errorId}>'),
  nativeModalAndCancel: sheet.includes('element.showModal()') && sheet.includes('onCancel=') && sheet.includes('previous?.focus()'),
  secretInputMaskedAndCleared: sheet.includes('type="password"') && sheet.includes("input.current.value = ''"),
  largeTextChartsBounded: /\.balance-scroll \{ overflow-x: auto/.test(css) && /\.balance-canvas[^}]*min-width: 22em/.test(css) && /\.correlation-table[^}]*min-width: 26em/.test(css),
  touchTargetsDeclared: /button, input, select, summary, \.file-button \{ min-height: 44px/.test(css),
  noPermanentAnimationRuntime: !/requestAnimationFrame|setInterval|WebGL|<canvas/.test(await readFile('src/ui/Glyph.tsx', 'utf8')),
};
const report = { format: 'EQUINOX_UI_STATIC_ACCESSIBILITY_V1', checkedAt: new Date().toISOString(),
  status: checks.every(c => c.pass) && Object.values(contracts).every(Boolean) ? 'PASS' : 'FAIL',
  scope: 'Declared CSS foreground/background pairs and source contracts only; not computed browser styles, whole-screen WCAG, VoiceOver, text reflow or touch/device certification.',
  colorChecks: checks, sourceContracts: contracts,
  browserLayout: 'NOT TESTED', voiceOver: 'NOT TESTED', physicalIPhone: 'NOT TESTED',
};
await writeFile('validation/ui-accessibility.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ status: report.status, colorPairs: checks.length, minimumTextContrast: Math.min(...checks.filter(c => c.minimum === 4.5).map(c => c.contrast)), failed: checks.filter(c => !c.pass), sourceContracts: contracts }, null, 2));
if (report.status !== 'PASS') process.exitCode = 1;
