import { expect, it } from 'vitest';
import { validateTSMADRDividends } from '../src/market-data/live/tsm-adr';
import raw from './fixtures/providers/tsm-dividends.raw.json';

// Expected values transcribed from the FINAL Citibank announcement linked by
// TSMC IR, dated 02-Oct-2026, p1; never inferred from the Massive cash field.
const fact={exDate:'2026-09-16',payDate:'2026-10-08',grossUSDPerADR:1.0962510,
  netUSDPerADR:0.8660380,withheldUSDPerADR:0.2302130,ordinaryPerADR:5};
it('proves September 16 gross USD/ADR against the final issuer/depositary amount, not net cash', () => {
  const result=validateTSMADRDividends(raw,'2025-01-01','2026-10-06');
  expect(result.dividends.at(-1)).toMatchObject({date:fact.exDate,cashAmountUSD:fact.grossUSDPerADR,
    sourceURL:'https://investor.tsmc.com/english/dividends/1q26'});
  expect(result.basis).toBe('GROSS_USD_PER_ADR_BEFORE_WITHHOLDING');
  expect(result.verifiedForRisk).toBe(false); // A dividend proof is not a full dataset gate.
});
it('fails closed on net USD, TWD ordinary-share cash, wrong ex/pay date and unverified future windows', () => {
  for (const change of [{cash_amount:fact.netUSDPerADR},{cash_amount:7.00000137},
    {currency:'TWD'},{ex_dividend_date:'2026-09-17'},{pay_date:'2026-10-09'},
    {split_adjusted_cash_amount:fact.grossUSDPerADR/2}]) {
    const rows=structuredClone(raw);Object.assign(rows[6],change);
    expect(()=>validateTSMADRDividends(rows,'2025-01-01','2026-10-06')).toThrow('CORPORATE_ACTION_UNVERIFIED');
  }
  expect(()=>validateTSMADRDividends(raw,'2025-01-01','2026-12-31')).toThrow('CORPORATE_ACTION_UNVERIFIED');
});

it('accepts the renewed October 8 evidence boundary with the same seven final gross ADR events', () => {
  const result=validateTSMADRDividends(raw,'2025-01-01','2026-10-08');
  // Independently transcribed issuer/depositary facts, not adapter-derived expectations.
  expect(result.dividends.map(d=>[d.date,d.cashAmountUSD])).toEqual([
    ['2025-03-18',0.677693],['2025-06-12',0.780305],['2025-09-16',0.821965],
    ['2025-12-11',0.795420],['2026-03-17',0.938972],['2026-06-11',0.939325],
    ['2026-09-16',1.0962510],
  ]);
  expect(result.verifiedRange).toEqual({from:'2025-01-01',to:'2026-10-08'});
  expect(result.basis).toBe('GROSS_USD_PER_ADR_BEFORE_WITHHOLDING');
  expect(result.verifiedForRisk).toBe(false);
});
it('does not book a second dividend on the October 8 payment date', () => {
  const result=validateTSMADRDividends([],'2026-10-08','2026-10-08');
  expect(result.dividends).toEqual([]);
  expect(result.verifiedForRisk).toBe(false);
});
it('still rejects October 9, future windows and history before the approved lower boundary', () => {
  for(const [from,to] of [
    ['2025-01-01','2026-10-09'],['2025-01-01','2026-12-10'],
    ['2024-12-31','2026-10-08'],
  ]) expect(()=>validateTSMADRDividends(raw,from,to)).toThrow('CORPORATE_ACTION_UNVERIFIED');
});
it('renewed coverage does not admit net cash, missing actions or an unverified October action', () => {
  const net=structuredClone(raw);net[6].cash_amount=0.8660380;net[6].split_adjusted_cash_amount=0.8660380;
  const extra={...raw[6],ex_dividend_date:'2026-10-08',pay_date:'2026-10-08'};
  for(const rows of [net,raw.slice(0,6),[...raw,extra]]) {
    expect(()=>validateTSMADRDividends(rows,'2025-01-01','2026-10-08')).toThrow('CORPORATE_ACTION_UNVERIFIED');
  }
});
