/**
 * ui.js — All DOM rendering.
 */

window.UI = (() => {

  function qs(id) { return document.getElementById(id); }

  function formatPnl(v) {
    return (v >= 0 ? '+$' : '-$') + Math.abs(v).toFixed(2);
  }

  /* ── Log ── */
  function addLog(msg, type = 'info') {
    const t = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    function makeEl() {
      const el = document.createElement('div');
      el.className = 'log-entry';
      el.innerHTML = `<span class="log-time">${t}</span><span class="log-${type}">${msg}</span>`;
      return el;
    }
    const list = qs('logList');
    list.insertBefore(makeEl(), list.firstChild);
    const full = qs('fullLog');
    if (full.textContent.trim() === 'No agent activity yet.') full.innerHTML = '';
    full.insertBefore(makeEl(), full.firstChild);
  }

  /* ── Time-window filter dropdown ── */
  function buildTimeWindowSelect() {
    const sel = qs('timeWindowSelect');
    if (!sel) return;
    sel.innerHTML = Engine.TIME_WINDOWS.map((w, i) =>
      `<option value="${i}">${w.label}</option>`
    ).join('');
  }

  /* ── Metrics ── */
  function updateMetrics(state) {
    const closed = state.positions.filter(p => p.status === 'closed');
    const open   = state.positions.filter(p => p.status === 'open');
    const realised = closed.reduce((s, p) => s + (p.actualPnl ?? 0), 0);
    const wins   = closed.filter(p => (p.actualPnl ?? 0) > 0).length;

    qs('pnl').textContent        = formatPnl(realised);
    qs('pnl').className          = 'metric-value ' + (realised >= 0 ? 'up' : 'down');
    qs('pnlChange').textContent  = closed.length + ' closed';
    qs('openPos').textContent    = open.length;
    qs('openPosChange').textContent = open.length === 1 ? '1 active' : open.length + ' active';
    qs('scanned').textContent    = state.scannedCount;

    const visible = state.filteredOpps ? state.filteredOpps.length : state.opps.length;
    qs('oppCount').textContent       = visible;
    qs('oppCountChange').textContent = state.opps.length > visible
      ? `of ${state.opps.length} total` : 'visible';

    if (closed.length > 0) {
      qs('winRate').textContent       = Math.round(wins / closed.length * 100) + '%';
      qs('winRateChange').textContent = wins + '/' + closed.length + ' closed';
    } else {
      qs('winRate').textContent       = '—';
      qs('winRateChange').textContent = 'no closed trades';
    }
  }

  /* ── Countdown badge ── */
  function countdownBadge(opp) {
    const h = Engine.hoursUntilResolution(opp);
    const txt = Engine.formatCountdown(opp);
    let cls = 'tag-low';
    if (h < 1)  cls = 'tag-risk';
    else if (h < 6)  cls = 'tag-med';
    return `<span class="opp-tag ${cls}">⏱ ${txt}</span>`;
  }

  /* ── Opportunity row ── */
  function buildOppRow(opp, selectedId, onSelect) {
    const sp        = Engine.calcSpread(opp);
    const id        = Engine.calcIdentity(opp);
    const tier      = Engine.riskTier(sp.maxProfit, id);
    const platNames = Object.keys(opp.platforms).map(k => PLATFORMS[k]?.name).filter(Boolean);
    const hasLiq    = Engine.hasRealLiquidity(opp);

    const div = document.createElement('div');
    div.className = 'opp-row' + (opp.id === selectedId ? ' selected' : '');
    div.id = 'opp-' + opp.id;
    div.onclick = () => onSelect(opp.id);

    div.innerHTML = `
      <div>
        <div class="opp-title">${opp.title}</div>
        <div class="opp-meta">
          <span class="opp-tag tag-low">${opp.category}</span>
          ${countdownBadge(opp)}
          ${sp.maxProfit > 0 && hasLiq ? `<span class="opp-tag ${tier.cls}">${tier.label} EDGE</span>` : ''}
          ${!hasLiq ? '<span class="opp-tag tag-risk">NO LIQUIDITY</span>' : ''}
          <div class="platform-pills">
            ${platNames.map(n => `<span class="platform-pill">${n}</span>`).join('')}
          </div>
        </div>
      </div>
      <div class="opp-right">
        <div class="profit-est">${sp.maxProfit > 0 && hasLiq ? '+$' + (sp.maxProfit * 100).toFixed(2) : '—'}</div>
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

    const source = state.filteredOpps ?? state.opps;

    if (!source.length && state.opps.length > 0) {
      list.innerHTML = `<div class="empty-state">No markets close within this window.<br>Try a wider time filter.</div>`;
      return;
    }

    const sorted = [...source].sort((a, b) => {
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

    const sp        = Engine.calcSpread(opp);
    const id        = Engine.calcIdentity(opp);
    const tier      = Engine.riskTier(sp.maxProfit, id);
    const platforms = Object.keys(opp.platforms);
    const countdown = Engine.formatCountdown(opp);
    const hours     = Engine.hoursUntilResolution(opp);

    let html = '';

    /* Price comparison */
    html += `<div class="detail-section">
      <div class="detail-section-header">Price comparison · closes in ${countdown}</div>
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
                <div class="id-bar-fill" style="width:${val*100}%;background:${Engine.barColor(val)}"></div>
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
    html += `<div class="detail-section">
      <div class="detail-section-header">Risk factors</div>
      <div class="detail-section-body">
        <div class="risk-grid">
          <div class="risk-item">
            <div class="risk-item-label">Spread edge</div>
            <div class="risk-item-val" style="color:${sp.maxProfit>0.02?'#22c55e':sp.maxProfit>0?'#f59e0b':'#ef4444'}">
              ${sp.maxProfit > 0 ? '+' + (sp.maxProfit*100).toFixed(2) + '¢' : 'None'}
            </div>
          </div>
          <div class="risk-item">
            <div class="risk-item-label">Identity score</div>
            <div class="risk-item-val" style="color:${Engine.barColor(id)}">${Math.round(id*100)}%</div>
          </div>
          <div class="risk-item">
            <div class="risk-item-label">Max liquidity</div>
            <div class="risk-item-val">${maxLiq ? '$' + Math.round(maxLiq/1000) + 'k' : 'N/A'}</div>
          </div>
          <div class="risk-item">
            <div class="risk-item-label">Closes in</div>
            <div class="risk-item-val" style="color:${hours<1?'#ef4444':hours<6?'#f59e0b':'#aaa'}">${countdown}</div>
          </div>
          <div class="risk-item">
            <div class="risk-item-label">Exec risk</div>
            <div class="risk-item-val" style="color:${id<0.7?'#ef4444':sp.maxProfit<0.01?'#f59e0b':'#22c55e'}">
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

  /* ── Open Positions table ── */
  function renderPositions(state) {
    const open = state.positions.filter(p => p.status === 'open');
    const el   = qs('positionsContent');
    const btn  = qs('closeAllBtn');
    qs('posCount').textContent = open.length + ' open';
    if (btn) btn.style.display = open.length ? '' : 'none';

    if (!open.length) {
      el.innerHTML = '<div class="empty-state">No open positions. Place a paper trade from the Opportunities tab.</div>';
      return;
    }

    el.innerHTML = `<table class="positions-table">
      <tr>
        <th>Market</th><th>Buy on</th><th>Sell on</th><th>Side</th>
        <th>Stake</th><th>Exp. P&amp;L</th><th>Identity</th><th>Opened</th><th></th>
      </tr>
      ${open.map(p => `
        <tr>
          <td style="max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${p.market}">${p.market}</td>
          <td>${p.buyPlat}</td>
          <td>${p.sellPlat}</td>
          <td>${p.side}</td>
          <td>$${p.stake}</td>
          <td class="up">+$${p.expectedPnl.toFixed(2)}</td>
          <td style="color:${Engine.barColor(p.identity)}">${Math.round(p.identity * 100)}%</td>
          <td>${p.openedAt}</td>
          <td><button class="close-pos-btn" onclick="simulateCloseOne('${p.id}')">Close</button></td>
        </tr>
      `).join('')}
    </table>`;
  }

  /* ── Dashboard ── */
  function renderDashboard(state) {
    const closed = state.positions.filter(p => p.status === 'closed');
    const el = qs('dashContent');

    if (!closed.length) {
      el.innerHTML = '<div class="empty-state">Place paper trades and close positions<br />to see your performance here.</div>';
      qs('dashSubtitle').textContent = 'No closed trades yet';
      return;
    }

    const realised  = closed.reduce((s, p) => s + (p.actualPnl ?? 0), 0);
    const wins      = closed.filter(p => (p.actualPnl ?? 0) > 0);
    const losses    = closed.filter(p => (p.actualPnl ?? 0) <= 0);
    const winRate   = Math.round(wins.length / closed.length * 100);
    const avgWin    = wins.length    ? wins.reduce((s,p)=>s+p.actualPnl,0)    / wins.length    : 0;
    const avgLoss   = losses.length  ? losses.reduce((s,p)=>s+p.actualPnl,0)  / losses.length  : 0;
    const bestTrade = closed.reduce((b, p) => (p.actualPnl > (b?.actualPnl ?? -Infinity) ? p : b), null);
    const worstTrade= closed.reduce((b, p) => (p.actualPnl < (b?.actualPnl ?? Infinity)  ? p : b), null);

    qs('dashSubtitle').textContent = `${closed.length} closed trade${closed.length !== 1 ? 's' : ''}`;

    // running cumulative P&L for sparkline
    const cumPnl = [];
    let running = 0;
    closed.forEach(p => { running += p.actualPnl ?? 0; cumPnl.push(running); });

    // sparkline SVG (inline, no library)
    const W = 320, H = 60, pad = 6;
    const minV = Math.min(0, ...cumPnl), maxV = Math.max(0, ...cumPnl);
    const range = maxV - minV || 1;
    function px(i) { return pad + (i / (cumPnl.length - 1 || 1)) * (W - pad * 2); }
    function py(v) { return H - pad - ((v - minV) / range) * (H - pad * 2); }
    const pts = cumPnl.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ');
    const zeroY = py(0).toFixed(1);
    const lineColor = realised >= 0 ? '#22c55e' : '#ef4444';
    const sparkline = cumPnl.length > 1
      ? `<svg width="${W}" height="${H}" style="display:block;margin-bottom:4px">
          <line x1="${pad}" y1="${zeroY}" x2="${W-pad}" y2="${zeroY}" stroke="#333" stroke-width="0.5" stroke-dasharray="3 3"/>
          <polyline points="${pts}" fill="none" stroke="${lineColor}" stroke-width="2" stroke-linejoin="round"/>
          ${cumPnl.map((v,i) => `<circle cx="${px(i).toFixed(1)}" cy="${py(v).toFixed(1)}" r="3" fill="${v>=0?'#22c55e':'#ef4444'}"/>`).join('')}
         </svg>`
      : '';

    el.innerHTML = `
      <!-- Summary stat cards -->
      <div class="dash-stat-grid">
        <div class="dash-stat">
          <div class="dash-stat-label">Realised P&amp;L</div>
          <div class="dash-stat-val ${realised >= 0 ? 'up' : 'down'}">${formatPnl(realised)}</div>
        </div>
        <div class="dash-stat">
          <div class="dash-stat-label">Win rate</div>
          <div class="dash-stat-val" style="color:${winRate>=60?'#22c55e':winRate>=40?'#f59e0b':'#ef4444'}">${winRate}%</div>
        </div>
        <div class="dash-stat">
          <div class="dash-stat-label">Avg win</div>
          <div class="dash-stat-val up">${avgWin > 0 ? '+$' + avgWin.toFixed(2) : '—'}</div>
        </div>
        <div class="dash-stat">
          <div class="dash-stat-label">Avg loss</div>
          <div class="dash-stat-val down">${avgLoss < 0 ? '-$' + Math.abs(avgLoss).toFixed(2) : '—'}</div>
        </div>
      </div>

      <!-- Cumulative P&L sparkline -->
      <div class="detail-section" style="margin-top:12px">
        <div class="detail-section-header">Cumulative P&amp;L</div>
        <div class="detail-section-body" style="padding:12px 14px">
          ${sparkline || '<div style="color:#555;font-size:12px">Need 2+ trades for chart.</div>'}
          <div style="font-size:11px;color:#555;margin-top:4px">Each dot = one closed trade</div>
        </div>
      </div>

      <!-- Closed trades table -->
      <div class="detail-section" style="margin-top:12px">
        <div class="detail-section-header">Closed trades</div>
        <div style="overflow-x:auto">
          <table class="positions-table">
            <tr>
              <th>Market</th><th>Buy on</th><th>Sell on</th><th>Side</th>
              <th>Stake</th><th>Expected</th><th>Actual P&amp;L</th><th>Identity</th><th>Opened</th><th>Closed</th>
            </tr>
            ${[...closed].reverse().map(p => {
              const actual = p.actualPnl ?? 0;
              return `<tr>
                <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${p.market}">${p.market}</td>
                <td>${p.buyPlat}</td>
                <td>${p.sellPlat}</td>
                <td>${p.side}</td>
                <td>$${p.stake}</td>
                <td class="neutral">+$${p.expectedPnl.toFixed(2)}</td>
                <td class="${actual >= 0 ? 'up' : 'down'}">${actual >= 0 ? '+' : ''}$${actual.toFixed(2)}</td>
                <td style="color:${Engine.barColor(p.identity)}">${Math.round(p.identity * 100)}%</td>
                <td>${p.openedAt}</td>
                <td>${p.closedAt ?? '—'}</td>
              </tr>`;
            }).join('')}
          </table>
        </div>
      </div>

      ${bestTrade ? `
      <!-- Best / worst -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px">
        <div class="detail-section">
          <div class="detail-section-header">Best trade</div>
          <div class="detail-section-body" style="font-size:12px">
            <div style="margin-bottom:4px;color:#aaa;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${bestTrade.market}</div>
            <div class="up" style="font-size:18px;font-weight:600">+$${bestTrade.actualPnl.toFixed(2)}</div>
          </div>
        </div>
        <div class="detail-section">
          <div class="detail-section-header">Worst trade</div>
          <div class="detail-section-body" style="font-size:12px">
            <div style="margin-bottom:4px;color:#aaa;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${worstTrade.market}</div>
            <div class="${(worstTrade.actualPnl??0)>=0?'up':'down'}" style="font-size:18px;font-weight:600">${(worstTrade.actualPnl??0)>=0?'+':''}\$${(worstTrade.actualPnl??0).toFixed(2)}</div>
          </div>
        </div>
      </div>
      ` : ''}
    `;
  }

  /* ── Tab switching ── */
  function showTab(name) {
    ['Opps','Positions','Dashboard','Log'].forEach(t => {
      const el = qs('tab' + t);
      if (el) el.style.display = t.toLowerCase() === name ? '' : 'none';
    });
    document.querySelectorAll('.nav-btn[data-tab]').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === name);
    });
  }

  function showModal(title, body) {
    qs('modalTitle').textContent = title;
    qs('modalBody').textContent  = body;
    qs('modalOverlay').style.display = 'flex';
  }
  function closeModal() { qs('modalOverlay').style.display = 'none'; }

  function setScanBusy(busy) {
    const btn = qs('scanBtn');
    btn.classList.toggle('scanning', busy);
    btn.innerHTML = busy ? '<span class="spinner"></span> Scanning…' : '⟳ Scan';
  }

  return {
    addLog, buildTimeWindowSelect, updateMetrics,
    renderOpps, renderDetail, renderPositions, renderDashboard,
    showTab, showModal, closeModal, setScanBusy,
  };
})();

window.showTab    = UI.showTab;
window.closeModal = UI.closeModal;
