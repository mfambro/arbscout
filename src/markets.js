/**
 * markets.js — Platform definitions and seed market data.
 *
 * All markets use future resolution dates (relative to now) so the
 * time-window filter works correctly in paper-trading mode.
 */

window.PLATFORMS = {
  polymarket: { name: 'Polymarket', fee: 0.02, color: '#4f46e5', url: 'https://polymarket.com' },
  manifold:   { name: 'Manifold',   fee: 0.00, color: '#0891b2', url: 'https://manifold.markets' },
  kalshi:     { name: 'Kalshi',     fee: 0.03, color: '#059669', url: 'https://kalshi.com' },
  metaculus:  { name: 'Metaculus',  fee: 0.00, color: '#d97706', url: 'https://metaculus.com' },
  predictit:  { name: 'PredictIt',  fee: 0.05, color: '#dc2626', url: 'https://predictit.org' },
};

window.API_KEYS = {
  polymarket: '',
  kalshi:     '',
  predictit:  '',
};

/**
 * resolutionTs(hoursFromNow) — helper so seed data stays valid regardless
 * of when the file is loaded.
 */
function resolutionTs(hoursFromNow) {
  return new Date(Date.now() + hoursFromNow * 3600 * 1000).toISOString();
}

window.SEED_MARKETS = [
  // ── closes in ~45 min ──────────────────────────────────────────────────
  {
    id: 'm1',
    title: 'Will BTC stay above $68k at next hourly close?',
    category: 'Crypto',
    resolutionTs: () => resolutionTs(0.75),
    platforms: {
      polymarket: { yes: 0.61, no: 0.39, liquidity: 95000,  volume: 310000 },
      kalshi:     { yes: 0.54, no: 0.46, liquidity: 48000,  volume: 140000 },
    },
    clauses: {
      polymarket: 'Resolves YES if BTC/USD on Coinbase Pro is ≥$68,000 at the close of the next full UTC hour. UMA arbitration.',
      kalshi:     'Resolves YES if BTC/USD mark price on Kalshi feed is ≥$68,000 at the top of the next UTC hour. CFTC regulated.',
    },
    clauseFlags: [
      '⚠ Different price feeds (Coinbase vs Kalshi mark)',
      '✓ Same threshold ($68k)',
      '✓ Same resolution trigger (hourly UTC close)',
    ],
    identityScores: { titleMatch: 0.93, resolutionLogic: 0.85, resolveDate: 0.98, oracle: 0.60, currency: 1.00 },
  },
  // ── closes in ~2 h ────────────────────────────────────────────────────
  {
    id: 'm2',
    title: 'Will ETH/BTC ratio exceed 0.055 today?',
    category: 'Crypto',
    resolutionTs: () => resolutionTs(2.1),
    platforms: {
      polymarket: { yes: 0.38, no: 0.62, liquidity: 72000,  volume: 185000 },
      manifold:   { yes: 0.29, no: 0.71, liquidity:  3800,  volume:  11000 },
    },
    clauses: {
      polymarket: 'Resolves YES if ETH/BTC spot ratio on Coinbase Pro exceeds 0.055 at any point before 23:59 UTC today. UMA arbitration.',
      manifold:   'Resolves YES if ETH/BTC on CoinGecko exceeds 0.055 at any point today (UTC). Community resolution.',
    },
    clauseFlags: [
      '⚠ Different price feeds (Coinbase vs CoinGecko)',
      '⚠ Manifold is play-money — no real USD payout',
      '✓ Same threshold and direction',
    ],
    identityScores: { titleMatch: 0.94, resolutionLogic: 0.72, resolveDate: 0.95, oracle: 0.35, currency: 0.10 },
  },
  // ── closes in ~6 h ────────────────────────────────────────────────────
  {
    id: 'm3',
    title: 'Will US CPI print come in below 3.1% today?',
    category: 'Macro',
    resolutionTs: () => resolutionTs(5.8),
    platforms: {
      kalshi:     { yes: 0.44, no: 0.56, liquidity: 130000, volume: 390000 },
      polymarket: { yes: 0.37, no: 0.63, liquidity:  88000, volume: 260000 },
    },
    clauses: {
      kalshi:     'Resolves YES if BLS CPI-U YoY initial release today is below 3.1%. CFTC regulated event contract.',
      polymarket: 'Resolves YES if BLS headline CPI YoY (initial release) is <3.1% per official BLS release today. UMA arbitration.',
    },
    clauseFlags: [
      '✓ Both use BLS headline CPI-U',
      '✓ Same threshold (<3.1%)',
      '⚠ Resolution oracle differs (CFTC vs UMA)',
    ],
    identityScores: { titleMatch: 0.96, resolutionLogic: 0.92, resolveDate: 1.00, oracle: 0.70, currency: 1.00 },
  },
  // ── closes in ~12 h ───────────────────────────────────────────────────
  {
    id: 'm4',
    title: 'Will S&P 500 close green today?',
    category: 'Equities',
    resolutionTs: () => resolutionTs(11.5),
    platforms: {
      polymarket: { yes: 0.55, no: 0.45, liquidity: 210000, volume: 580000 },
      kalshi:     { yes: 0.49, no: 0.51, liquidity: 155000, volume: 420000 },
      predictit:  { yes: 0.57, no: 0.43, liquidity:  62000, volume: 170000 },
    },
    clauses: {
      polymarket: 'Resolves YES if S&P 500 closing price today is higher than yesterday\'s close per NYSE official close. UMA arbitration.',
      kalshi:     'Resolves YES if SPX official closing level today exceeds prior day close per S&P Dow Jones Indices. CFTC regulated.',
      predictit:  'Resolves YES if SPY ETF closing price is above prior close per Yahoo Finance EOD. $850 position cap.',
    },
    clauseFlags: [
      '⚠ Polymarket/Kalshi use SPX index; PredictIt uses SPY ETF',
      '⚠ PredictIt $850 position cap limits size',
      '✓ All resolve on same-day US market close',
    ],
    identityScores: { titleMatch: 0.91, resolutionLogic: 0.78, resolveDate: 1.00, oracle: 0.65, currency: 0.85 },
  },
  // ── closes in ~24 h ───────────────────────────────────────────────────
  {
    id: 'm5',
    title: 'Will Fed announce rate hold at tomorrow\'s meeting?',
    category: 'Macro',
    resolutionTs: () => resolutionTs(23.5),
    platforms: {
      polymarket: { yes: 0.82, no: 0.18, liquidity: 340000, volume: 920000 },
      kalshi:     { yes: 0.79, no: 0.21, liquidity: 195000, volume: 510000 },
    },
    clauses: {
      polymarket: 'Resolves YES if FOMC statement tomorrow announces no change to federal funds target rate. UMA arbitration.',
      kalshi:     'Resolves YES if FOMC holds the federal funds rate at current level per official FOMC press release. CFTC regulated.',
    },
    clauseFlags: [
      '✓ Identical event trigger (FOMC hold)',
      '✓ Same data source (official FOMC statement)',
      '⚠ Oracle differs (UMA vs CFTC)',
    ],
    identityScores: { titleMatch: 0.97, resolutionLogic: 0.95, resolveDate: 1.00, oracle: 0.72, currency: 1.00 },
  },
  // ── closes in ~72 h ───────────────────────────────────────────────────
  {
    id: 'm6',
    title: 'Will BTC reach $75k before end of week?',
    category: 'Crypto',
    resolutionTs: () => resolutionTs(71),
    platforms: {
      polymarket: { yes: 0.23, no: 0.77, liquidity: 280000, volume: 740000 },
      kalshi:     { yes: 0.19, no: 0.81, liquidity: 110000, volume: 295000 },
    },
    clauses: {
      polymarket: 'Resolves YES if BTC/USD touches or exceeds $75,000 on Coinbase Pro at any point before Sunday 23:59 UTC. UMA arbitration.',
      kalshi:     'Resolves YES if BTC/USD mark price on Kalshi reaches $75,000 at any point before end of week (Sunday 23:59 UTC). CFTC regulated.',
    },
    clauseFlags: [
      '⚠ Different feeds (Coinbase spot vs Kalshi mark)',
      '✓ Same target price ($75k)',
      '✓ Same resolution window (end of week)',
    ],
    identityScores: { titleMatch: 0.95, resolutionLogic: 0.87, resolveDate: 0.97, oracle: 0.58, currency: 1.00 },
  },
];
