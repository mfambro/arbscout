/**
 * engine.js — Core arbitrage calculation engine.
 *
 * All pure functions. No DOM access.
 * Export-friendly: each function is assigned to window.Engine
 * so it can be imported in a Node/Claude Code environment later.
 */

window.Engine = (() => {

  /**
   * calcSpread — find the best directional spread across all platform pairs.
   * Returns: { maxProfit, buyPlat, sellPlat, buyPrice, sellPrice, side }
   * maxProfit is cents-per-dollar (0.05 = 5c profit per $1 stake).
   */
  function calcSpread(opp) {
    const platforms = Object.keys(opp.platforms);
    let maxProfit = 0;
    let result = { maxProfit: 0, buyPlat: null, sellPlat: null, buyPrice: 0, sellPrice: 0, side: 'YES' };

    for (let i = 0; i < platforms.length; i++) {
      for (let j = 0; j < platforms.length; j++) {
        if (i === j) continue;
        const pA = platforms[i];
        const pB = platforms[j];
        const a = opp.platforms[pA];
        const b = opp.platforms[pB];
        if (!a || !b || !a.liquidity || !b.liquidity) continue;

        const feeA = (PLATFORMS[pA]?.fee ?? 0);
        const feeB = (PLATFORMS[pB]?.fee ?? 0);

        // YES leg: buy YES cheap on A, effectively short YES expensive on B
        const profitYes = (b.yes - a.yes) - (a.yes * feeA) - (b.yes * feeB);
        if (profitYes > maxProfit) {
          maxProfit = profitYes;
          result = { maxProfit: profitYes, buyPlat: pA, sellPlat: pB, buyPrice: a.yes, sellPrice: b.yes, side: 'YES' };
        }

        // NO leg
        const profitNo = (b.no - a.no) - (a.no * feeA) - (b.no * feeB);
        if (profitNo > maxProfit) {
          maxProfit = profitNo;
          result = { maxProfit: profitNo, buyPlat: pA, sellPlat: pB, buyPrice: a.no, sellPrice: b.no, side: 'NO' };
        }
      }
    }
    return result;
  }

  /**
   * calcIdentity — weighted identity score from sub-scores.
   * Weights reflect how much each dimension affects real-world identicalness.
   */
  function calcIdentity(opp) {
    const s = opp.identityScores;
    const weights = {
      titleMatch:      0.10,
      resolutionLogic: 0.40,  // most critical — same event trigger?
      resolveDate:     0.20,
      oracle:          0.20,  // same data source?
      currency:        0.10,
    };
    let total = 0;
    for (const k of Object.keys(weights)) {
      total += (s[k] ?? 0) * weights[k];
    }
    return Math.min(1, Math.max(0, total));
  }

  /**
   * riskTier — composite risk/reward tier.
   */
  function riskTier(spread, identity) {
    const score = spread * identity;
    if (score > 0.02 && identity > 0.80) return { label: 'HIGH',   cls: 'tag-high', color: '#22c55e' };
    if (score > 0.008 && identity > 0.60) return { label: 'MED',   cls: 'tag-med',  color: '#f59e0b' };
    return                                       { label: 'LOW',   cls: 'tag-low',  color: '#555' };
  }

  /**
   * barColor — traffic-light colour for an identity sub-score.
   */
  function barColor(v) {
    if (v >= 0.85) return '#22c55e';
    if (v >= 0.65) return '#f59e0b';
    return '#ef4444';
  }

  /**
   * hasRealLiquidity — checks at least one platform has real USD liquidity.
   */
  function hasRealLiquidity(opp) {
    return Object.values(opp.platforms).some(p => p && p.liquidity > 0);
  }

  /**
   * simulatePriceJitter — random walk for paper-trading price simulation.
   * Mutates opp.platforms in place.
   */
  function simulatePriceJitter(opp) {
    Object.keys(opp.platforms).forEach(p => {
      const d = opp.platforms[p];
      if (!d || !d.liquidity) return;
      const drift = (Math.random() - 0.5) * 0.018;
      d.yes = Math.max(0.01, Math.min(0.99, d.yes + drift));
      d.no  = +(1 - d.yes).toFixed(4);
    });
  }

  return { calcSpread, calcIdentity, riskTier, barColor, hasRealLiquidity, simulatePriceJitter };
})();
