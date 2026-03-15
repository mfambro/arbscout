/**
 * markets.js — Platform definitions and seed market data.
 *
 * To connect real APIs:
 *   1. Add your API keys to config.apiKeys below (or use env vars via a build step)
 *   2. Replace SEED_MARKETS with a call to fetchLiveMarkets()
 *   3. Implement each platform's fetchMarkets() fn in src/api/ (see README)
 */

window.PLATFORMS = {
  polymarket: { name: 'Polymarket', fee: 0.02, color: '#4f46e5', url: 'https://polymarket.com' },
  manifold:   { name: 'Manifold',   fee: 0.00, color: '#0891b2', url: 'https://manifold.markets' },
  kalshi:     { name: 'Kalshi',     fee: 0.03, color: '#059669', url: 'https://kalshi.com' },
  metaculus:  { name: 'Metaculus',  fee: 0.00, color: '#d97706', url: 'https://metaculus.com' },
  predictit:  { name: 'PredictIt',  fee: 0.05, color: '#dc2626', url: 'https://predictit.org' },
};

/**
 * API keys — populate these when going live.
 * In production use environment variables / a backend proxy.
 */
window.API_KEYS = {
  polymarket: '',   // CLOB API key
  kalshi:     '',   // REST API key
  predictit:  '',   // Credentials
};

/**
 * SEED_MARKETS — used in paper-trading / demo mode.
 * Schema per market:
 *   id, title, category, resolution (ISO date), platforms, clauses, clauseFlags, identityScores
 *
 * platforms[key]: { yes (0–1), no (0–1), liquidity ($), volume ($) }
 * identityScores: { titleMatch, resolutionLogic, resolveDate, oracle, currency }  — all 0–1
 */
window.SEED_MARKETS = [
  {
    id: 'm1',
    title: 'Will the Fed cut rates by June 2025?',
    category: 'Macro',
    platforms: {
      polymarket: { yes: 0.44, no: 0.56, liquidity: 180000, volume: 420000 },
      kalshi:     { yes: 0.38, no: 0.62, liquidity:  95000, volume: 210000 },
    },
    resolution: '2025-06-30',
    clauses: {
      polymarket: 'Resolves YES if FOMC announces a rate reduction of ≥25bps before June 30 2025. Relies on official FOMC statements. No partial resolution. UMA arbitration.',
      kalshi:     'Resolves YES if the federal funds target rate (upper bound) is lower than current rate at any FOMC meeting on or before June 30 2025. CFTC regulated.',
    },
    clauseFlags: [
      '⚠ Resolution oracle differs (UMA vs CFTC)',
      '✓ Both require ≥25bps cut',
      '✓ Same event trigger (FOMC meeting)',
    ],
    identityScores: { titleMatch: 0.92, resolutionLogic: 0.88, resolveDate: 1.00, oracle: 0.55, currency: 1.00 },
  },
  {
    id: 'm2',
    title: 'Bitcoin above $100k end of 2024?',
    category: 'Crypto',
    platforms: {
      polymarket: { yes: 0.71, no: 0.29, liquidity: 320000, volume: 980000 },
      manifold:   { yes: 0.58, no: 0.42, liquidity:   4200, volume:  18000 },
    },
    resolution: '2024-12-31',
    clauses: {
      polymarket: 'Resolves YES if BTC/USD spot price on Coinbase Pro is ≥$100,000 at 11:59pm UTC on Dec 31 2024. Uses Coinbase Pro feed only.',
      manifold:   'Resolves YES if Bitcoin price exceeds $100k USD according to CoinGecko at any point before Jan 1 2025.',
    },
    clauseFlags: [
      '⚠ Different price feeds (Coinbase vs CoinGecko)',
      '⚠ Manifold resolves on ANY point; Polymarket on EOD close',
      '⚠ Manifold is play-money only — no real USD value',
    ],
    identityScores: { titleMatch: 0.95, resolutionLogic: 0.60, resolveDate: 0.90, oracle: 0.30, currency: 0.10 },
  },
  {
    id: 'm3',
    title: 'US unemployment above 4.5% in Q1 2025?',
    category: 'Economics',
    platforms: {
      kalshi:     { yes: 0.22, no: 0.78, liquidity: 65000, volume: 145000 },
      polymarket: { yes: 0.17, no: 0.83, liquidity: 48000, volume:  88000 },
    },
    resolution: '2025-03-31',
    clauses: {
      kalshi:     'Resolves YES if BLS reports U-3 unemployment rate ≥4.5% for any month with initial release before April 15 2025. Regulated event contract.',
      polymarket: 'Resolves YES if BLS U-3 unemployment rate ≥4.5% for any month in Q1 2025 per initial BLS release. UMA arbitration.',
    },
    clauseFlags: [
      '✓ Both use BLS U-3 — strong match',
      '⚠ Kalshi deadline April 15 vs Polymarket unspecified',
      '✓ Same threshold (4.5%)',
    ],
    identityScores: { titleMatch: 0.97, resolutionLogic: 0.93, resolveDate: 0.95, oracle: 0.80, currency: 1.00 },
  },
  {
    id: 'm4',
    title: 'Will there be a US recession in 2025?',
    category: 'Macro',
    platforms: {
      polymarket: { yes: 0.35, no: 0.65, liquidity: 220000, volume: 510000 },
      metaculus:  { yes: 0.28, no: 0.72, liquidity:       0, volume:      0 },
      predictit:  { yes: 0.41, no: 0.59, liquidity:  88000, volume: 190000 },
    },
    resolution: '2025-12-31',
    clauses: {
      polymarket: 'Resolves YES if NBER officially declares a recession beginning in 2025 by Dec 31 2026 (18-month resolution window). USDC payout.',
      metaculus:  'Resolves YES if GDP declines for two consecutive quarters OR NBER recession declaration. Metaculus community resolves.',
      predictit:  'Resolves YES if NBER announces recession start in 2025. $850 position limit per contract.',
    },
    clauseFlags: [
      '⚠ Metaculus uses GDP OR NBER — broader definition',
      '⚠ Metaculus has no real USD payout (points only for non-US traders)',
      '⚠ PredictIt $850 cap limits position size',
      '⚠ Resolution timeline differs significantly',
    ],
    identityScores: { titleMatch: 0.89, resolutionLogic: 0.55, resolveDate: 0.70, oracle: 0.50, currency: 0.75 },
  },
];
