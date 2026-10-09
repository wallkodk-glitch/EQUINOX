import { readFileSync } from 'node:fs';

// Official saved raw JSON-stat; simulate the server's requested date interval.
// No production parser/selector is used to fabricate expected engine results.
const saved = JSON.parse(readFileSync('validation/closure-final-fx.json', 'utf8'));
export const fxPayload = saved.raw.find((entry: { sourceURL: string }) => entry.sourceURL.includes('/data/DNVALD/JSONSTAT')).response;
export function nativeFXResponse(url: URL) {
  const interval = /^>=(\d{4}M\d{2}D\d{2})<=(\d{4}M\d{2}D\d{2})$/.exec(url.searchParams.get('Tid') ?? '');
  if (!interval) throw new Error('Test request omitted explicit date interval');
  const payload = structuredClone(fxPayload), d = payload.dataset.dimension;
  const selected = Object.entries<number>(d.Tid.category.index).filter(([code]) => code >= interval[1] && code <= interval[2]);
  payload.dataset.value = selected.map(([, index]) => payload.dataset.value[index]);
  d.size[3] = selected.length;
  d.Tid.category.index = Object.fromEntries(selected.map(([code], index) => [code, index]));
  d.Tid.category.label = Object.fromEntries(selected.map(([code]) => [code, d.Tid.category.label[code]]));
  return payload;
}
