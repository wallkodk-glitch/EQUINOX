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
