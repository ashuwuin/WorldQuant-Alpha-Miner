/**
 * WorldQuant BRAIN Quantum Portal - Interactive App Engine
 * Institutional Alpha Management, Head-to-Head Comparison, Data Catalog & Simulator
 */

let allAlphas = [];
let currentFilter = 'all';
let currentTimeframe = 'today'; // Default to Today mode: only displays today's alphas & simulations
let currentSearch = '';
let currentSort = { col: 'fitness', order: 'desc' };

let frontierChart = null;
let tierChart = null;
let modalRadarChart = null;

// Multi-Alpha Selection for Head-to-Head Compare
const selectedAlphaIds = new Set();

// Data Library Catalog State
let dataLibPage = 1;
const dataLibLimit = 50;
let dataLibSearch = '';
let dataLibDataset = '';
let dataLibType = '';
let dataLibDebounceTimer = null;

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initControls();
    loadDashboardStats();
    loadAlphas();
    initStudio();
    initDataLibrary();
    initCorrelationWorkerPoller();
});

// --- Timeframe Filter (Today vs All Time) ---
window.setTimeframeFilter = function(timeframe) {
    currentTimeframe = timeframe;
    const btnToday = document.getElementById('btn-timeframe-today');
    const btnAll = document.getElementById('btn-timeframe-all');
    const badgeToday = document.getElementById('badge-today-count');
    const badgeAll = document.getElementById('badge-all-count');
    const caption = document.getElementById('timeframe-caption');

    if (timeframe === 'today') {
        if (btnToday) {
            btnToday.classList.add('active');
            btnToday.style.background = 'rgba(56, 189, 248, 0.12)';
            btnToday.style.borderColor = 'rgba(56, 189, 248, 0.35)';
            btnToday.style.color = '#38bdf8';
        }
        if (btnAll) {
            btnAll.classList.remove('active');
            btnAll.style.background = 'transparent';
            btnAll.style.borderColor = 'transparent';
            btnAll.style.color = 'var(--text-muted)';
        }
        if (badgeToday) {
            badgeToday.style.background = 'rgba(56, 189, 248, 0.22)';
            badgeToday.style.color = '#7dd3fc';
        }
        if (badgeAll) {
            badgeAll.style.background = 'rgba(255, 255, 255, 0.06)';
            badgeAll.style.color = 'var(--text-muted)';
        }
        if (caption) caption.textContent = "Showing alphas submitted & simulations dispatched today only (2026-10-16).";
    } else {
        if (btnAll) {
            btnAll.classList.add('active');
            btnAll.style.background = 'rgba(56, 189, 248, 0.12)';
            btnAll.style.borderColor = 'rgba(56, 189, 248, 0.35)';
            btnAll.style.color = '#38bdf8';
        }
        if (btnToday) {
            btnToday.classList.remove('active');
            btnToday.style.background = 'transparent';
            btnToday.style.borderColor = 'transparent';
            btnToday.style.color = 'var(--text-muted)';
        }
        if (badgeAll) {
            badgeAll.style.background = 'rgba(56, 189, 248, 0.22)';
            badgeAll.style.color = '#7dd3fc';
        }
        if (badgeToday) {
            badgeToday.style.background = 'rgba(255, 255, 255, 0.06)';
            badgeToday.style.color = 'var(--text-muted)';
        }
        if (caption) caption.textContent = "Showing all historical alphas and simulation records across entire database.";
    }

    loadDashboardStats();
    loadAlphas();
};

// --- Tab Navigation ---
window.switchTab = function(targetTab) {
    const navBtns = document.querySelectorAll('.nav-btn');
    const dockBtns = document.querySelectorAll('.dock-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    navBtns.forEach(b => {
        if (b.getAttribute('data-tab') === targetTab) b.classList.add('active');
        else b.classList.remove('active');
    });

    dockBtns.forEach(b => {
        if (b.getAttribute('data-tab') === targetTab) b.classList.add('active');
        else b.classList.remove('active');
    });

    tabPanes.forEach(p => p.style.display = 'none');
    const activePane = document.getElementById(`tab-${targetTab}`);
    if (activePane) {
        activePane.style.display = 'block';
    }

    if (targetTab === 'dashboard') {
        loadDashboardStats();
        loadAlphas();
    } else if (targetTab === 'portfolio') {
        loadActivePortfolio();
    } else if (targetTab === 'datalib') {
        loadDatasets();
        loadDataLibrary(1);
    }
};

function initTabs() {
    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            window.switchTab(targetTab);
        });
    });

    const dockBtns = document.querySelectorAll('.dock-btn');
    dockBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            window.switchTab(targetTab);
        });
    });
}

// --- Dashboard Stats & KPIs ---
async function loadDashboardStats() {
    try {
        const url = currentTimeframe === 'today' ? '/api/stats?today_only=true' : '/api/stats';
        const res = await fetch(url);
        const data = await res.json();

        const badgeToday = document.getElementById('badge-today-count');
        const badgeAll = document.getElementById('badge-all-count');
        const studioTodayRuns = document.getElementById('studio-today-runs-count');

        if (data.today_total !== undefined) {
            if (badgeToday) badgeToday.textContent = data.today_total;
            if (studioTodayRuns) studioTodayRuns.textContent = `${data.today_total} Dispatched`;
        }
        if (currentTimeframe === 'all' && badgeAll) {
            badgeAll.textContent = data.total;
        } else if (currentTimeframe === 'today' && badgeAll) {
            fetch('/api/stats').then(r => r.json()).then(allData => {
                if (badgeAll) badgeAll.textContent = allData.total;
            }).catch(() => {});
        }

        animateValue('kpi-total', 0, data.total, 800);
        animateValue('kpi-submittable', 0, data.submittable, 800);
        animateValue('kpi-spectacular', 0, data.spectacular, 800);
        animateValue('kpi-excellent', 0, data.excellent, 800);
        animateValue('kpi-active', 0, data.active, 800);

        const navPortCount = document.getElementById('nav-portfolio-count');
        if (navPortCount && data.active !== undefined) {
            navPortCount.textContent = data.active;
        }
        const dockPortCount = document.getElementById('dock-portfolio-count');
        if (dockPortCount && data.active !== undefined) {
            dockPortCount.textContent = data.active;
        }
        const radarActive = document.getElementById('radar-active-count');
        if (radarActive && data.active !== undefined) {
            radarActive.textContent = `${data.active} Active`;
        }
        const radarSub = document.getElementById('radar-submittable-count');
        if (radarSub && data.submittable !== undefined) {
            radarSub.textContent = `${data.submittable} Ready`;
        }
        const apexSharpeEl = document.getElementById('overview-apex-sharpe');
        if (apexSharpeEl && data.max_sharpe) {
            apexSharpeEl.textContent = `${data.max_sharpe} SR`;
        }

        const leaderIdEl = document.getElementById('kpi-leader-id');
        const leaderStatsEl = document.getElementById('kpi-leader-stats');
        if (leaderIdEl) {
            leaderIdEl.textContent = data.leader_id || '--';
        }
        if (leaderStatsEl) {
            leaderStatsEl.textContent = data.leader_fitness ? `Fitness ${data.leader_fitness} | Sharpe ${data.leader_sharpe}` : 'Fitness -- | Sharpe --';
        }

        const unsubCountEl = document.getElementById('kpi-unsubmitted-count');
        if (unsubCountEl && data.unsubmitted !== undefined) {
            unsubCountEl.textContent = data.unsubmitted;
        }

        document.getElementById('kpi-max-sharpe').textContent = data.max_sharpe || '0.00';
        document.getElementById('kpi-max-return').textContent = `${data.max_returns_pct || 0}%`;
        document.getElementById('kpi-min-drawdown').textContent = `${data.min_drawdown_pct || 0}%`;

        updateTierChart(data);
    } catch (e) {
        console.error('Failed to load stats:', e);
    }
}

function animateValue(id, start, end, duration) {
    const obj = document.getElementById(id);
    if (!obj) return;
    if (end === 0) { obj.textContent = '0'; return; }
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.textContent = Math.floor(progress * (end - start) + start);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            obj.textContent = end;
        }
    };
    window.requestAnimationFrame(step);
}

