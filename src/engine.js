/**
 * engine.js — Core arbitrage calculation engine.
 * Pure functions only — no DOM access.
 */

window.Engine = (() => {

  /**
   * TIME WINDOW LABELS — used in the filter dropdown.
   * value = max hours until resolution (Infinity = no filter)
   */
  const TIME_WINDOWS = [
    { label: 'All open',   hours: Infinity },
    { label: '< 1 hour',   hours: 1        },
    { label: '< 6 hours',  hours: 6        },
    { label: '< 24 hours', hours: 24       },
    { label: '< 3 days',   hours: 72       },
  ];

  /**
   * hoursUntilResolution — returns hours (float) until a market resolves.
   * Accepts either an ISO string or a resolutionTs() function.
   */
  function hoursUntilResolution(opp) {
    const ts = typeof opp.resolutionTs === 'function'
      ? new Date(opp.resolutionTs())
      : new Date(opp.resolution);
    return (ts - Date.now()) / 3600000;
  }

  /**
   * isOpenMarket — true if market resolves in the future.
   */
  function isOpenMarket(opp) {
    return hoursUntilResolution(opp) > 0;
  }

  /**
   * filterByWindow — returns only markets that close within `hours`.
   */
  function filterByWindow(opps, hours) {
    return opps.filter(o => {
      const h = hoursUntilResolution(o);
      return h > 0 && h <= hours;
    });
  }

  /**
   * calcSpread — best directional spread across all platform pairs.
   */
  function calcSpread(opp) {
    const platforms = Object.keys(opp.platforms);
    let result = { maxProfit: 0, buyPlat: null, sellPlat: null, buyPrice: 0, sellPrice: 0, side: 'YES' };

    for (let i = 0; i < platforms.length; i++) {
      for (let j = 0; j < platforms.length; j++) {
        if (i === j) continue;
        const pA = platforms[i], pB = platforms[j];
        const a = opp.platforms[pA], b = opp.platforms[pB];
        if (!a || !b || !a.liquidity || !b.liquidity) continue;

        const feeA = PLATFORMS[pA]?.fee ?? 0;
        const feeB = PLATFORMS[pB]?.fee ?? 0;

        const profitYes = (b.yes - a.yes) - (a.yes * feeA) - (b.yes * feeB);
        if (profitYes > result.maxProfit) {
          result = { maxProfit: profitYes, buyPlat: pA, sellPlat: pB, buyPrice: a.yes, sellPrice: b.yes, side: 'YES' };
        }
        const profitNo = (b.no - a.no) - (a.no * feeA) - (b.no * feeB);
        if (profitNo > result.maxProfit) {
          result = { maxProfit: profitNo, buyPlat: pA, sellPlat: pB, buyPrice: a.no, sellPrice: b.no, side: 'NO' };
        }
      }
    }
    return result;
  }

  /**
   * calcIdentity — weighted identity score.
   */
  function calcIdentity(opp) {
    const s = opp.identityScores;
    const weights = { titleMatch: 0.10, resolutionLogic: 0.40, resolveDate: 0.20, oracle: 0.20, currency: 0.10 };
    let total = 0;
    for (const k of Object.keys(weights)) total += (s[k] ?? 0) * weights[k];
    return Math.min(1, Math.max(0, total));
  }

  function riskTier(spread, identity) {
    const score = spread * identity;
    if (score > 0.02 && identity > 0.80) return { label: 'HIGH', cls: 'tag-high', color: '#22c55e' };
    if (score > 0.008 && identity > 0.60) return { label: 'MED',  cls: 'tag-med',  color: '#f59e0b' };
    return                                        { label: 'LOW',  cls: 'tag-low',  color: '#555'    };
  }

  function barColor(v) {
    if (v >= 0.85) return '#22c55e';
    if (v >= 0.65) return '#f59e0b';
    return '#ef4444';
  }

  function hasRealLiquidity(opp) {
    return Object.values(opp.platforms).some(p => p && p.liquidity > 0);
  }

  function simulatePriceJitter(opp) {
    Object.keys(opp.platforms).forEach(p => {
      const d = opp.platforms[p];
      if (!d || !d.liquidity) return;
      d.yes = Math.max(0.01, Math.min(0.99, d.yes + (Math.random() - 0.5) * 0.018));
      d.no  = +(1 - d.yes).toFixed(4);
    });
  }

  /**
   * formatCountdown — "45m", "2h 10m", "3d 4h"
   */
  function formatCountdown(opp) {
    const h = hoursUntilResolution(opp);
    if (h < 0) return 'Closed';
    if (h < 1) return Math.round(h * 60) + 'm';
    if (h < 24) {
      const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
      return mm > 0 ? `${hh}h ${mm}m` : `${hh}h`;
    }
    const d = Math.floor(h / 24), rem = Math.floor(h % 24);
    return rem > 0 ? `${d}d ${rem}h` : `${d}d`;
  }

  /**
   * simulateClose — randomly resolves a position for the dashboard.
   * In live mode this would be replaced by actual resolution polling.
   */
  function simulateClose(position) {
    const identity = position.identity;
    // Higher identity = more likely actual arb profit is realised
    const winChance = 0.5 + (identity - 0.5) * 0.6;
    const won = Math.random() < winChance;
    // Actual P&L: expected ± some slippage noise
    const slippage = (Math.random() * 0.4 - 0.1) * position.expectedPnl;
    const actualPnl = won
      ? +(position.expectedPnl * (0.85 + Math.random() * 0.3) + slippage).toFixed(2)
      : +(-position.stake * (0.05 + Math.random() * 0.15)).toFixed(2);
    return { ...position, status: 'closed', actualPnl, closedAt: new Date().toLocaleTimeString() };
  }

  return {
    TIME_WINDOWS, hoursUntilResolution, isOpenMarket, filterByWindow,
    calcSpread, calcIdentity, riskTier, barColor,
    hasRealLiquidity, simulatePriceJitter, formatCountdown, simulateClose,
  };
})();
