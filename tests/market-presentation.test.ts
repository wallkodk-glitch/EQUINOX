import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { MarketDataSettings } from '../src/ui/MarketDataSettings';
import { MarketError } from '../src/market-data/live/network';
import { marketErrorMessage } from '../src/ui/presentation';

it('Settings exposes a manual refresh action even when a missing key needs configuration', () => {
  const html = renderToStaticMarkup(createElement(MarketDataSettings, {
    online: true, lookback: 252, dataset: null,
    onAcceptRiskDataset: async () => {}, onBusyChange: () => {},
  }));
  const action = html.match(/<button[^>]*>Opdatér risikohistorik<\/button>/)?.[0];
  expect(action).toBeDefined(); expect(action).not.toContain('disabled');
  expect(html).toContain('CoinGecko'); expect(html).toContain('kun aktuelle crypto-referencer');
  expect(html).not.toContain('<dialog');
});
it.each([
  ['AUTH_FAILED', 'nøgle'], ['ENTITLEMENT_DENIED', 'adgang'], ['RATE_LIMITED', 'request'],
  ['NETWORK_OR_CORS', 'forbindelse'], ['CACHE_INVALID', 'cache'], ['CORPORATE_ACTION_UNVERIFIED', 'corporate'],
] as const)('safe %s errors have a human-readable next action, not provider text', (code, meaning) => {
  const message = marketErrorMessage(new MarketError(code));
  expect(message.toLowerCase()).toContain(meaning); expect(message).not.toContain(code);
});
it('an arbitrary provider exception cannot leak into human-readable errors', () => {
  const secret = crypto.randomUUID(); expect(marketErrorMessage(new Error(secret))).not.toContain(secret);
  expect(marketErrorMessage(new Error(secret))).toContain('igen');
});
it('manual refresh discloses the bounded TSM proof instead of promising current live history', () => {
  const html = renderToStaticMarkup(createElement(MarketDataSettings, { online: true, onAcceptRiskDataset: async () => {} }));
  expect(html).toContain('2025-01-01–2026-10-08');
  expect(html).toContain('Senere og bredere perioder afvises');
});
