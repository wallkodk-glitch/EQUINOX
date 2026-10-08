import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const base = process.env.BASE_PATH || "/EQUINOX/";
if (!base.startsWith("/") || !base.endsWith("/") || base.includes(".."))
  throw new Error(
    "BASE_PATH must be absolute, trailing slash, no parent segments",
  );
const manifest = {
  id: base,
  name: "EQUINOX",
  short_name: "EQUINOX",
  lang: "da",
  start_url: base,
  scope: base,
  display: "standalone",
  background_color: "#071012",
  theme_color: "#0A1417",
  icons: [
    {
      src: `${base}icon-192.png`,
      sizes: "192x192",
      type: "image/png",
      purpose: "any",
    },
    {
      src: `${base}icon-512.png`,
      sizes: "512x512",
      type: "image/png",
      purpose: "any maskable",
    },
  ],
};
await writeFile("dist/manifest.webmanifest", JSON.stringify(manifest));
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (!p.endsWith(".map") && !p.endsWith("/sw.js")) out.push(p);
  }
  return out.sort();
}
const files = await walk("dist"),
  hash = createHash("sha256");
for (const f of files) {
  hash.update(f);
  hash.update(await readFile(f));
}
const version = hash.digest("hex").slice(0, 16),
  prefix = `equinox:${base}:`,
  cache = `${prefix}${version}`,
  urls = files.map((p) => base + p.slice(5));
const sw = `/* EQUINOX immutable shell ${version}; user-approved updates. Never caches market-data requests. */
const CACHE=${JSON.stringify(cache)},PREFIX=${JSON.stringify(prefix)},BASE=${JSON.stringify(base)},URLS=${JSON.stringify(urls)};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(URLS))));
self.addEventListener('message',e=>{if(e.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith(PREFIX)&&k!==CACHE)await caches.delete(k);await self.clients.claim();})()));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin||u.search||e.request.headers.has('Authorization')||e.request.headers.has('x-cg-demo-api-key'))return;if(e.request.mode==='navigate'&&u.pathname.startsWith(BASE)){e.respondWith(caches.open(CACHE).then(c=>c.match(BASE+'index.html')).then(r=>r||fetch(e.request)));return;}if(URLS.includes(u.pathname)){e.respondWith(caches.open(CACHE).then(c=>c.match(u.pathname)).then(r=>r||fetch(e.request)));}});
`;
await writeFile("dist/sw.js", sw);
await writeFile("dist/.nojekyll", "");
console.log(`PWA ${version}: ${urls.length} shell files; scope ${base}`);
