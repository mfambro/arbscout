/**
 * app.js — Application state, agent orchestration, and event wiring.
 *
 * Paper-trading mode: all trades are simulated, no real API calls.
 * To go live:
 *   1. Implement src/api/{platform}.js with fetchMarkets() / placeBet()
 *   2. Replace SEED_MARKETS in runScan() with real API calls
 *   3. Replace doExecuteTrade() stub with real order placement
 */

/* ── App state ── */
const STATE = {
  opps:         [],
  selectedId:   null,
  positions:    [],
  pnl:          0,
  tradesCount:  0,
  scannedCount: 0,
  scanning:     false,
  pendingTrade: null,
};

/* ── Agents ── */

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * ScanAgent — simulates fetching markets from all platforms.
 * Replace the body of this function with real API calls when going live.
 */
async function ScanAgent() {
  UI.addLog('ScanAgent → fetching Polymarket, Kalshi, Manifold, Metaculus, PredictIt', 'info');
  await sleep(550);

  UI.addLog('ClauseAgent → parsing resolution conditions for ' + SEED_MARKETS.length + ' matched markets', 'info');
  await sleep(480);

  UI.addLog('IdentityAgent → comparing resolution logic, oracles, payouts across platforms', 'info');
  await sleep(420);

  UI.addLog('SpreadAgent → computing net spreads after platform fees', 'info');
  await sleep(420);

  return {
    markets: SEED_MARKETS,
    scanned: 847,
    platforms: '5 platforms',
  };
}

/* ── runScan ── */
async function runScan() {
  if (STATE.scanning) return;
  STATE.scanning = true;
  UI.setScanBusy(true);

  document.getElementById('oppsList').innerHTML = `
    <div class="empty-state">
      <div class="spinner" style="width:16px;height:16px;margin:0 auto 10px"></div>
      Agents scanning Polymarket, Kalshi, Manifold…
    </div>`;

  const result = await ScanAgent();

  STATE.opps = result.markets;
  STATE.scannedCount = result.scanned;
  document.getElementById('scannedPlatforms').textContent = result.platforms;

  UI.addLog(`Found ${STATE.opps.length} opportunities from ${STATE.scannedCount} markets scanned`, 'success');

  STATE.opps.forEach(o => {
    const sp = Engine.calcSpread(o);
    const id = Engine.calcIdentity(o);
    if (sp.maxProfit > 0) {
      UI.addLog(
        `${o.title.substring(0, 42)}… — spread +${(sp.maxProfit * 100).toFixed(2)}¢, identity ${Math.round(id * 100)}%`,
        'success'
      );
    } else {
      UI.addLog(`${o.title.substring(0, 42)}… — no positive spread found`, 'warn');
    }
  });

  UI.renderOpps(STATE, selectOpp);
  UI.updateMetrics(STATE);

  STATE.scanning = false;
  UI.setScanBusy(false);
}

/* ── selectOpp ── */
function selectOpp(id) {
  STATE.selectedId = id;

  // re-highlight rows
  document.querySelectorAll('.opp-row').forEach(r => r.classList.remove('selected'));
  const row = document.getElementById('opp-' + id);
  if (row) row.classList.add('selected');

  const opp = STATE.opps.find(o => o.id === id);
  UI.renderDetail(opp, STATE);

  // reset execute button
  const btn = document.getElementById('executeBtn');
  btn.textContent = 'Paper trade';
  btn.disabled = false;
}

/* ── analyseDeep — sends prompt to Claude for deep risk analysis ── */
function analyseDeep() {
  const opp = STATE.opps.find(o => o.id === STATE.selectedId);
  if (!opp) return;
  const sp = Engine.calcSpread(opp);
  const id = Engine.calcIdentity(opp);
  const prompt =
    `I'm analysing a prediction market arbitrage opportunity: "${opp.title}". ` +
    `Spread: +${(sp.maxProfit * 100).toFixed(2)}¢/$1 (buy on ${PLATFORMS[sp.buyPlat]?.name}, sell on ${PLATFORMS[sp.sellPlat]?.name}). ` +
    `Identity score: ${Math.round(id * 100)}%. ` +
    `Clause flags: ${opp.clauseFlags?.join('; ') ?? 'none'}. ` +
    `Please give a detailed risk assessment, identify any hidden risks in the clauses, and recommend whether to execute.`;

  // In browser: open Claude.ai with pre-filled prompt
  if (typeof window !== 'undefined' && !window.sendPrompt) {
    const url = 'https://claude.ai/new?q=' + encodeURIComponent(prompt);
    window.open(url, '_blank');
  } else if (window.sendPrompt) {
    window.sendPrompt(prompt);
  }
}

/* ── executeTrade ── */
function executeTrade() {
  const opp = STATE.opps.find(o => o.id === STATE.selectedId);
  if (!opp) return;

  const id = Engine.calcIdentity(opp);

  if (id < 0.60) {
    STATE.pendingTrade = opp;
    UI.showModal(
      '⚠ Low identity score',
      `Identity score is only ${Math.round(id * 100)}%. The resolution conditions on these platforms ` +
      `may differ significantly — this is NOT a clean arbitrage. Are you sure you want to paper trade this?`
    );
    return;
  }

  doExecuteTrade(opp);
}

function confirmTrade() {
  UI.closeModal();
  if (STATE.pendingTrade) {
    doExecuteTrade(STATE.pendingTrade);
    STATE.pendingTrade = null;
  }
}

function doExecuteTrade(opp) {
  const sp    = Engine.calcSpread(opp);
  const id    = Engine.calcIdentity(opp);
  const stake = 100;
  const expectedPnl = +(sp.maxProfit * stake).toFixed(2);

  const position = {
    id:          'pos-' + Date.now(),
    market:      opp.title,
    buyPlat:     PLATFORMS[sp.buyPlat]?.name  ?? sp.buyPlat,
    sellPlat:    PLATFORMS[sp.sellPlat]?.name ?? sp.sellPlat,
    side:        sp.side,
    buyPrice:    sp.buyPrice,
    sellPrice:   sp.sellPrice,
    stake,
    expectedPnl,
    identity:    id,
    status:      'open',
    openedAt:    new Date().toLocaleTimeString(),
  };

  STATE.positions.push(position);
  STATE.pnl         += expectedPnl;
  STATE.tradesCount += 1;

  UI.addLog(
    `PAPER TRADE: Buy ${sp.side} on ${position.buyPlat}, ` +
    `sell on ${position.sellPlat} — exp. +$${expectedPnl.toFixed(2)}`,
    'success'
  );

  UI.updateMetrics(STATE);
  UI.renderPositions(STATE);

  const btn = document.getElementById('executeBtn');
  btn.textContent = '✓ Placed';
  btn.disabled = true;
  setTimeout(() => {
    btn.textContent = 'Paper trade';
    btn.disabled = false;
  }, 2500);
}

/* ── Live price simulation (paper mode) ── */
setInterval(() => {
  if (!STATE.opps.length) return;
  STATE.opps.forEach(Engine.simulatePriceJitter);
  UI.renderOpps(STATE, selectOpp);
  if (STATE.selectedId) {
    const opp = STATE.opps.find(o => o.id === STATE.selectedId);
    if (opp) UI.renderDetail(opp, STATE);
  }
  UI.addLog('PriceAgent → prices updated (' + STATE.opps.length + ' markets)', 'info');
}, 8000);

/* ── Expose globals for inline onclick handlers ── */
window.runScan      = runScan;
window.analyseDeep  = analyseDeep;
window.executeTrade = executeTrade;
window.confirmTrade = confirmTrade;
