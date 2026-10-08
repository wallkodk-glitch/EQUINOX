import { it,expect } from 'vitest';
import { parseCoinGecko } from '../src/market-data/live/coingecko';
import { parseMassiveBars, parseActions } from '../src/market-data/live/massive';
import { parseRate, rssObservationDate } from '../src/market-data/live/nationalbank';
import { canonicalSession, cryptoAtClose } from '../src/market-data/live/timestamps';
const acquired='2026-10-02T23:00:00.000Z';
import rawStock from './fixtures/providers/massive-stock.raw.json';
import rawCrypto from './fixtures/providers/massive-crypto.raw.json';
import rawCurrent from './fixtures/providers/coingecko.raw.json';
import expected from './fixtures/providers/expected.normalized.json';
it('separate raw fixtures match independently authored normalized expectations',()=>{
 expect(parseMassiveBars(rawStock,'GOOGL','day',expected.acquiredAt)[0]).toMatchObject(expected.stock);
 expect(parseMassiveBars(rawCrypto,'BTC','minute',expected.acquiredAt)[0]).toMatchObject(expected.crypto);
 expect(parseCoinGecko(rawCurrent,expected.acquiredAt).map(q=>[q.instrument,q.price,q.observationTimestamp])).toEqual(expected.current);
});
it('CoinGecko projects BTC ETH price/time only; prices are not risk inputs',()=>{
  const t=Date.parse(acquired)/1000-60;
  expect(parseCoinGecko({bitcoin:{usd:100000,last_updated_at:t},ethereum:{usd:4000,last_updated_at:t}},acquired).map(q=>[q.instrument,q.price,q.observationTimestamp])).toEqual([
    ['BTC',100000,'2026-10-02T22:59:00.000Z'],['ETH',4000,'2026-10-02T22:59:00.000Z']]);
});
it('CoinGecko rejects missing, invalid, future or stale observations',()=>{
  for (const value of [NaN,Infinity,0,-1]) expect(()=>parseCoinGecko({bitcoin:{usd:value,last_updated_at:1}},acquired)).toThrow();
  for(const seconds of [Date.parse(acquired)/1000+1,1]) {
    expect(()=>parseCoinGecko({bitcoin:{usd:100,last_updated_at:seconds},ethereum:{usd:50,last_updated_at:seconds}},acquired)).toThrow();
  }
});
it('Massive stock day timestamp remains provider timestamp, not close time',()=>{
  const bars=parseMassiveBars({ticker:'GOOGL',adjusted:false,status:'OK',resultsCount:1,results:[{t:1790913600000,o:100,h:102,l:99,c:101,v:1000}]},'GOOGL','day',acquired);
  expect(bars[0]).toMatchObject({instrument:'GOOGL',observationDate:'2026-10-02',observationTimestamp:null,providerTimestamp:'2026-10-02T04:00:00.000Z',price:101});
});
it('Massive refuses adjusted/wrong ticker/partial/duplicate/non-finite/future data',()=>{
 const b={t:1790913600000,o:100,h:102,l:99,c:101,v:1000};
 const good={ticker:'GOOGL',adjusted:false,status:'OK',resultsCount:1,results:[b]};
 for(const p of [{...good,adjusted:true},{...good,ticker:'TSM'},{...good,resultsCount:2},{...good,results:[b,b],resultsCount:2},{...good,results:[{...b,c:0}]},{...good,results:[{...b,t:Date.parse(acquired)+1}]}]) expect(()=>parseMassiveBars(p,'GOOGL','day',acquired)).toThrow();
});
it('canonical close handles DST, holidays, weekends, exceptional and early closes',()=>{
 expect(canonicalSession('2026-03-06').close).toBe('2026-03-06T21:00:00.000Z');
 expect(canonicalSession('2026-03-09').close).toBe('2026-03-09T20:00:00.000Z');
 expect(canonicalSession('2026-11-27').close).toBe('2026-11-27T18:00:00.000Z');
 for(const date of ['2026-07-03','2026-10-03','2025-01-09','2028-01-03']) expect(()=>canonicalSession(date)).toThrow();
});
it('crypto selects only exact close-ending minute; rejects missing/future bucket and duplicate',()=>{
 const close='2026-10-02T20:00:00.000Z',start=Date.parse(close)-60000;
 const payload={ticker:'X:BTCUSD',adjusted:false,status:'OK',resultsCount:1,results:[{t:start,o:100,h:102,l:99,c:101,v:1}]};
 const bars=parseMassiveBars(payload,'BTC','minute',acquired);
 expect(cryptoAtClose(bars,'2026-10-02')).toMatchObject({price:101,observationTimestamp:close});
 expect(()=>cryptoAtClose([], '2026-10-02')).toThrow('MISSING_OBSERVATION');
 expect(()=>cryptoAtClose([...bars,...bars], '2026-10-02')).toThrow('DUPLICATE_OBSERVATION');
 const later=parseMassiveBars({...payload,results:[{...payload.results[0],t:Date.parse(close)}]},'BTC','minute',acquired);
 expect(()=>cryptoAtClose(later,'2026-10-02')).toThrow('MISSING_OBSERVATION');
});
it('Nationalbank decimals and unit conversion are explicit; ambiguous numbers reject',()=>{
 expect(parseRate('665,80')).toBe(6.658);expect(parseRate('665.80')).toBe(6.658);
 for(const x of ['1,234.56','665,80oops','NaN','Infinity','0','-1','1e3','']) expect(()=>parseRate(x)).toThrow('INVALID_FX');
});
it('RSS extracts observation date only; does not invent a publication time',()=>{
 expect(rssObservationDate('fre, 02 okt. 2026 12.00.00 +02:00')).toBe('2026-10-02');
 expect(rssObservationDate('Fri, 02 Oct 2026 12:00:00 +02:00')).toBe('2026-10-02');
 expect(()=>rssObservationDate('Fri, 31 Feb 2026 12:00:00 +02:00')).toThrow();
});
it('corporate-action fields retain original basis; TSM cannot silently become proven gross dividends',()=>{
 const actions=parseActions([{ticker:'GOOGL',execution_date:'2026-09-01',split_from:1,split_to:2,adjustment_type:'forward_split'}],[{ticker:'GOOGL',ex_dividend_date:'2026-09-10',cash_amount:1,currency:'USD',split_adjusted_cash_amount:0.5,distribution_type:'recurring'}],'GOOGL');
 expect(actions.splits[0].ratio).toBe(2);expect(actions.dividends[0].cashAmountUSD).toBe(1);
 expect(actions.verifiedForRisk).toBe(false);
 expect(()=>parseActions([],[{ticker:'TSM',ex_dividend_date:'2026-09-10',cash_amount:1,currency:'TWD',distribution_type:'recurring'}],'TSM')).toThrow();
});
