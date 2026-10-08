import { z } from 'zod';
import { MarketError } from './network';
import { validDate } from './timestamps';

// Bounded issuer evidence, audited 2026-10-07. This is not a blanket certification
// of future events, splits, other stocks or corporate-action completeness.
const finalIssuerEvents = [
  ['2025-03-18','2025-04-10',0.677693,'3q24'],
  ['2025-06-12','2025-07-10',0.780305,'4q24'],
  ['2025-09-16','2025-10-09',0.821965,'1q25'],
  ['2025-12-11','2026-01-08',0.795420,'2q25'],
  ['2026-03-17','2026-04-09',0.938972,'3q25'],
  ['2026-06-11','2026-07-09',0.939325,'4q25'],
  // FINAL Citibank announcement, 02-Oct-2026, linked by TSMC IR (1Q26).
  // 5 ords/ADR; gross $1.0962510, withholding $0.2302130, net $0.8660380.
  ['2026-09-16','2026-10-08',1.0962510,'1q26'],
] as const;
const dividend = z.object({ticker:z.literal('TSM'),currency:z.literal('USD'),
  ex_dividend_date:z.iso.date(),pay_date:z.iso.date(),distribution_type:z.literal('recurring'),
  cash_amount:z.number().finite().positive(),split_adjusted_cash_amount:z.number().finite().positive(),
});
export function validateTSMADRDividends(raw: unknown, from: string, to: string) {
  const parsed = z.array(dividend).safeParse(raw);
  if (!parsed.success || !validDate(from) || !validDate(to) || from > to || from < '2025-01-01' || to > '2026-10-07') throw new MarketError('CORPORATE_ACTION_UNVERIFIED');
  const expected = finalIssuerEvents.filter(([ex]) => ex >= from && ex <= to);
  if (parsed.data.length !== expected.length) throw new MarketError('CORPORATE_ACTION_UNVERIFIED');
  const seen = new Set<string>();
  for (const event of parsed.data) {
    if (seen.has(event.ex_dividend_date)) throw new MarketError('DUPLICATE_OBSERVATION');
    seen.add(event.ex_dividend_date);
    const fact = expected.find(([ex]) => ex === event.ex_dividend_date);
    // Match original USD per ADR cash, not net cash or a split-adjusted substitute.
    if (!fact || event.pay_date !== fact[1] || event.cash_amount !== fact[2] || event.split_adjusted_cash_amount !== event.cash_amount) throw new MarketError('CORPORATE_ACTION_UNVERIFIED');
  }
  return {
    basis:'GROSS_USD_PER_ADR_BEFORE_WITHHOLDING' as const,
    dividends:expected.map(([date,,cashAmountUSD,quarter]) => ({date,cashAmountUSD,sourceURL:`https://investor.tsmc.com/english/dividends/${quarter}`})),
    verifiedRange:{from,to},verifiedForRisk:false as const,
  };
}
