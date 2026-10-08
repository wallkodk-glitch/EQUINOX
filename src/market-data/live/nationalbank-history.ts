import { z } from 'zod';
import { observation, observationSchema, type Observation, MARKET_DATA_MODEL_VERSION, NATIONALBANK_HISTORY_SOURCE } from './model';
import { MarketError, request } from './network';
import { parseRate } from './nationalbank';
import { dayInZone, validDate, canonicalSession } from './timestamps';
import { RETROSPECTIVE_FX_POLICY, FX_MAX_CALENDAR_DAYS } from '../retrospective-fx';

export const HISTORICAL_FX_POLICY = RETROSPECTIVE_FX_POLICY;
const UNIT = 'Exchange rates (DKK per 100 units of foreign currency)';
const axis = z.object({ category: z.object({ index: z.record(z.string(), z.number().int().nonnegative()), label: z.record(z.string(), z.string()) }) });
const historySchema = z.object({ dataset: z.object({
  source: z.literal('Danmarks Nationalbank'),
  extension: z.object({ px: z.object({ tableid: z.literal('DNVALD') }) }),
  dimension: z.object({
    id: z.tuple([z.literal('VALUTA'),z.literal('KURTYP'),z.literal('ContentsCode'),z.literal('Tid')]),
    size: z.tuple([z.literal(1),z.literal(1),z.literal(1),z.number().int().positive().max(1100)]),
    VALUTA: axis, KURTYP: axis, ContentsCode: axis, Tid: axis,
  }),
  value: z.array(z.unknown()).max(1100),
}) });
function dateFromCode(code: string): string {
  const match = /^(\d{4})M(\d{2})D(\d{2})$/.exec(code);
  const date = match ? `${match[1]}-${match[2]}-${match[3]}` : '';
  if (!validDate(date)) throw new MarketError('INVALID_FX');
  return date;
}
export function parseHistoricalFX(raw: unknown, acquiredAt: string, expectedDates?: string[]): Observation[] {
  const parsed = historySchema.safeParse(raw);
  if (!parsed.success || !z.iso.datetime().safeParse(acquiredAt).success) throw new MarketError('SCHEMA_INVALID');
  const { dimension: d, value } = parsed.data.dataset;
  for (const [axisName,code] of [['VALUTA','USD'],['KURTYP','KBH'],['ContentsCode','DNVALD']] as const) {
    if (Object.keys(d[axisName].category.index).length !== 1 || d[axisName].category.index[code] !== 0) throw new MarketError('SCHEMA_INVALID');
  }
  if (d.KURTYP.category.label.KBH !== UNIT) throw new MarketError('SCHEMA_INVALID');
  const dates = Object.entries(d.Tid.category.index);
  if (dates.length !== d.size[3] || value.length !== d.size[3]) throw new MarketError('MISSING_OBSERVATION');
  const indexes = new Set<number>(), byDate = new Map<string,number>();
  const today = dayInZone(Date.parse(acquiredAt),'Europe/Copenhagen');
  for (const [code,index] of dates) {
    if (indexes.has(index)) throw new MarketError('DUPLICATE_OBSERVATION');
    indexes.add(index);
    if (index >= value.length) throw new MarketError('MISSING_OBSERVATION');
    const date = dateFromCode(code), publishedValue = value[index];
    if (date > today) throw new MarketError('FUTURE_OBSERVATION');
    if (typeof publishedValue !== 'number' || !Number.isFinite(publishedValue) || publishedValue <= 0) throw new MarketError('INVALID_FX');
    const price = parseRate(String(publishedValue));
    if (byDate.has(date) && byDate.get(date) !== price) throw new MarketError('FX_OBSERVATION_CONFLICT');
    byDate.set(date,price);
  }
  if (expectedDates && (new Set(expectedDates).size !== expectedDates.length || expectedDates.length !== byDate.size || expectedDates.some(date => !byDate.has(date)))) throw new MarketError('MISSING_OBSERVATION');
  // JSON-stat updated is a table maintenance timestamp, never economic publication.
  return [...byDate].sort(([a],[b]) => a.localeCompare(b)).map(([date,price]) => observation({
    schemaVersion:1,dataModelVersion:MARKET_DATA_MODEL_VERSION,provider:'nationalbank',instrument:'USD/DKK',
    observationDate:date,observationTimestamp:null,providerTimestamp:null,acquiredAt,price,unit:'DKK_PER_USD',
    kind:'fx-reference',bucketStart:null,bucketEnd:null,sourceURL:NATIONALBANK_HISTORY_SOURCE,
    semantics:'NATIONALBANK_DATE_ONLY_DKK_PER_100_DIVIDED_BY_100',
  }));
}
export function historicalFXAsOf(rows: Observation[], sessionDate: string): Observation {
  canonicalSession(sessionDate);
  const byDate = new Map<string,Observation>();
  for (const row of rows) {
    if (!observationSchema.safeParse(row).success || row.provider !== 'nationalbank' || row.sourceURL !== NATIONALBANK_HISTORY_SOURCE) throw new MarketError('INVALID_FX');
    if (row.observationDate > dayInZone(Date.parse(row.acquiredAt),'Europe/Copenhagen')) throw new MarketError('FUTURE_OBSERVATION');
    const previous = byDate.get(row.observationDate);
    if (previous && previous.price !== row.price) throw new MarketError('FX_OBSERVATION_CONFLICT');
    if (previous) throw new MarketError('DUPLICATE_OBSERVATION');
    byDate.set(row.observationDate,row);
  }
  // Strict preceding date avoids assuming when same-day data became available.
  const selected = [...byDate.values()].filter(row => row.observationDate < sessionDate).sort((a,b) => a.observationDate.localeCompare(b.observationDate)).at(-1);
  if (!selected) throw new MarketError('MISSING_OBSERVATION');
  if ((Date.parse(sessionDate)-Date.parse(selected.observationDate))/86400000 > FX_MAX_CALENDAR_DAYS) throw new MarketError('STALE_DATA');
  return selected;
}
const tableSchema = z.object({id:z.literal('DNVALD'),variables:z.array(z.object({id:z.string(),values:z.array(z.object({id:z.string(),text:z.string()}))}))});
export async function historicalFX(from: string, to: string, signal?: AbortSignal): Promise<Observation[]> {
  if (!validDate(from) || !validDate(to) || from > to || (Date.parse(to)-Date.parse(from))/86400000 > 1099) throw new MarketError('SCHEMA_INVALID');
  // Metadata lists the actual observation dates: no invented Danish holiday grid.
  const raw = await request('https://api.statbank.dk/v1/tableinfo/DNVALD?format=JSON&lang=en',{provider:'nationalbank',signal});
  const table = tableSchema.safeParse(raw);
  if (!table.success) throw new MarketError('SCHEMA_INVALID');
  if (!table.data.variables.find(v => v.id === 'VALUTA')?.values.some(v => v.id === 'USD') || !table.data.variables.find(v => v.id === 'KURTYP')?.values.some(v => v.id === 'KBH' && v.text === UNIT)) throw new MarketError('SCHEMA_INVALID');
  const time = table.data.variables.filter(v => v.id === 'Tid');
  if (time.length !== 1) throw new MarketError('SCHEMA_INVALID');
  const codes = time[0].values.filter(v => { const date=dateFromCode(v.id);return date>=from&&date<=to; });
  if (!codes.length) throw new MarketError('MISSING_OBSERVATION');
  if (codes.length > 1100) throw new MarketError('SCHEMA_INVALID');
  const url = new URL(NATIONALBANK_HISTORY_SOURCE);
  // Official sequence syntax keeps the URL short for multi-year histories.
  const timeCode = (date:string) => date.replace('-','M').replace('-','D');
  for (const [key,value] of Object.entries({lang:'en',valuePresentation:'Code',VALUTA:'USD',KURTYP:'KBH',Tid:`>=${timeCode(from)}<=${timeCode(to)}`})) url.searchParams.set(key,value);
  const payload = await request(url.href,{provider:'nationalbank',signal});
  return parseHistoricalFX(payload,new Date().toISOString(),codes.map(v => dateFromCode(v.id)));
}
