"""Independent reference from public provider rows + official raw JSON-stat FX.

Lives in reference/ so the project's scripts/calendar.py cannot shadow Python's
standard-library calendar module while datetime parses provider date codes.

No production JavaScript/TypeScript, adapter, calendar or FX selector is imported.
Expected numbers come from the separately retained raw projections, not from the
normalized output under test. Test holdings in the snapshots are synthetic.
"""
from datetime import datetime, timezone, timedelta
from decimal import Decimal
import json
from pathlib import Path
from zoneinfo import ZoneInfo

import numpy as np

root = Path(__file__).resolve().parents[1]
raw = json.loads((root / 'validation/closure-final-provider-rows.json').read_text())
fx_raw = json.loads((root / 'validation/closure-final-fx.json').read_text())
actual = json.loads((root / 'validation/closure-final-synchronized.json').read_text())
assets = ['GOOGL', 'ISRG', 'TSM', 'BTC', 'ETH']
book = {}
payloads = [r['response'] for r in fx_raw['raw'] if '/data/DNVALD/JSONSTAT' in r['sourceURL']]
assert len(payloads) == 1
d = payloads[0]['dataset']
assert d['source'] == 'Danmarks Nationalbank'
assert d['dimension']['VALUTA']['category']['index'] == {'USD': 0}
assert d['dimension']['KURTYP']['category']['index'] == {'KBH': 0}
assert d['dimension']['KURTYP']['category']['label']['KBH'] == 'Exchange rates (DKK per 100 units of foreign currency)'
for code, index in d['dimension']['Tid']['category']['index'].items():
    date = datetime.strptime(code, '%YM%mD%d').date()
    value = d['value'][index]
    assert np.isfinite(value) and value > 0 and date not in book
    # Published monetary rates are decimals. Divide their decimal value by 100
    # before one Float64 conversion, not two binary rounding operations.
    book[date] = float(Decimal(str(value)) / Decimal(100))
points = {a: {b['t']: b['c'] for b in raw['data'][a]['bars']} for a in assets}
levels, prices, rates, rows, fx_ages = [], [], [], [], []
for session in raw['grid']:
    close = datetime.fromisoformat(session['close'].replace('Z', '+00:00'))
    date = close.astimezone(ZoneInfo('Europe/Copenhagen')).date()
    eligible = [d for d in book if d < date]
    assert eligible
    chosen = max(eligible)
    age = (date - chosen).days
    assert 0 < age <= 6
    minute_start = int((close - timedelta(seconds=60)).timestamp() * 1000)
    p = np.array([points[a][minute_start] for a in assets])
    prices.append(p); rates.append(book[chosen]); levels.append(p * book[chosen]); fx_ages.append(age)
    rows.append((session['date'], chosen.isoformat(), book[chosen]))
    normalized = actual['normalizedInput']['rows'][len(rows) - 1]
    assert normalized['fx']['observationDate'] == chosen.isoformat()
    assert normalized['fx']['rate'] == book[chosen]
    assert 'observedAt' not in normalized['fx'] and 'publishedAt' not in normalized['fx']
returns = []
for i in range(1, len(rows)):
    usd_factors = prices[i] / prices[i - 1]
    for j, asset in enumerate(assets[:3]):
        action = raw['actions'][asset]
        splits = [s for s in action['rawSplits'] if s['execution_date'] == rows[i][0]]
        dividends = [v for v in action['rawDividends'] if v['ex_dividend_date'] == rows[i][0]]
        assert not (splits and dividends), 'uncertified simultaneous action basis'
        split = np.prod([s['split_to'] / s['split_from'] for s in splits]) if splits else 1.0
        cash = sum(v['cash_amount'] for v in dividends)
        usd_factors[j] = split * (prices[i][j] + cash) / prices[i - 1][j]
    returns.append(usd_factors * (rates[i] / rates[i - 1]) - 1.0)
returns = np.array(returns)
assert returns.shape == (252, 5)
assert np.isfinite(returns).all()
expected_covariance = np.cov(returns, rowvar=False, ddof=1) * 252
expected_correlation = np.corrcoef(returns, rowvar=False)
np.testing.assert_allclose(actual['levelsDKK'], levels, rtol=0, atol=1e-10)
np.testing.assert_allclose(actual['returns'], returns, rtol=0, atol=1e-13)
np.testing.assert_allclose(actual['covariance'], expected_covariance, rtol=0, atol=1e-13)
np.testing.assert_allclose(actual['correlation'], expected_correlation, rtol=0, atol=1e-12)
assert actual['returnDates'] == [r[0] for r in rows[1:]]
tsm = [v for v in raw['actions']['TSM']['rawDividends'] if v['ex_dividend_date'] == '2026-09-16']
assert len(tsm) == 1 and tsm[0]['cash_amount'] == 1.096251 and tsm[0]['pay_date'] == '2026-10-08'
report = {'checkedAt': datetime.now(timezone.utc).isoformat(), 'status': 'PASS',
          'scope': 'Independent raw-row/official raw FX as-of, gross total returns, DKK levels, covariance and correlation',
          'returns': len(returns), 'observations': len(rows), 'maximumFXAgeDays': max(fx_ages),
          'maxReturnDifference': float(np.max(np.abs(np.array(actual['returns']) - returns))),
          'maxCovarianceDifference': float(np.max(np.abs(np.array(actual['covariance']) - expected_covariance))),
          'browserRuntime': 'NOT TESTED'}
(root / 'validation/closure-final-independent-reference.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))
