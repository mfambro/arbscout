/**
 * app.js — Application state, agent orchestration, event wiring.
 */

const STATE = {
  opps:         [],       // all loaded markets (future-only)
  filteredOpps: null,     // null = show all; array = filtered by time window
  selectedId:   null,
  positions:    [],       // open + closed
  scannedCount: 0,
  scanning:     false,
  pendingTrade: null,
  timeWindowIdx: 0,       // index into Engine.TIME_WINDOWS
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ── ScanAgent ── */
async function ScanAgent() {
  UI.addLog('ScanAgent → fetching Polymarket, Kalshi, Manifold, Metaculus, PredictIt', 'info');
  await sleep(550);
  UI.addLog('ClauseAgent → parsing resolution conditions', 'info');
  await sleep(430);
  UI.addLog('IdentityAgent → comparing resolution logic, oracles, payouts', 'info');
  await sleep(380);
  UI.addLog('SpreadAgent → computing net spreads after fees', 'info');
  await sleep(380);

  // Filter to only open (future) markets before returning
  const open = SEED_MARKETS.filter(Engine.isOpenMarket);
  return { markets: open, scanned: 847, platforms: '5 platforms' };
}

/* ── applyTimeWindow ── */
function applyTimeWindow(idxStr) {
  STATE.timeWindowIdx = parseInt(idxStr, 10);
  const hours = Engine.TIME_WINDOWS[STATE.timeWindowIdx].hours;
  STATE.filteredOpps = isFinite(hours)
    ? Engine.filterByWindow(STATE.opps, hours)
    : null;
  UI.renderOpps(STATE, selectOpp);
  UI.updateMetrics(STATE);
}

/* ── runScan ── */
async function runScan() {
  if (STATE.scanning) return;
  STATE.scanning = true;
  UI.setScanBusy(true);

  document.getElementById('oppsList').innerHTML = `
    <div class="empty-state">
      <div class="spinner" style="width:16px;height:16px;margin:0 auto 10px"></div>
      Agents scanning markets…
    </div>`;

  const result = await ScanAgent();
  STATE.opps = result.markets;
  STATE.scannedCount = result.scanned;
  document.getElementById('scannedPlatforms').textContent = result.platforms;

  // Re-apply window filter
  const hours = Engine.TIME_WINDOWS[STATE.timeWindowIdx].hours;
  STATE.filteredOpps = isFinite(hours) ? Engine.filterByWindow(STATE.opps, hours) : null;

  const visible = STATE.filteredOpps ?? STATE.opps;
  UI.addLog(`Found ${STATE.opps.length} open markets (${visible.length} in window)`, 'success');

  STATE.opps.forEach(o => {
    const sp = Engine.calcSpread(o);
    const id = Engine.calcIdentity(o);
    if (sp.maxProfit > 0) {
      UI.addLog(
        `${o.title.substring(0,42)}… — +${(sp.maxProfit*100).toFixed(2)}¢ spread, identity ${Math.round(id*100)}%, closes ${Engine.formatCountdown(o)}`,
        'success'
      );
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
  document.querySelectorAll('.opp-row').forEach(r => r.classList.remove('selected'));
  const row = document.getElementById('opp-' + id);
  if (row) row.classList.add('selected');
  const opp = STATE.opps.find(o => o.id === id);
  UI.renderDetail(opp, STATE);
  const btn = document.getElementById('executeBtn');
  if (btn) { btn.textContent = 'Paper trade'; btn.disabled = false; }
}

/* ── analyseDeep ── */
function analyseDeep() {
  const opp = STATE.opps.find(o => o.id === STATE.selectedId);
  if (!opp) return;
  const sp = Engine.calcSpread(opp);
  const id = Engine.calcIdentity(opp);
  const prompt =
    `I'm analysing a prediction market arbitrage opportunity: "${opp.title}". ` +
    `Closes in ${Engine.formatCountdown(opp)}. ` +
    `Spread: +${(sp.maxProfit*100).toFixed(2)}¢/$1 ` +
    `(buy on ${PLATFORMS[sp.buyPlat]?.name}, sell on ${PLATFORMS[sp.sellPlat]?.name}). ` +
    `Identity: ${Math.round(id*100)}%. ` +
    `Clause flags: ${opp.clauseFlags?.join('; ') ?? 'none'}. ` +
    `Give a detailed risk assessment and recommend whether to execute.`;

  if (window.sendPrompt) {
    window.sendPrompt(prompt);
  } else {
    window.open('https://claude.ai/new?q=' + encodeURIComponent(prompt), '_blank');
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
      `Identity is only ${Math.round(id*100)}%. Resolution conditions may differ significantly — this is not a clean arbitrage. Proceed with paper trade?`
    );
    return;
  }
  doExecuteTrade(opp);
}

function confirmTrade() {
  UI.closeModal();
  if (STATE.pendingTrade) { doExecuteTrade(STATE.pendingTrade); STATE.pendingTrade = null; }
}

function doExecuteTrade(opp) {
  const sp    = Engine.calcSpread(opp);
  const id    = Engine.calcIdentity(opp);
  const stake = 100;

  STATE.positions.push({
    id:          'pos-' + Date.now(),
    market:      opp.title,
    buyPlat:     PLATFORMS[sp.buyPlat]?.name  ?? sp.buyPlat,
    sellPlat:    PLATFORMS[sp.sellPlat]?.name ?? sp.sellPlat,
    side:        sp.side,
    buyPrice:    sp.buyPrice,
    sellPrice:   sp.sellPrice,
    stake,
    expectedPnl: +(sp.maxProfit * stake).toFixed(2),
    identity:    id,
    status:      'open',
    openedAt:    new Date().toLocaleTimeString(),
  });

  UI.addLog(
    `PAPER TRADE: ${sp.side} — buy ${PLATFORMS[sp.buyPlat]?.name}, sell ${PLATFORMS[sp.sellPlat]?.name} · exp +$${(sp.maxProfit*stake).toFixed(2)}`,
    'success'
  );

  UI.updateMetrics(STATE);
  UI.renderPositions(STATE);

  const btn = document.getElementById('executeBtn');
  if (btn) { btn.textContent = '✓ Placed'; btn.disabled = true; }
  setTimeout(() => { if (btn) { btn.textContent = 'Paper trade'; btn.disabled = false; } }, 2500);
}

/* ── Close positions (simulate resolution) ── */
function simulateCloseOne(posId) {
  const idx = STATE.positions.findIndex(p => p.id === posId);
  if (idx === -1) return;
  STATE.positions[idx] = Engine.simulateClose(STATE.positions[idx]);
  const p = STATE.positions[idx];
  UI.addLog(
    `CLOSED: ${p.market.substring(0,40)}… → actual P&L ${p.actualPnl >= 0 ? '+' : ''}$${p.actualPnl.toFixed(2)}`,
    p.actualPnl >= 0 ? 'success' : 'warn'
  );
  UI.updateMetrics(STATE);
  UI.renderPositions(STATE);
  UI.renderDashboard(STATE);
}

function simulateCloseAll() {
  STATE.positions
    .filter(p => p.status === 'open')
    .forEach(p => {
      const idx = STATE.positions.indexOf(p);
      STATE.positions[idx] = Engine.simulateClose(p);
    });
  UI.addLog('Closed all open positions (simulated resolution)', 'warn');
  UI.updateMetrics(STATE);
  UI.renderPositions(STATE);
  UI.renderDashboard(STATE);
}

/* ── Live price simulation ── */
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

/* ── Countdown refresh every 30 s ── */
setInterval(() => {
  if (!STATE.opps.length) return;
  // Re-filter in case any market just expired
  const hours = Engine.TIME_WINDOWS[STATE.timeWindowIdx].hours;
  STATE.filteredOpps = isFinite(hours) ? Engine.filterByWindow(STATE.opps, hours) : null;
  UI.renderOpps(STATE, selectOpp);
  UI.updateMetrics(STATE);
}, 30000);

/* ── Init ── */
(function init() {
  UI.buildTimeWindowSelect();
})();

/* ── Globals ── */
window.runScan           = runScan;
window.applyTimeWindow   = applyTimeWindow;
window.analyseDeep       = analyseDeep;
window.executeTrade      = executeTrade;
window.confirmTrade      = confirmTrade;
window.simulateCloseOne  = simulateCloseOne;
window.simulateCloseAll  = simulateCloseAll;
