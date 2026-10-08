import { expect, it } from 'vitest';
import { validateTSMADRDividends } from '../src/market-data/live/tsm-adr';
import raw from './fixtures/providers/tsm-dividends.raw.json';
import issuer from './fixtures/providers/tsmc-dividends.expected.json';

it('matches original USD cash per ADR and US ex-date to six final issuer announcements', () => {
  const result = validateTSMADRDividends(raw.slice(0,6), '2025-01-01', '2026-06-11');
  expect(result.dividends.map(d => [d.date,d.cashAmountUSD])).toEqual(issuer.events.map(e => [e.exDate,e.grossUSDPerADR]));
  expect(result.basis).toBe('GROSS_USD_PER_ADR_BEFORE_WITHHOLDING');
  expect(result.verifiedForRisk).toBe(false); // Dividends alone are not the complete risk dataset.
});
it('rejects net/withheld cash, ordinary-share cash, split-adjusted substitutions and wrong ex-date', () => {
  for (const change of [
    {cash_amount:0.741788}, {cash_amount:6.00003573}, {currency:'TWD'},
    {split_adjusted_cash_amount:0.469486}, {ex_dividend_date:'2026-03-18'},
    {pay_date:'2026-04-10'},
  ]) {
    const rows = structuredClone(raw.slice(0,6)); Object.assign(rows[4],change);
    expect(() => validateTSMADRDividends(rows,'2025-01-01','2026-06-11')).toThrow('CORPORATE_ACTION_UNVERIFIED');
  }
});
it('fails closed on missing, duplicate, conflicting or not-finally-verified ADR actions', () => {
  for (const rows of [raw.slice(0,5),[...raw.slice(0,6),raw[4]],[...raw.slice(0,6),{...raw[4],cash_amount:1}]]) {
    expect(() => validateTSMADRDividends(rows,'2025-01-01','2026-06-11')).toThrow();
  }
  // Future events outside the explicitly audited evidence window still fail closed.
  expect(() => validateTSMADRDividends(raw,'2025-01-01','2026-12-31')).toThrow('CORPORATE_ACTION_UNVERIFIED');
});
