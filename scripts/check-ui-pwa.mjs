// Exercises the generated worker in Node and inspects its static shell assets.
// This is deliberately not browser offline, installation or service-worker lifecycle evidence.
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';
const base = '/EQUINOX/', manifest = JSON.parse(await readFile('dist/manifest.webmanifest', 'utf8'));
const html = await readFile('dist/index.html', 'utf8');
const referencedAssets = [...html.matchAll(/(?:src|href)="\/EQUINOX\/assets\/([^"?#]+)"/g)].map(m => m[1]).sort();
assert.equal(referencedAssets.length, 2, 'Expected one current JS entry and one CSS entry');
const expectedAssets = [...referencedAssets, ...referencedAssets.filter(f => f.endsWith('.js')).map(f => f + '.map')].sort();
assert.deepEqual((await readdir('dist/assets')).sort(), expectedAssets, 'Stale or unexpected assets in production artifact');
assert.equal(manifest.scope, base); assert.equal(manifest.start_url, base); assert.equal(manifest.display, 'standalone');
assert.equal(manifest.theme_color, '#0A1417'); assert.equal(manifest.background_color, '#071012');
for (const [file, dimension] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  const png = await readFile('dist/' + file);
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16), dimension); assert.equal(png.readUInt32BE(20), dimension);
}
assert((await readFile('public/brand/equinox-primary.jpeg')).equals(await readFile('dist/brand/equinox-primary.jpeg')));
const worker = await readFile('dist/sw.js', 'utf8'), handlers = new Map(), calls = [], registrations = [];
runInNewContext(worker, {
  URL,
  self: { location: { origin: 'https://example.test' }, addEventListener: (name, handler) => handlers.set(name, handler), skipWaiting: () => {}, clients: { claim: async () => {} } },
  caches: { open: async () => ({ match: async () => 'SHELL', addAll: async urls => registrations.push(...urls) }), keys: async () => [], delete: async () => {} },
  fetch: async () => 'FETCH',
});
await new Promise(resolve => handlers.get('install')({ waitUntil: promise => promise.then(resolve) }));
assert(registrations.includes(base + 'index.html'));
assert(registrations.includes(base + 'brand/equinox-primary.jpeg'));
assert(registrations.every(url => url.startsWith(base) && !url.includes('?') && !url.endsWith('.map')));
function request(name, url, { method = 'GET', mode = 'cors', header = null } = {}) {
  let intercepted = false;
  handlers.get('fetch')({ request: { url, method, mode, headers: { has: key => key === header } }, respondWith: promise => { intercepted = true; calls.push(Promise.resolve(promise)); } });
  return { name, intercepted };
}
const guards = [
  request('external Massive request', 'https://api.massive.com/v2/aggs/ticker/GOOGL/range/1/minute/1/2'),
  request('external CoinGecko request', 'https://api.coingecko.com/api/v3/simple/price'),
  request('external Nationalbank request', 'https://www.nationalbanken.dk/feed'),
  request('same-origin Authorization header', 'https://example.test/EQUINOX/index.html', { header: 'Authorization' }),
  request('same-origin CoinGecko auth header', 'https://example.test/EQUINOX/index.html', { header: 'x-cg-demo-api-key' }),
  request('same-origin query request', 'https://example.test/EQUINOX/index.html?value=1'),
  request('same-origin POST', 'https://example.test/EQUINOX/index.html', { method: 'POST' }),
  request('unknown same-origin API request', 'https://example.test/EQUINOX/api/market'),
];
assert(guards.every(g => !g.intercepted));
assert(request('same-origin navigation shell', 'https://example.test/EQUINOX/', { mode: 'navigate' }).intercepted);
await Promise.all(calls);
const assets = [];
for (const file of await readdir('dist/assets')) {
  if (/\.(js|css)$/.test(file)) { const data = await readFile('dist/assets/' + file); assets.push({ file, bytes: data.length, gzipBytes: gzipSync(data).length, sha256: createHash('sha256').update(data).digest('hex') }); }
}
const image = await readFile('dist/brand/equinox-primary.jpeg');
const report = { format: 'EQUINOX_UI_PWA_STATIC_V1', checkedAt: new Date().toISOString(), status: 'PASS',
  scope: 'Generated manifest/icon/brand checks plus Node VM worker request-guard and install-asset exercise only.',
  manifest, iconSizes: [192, 512, 180], noStaleBuildAssets: true, authRequestsNeverIntercepted: true, guards, shellAssetCount: registrations.length,
  assets, primaryBrandBytes: image.length, externalRuntimeFontsOrChartDependenciesAdded: false,
  performanceScope: 'Artifact sizes and static animation architecture only. Frame time, energy use, scrolling and keyboard NOT TESTED.',
  browserOffline: 'NOT TESTED', installedPWA: 'NOT TESTED', actualSafeAreas: 'NOT TESTED', serviceWorkerUpdateRuntime: 'NOT TESTED',
};
await writeFile('validation/ui-pwa.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ status: report.status, shellAssets: registrations.length, protectedRequestGuards: guards.length, assets, primaryBrandBytes: image.length }, null, 2));