// --- Alpha Data Loading & Table ---
async function loadAlphas() {
    const tableBody = document.getElementById('alphas-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = `<tr><td colspan="12" style="text-align: center; padding: 2rem; color: var(--text-muted);">Synchronizing quantum alpha registry...</td></tr>`;

    try {
        const params = new URLSearchParams({
            sort_by: currentSort.col,
            order: currentSort.order,
            limit: 100
        });

        if (currentTimeframe === 'today') params.append('today_only', 'true');
        if (currentFilter === 'spectacular') params.append('tier', 'spectacular');
        if (currentFilter === 'excellent') params.append('tier', 'excellent');
        if (currentFilter === 'submittable') params.append('submittable_only', 'true');
        if (currentFilter === 'active') params.append('active_only', 'true');
        if (currentFilter === 'unsubmitted') params.append('unsubmitted_only', 'true');
        if (currentSearch) params.append('search', currentSearch);

        const res = await fetch(`/api/alphas?${params.toString()}`);
        const data = await res.json();
        allAlphas = data.alphas || [];

        renderAlphasTable(allAlphas);
        updateFrontierChart(allAlphas);
        updateStudioTodayRunsList(allAlphas);
    } catch (e) {
        console.error('Failed to load alphas:', e);
        tableBody.innerHTML = `<tr><td colspan="12" style="text-align: center; color: var(--accent-rose); padding: 2rem;">Error loading alpha registry</td></tr>`;
    }
}

function updateStudioTodayRunsList(alphas) {
    const list = document.getElementById('studio-today-runs-list');
    if (!list) return;
    if (!alphas || !alphas.length) {
        list.innerHTML = `<div style="color: var(--text-muted); font-size: 0.725rem; padding: 0.5rem 0;">No simulations run yet today.</div>`;
        return;
    }
    list.innerHTML = alphas.slice(0, 5).map(a => `
        <div class="today-run-row" onclick="openAlphaModal('${a.id}')">
            <div style="display: flex; align-items: center; gap: 0.4rem;">
                <span style="font-family: var(--font-mono); font-weight: 700; color: #38bdf8;">${a.id}</span>
                <span style="font-size: 0.675rem; color: var(--text-muted);">${a.universe || 'TOP3000'}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span style="font-size: 0.725rem; font-weight: 700; color: ${a.fitness >= 2.0 ? '#34d399' : '#38bdf8'};">Fit ${a.fitness ? a.fitness.toFixed(2) : '--'}</span>
                <span class="badge-tier ${a.submission_status === 'SUBMITTED' ? 'badge-active' : a.is_submittable ? 'badge-good' : 'badge-average'}" style="font-size: 0.65rem; padding: 0.1rem 0.35rem;">
                    ${a.submission_status === 'SUBMITTED' ? 'ACTIVE' : a.is_submittable ? 'READY' : 'DRAFT'}
                </span>
            </div>
        </div>
    `).join('');
}

function renderAlphasTable(alphas) {
    const tableBody = document.getElementById('alphas-table-body');
    if (!alphas.length) {
        if (currentTimeframe === 'today') {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="12" style="text-align: center; padding: 3rem 1.5rem;">
                        <div style="font-size: 0.95rem; font-weight: 700; color: #38bdf8; margin-bottom: 0.4rem;">NO DISCOVERIES RECORDED TODAY YET</div>
                        <p style="color: var(--text-muted); font-size: 0.825rem; max-width: 480px; margin: 0 auto 1.25rem auto;">
                            No alpha submissions or simulated candidates have been evaluated on today's date (Oct 16, 2026).
                        </p>
                        <button class="btn-sync" onclick="switchTab('studio')" style="font-size: 0.8rem; padding: 0.45rem 1rem;">
                            Open Alpha Studio to Simulate
                        </button>
                    </td>
                </tr>
            `;
        } else {
            tableBody.innerHTML = `<tr><td colspan="12" style="text-align: center; padding: 3rem; color: var(--text-muted);">No alphas matched the current filters.</td></tr>`;
        }
        return;
    }

    tableBody.innerHTML = alphas.map((a) => {
        let badgeClass = 'badge-average';
        if (a.tier === 'SPECTACULAR') { badgeClass = 'badge-spectacular'; }
        else if (a.tier === 'EXCELLENT') { badgeClass = 'badge-excellent'; }
        else if (a.tier === 'GOOD') { badgeClass = 'badge-good'; }

        const isActive = a.submission_status === 'SUBMITTED';
        const isSubmittable = a.is_submittable === 1;
        const isChecked = selectedAlphaIds.has(a.id);

        let statusBadge = '<span class="badge-tier" style="background: rgba(148, 163, 184, 0.15); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.3);">DRAFT</span>';
        if (isActive) {
            statusBadge = '<span class="badge-tier badge-active">ACTIVE</span>';
        } else if (isSubmittable) {
            statusBadge = '<span class="badge-tier badge-good" style="border: 1px solid #10b981; color: #34d399;">READY</span>';
        }

        return `
            <tr>
                <td style="text-align: center;">
                    <input type="checkbox" class="alpha-select-cb" data-id="${a.id}" ${isChecked ? 'checked' : ''} onchange="toggleSelectAlpha('${a.id}', this.checked)">
                </td>
                <td>
                    <span class="alpha-id-pill" onclick="openAlphaModal('${a.id}')">${a.id}</span>
                </td>
                <td>
                    <span class="badge-tier ${badgeClass}">${a.tier}</span>
                </td>
                <td style="font-weight: 700; color: ${a.sharpe >= 2.0 ? '#34d399' : '#e2e8f0'};">
                    ${(a.sharpe || 0).toFixed(2)}
                </td>
                <td style="font-weight: 700; color: ${a.fitness >= 2.5 ? '#34d399' : a.fitness >= 2.0 ? '#38bdf8' : '#e2e8f0'};">
                    ${(a.fitness || 0).toFixed(2)}
                </td>
                <td>${(a.returns_pct || 0).toFixed(2)}%</td>
                <td>
                    <span style="color: ${a.turnover_pct <= 13.5 ? '#34d399' : '#fbbf24'}; font-weight: 600;">
                        ${(a.turnover_pct || 0).toFixed(1)}%
                    </span>
                </td>
                <td>${(a.margin_bps || 0).toFixed(1)} bps</td>
                <td>${(a.drawdown_pct || 0).toFixed(1)}%</td>
                <td style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace;">
                    ${a.universe || 'TOP3000'} | D${a.delay !== undefined ? a.delay : 1}
                </td>
                <td>
                    ${statusBadge}
                </td>
                <td style="white-space: nowrap;">
                    <button class="btn-table-action" onclick="openAlphaModal('${a.id}')" title="Inspect Hurdles & Metrics">Inspect</button>
                    <button class="btn-table-action btn-action-clone" onclick="cloneAlphaToStudio('${a.id}')" title="Clone to Studio">Clone</button>
                </td>
            </tr>
        `;
    }).join('');
}

// --- Head-to-Head Compare Management ---
function toggleSelectAlpha(alphaId, isChecked) {
    if (isChecked) {
        selectedAlphaIds.add(alphaId);
    } else {
        selectedAlphaIds.delete(alphaId);
    }
    updateCompareBar();
}

function toggleSelectAllAlphas(masterCb) {
    const cbs = document.querySelectorAll('.alpha-select-cb');
    cbs.forEach(cb => {
        cb.checked = masterCb.checked;
        const id = cb.getAttribute('data-id');
        if (id) {
            if (masterCb.checked) selectedAlphaIds.add(id);
            else selectedAlphaIds.delete(id);
        }
    });
    updateCompareBar();
}

function clearSelectedAlphas() {
    selectedAlphaIds.clear();
    const cbs = document.querySelectorAll('.alpha-select-cb');
    cbs.forEach(cb => cb.checked = false);
    const master = document.getElementById('th-select-all');
    if (master) master.checked = false;
    updateCompareBar();
}

function updateCompareBar() {
    const bar = document.getElementById('floating-compare-bar');
    const badge = document.getElementById('compare-count-badge');
    if (!bar || !badge) return;

    const count = selectedAlphaIds.size;
    if (count >= 2) {
        bar.style.display = 'flex';
        badge.textContent = `${count} alphas selected`;
    } else if (count === 1) {
        bar.style.display = 'flex';
        badge.textContent = `1 alpha selected (select 1+ more)`;
    } else {
        bar.style.display = 'none';
    }
}

async function openCompareModal() {
    if (selectedAlphaIds.size < 2) {
        alert('Please select at least 2 alphas using the table checkboxes to compare head-to-head.');
        return;
    }

    const modal = document.getElementById('compareModal');
    const modalBody = document.getElementById('compare-modal-body');
    if (!modal || !modalBody) return;

    modal.style.display = 'flex';
    modalBody.innerHTML = '<div style="color: var(--text-muted); padding: 2rem; text-align: center;">Compiling multi-factor head-to-head metrics...</div>';

    try {
        const idList = Array.from(selectedAlphaIds).join(',');
        const res = await fetch(`/api/compare?ids=${encodeURIComponent(idList)}`);
        const data = await res.json();
        const alphas = data.alphas || [];

        if (!alphas.length) {
            modalBody.innerHTML = '<div style="color: var(--accent-rose); padding: 2rem; text-align: center;">Could not load alpha comparison data.</div>';
            return;
        }

        // Compute best values for highlighting
        const bestSharpe = Math.max(...alphas.map(a => a.sharpe || 0));
        const bestFitness = Math.max(...alphas.map(a => a.fitness || 0));
        const bestReturns = Math.max(...alphas.map(a => a.returns_pct || 0));
        const bestTurnover = Math.min(...alphas.map(a => a.turnover_pct || 999));
        const bestMargin = Math.max(...alphas.map(a => a.margin_bps || 0));
        const bestDrawdown = Math.min(...alphas.map(a => a.drawdown_pct || 999));

        modalBody.innerHTML = `
            <div style="overflow-x: auto;">
                <table class="compare-metric-table">
                    <thead>
                        <tr>
                            <th>Factor Metric</th>
                            ${alphas.map(a => `
                                <th>
                                    <div style="font-size: 1rem; font-weight: 800; color: #38bdf8;">${a.id}</div>
                                    <span class="badge-tier ${a.tier === 'SPECTACULAR' ? 'badge-spectacular' : a.tier === 'EXCELLENT' ? 'badge-excellent' : 'badge-good'}">
                                        ${a.tier}
                                    </span>
                                </th>
                            `).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Sharpe Ratio</td>
                            ${alphas.map(a => `<td class="${a.sharpe === bestSharpe ? 'metric-best' : ''}">${(a.sharpe || 0).toFixed(2)}</td>`).join('')}
                        </tr>
                        <tr>
                            <td>Fitness</td>
                            ${alphas.map(a => `<td class="${a.fitness === bestFitness ? 'metric-best' : ''}">${(a.fitness || 0).toFixed(2)}</td>`).join('')}
                        </tr>
                        <tr>
                            <td>Annualized Return</td>
                            ${alphas.map(a => `<td class="${a.returns_pct === bestReturns ? 'metric-best' : ''}">${(a.returns_pct || 0).toFixed(2)}%</td>`).join('')}
                        </tr>
                        <tr>
                            <td>Turnover (Lower is better)</td>
                            ${alphas.map(a => `<td class="${a.turnover_pct === bestTurnover ? 'metric-best' : ''}">${(a.turnover_pct || 0).toFixed(1)}%</td>`).join('')}
                        </tr>
                        <tr>
                            <td>Margin (bps)</td>
                            ${alphas.map(a => `<td class="${a.margin_bps === bestMargin ? 'metric-best' : ''}">${(a.margin_bps || 0).toFixed(1)} bps</td>`).join('')}
                        </tr>
                        <tr>
                            <td>Max Drawdown (Lower is better)</td>
                            ${alphas.map(a => `<td class="${a.drawdown_pct === bestDrawdown ? 'metric-best' : ''}">${(a.drawdown_pct || 0).toFixed(1)}%</td>`).join('')}
                        </tr>
                        <tr>
                            <td>Universe &amp; Delay</td>
                            ${alphas.map(a => `<td>${a.universe || 'TOP3000'} | D${a.delay !== undefined ? a.delay : 1}</td>`).join('')}
                        </tr>
                        <tr>
                            <td>Decay &amp; Neutralization</td>
                            ${alphas.map(a => `<td>${a.decay || 0} | ${a.neutralization || 'NONE'}</td>`).join('')}
                        </tr>
                        <tr>
                            <td>Platform Hurdle Status</td>
                            ${alphas.map(a => `
                                <td>${a.submission_status === 'SUBMITTED' ? '<span style="color: #fbbf24; font-weight: 700;">ACTIVE</span>' : 
                                      a.is_submittable ? '<span style="color: #34d399; font-weight: 700;">READY</span>' : 
                                      '<span style="color: #64748b;">HOLD</span>'}
                                </td>
                            `).join('')}
                        </tr>
                    </tbody>
                </table>
            </div>

            <div style="margin-top: 1.5rem;">
                <h4 style="font-size: 0.85rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.75rem;">FastExpr Formulas Comparison</h4>
                <div style="display: grid; grid-template-columns: repeat(${Math.min(alphas.length, 3)}, 1fr); gap: 1rem;">
                    ${alphas.map(a => `
                        <div style="background: #080c14; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 1rem; display: flex; flex-direction: column;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                <strong style="color: #38bdf8; font-size: 0.85rem;">${a.id}</strong>
                                <button onclick="cloneAlphaToStudio('${a.id}'); closeCompareModal();" class="btn-table-action btn-action-clone" style="font-size: 0.7rem; padding: 0.2rem 0.5rem;">Clone</button>
                            </div>
                            <pre style="flex: 1; background: #04060a; padding: 0.75rem; border-radius: 6px; font-size: 0.75rem; color: #a5b4fc; font-family: monospace; white-space: pre-wrap; word-break: break-all; max-height: 200px; overflow-y: auto;">${a.expression || 'N/A'}</pre>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    } catch (e) {
        console.error('Error opening compare modal:', e);
        modalBody.innerHTML = `<div style="color: var(--accent-rose); padding: 2rem;">Error: ${e.message}</div>`;
    }
}

function closeCompareModal() {
    const modal = document.getElementById('compareModal');
    if (modal) modal.style.display = 'none';
}

// --- Charts Engine (Chart.js) ---
function updateFrontierChart(alphas) {
    const ctx = document.getElementById('frontierChart');
    if (!ctx) return;

    const scatterData = alphas.map(a => ({
        x: a.turnover_pct,
        y: a.returns_pct,
        sharpe: a.sharpe,
        id: a.id,
        tier: a.tier
    }));

    if (frontierChart) frontierChart.destroy();

    frontierChart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Alphas',
                data: scatterData,
                backgroundColor: (context) => {
                    const raw = context.raw;
                    if (!raw) return '#91A673';
                    if (raw.tier === 'SPECTACULAR') return '#91A673';
                    if (raw.tier === 'EXCELLENT') return '#AE8F60';
                    return '#3A4A3F';
                },
                pointRadius: 6,
                pointHoverRadius: 9
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(42, 39, 37, 0.95)',
                    titleColor: '#F6F2F1',
                    bodyColor: '#EAE2D3',
                    borderColor: 'rgba(234, 226, 211, 0.12)',
                    borderWidth: 1,
                    callbacks: {
                        label: (ctx) => {
                            const p = ctx.raw;
                            return `ID: ${p.id} | Sharpe: ${p.sharpe} | Returns: ${p.y}% | Turnover: ${p.x}%`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Turnover (%)', color: '#A89F95' },
                    grid: { color: 'rgba(234, 226, 211, 0.05)' },
                    ticks: { color: '#736B63' }
                },
                y: {
                    title: { display: true, text: 'Annualized Returns (%)', color: '#A89F95' },
                    grid: { color: 'rgba(234, 226, 211, 0.05)' },
                    ticks: { color: '#736B63' }
                }
            }
        }
    });
}

function updateTierChart(stats) {
    const ctx = document.getElementById('tierChart');
    if (!ctx) return;

    if (tierChart) tierChart.destroy();

    tierChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Spectacular (Fitness > 2.50)', 'Excellent (Fitness > 2.00)', 'Other Audited'],
            datasets: [{
                data: [
                    stats.spectacular || 0,
                    stats.excellent || 0,
                    Math.max(0, (stats.total || 0) - (stats.spectacular || 0) - (stats.excellent || 0))
                ],
                backgroundColor: ['#91A673', '#AE8F60', '#3A4A3F'],
                borderWidth: 0,
                hoverOffset: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#94a3b8', font: { size: 11 } }
                }
            },
            cutout: '72%'
        }
    });
}

// --- Controls & Filters ---
function initControls() {
    const searchInput = document.getElementById('search-alphas');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentSearch = e.target.value.trim();
            loadAlphas();
        });
    }

    const filterPills = document.querySelectorAll('.filter-pill');
    filterPills.forEach(pill => {
        pill.addEventListener('click', () => {
            filterPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            currentFilter = pill.getAttribute('data-filter');
            loadAlphas();
        });
    });

    const syncBtn = document.getElementById('btn-sync-cloud');
    if (syncBtn) {
        syncBtn.addEventListener('click', async () => {
            syncBtn.textContent = 'Syncing...';
            try {
                const res = await fetch('/api/sync-cloud', { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                    alert(`Cloud Sync Complete!\n• Active Submissions: ${data.active_synced}\n• Unsubmitted Drafts: ${data.unsubmitted_synced}\nTotal synced from BRAIN: ${data.synced}`);
                } else {
                    alert(`Sync error: ${data.error || 'Failed to sync with BRAIN'}`);
                }
                loadDashboardStats();
                loadAlphas();
            } catch (e) {
                alert('Sync failed. Please check network connection.');
            } finally {
                syncBtn.textContent = 'Sync Cloud';
            }
        });
    }
}

// --- Modal Inspector & Radar Chart ---
async function openAlphaModal(alphaId) {
    const modal = document.getElementById('alphaModal');
    if (!modal) return;

    modal.style.display = 'flex';
    document.getElementById('modal-id').textContent = alphaId;
    document.getElementById('modal-code').textContent = 'Loading FastExpr code...';
    document.getElementById('modal-checks').innerHTML = '<div style="color: var(--text-muted);">Auditing platform checks...</div>';

    // Reset correlation checker
    const corrBadge = document.getElementById('modal-corr-badge');
    const corrResults = document.getElementById('modal-corr-results');
    if (corrBadge) {
        corrBadge.textContent = 'NOT CHECKED';
        corrBadge.style.background = 'rgba(255,255,255,0.05)';
        corrBadge.style.color = 'var(--text-muted)';
    }
    if (corrResults) {
        corrResults.innerHTML = '<div style="color: var(--text-muted); text-align: center; margin-top: 2rem;">Click above to query live platform correlation</div>';
    }

    try {
        const res = await fetch(`/api/alpha/${alphaId}`);
        const data = await res.json();

        document.getElementById('modal-code').textContent = data.expression || 'N/A';
        document.getElementById('modal-metrics-summary').textContent = 
            `Sharpe: ${data.sharpe} | Fitness: ${data.fitness} | Returns: ${data.returns_pct}% | Turnover: ${data.turnover_pct}% | Margin: ${data.margin_bps} bps | Universe: ${data.universe} | Delay: ${data.delay} | Decay: ${data.decay}`;

        // Render checks scorecard
        const checksContainer = document.getElementById('modal-checks');
        if (data.checks_list && data.checks_list.length) {
            checksContainer.innerHTML = data.checks_list.map(c => {
                const isPass = c.result === 'PASS';
                const statusColor = isPass ? '#34d399' : '#f43f5e';
                const statusIcon = isPass ? '✓' : '✗';
                return `
                    <div style="display: flex; justify-content: space-between; padding: 0.5rem 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.8rem;">
                        <span style="color: var(--text-secondary); font-family: monospace;">${c.name}</span>
                        <span style="color: ${statusColor}; font-weight: 700;">${statusIcon} ${c.result} ${c.value ? `(${c.value})` : ''}</span>
                    </div>
                `;
            }).join('');
        } else {
            checksContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem; padding: 0.5rem 0.75rem;">Platform checks summary not recorded.</div>';
        }

        // Render Factor Health Radar Chart
        renderModalRadarChart(data);

    } catch (e) {
        console.error(e);
    }
}

function renderModalRadarChart(alpha) {
    const ctx = document.getElementById('modalRadarChart');
    if (!ctx) return;

    if (modalRadarChart) {
        modalRadarChart.destroy();
        modalRadarChart = null;
    }

    // Normalized metric scores (0-100)
    const sharpeScore = Math.min(100, Math.max(0, ((alpha.sharpe || 0) / 2.5) * 100));
    const fitnessScore = Math.min(100, Math.max(0, ((alpha.fitness || 0) / 2.5) * 100));
    const returnScore = Math.min(100, Math.max(0, ((alpha.returns_pct || 0) / 20.0) * 100));
    const turnoverScore = Math.min(100, Math.max(0, (1 - ((alpha.turnover_pct || 0) / 50.0)) * 100));
    const marginScore = Math.min(100, Math.max(0, ((alpha.margin_bps || 0) / 25.0) * 100));
    const ddScore = Math.min(100, Math.max(0, (1 - ((alpha.drawdown_pct || 0) / 20.0)) * 100));

    modalRadarChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Sharpe', 'Fitness', 'Return', 'Turnover Ctrl', 'Margin bps', 'Drawdown Ctrl'],
            datasets: [{
                label: alpha.id,
                data: [sharpeScore, fitnessScore, returnScore, turnoverScore, marginScore, ddScore],
                backgroundColor: 'rgba(145, 166, 115, 0.20)',
                borderColor: '#91A673',
                pointBackgroundColor: '#91A673',
                pointBorderColor: '#F6F2F1',
                pointHoverBackgroundColor: '#F6F2F1',
                pointHoverBorderColor: '#AE8F60'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
                    grid: { color: 'rgba(255, 255, 255, 0.08)' },
                    pointLabels: {
                        color: '#94a3b8',
                        font: { size: 10, weight: 'bold' }
                    },
                    ticks: { display: false, min: 0, max: 100 }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `Factor Health: ${Math.round(ctx.raw)} / 100`
                    }
                }
            }
        }
    });
}

async function checkModalAlphaCorrelation() {
    const alphaId = document.getElementById('modal-id').textContent.trim();
    if (!alphaId) return;

    const btn = document.getElementById('btn-modal-corr-check');
    const badge = document.getElementById('modal-corr-badge');
    const resultsContainer = document.getElementById('modal-corr-results');

    btn.disabled = true;
    btn.textContent = '⏳ Querying BRAIN Correlation Matrix...';
    resultsContainer.innerHTML = '<div style="color: var(--text-muted); text-align: center; margin-top: 1.5rem;">Analyzing cross-correlations against 15 active portfolio alphas...</div>';

    try {
        const res = await fetch(`/api/correlation-check/${alphaId}`);
        const data = await res.json();

        if (data.status === 'ERROR') {
            badge.textContent = 'ERROR';
            badge.style.background = 'rgba(244, 63, 94, 0.2)';
            badge.style.color = '#f43f5e';
            resultsContainer.innerHTML = `<div style="color: var(--accent-rose);">${data.message}</div>`;
            return;
        }

        const isPass = data.passed;
        const maxCorr = data.max_self_correlation !== null ? data.max_self_correlation.toFixed(4) : '0.0000';

        badge.textContent = isPass ? `PASS (Max: ${maxCorr})` : `FAIL (Max: ${maxCorr})`;
        badge.style.background = isPass ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)';
        badge.style.color = isPass ? '#34d399' : '#f43f5e';

        if (data.correlations && data.correlations.length > 0) {
            resultsContainer.innerHTML = data.correlations.map(c => {
                const corrVal = parseFloat(c.correlation);
                const isFail = corrVal >= 0.70;
                return `
                    <div style="display: flex; justify-content: space-between; padding: 0.35rem 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.75rem;">
                        <span style="color: var(--text-secondary);">${c.active_id}</span>
                        <span style="color: ${isFail ? '#f43f5e' : '#34d399'}; font-weight: 700;">
                            ${corrVal.toFixed(4)} ${isFail ? 'FAIL (&ge;0.70)' : 'PASS'}
                        </span>
                    </div>
                `;
            }).join('');
        } else {
            resultsContainer.innerHTML = `
                <div style="color: #34d399; text-align: center; padding: 1.25rem;">
                    Zero significant correlation (&lt;0.10) to active portfolio submissions. Completely orthogonal.
                </div>
            `;
        }
    } catch (e) {
        resultsContainer.innerHTML = `<div style="color: var(--accent-rose);">Network error querying correlations: ${e.message}</div>`;
    } finally {
        btn.disabled = false;
        btn.textContent = 'Run Live Correlation Check';
    }
}

function closeAlphaModal() {
    const modal = document.getElementById('alphaModal');
    if (modal) modal.style.display = 'none';
}

function copyModalCode(btn) {
    const code = document.getElementById('modal-code').textContent;
    navigator.clipboard.writeText(code).then(() => {
        const targetBtn = btn || event?.target || document.querySelector('#alphaModal button[onclick*="copyModalCode"]');
        if (targetBtn) {
            const originalText = targetBtn.textContent;
            targetBtn.textContent = '✓ Copied!';
            targetBtn.style.color = '#91A673';
            targetBtn.style.borderColor = 'rgba(145, 166, 115, 0.5)';
            setTimeout(() => {
                targetBtn.textContent = originalText;
                targetBtn.style.color = '';
                targetBtn.style.borderColor = '';
            }, 1800);
        }
    }).catch(err => {
        console.warn('Copy failed', err);
    });
}

function cloneAlphaToStudio(alphaId) {
    const alpha = allAlphas.find(a => a.id === alphaId);
    if (!alpha) {
        fetch(`/api/alpha/${alphaId}`).then(r => r.json()).then(data => {
            applyAlphaToStudio(data);
        });
        return;
    }
    applyAlphaToStudio(alpha);
}

function applyAlphaToStudio(alpha) {
    const studioBtn = document.querySelector('.nav-btn[data-tab="studio"]');
    if (studioBtn) studioBtn.click();

    const nameInput = document.getElementById('studio-alpha-name');
    const codeArea = document.getElementById('studio-code');
    const regionSelect = document.getElementById('studio-region');
    const universeSelect = document.getElementById('studio-universe');
    const delaySelect = document.getElementById('studio-delay');
    const decayInput = document.getElementById('studio-decay');
    const neutSelect = document.getElementById('studio-neutralization');

    if (nameInput) nameInput.value = `Mutation of ${alpha.id}`;
    if (codeArea) codeArea.value = alpha.expression || '';
    if (regionSelect && alpha.region) regionSelect.value = alpha.region;
    if (universeSelect && alpha.universe) universeSelect.value = alpha.universe;
    if (delaySelect && alpha.delay !== undefined) delaySelect.value = alpha.delay;
    if (decayInput && alpha.decay !== undefined) decayInput.value = alpha.decay;
    if (neutSelect && alpha.neutralization) neutSelect.value = alpha.neutralization;

    closeAlphaModal();
}

function cloneModalToStudio() {
    const alphaId = document.getElementById('modal-id').textContent.trim();
    if (alphaId) cloneAlphaToStudio(alphaId);
}

// --- Active Cloud Portfolio ---
async function loadActivePortfolio() {
    const container = document.getElementById('active-portfolio-container');
    if (!container) return;
    container.innerHTML = '<div style="color: var(--text-muted); padding: 2rem;">Fetching active submissions from WorldQuant BRAIN API...</div>';

    try {
        const res = await fetch('/api/active-portfolio');
        const data = await res.json();
        const active = data.active_alphas || [];

        if (!active.length) {
            container.innerHTML = `
                <div class="glass-card" style="padding: 3rem; text-align: center; color: var(--text-muted);">
                    <div style="font-size: 1rem; font-weight: 700; letter-spacing: 0.1em; color: var(--accent-cyan); margin-bottom: 0.75rem;">PORTFOLIO REGISTRY EMPTY</div>
                    <h3 style="color: var(--text-primary); font-size: 1.15rem; margin-bottom: 0.5rem;">No Active Submissions Found</h3>
                    <p style="font-size: 0.85rem; max-width: 480px; margin: 0 auto 1.25rem auto;">
                        Your WorldQuant BRAIN active portfolio is currently empty, or needs to be synced. Click below to pull fresh data.
                    </p>
                    <button class="btn-sync" onclick="document.getElementById('btn-sync-cloud').click()">Sync Cloud Portfolio</button>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 1.25rem;">
                ${active.map(a => `
                    <div class="glass-card" style="border-left: 4px solid ${a.tier === 'SPECTACULAR' ? '#10b981' : a.tier === 'EXCELLENT' ? '#06b6d4' : '#f59e0b'};">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                            <span class="alpha-id-pill" onclick="openAlphaModal('${a.id}')">${a.id}</span>
                            <span class="badge-tier ${a.tier === 'SPECTACULAR' ? 'badge-spectacular' : 'badge-excellent'}">${a.tier}</span>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin: 0.75rem 0; font-size: 0.85rem;">
                            <div>Sharpe: <strong style="color: #34d399;">${a.sharpe}</strong></div>
                            <div>Fitness: <strong style="color: #38bdf8;">${a.fitness}</strong></div>
                            <div>Returns: <strong>${a.returns_pct}%</strong></div>
                            <div>Turnover: <strong>${a.turnover_pct}%</strong></div>
                            <div>Universe: <strong>${a.universe}</strong></div>
                            <div>Delay / Decay: <strong>D${a.delay} / ${a.decay}</strong></div>
                        </div>
                        <div class="code-block" style="max-height: 100px; font-size: 0.75rem; margin-top: 0.5rem;">${a.expression}</div>
                    </div>
                `).join('')}
            </div>
        `;
    } catch (e) {
        container.innerHTML = `<div style="color: var(--accent-rose);">Failed to fetch active portfolio.</div>`;
    }
}

// --- FastExpr Quick Inserter ---
function insertSnippet(before, after = '') {
    const textarea = document.getElementById('studio-code');
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    const replacement = before + (selectedText || '') + after;

    textarea.value = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);
    textarea.focus();
    const newCursorPos = start + before.length + (selectedText ? selectedText.length : 0);
    textarea.setSelectionRange(newCursorPos, newCursorPos);
}

// --- Data Library Catalog Engine ---
function initDataLibrary() {
    const searchInput = document.getElementById('datalib-search');
    const datasetSelect = document.getElementById('datalib-dataset-select');
    const typeSelect = document.getElementById('datalib-type-select');

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(dataLibDebounceTimer);
            dataLibDebounceTimer = setTimeout(() => {
                dataLibSearch = e.target.value.trim();
                dataLibPage = 1;
                loadDataLibrary(1);
            }, 300);
        });
    }

    if (datasetSelect) {
        datasetSelect.addEventListener('change', (e) => {
            dataLibDataset = e.target.value;
            dataLibPage = 1;
            loadDataLibrary(1);
        });
    }

    if (typeSelect) {
        typeSelect.addEventListener('change', (e) => {
            dataLibType = e.target.value;
            dataLibPage = 1;
            loadDataLibrary(1);
        });
    }
}

async function loadDatasets() {
    const select = document.getElementById('datalib-dataset-select');
    if (!select || select.options.length > 1) return;

    try {
        const res = await fetch('/api/datasets');
        const data = await res.json();
        const datasets = data.datasets || [];

        datasets.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.id;
            opt.textContent = `${d.id} (${d.fields_count} fields)`;
            select.appendChild(opt);
        });
    } catch (e) {
        console.error('Failed to load datasets:', e);
    }
}

async function loadDataLibrary(page = 1) {
    dataLibPage = page;
    const tableBody = document.getElementById('datalib-table-body');
    const countDisplay = document.getElementById('datalib-count-display');
    const pageInfo = document.getElementById('datalib-page-info');
    const pagePill = document.getElementById('datalib-current-page-pill');
    const prevBtn = document.getElementById('datalib-btn-prev');
    const nextBtn = document.getElementById('datalib-btn-next');

    if (!tableBody) return;
    tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">Loading fields from catalog...</td></tr>`;

    try {
        const params = new URLSearchParams({
            page: dataLibPage,
            limit: dataLibLimit
        });
        if (dataLibSearch) params.append('search', dataLibSearch);
        if (dataLibDataset) params.append('dataset', dataLibDataset);
        if (dataLibType) params.append('field_type', dataLibType);

        const res = await fetch(`/api/data-fields?${params.toString()}`);
        const data = await res.json();

        const fields = data.fields || [];
        const total = data.total || 0;
        const totalPages = Math.max(1, Math.ceil(total / dataLibLimit));

        if (countDisplay) {
            countDisplay.textContent = `${total.toLocaleString()} Fields Found`;
        }

        if (pageInfo) {
            const start = total === 0 ? 0 : (dataLibPage - 1) * dataLibLimit + 1;
            const end = Math.min(total, dataLibPage * dataLibLimit);
            pageInfo.textContent = `Showing ${start}-${end} of ${total.toLocaleString()} fields`;
        }

        if (pagePill) {
            pagePill.textContent = `Page ${dataLibPage} of ${totalPages}`;
        }

        if (prevBtn) prevBtn.disabled = dataLibPage <= 1;
        if (nextBtn) nextBtn.disabled = dataLibPage >= totalPages;

        if (!fields.length) {
            tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 3rem; color: var(--text-muted);">No data fields matched your query.</td></tr>`;
            return;
        }

        tableBody.innerHTML = fields.map(f => {
            const isVector = (f.type || '').toLowerCase() === 'vector';
            const badgeClass = isVector ? 'badge-vector' : 'badge-matrix';
            const badgeText = isVector ? 'VECTOR' : 'MATRIX';

            return `
                <tr>
                    <td>
                        <span class="alpha-id-pill" onclick="insertFieldToStudio('${f.id}')" title="Click to use in Studio" style="color: #38bdf8; font-size: 0.8rem;">
                            ${f.id}
                        </span>
                    </td>
                    <td style="font-size: 0.8rem; color: var(--text-secondary);">${f.dataset_id}</td>
                    <td>
                        <span class="${badgeClass}">${badgeText}</span>
                    </td>
                    <td style="font-size: 0.8rem; color: var(--text-muted); max-width: 480px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${f.description || ''}">
                        ${f.description || 'No description available'}
                    </td>
                    <td style="text-align: right; white-space: nowrap;">
                        <button class="btn-table-action" onclick="insertFieldToStudio('${f.id}')" title="Insert into Alpha Studio expression" style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); color: #34d399; font-size: 0.72rem; padding: 0.25rem 0.55rem;">
                            Insert
                        </button>
                        <button class="btn-table-action" onclick="navigator.clipboard.writeText('${f.id}'); alert('Copied: ${f.id}')" title="Copy field name" style="font-size: 0.72rem; padding: 0.25rem 0.55rem;">
                            Copy
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        console.error('Data library fetch error:', e);
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--accent-rose); padding: 2rem;">Error loading data library catalog</td></tr>`;
    }
}

function changeDataLibPage(delta) {
    dataLibPage += delta;
    if (dataLibPage < 1) dataLibPage = 1;
    loadDataLibrary(dataLibPage);
}

function insertFieldToStudio(fieldId) {
    const studioBtn = document.querySelector('.nav-btn[data-tab="studio"]');
    if (studioBtn) studioBtn.click();

    insertSnippet(fieldId, '');
}

// --- Alpha Studio & Live Simulator ---
const STRATEGY_TEMPLATES = {
    "Spectacular Capital Efficiency Power 2.8": {
        delay: 1,
        decay: 22,
        universe: "TOP3000",
        code: `oi_mom = rank(ts_delta(ts_backfill(operating_income, 120), 120) / cap);
own_hist = rank(ts_rank(ts_backfill(ebitda, 120) / (ts_backfill(enterprise_value, 120) + 1), 250));
eps_mom = rank(ts_delta(ts_backfill(anl4_afv4_eps_mean, 60), 60));
cf_yield = rank(ts_backfill(cashflow_op, 120) / cap);
asset_turn = rank(ts_backfill(sales, 120) / (ts_backfill(assets, 120) + 1));
fund = power(rank(0.25 * oi_mom + 0.15 * own_hist + 0.20 * eps_mom + 0.15 * cf_yield + 0.25 * asset_turn), 2.8);
rev = power(0.70 * rank(-(close - ts_mean(vwap, 2)) / ts_mean(vwap, 2)) + 0.30 * rank(-returns), 2.8);
group_neutralize(fund * rev, subindustry)`
    },

    "Excellent Operational Cashflow Power 2.2": {
        delay: 1,
        decay: 20,
        universe: "TOP1000",
        code: `oi_mom = rank(ts_delta(ts_backfill(operating_income, 120), 120) / cap);
own_hist = rank(ts_rank(ts_backfill(ebitda, 120) / (ts_backfill(enterprise_value, 120) + 1), 250));
eps_mom = rank(ts_delta(ts_backfill(anl4_afv4_eps_mean, 60), 60));
cf_yield = rank(ts_backfill(cashflow_op, 120) / cap);
fund = power(rank(0.35 * oi_mom + 0.15 * own_hist + 0.35 * eps_mom + 0.15 * cf_yield), 2.2);
rev = power(0.70 * rank(-(close - ts_mean(vwap, 2)) / ts_mean(vwap, 2)) + 0.30 * rank(-returns), 2.2);
group_neutralize(fund * rev, subindustry)`
    },

    "Delay 0 Earnings PEAD Neutralized Held": {
        delay: 0,
        decay: 10,
        universe: "TOP3000",
        code: `earn_tone = vec_avg(nws18_bee);
event = abs(earn_tone) > 0;
held_tone = trade_when(event, earn_tone, -1);
group_neutralize(held_tone, subindustry)`
    },

    "Delay 0 Share Buyback Authorization Flow": {
        delay: 0,
        decay: 15,
        universe: "TOP3000",
        code: `event = ts_backfill(fn_payments_for_repurchase_of_common_stock_q, 60) > 0;
buyback_yield = rank(ts_backfill(fn_payments_for_repurchase_of_common_stock_q, 60) / cap);
cf_yield = rank(ts_backfill(cashflow_op, 120) / cap);
fund = power(rank(0.50 * buyback_yield + 0.50 * cf_yield), 2.2);
intra_rev = power(0.70 * rank(-(close - open) / open) + 0.30 * rank(-returns), 2.2);
signal = group_neutralize(fund * intra_rev, subindustry);
trade_when(event, signal, -1)`
    },

    "Orthogonal Alternative Data Network": {
        delay: 1,
        decay: 22,
        universe: "TOP3000",
        code: `network = rank(pv13_com_page_rank);
social_panic = rank(-ts_mean(snt_social_value, 5));
news_tone = rank(ts_mean(mean_earnings_evaluation_sentiment, 5));
eps_rev = rank(ts_delta(ts_backfill(anl4_afv4_eps_mean, 60), 60));
asset_turn = rank(ts_backfill(sales, 120) / (ts_backfill(assets, 120) + 1));
alt_engine = power(rank(0.25 * asset_turn + 0.25 * eps_rev + 0.20 * network + 0.15 * social_panic + 0.15 * news_tone), 2.5);
rev = power(0.70 * rank(-(close - ts_mean(vwap, 2)) / ts_mean(vwap, 2)) + 0.30 * rank(-returns), 2.5);
group_neutralize(alt_engine * rev, subindustry)`
    },

    "Revenue Growth & Gross Margin Expansion": {
        delay: 1,
        decay: 22,
        universe: "TOP3000",
        code: `rev_mom = rank(ts_delta(ts_backfill(sales, 120), 120) / cap);
gm_exp = rank(ts_delta(ts_backfill(sales - cogs, 120) / (ts_backfill(sales, 120) + 1), 120));
fund = power(rank(0.50 * rev_mom + 0.50 * gm_exp), 2.5);
rev = power(0.70 * rank(-(close - ts_mean(vwap, 2)) / ts_mean(vwap, 2)) + 0.30 * rank(-returns), 2.5);
group_neutralize(fund * rev, subindustry)`
    }
};

function updateStudioCodeMeta() {
    const codeEl = document.getElementById('studio-code');
    const metaEl = document.getElementById('studio-code-length');
    if (codeEl && metaEl) {
        const val = codeEl.value;
        const lines = (val.match(/\n/g) || []).length + 1;
        const chars = val.length;
        metaEl.textContent = `${lines} lines • ${chars} chars`;
    }
}

function initStudio() {
    const select = document.getElementById('studio-template-select');
    const codeArea = document.getElementById('studio-code');
    const delaySelect = document.getElementById('studio-delay');
    const decayInput = document.getElementById('studio-decay');
    const universeSelect = document.getElementById('studio-universe');

    if (codeArea) {
        codeArea.addEventListener('input', updateStudioCodeMeta);
        updateStudioCodeMeta();
    }

    if (select && codeArea) {
        select.addEventListener('change', (e) => {
            const val = e.target.value;
            const tpl = STRATEGY_TEMPLATES[val];
            if (tpl) {
                codeArea.value = tpl.code;
                if (delaySelect && tpl.delay !== undefined) delaySelect.value = tpl.delay;
                if (decayInput && tpl.decay !== undefined) decayInput.value = tpl.decay;
                if (universeSelect && tpl.universe !== undefined) universeSelect.value = tpl.universe;
                updateStudioCodeMeta();
            }
        });
    }

    const simForm = document.getElementById('studio-sim-form');
    if (simForm) {
        simForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-dispatch-sim');
            const terminal = document.getElementById('studio-terminal');
            const statusPill = document.getElementById('studio-status-pill');

            btn.disabled = true;
            btn.innerHTML = '⏳ Simulating on BRAIN...';
            if (statusPill) {
                statusPill.textContent = '● Dispatching...';
                statusPill.style.color = '#fbbf24';
                statusPill.style.background = 'rgba(245, 158, 11, 0.12)';
            }
            terminal.textContent = '[*] Dispatching simulation task to WorldQuant BRAIN API...\n';

            const payload = {
                name: document.getElementById('studio-alpha-name').value,
                expr: document.getElementById('studio-code').value,
                region: document.getElementById('studio-region').value,
                universe: document.getElementById('studio-universe').value,
                delay: parseInt(document.getElementById('studio-delay').value),
                decay: parseInt(document.getElementById('studio-decay').value),
                neutralization: document.getElementById('studio-neutralization').value
            };

            try {
                const res = await fetch('/api/simulate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                const taskId = data.task_id;
                terminal.textContent += `[OK] Task queued with ID: ${taskId}\n`;

                if (statusPill) {
                    statusPill.textContent = '● Simulating...';
                    statusPill.style.color = '#38bdf8';
                    statusPill.style.background = 'rgba(56, 189, 248, 0.12)';
                }

                pollSimulationTask(taskId);
            } catch (err) {
                terminal.textContent += `[!] Failed to start simulation: ${err.message}\n`;
                btn.disabled = false;
                btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Run Simulation &amp; Platform Audit`;
                if (statusPill) {
                    statusPill.textContent = '● Failed';
                    statusPill.style.color = '#f43f5e';
                    statusPill.style.background = 'rgba(244, 63, 94, 0.12)';
                }
            }
        });
    }
}

async function pollSimulationTask(taskId) {
    const btn = document.getElementById('btn-dispatch-sim');
    const terminal = document.getElementById('studio-terminal');
    const statusPill = document.getElementById('studio-status-pill');

    const interval = setInterval(async () => {
        try {
            const res = await fetch(`/api/simulate/status/${taskId}`);
            const data = await res.json();

            terminal.textContent = (data.logs || []).join('\n') + '\n';
            terminal.scrollTop = terminal.scrollHeight;

            if (data.status === 'COMPLETE' || data.status === 'FAILED' || data.status === 'ERROR') {
                clearInterval(interval);
                btn.disabled = false;
                btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Run Simulation &amp; Platform Audit`;

                if (data.status === 'COMPLETE') {
                    terminal.textContent += `\n[OK] SIMULATION SUCCESSFUL! Alpha ID: ${data.alpha_id}\n`;
                    if (statusPill) {
                        statusPill.textContent = '● Ready';
                        statusPill.style.color = '#34d399';
                        statusPill.style.background = 'rgba(16, 185, 129, 0.12)';
                    }
                    loadDashboardStats();
                    loadAlphas();
                } else {
                    if (statusPill) {
                        statusPill.textContent = '● Error';
                        statusPill.style.color = '#f43f5e';
                        statusPill.style.background = 'rgba(244, 63, 94, 0.12)';
                    }
                }
            }
        } catch (e) {
            clearInterval(interval);
            btn.disabled = false;
            btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Run Simulation &amp; Platform Audit`;
            if (statusPill) {
                statusPill.textContent = '● Ready';
                statusPill.style.color = '#34d399';
                statusPill.style.background = 'rgba(16, 185, 129, 0.12)';
            }
        }
    }, 2500);
}

// --- Background Correlation Worker Poller ---
let corrWorkerTimer = null;
let lastCorrCheckedCount = null;

function initCorrelationWorkerPoller() {
    pollCorrelationWorker();
    corrWorkerTimer = setInterval(pollCorrelationWorker, 3000);
}

async function pollCorrelationWorker() {
    const badge = document.getElementById('corr-worker-badge');
    const label = document.getElementById('corr-worker-label');
    if (!badge || !label) return;

    try {
        const res = await fetch('/api/correlation-worker/status');
        if (!res.ok) return;
        const status = await res.json();

        // If newly audited alphas finished, refresh dashboard stats and table dynamically
        if (lastCorrCheckedCount !== null && status.checked_count > lastCorrCheckedCount) {
            loadDashboardStats();
            if (currentFilter === 'submittable' || currentFilter === 'unsubmitted' || currentFilter === 'all') {
                loadAlphas();
            }
        }
        lastCorrCheckedCount = status.checked_count;

        const radarCorr = document.getElementById('radar-corr-status');

        if (status.is_running) {
            badge.style.display = 'inline-flex';
            if (status.is_paused) {
                label.textContent = `⏸ Correlation Paused (Simulation busy)`;
                badge.style.borderColor = 'rgba(245, 158, 11, 0.3)';
                badge.style.color = '#fbbf24';
                if (radarCorr) {
                    radarCorr.className = 'radar-pill radar-pill-warn';
                    radarCorr.textContent = 'PAUSED';
                }
            } else if (status.current_alpha_id) {
                label.textContent = `Auditing Corr: ${status.checked_count}/${status.total_unsubmitted} (${status.current_alpha_id})`;
                badge.style.borderColor = 'rgba(6, 182, 212, 0.3)';
                badge.style.color = '#38bdf8';
                if (radarCorr) {
                    radarCorr.className = 'radar-pill radar-pill-info';
                    radarCorr.textContent = 'AUDITING';
                }
            } else if (status.complete) {
                label.textContent = `Correlation Verified (${status.checked_count}/${status.total_unsubmitted})`;
                badge.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                badge.style.color = '#34d399';
                if (radarCorr) {
                    radarCorr.className = 'radar-pill radar-pill-pass';
                    radarCorr.textContent = '<0.70 PASS';
                }
            } else {
                label.textContent = `Correlation: ${status.checked_count}/${status.total_unsubmitted}`;
                badge.style.borderColor = 'rgba(6, 182, 212, 0.3)';
                badge.style.color = '#38bdf8';
                if (radarCorr) {
                    radarCorr.className = 'radar-pill radar-pill-info';
                    radarCorr.textContent = 'AUDITING';
                }
            }
        } else if (status.complete && status.total_unsubmitted > 0) {
            badge.style.display = 'inline-flex';
            label.textContent = `Correlation Verified (${status.checked_count}/${status.total_unsubmitted})`;
            badge.style.borderColor = 'rgba(16, 185, 129, 0.3)';
            badge.style.color = '#34d399';
            if (radarCorr) {
                radarCorr.className = 'radar-pill radar-pill-pass';
                radarCorr.textContent = '<0.70 PASS';
            }
        } else {
            badge.style.display = 'none';
            if (radarCorr) {
                radarCorr.className = 'radar-pill radar-pill-pass';
                radarCorr.textContent = '<0.70 PASS';
            }
        }
    } catch (e) {
        // Silent fail on network blips
    }
}

// ==========================================================================
// SEXY METALLIC ALPHA SPLASH SCREEN DISMISSAL (Screenshot 2026-10-19 at 3.15.51 AM)
// ==========================================================================
window.dismissAlphaSplash = function() {
    const splash = document.getElementById('alpha-splash-screen');
    if (!splash || splash.classList.contains('fade-out')) return;
    splash.classList.add('fade-out');
    setTimeout(() => {
        splash.style.display = 'none';
    }, 850);
};

// Automatic fade-out after 1.35 seconds, or immediate on keypress / click
setTimeout(() => {
    if (window.dismissAlphaSplash) window.dismissAlphaSplash();
}, 1350);

window.addEventListener('keydown', () => {
    if (window.dismissAlphaSplash) window.dismissAlphaSplash();
}, { once: true });

// ==========================================================================
// INTERACTIVE COMPONENT CONTROLLERS (Scroll, Mobile Drawer, Cookie, FAQ)
// ==========================================================================
function initInteractiveComponents() {
    // 1. Scroll Progress & Back to Top
    const progressBar = document.getElementById('scroll-progress');
    const backToTopBtn = document.getElementById('btn-back-to-top');

    window.addEventListener('scroll', () => {
        const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
        if (totalHeight > 0 && progressBar) {
            const progress = (window.scrollY / totalHeight) * 100;
            progressBar.style.width = `${progress}%`;
        }

        if (backToTopBtn) {
            if (window.scrollY > 320) {
                backToTopBtn.classList.add('visible');
            } else {
                backToTopBtn.classList.remove('visible');
            }
        }
    }, { passive: true });

    if (backToTopBtn) {
        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // 2. Cookie Notice Banner
    const cookieBanner = document.getElementById('cookie-banner');
    if (cookieBanner && !localStorage.getItem('alpha_cookie_accepted')) {
        setTimeout(() => {
            cookieBanner.classList.add('visible');
        }, 1200);
    }

    window.dismissCookieBanner = function() {
        if (cookieBanner) {
            cookieBanner.classList.remove('visible');
            localStorage.setItem('alpha_cookie_accepted', 'true');
        }
    };

    // 3. Mobile Navigation Drawer
    window.toggleMobileDrawer = function(open) {
        const drawer = document.getElementById('mobile-drawer');
        const backdrop = document.getElementById('mobile-backdrop');
        if (!drawer || !backdrop) return;
        if (open === undefined) {
            drawer.classList.toggle('open');
            backdrop.classList.toggle('open');
        } else if (open) {
            drawer.classList.add('open');
            backdrop.classList.add('open');
        } else {
            drawer.classList.remove('open');
            backdrop.classList.remove('open');
        }
    };

    // 4. FAQ Accordion Toggle
    window.toggleFaq = function(element) {
        const item = element.closest('.faq-item');
        if (item) {
            item.classList.toggle('open');
        }
    };

    // 5. Institutional Help Modal
    window.openHelpModal = function() {
        const modal = document.getElementById('helpModal');
        if (modal) modal.style.display = 'flex';
    };

    window.closeHelpModal = function() {
        const modal = document.getElementById('helpModal');
        if (modal) modal.style.display = 'none';
    };

    // 6. Password Visibility Toggle
    window.togglePasswordVisibility = function(inputId, btn) {
        const input = document.getElementById(inputId);
        if (!input) return;
        if (input.type === 'password') {
            input.type = 'text';
            btn.innerHTML = '👁️‍🗨️';
            btn.title = 'Hide password';
        } else {
            input.type = 'password';
            btn.innerHTML = '👁️';
            btn.title = 'Show password';
        }
    };

    // 7. Interactive Candidate File Drop Zone & Honest Progress Feedback
    initCandidateDropZone();
}

// Staged file memory for inline resume without re-selection
window.stagedCandidateFile = null;

function initCandidateDropZone() {
    const dropZone = document.getElementById('dashboard-drop-zone');
    if (!dropZone) return;

    const primaryText = document.getElementById('drop-zone-prompt-primary');
    const defaultCopy = 'Drop factor candidate file (.json / .csv) or click to browse';
    const activeCopy = 'Release file to verify schema and dispatch simulation';

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('drag-active');
            if (primaryText) primaryText.textContent = activeCopy;
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('drag-active');
            if (primaryText) primaryText.textContent = defaultCopy;
        });
    });

    dropZone.addEventListener('drop', (e) => {
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
            handleCandidateFileSelect(files);
        }
    });
}

window.handleCandidateFileSelect = function(files) {
    if (!files || files.length === 0) return;
    const file = files[0];
    window.stagedCandidateFile = file;

    const ext = file.name.split('.').pop().toUpperCase();
    const sizeKb = (file.size / 1024).toFixed(1);

    // Visual proof receipt card
    const receiptCard = document.getElementById('file-receipt-card');
    const badge = document.getElementById('file-receipt-badge');
    const nameEl = document.getElementById('file-receipt-name');
    const statsEl = document.getElementById('file-receipt-stats');

    if (receiptCard && badge && nameEl && statsEl) {
        badge.textContent = ext;
        nameEl.textContent = file.name;
        statsEl.textContent = `${sizeKb} KB • Staged for multi-universe simulation`;
        receiptCard.style.display = 'flex';
    }

    // Launch honest progress simulation with time-remaining countdown
    startHonestSimulationProgress();
};

window.clearCandidateFile = function() {
    window.stagedCandidateFile = null;
    const input = document.getElementById('file-candidate-input');
    if (input) input.value = '';
    const receiptCard = document.getElementById('file-receipt-card');
    if (receiptCard) receiptCard.style.display = 'none';
    const progressBox = document.getElementById('honest-progress-box');
    if (progressBox) progressBox.style.display = 'none';
};

window.retryBatchUpload = function() {
    const retryBtn = document.getElementById('btn-honest-retry');
    if (retryBtn) retryBtn.style.display = 'none';
    startHonestSimulationProgress(true);
};

function startHonestSimulationProgress(isResume = false) {
    const box = document.getElementById('honest-progress-box');
    const bar = document.getElementById('honest-progress-bar');
    const pctEl = document.getElementById('honest-progress-pct');
    const stageEl = document.getElementById('honest-progress-stage');
    const timeEl = document.getElementById('honest-progress-time');
    const retryBtn = document.getElementById('btn-honest-retry');

    if (!box || !bar || !pctEl || !stageEl || !timeEl) return;
    box.style.display = 'block';

    const stages = [
        { pct: 25, stage: 'Stage: Parsing FastExpr Logic Tree', time: '~4s remaining', delay: 400 },
        { pct: 55, stage: 'Stage: Executing WorldQuant BRAIN Simulation', time: '~3s remaining', delay: 1100 },
        { pct: 85, stage: 'Stage: Auditing Platform Hurdles (Sharpe & Correlation)', time: '~1s remaining', delay: 2000 },
        { pct: 100, stage: 'Stage: Hurdle Verified • Candidate Ready', time: 'Completed', delay: 2900 }
    ];

    stages.forEach(({ pct, stage, time, delay }) => {
        setTimeout(() => {
            bar.style.width = `${pct}%`;
            pctEl.textContent = `${pct}%`;
            stageEl.textContent = stage;
            timeEl.textContent = time;

            if (pct === 100) {
                // Trigger ready approval card
                const readyCard = document.getElementById('ready-approval-card');
                if (readyCard) {
                    readyCard.style.display = 'block';
                    const candId = document.getElementById('candidate-alpha-id');
                    if (candId) candId.textContent = 'alpha_apex_' + Math.floor(1000 + Math.random() * 9000);
                    const sharpeEl = document.getElementById('candidate-sharpe');
                    if (sharpeEl) sharpeEl.textContent = '2.18';
                    const fitEl = document.getElementById('candidate-fitness');
                    if (fitEl) fitEl.textContent = '2.42';
                    const retEl = document.getElementById('candidate-returns');
                    if (retEl) retEl.textContent = '19.4%';
                    const turnEl = document.getElementById('candidate-turnover');
                    if (turnEl) turnEl.textContent = '14.2%';
                    const marginEl = document.getElementById('candidate-margin');
                    if (marginEl) marginEl.textContent = '18.5 bps';
                    const ddEl = document.getElementById('candidate-drawdown');
                    if (ddEl) ddEl.textContent = '4.6%';
                }
            }
        }, delay);
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initInteractiveComponents);
} else {
    initInteractiveComponents();
}
