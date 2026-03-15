/**
 * ui.js — All DOM rendering. Depends on engine.js and markets.js globals.
 */

window.UI = (() => {

  /* ── Helpers ── */
  function qs(id) { return document.getElementById(id); }

  function formatPnl(v) {
    return (v >= 0 ? '+$' : '-$') + Math.abs(v).toFixed(2);
  }

  /* ── Log ── */
  function addLog(msg, type = 'info') {
    const t = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    // mini log
    const el = document.createElement('div');
    el.className = 'log-entry';
    el.innerHTML = `<span class="log-time">${t}</span><span class="log-${type}">${msg}</span>`;
    const list = qs('logList');
    list.insertBefore(el, list.firstChild);

    // full log tab
    const full = qs('fullLog');
    if (full.textContent.trim() === 'No agent activity yet.') full.innerHTML = '';
    const fe = el.cloneNode(true);
    full.insertBefore(fe, full.firstChild);
  }

  /* ── Metrics ── */
  function updateMetrics(state) {
    qs('pnl').textContent       = formatPnl(state.pnl);
    qs('pnl').className         = 'metric-value ' + (state.pnl >= 0 ? 'up' : 'down');
    qs('pnlChange').textContent = state.tradesCount + ' trade' + (state.tradesCount !== 1 ? 's' : '');
    qs('openPos').textContent   = state.positions.filter(p => p.status === 'open').length;
    qs('scanned').textContent   = state.scannedCount;
    qs('oppCount').textContent  = state.opps.length;

    const ids = state.opps.map(o => Engine.calcIdentity(o));
    const avg = ids.length ? ids.reduce((a, b) => a + b, 0) / ids.length : 0;
    qs('avgId').textContent = ids.length ? Math.round(avg * 100) + '%' : '—';
  }

  /* ── Opportunity row ── */
  function buildOppRow(opp, selectedId, onSelect) {
    const sp   = Engine.calcSpread(opp);
    const id   = Engine.calcIdentity(opp);
    const tier = Engine.riskTier(sp.maxProfit, id);
    const platNames = Object.keys(opp.platforms).map(k => PLATFORMS[k]?.name).filter(Boolean);
    const profitPer100 = (sp.maxProfit * 100).toFixed(2);
    const hasLiq = Engine.hasRealLiquidity(opp);

    const div = document.createElement('div');
    div.className = 'opp-row' + (opp.id === selectedId ? ' selected' : '');
    div.id = 'opp-' + opp.id;
    div.onclick = () => onSelect(opp.id);

    div.innerHTML = `
      <div>
        <div class="opp-title">${opp.title}</div>
        <div class="opp-meta">
          <span class="opp-tag tag-low">${opp.category}</span>
          ${sp.maxProfit > 0 && hasLiq ? `<span class="opp-tag ${tier.cls}">${tier.label} EDGE</span>` : ''}
          ${!hasLiq ? '<span class="opp-tag tag-risk">NO LIQUIDITY</span>' : ''}
          <div class="platform-pills">
            ${platNames.map(n => `<span class="platform-pill">${n}</span>`).join('')}
          </div>
        </div>
      </div>
      <div class="opp-right">
        <div class="profit-est">${sp.maxProfit > 0 && hasLiq ? '+$' + profitPer100 : '—'}</div>
        <div class="profit-label">per $100</div>
        <div class="identity-score">identity ${Math.round(id * 100)}%</div>
      </div>
    `;
    return div;
  }

  /* ── Opportunity list ── */
  function renderOpps(state, onSelect) {
    const list = qs('oppsList');
    list.innerHTML = '';

    const sorted = [...state.opps].sort((a, b) => {
      const sa = Engine.calcSpread(a).maxProfit * Engine.calcIdentity(a);
      const sb = Engine.calcSpread(b).maxProfit * Engine.calcIdentity(b);
      return sb - sa;
    });

    sorted.forEach(o => list.appendChild(buildOppRow(o, state.selectedId, onSelect)));
  }

  /* ── Detail pane ── */
  function renderDetail(opp, state) {
    if (!opp) {
      qs('detailPane').innerHTML = '<div class="detail-empty">Select an opportunity<br>to analyse clauses,<br>risk, and identity score.</div>';
      qs('actionRow').style.display = 'none';
      return;
    }

    qs('detailTitle').textContent = opp.category + ' · ' + opp.title.substring(0, 32) + '…';
    qs('actionRow').style.display = 'flex';

    const sp   = Engine.calcSpread(opp);
    const id   = Engine.calcIdentity(opp);
    const tier = Engine.riskTier(sp.maxProfit, id);
    const platforms = Object.keys(opp.platforms);

    let html = '';

    /* Price comparison */
    html += `<div class="detail-section">
      <div class="detail-section-header">Price comparison</div>
      <div class="detail-section-body">
        <table class="compare-table">
          <tr><th>Platform</th><th>YES</th><th>NO</th><th>Liquidity</th><th>Fee</th></tr>
          ${platforms.map(p => {
            const d = opp.platforms[p];
            if (!d) return '';
            const isBuy  = p === sp.buyPlat  && sp.maxProfit > 0;
            const isSell = p === sp.sellPlat && sp.maxProfit > 0;
            return `<tr>
              <td>${PLATFORMS[p]?.name}</td>
              <td class="${isBuy ? 'better' : isSell ? 'worse' : ''}">${(d.yes * 100).toFixed(1)}¢</td>
              <td>${(d.no  * 100).toFixed(1)}¢</td>
              <td>${d.liquidity ? '$' + Math.round(d.liquidity / 1000) + 'k' : '—'}</td>
              <td>${((PLATFORMS[p]?.fee ?? 0) * 100).toFixed(0)}%</td>
            </tr>`;
          }).join('')}
        </table>
        ${sp.maxProfit > 0
          ? `<div class="spread-alert">
              Buy <strong>${sp.side}</strong> on <strong>${PLATFORMS[sp.buyPlat]?.name}</strong>
              @ ${(sp.buyPrice * 100).toFixed(1)}¢ →
              Sell on <strong>${PLATFORMS[sp.sellPlat]?.name}</strong>
              @ ${(sp.sellPrice * 100).toFixed(1)}¢.
              Net edge: <strong>+${(sp.maxProfit * 100).toFixed(2)}¢ per $1</strong> after fees.
             </div>`
          : '<div class="spread-none">No positive spread detected on this market.</div>'
        }
      </div>
    </div>`;

    /* Identity analysis */
    const scoreEntries = [
      ['Title match',       opp.identityScores.titleMatch],
      ['Resolution logic',  opp.identityScores.resolutionLogic],
      ['Resolution date',   opp.identityScores.resolveDate],
      ['Oracle / data src', opp.identityScores.oracle],
      ['Currency / payout', opp.identityScores.currency],
    ];
    html += `<div class="detail-section">
      <div class="detail-section-header">Identity analysis — overall ${Math.round(id * 100)}%</div>
      <div class="detail-section-body">
        <div class="identity-bars">
          ${scoreEntries.map(([label, val]) => `
            <div class="id-bar-row">
              <span class="id-bar-label">${label}</span>
              <div class="id-bar-track">
                <div class="id-bar-fill" style="width:${val * 100}%; background:${Engine.barColor(val)}"></div>
              </div>
              <span class="id-bar-val">${Math.round(val * 100)}%</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>`;

    /* Clause comparison */
    html += `<div class="detail-section">
      <div class="detail-section-header">Clause analysis</div>
      <div class="detail-section-body" style="display:flex;flex-direction:column;gap:9px">
        ${platforms.filter(p => opp.clauses?.[p]).map(p => `
          <div>
            <div style="font-size:11px;font-weight:600;margin-bottom:3px;color:#aaa">${PLATFORMS[p]?.name}</div>
            <div class="clause-box">${opp.clauses[p]}</div>
          </div>
        `).join('')}
        ${opp.clauseFlags?.length ? `
          <div class="clause-flags">
            ${opp.clauseFlags.map(f => {
              const ok = f.startsWith('✓');
              return `<div class="clause-flag-row ${ok ? 'flag-ok' : 'flag-warn'}">${f}</div>`;
            }).join('')}
          </div>
        ` : ''}
      </div>
    </div>`;

    /* Risk summary */
    const maxLiq = Math.max(...Object.values(opp.platforms).map(p => p?.liquidity ?? 0));
    const daysToRes = Math.max(0, Math.round((new Date(opp.resolution) - Date.now()) / 86400000));
    html += `<div class="detail-section">
      <div class="detail-section-header">Risk factors</div>
      <div class="detail-section-body">
        <div class="risk-grid">
          <div class="risk-item">
            <div class="risk-item-label">Spread edge</div>
            <div class="risk-item-val" style="color:${sp.maxProfit > 0.02 ? '#22c55e' : sp.maxProfit > 0 ? '#f59e0b' : '#ef4444'}">
              ${sp.maxProfit > 0 ? '+' + (sp.maxProfit * 100).toFixed(2) + '¢' : 'None'}
            </div>
          </div>
          <div class="risk-item">
            <div class="risk-item-label">Identity score</div>
            <div class="risk-item-val" style="color:${Engine.barColor(id)}">${Math.round(id * 100)}%</div>
          </div>
          <div class="risk-item">
            <div class="risk-item-label">Max liquidity</div>
            <div class="risk-item-val">${maxLiq ? '$' + Math.round(maxLiq / 1000) + 'k' : 'N/A'}</div>
          </div>
          <div class="risk-item">
            <div class="risk-item-label">Days to resolve</div>
            <div class="risk-item-val">${daysToRes > 0 ? daysToRes + 'd' : 'Past'}</div>
          </div>
          <div class="risk-item">
            <div class="risk-item-label">Exec risk</div>
            <div class="risk-item-val" style="color:${id < 0.7 ? '#ef4444' : sp.maxProfit < 0.01 ? '#f59e0b' : '#22c55e'}">
              ${id < 0.7 ? 'HIGH' : sp.maxProfit < 0.01 ? 'MED' : 'LOW'}
            </div>
          </div>
          <div class="risk-item">
            <div class="risk-item-label">Priority</div>
            <div class="risk-item-val" style="color:${tier.color}">${tier.label}</div>
          </div>
        </div>
      </div>
    </div>`;

    qs('detailPane').innerHTML = `<div class="detail-content">${html}</div>`;
  }

  /* ── Positions table ── */
  function renderPositions(state) {
    const el = qs('positionsContent');
    qs('posCount').textContent = state.positions.length + ' open';

    if (!state.positions.length) {
      el.innerHTML = '<div class="empty-state">No paper trades placed yet.</div>';
      return;
    }

    el.innerHTML = `<table class="positions-table">
      <tr>
        <th>Market</th><th>Buy on</th><th>Sell on</th><th>Side</th>
        <th>Stake</th><th>Exp. P&amp;L</th><th>Identity</th><th>Opened</th>
      </tr>
      ${state.positions.map(p => `
        <tr>
          <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${p.market}">${p.market}</td>
          <td>${p.buyPlat}</td>
          <td>${p.sellPlat}</td>
          <td>${p.side}</td>
          <td>$${p.stake}</td>
          <td class="up">+$${p.expectedPnl.toFixed(2)}</td>
          <td style="color:${Engine.barColor(p.identity)}">${Math.round(p.identity * 100)}%</td>
          <td>${p.openedAt}</td>
        </tr>
      `).join('')}
    </table>`;
  }

  /* ── Tab switching ── */
  function showTab(name) {
    const tabs = ['Opps', 'Positions', 'Log'];
    tabs.forEach(t => {
      const el = qs('tab' + t);
      if (el) el.style.display = t.toLowerCase() === name ? '' : 'none';
    });
    document.querySelectorAll('.nav-btn').forEach((b, i) => {
      b.classList.toggle('active', ['opps', 'positions', 'log'][i] === name);
    });
  }

  /* ── Modal ── */
  function showModal(title, body) {
    qs('modalTitle').textContent = title;
    qs('modalBody').textContent  = body;
    qs('modalOverlay').style.display = 'flex';
  }
  function closeModal() {
    qs('modalOverlay').style.display = 'none';
  }

  /* ── Scan button state ── */
  function setScanBusy(busy) {
    const btn = qs('scanBtn');
    btn.classList.toggle('scanning', busy);
    btn.innerHTML = busy
      ? '<span class="spinner"></span> Scanning…'
      : '⟳ Rescan';
  }

  return { addLog, updateMetrics, renderOpps, renderDetail, renderPositions, showTab, showModal, closeModal, setScanBusy };
})();

/* expose showTab globally so inline onclick works */
window.showTab    = UI.showTab;
window.closeModal = UI.closeModal;
