/**
 * ====================================================================
 * DASHBOARD CONTROLLER - MUNICIPALITY OF SI SATCHANALAI
 * High-performance, reactive data visualization & analytical engine
 * ====================================================================
 */

(function () {
  'use strict';

  // Application State
  const state = {
    data: null,
    currentYear: 'compare', // 'compare' | '2569' | '2568'
    currentTab: 'tab-overview',
    searchQuery: '',
    vendorSearchQuery: '',
    mapYearFilter: 'all',
    filters: {
      year: 'all',
      type: 'all',
      method: 'all',
      category: 'all',
      tier: 'all'
    },
    sort: {
      column: 'agree',
      order: 'desc'
    },
    pagination: {
      page: 1,
      pageSize: 25
    },
    charts: {},
    map: null,
    mapMarkers: [],
    theme: localStorage.getItem('sisa_theme') || 'dark'
  };

  // Currency & Number Formatter Helpers
  const fmt = {
    money: (n) => {
      if (n === null || n === undefined || isNaN(n)) return '฿0.00';
      return '฿' + Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },
    shortMoney: (n) => {
      if (!n) return '฿0';
      if (Math.abs(n) >= 1000000) {
        return '฿' + (n / 1000000).toFixed(2) + 'M';
      }
      if (Math.abs(n) >= 1000) {
        return '฿' + (n / 1000).toFixed(1) + 'k';
      }
      return '฿' + n.toLocaleString();
    },
    num: (n) => Number(n || 0).toLocaleString('th-TH'),
    pct: (n) => (n > 0 ? '+' : '') + Number(n || 0).toFixed(2) + '%'
  };

  // Toast Notification
  function showToast(message) {
    const toast = document.getElementById('toastNotification');
    const msgEl = document.getElementById('toastMessage');
    if (!toast || !msgEl) return;
    msgEl.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3200);
  }

  // Theme Initializer & Toggle
  function initTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        state.theme = state.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', state.theme);
        localStorage.setItem('sisa_theme', state.theme);
        updateChartThemes();
        updateCharts();
        showToast(state.theme === 'dark' ? 'เปลี่ยนเป็นธีมกลางคืน (Dark Mode)' : 'เปลี่ยนเป็นธีมกลางวัน (Light Mode)');
      });
    }
  }

  // Get current dataset based on year filter
  function getCurrentProjects() {
    if (!state.data) return [];
    if (state.currentYear === '2568') return state.data.projects68;
    if (state.currentYear === '2569') return state.data.projects69;
    return [...state.data.projects69, ...state.data.projects68];
  }

  // Init Data
  async function loadData() {
    try {
      if (window.DASHBOARD_DATA) {
        state.data = window.DASHBOARD_DATA;
      } else {
        const res = await fetch('dashboard_data.json');
        state.data = await res.json();
      }
      onDataReady();
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      showToast('ไม่สามารถโหลดข้อมูลได้: ' + err.message);
    }
  }

  function onDataReady() {
    updateOverviewStats();
    initCharts();
    initTop5Table();
    initMap();
    renderVendorsLeaderboard();
    renderProjectsTable();
    bindEvents();
  }

  // ================= EVENT BINDINGS =================
  function bindEvents() {
    // Year switcher buttons
    const yearButtons = document.querySelectorAll('.fy-btn');
    yearButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        yearButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.currentYear = btn.dataset.year;
        
        // sync project explorer year filter if matching
        const filterYearSel = document.getElementById('filterYearSelect');
        if (filterYearSel) {
          if (state.currentYear === '2568' || state.currentYear === '2569') {
            filterYearSel.value = state.currentYear;
            state.filters.year = state.currentYear;
          } else {
            filterYearSel.value = 'all';
            state.filters.year = 'all';
          }
        }

        updateOverviewStats();
        updateCharts();
        initTop5Table();
        renderProjectsTable();
      });
    });

    // Navigation Tabs
    const navTabs = document.querySelectorAll('.nav-tab');
    navTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetId = tab.dataset.tab;
        navTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        const activePane = document.getElementById(targetId);
        if (activePane) activePane.classList.add('active');

        state.currentTab = targetId;
        if (targetId === 'tab-map' && state.map) {
          setTimeout(() => {
            state.map.invalidateSize();
            const allGeo = [...state.data.projects69, ...state.data.projects68].filter(p => p.lat && p.lon);
            if (allGeo.length > 0) {
              const bounds = L.latLngBounds(allGeo.map(p => [p.lat, p.lon]));
              state.map.fitBounds(bounds, { padding: [50, 50] });
            }
          }, 150);
        }
      });
    });

    // Toggle category sort button
    const btnToggleCatSort = document.getElementById('btnToggleCatSort');
    if (btnToggleCatSort) {
      btnToggleCatSort.addEventListener('click', () => {
        state.catSortAsc = !state.catSortAsc;
        updateCategoryChart();
        showToast(state.catSortAsc ? 'เรียงตามมูลค่า: น้อยไปมาก' : 'เรียงตามมูลค่า: มากไปน้อย');
      });
    }

    // Go to projects button from Top 5
    const btnGoProjects = document.getElementById('btnGoToProjectsTab');
    if (btnGoProjects) {
      btnGoProjects.addEventListener('click', () => {
        const projectsTabBtn = document.getElementById('tabProjectsBtn');
        if (projectsTabBtn) projectsTabBtn.click();
      });
    }

    // Modal Close
    const modalBackdrop = document.getElementById('projectModalBackdrop');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    if (modalCloseBtn && modalBackdrop) {
      modalCloseBtn.addEventListener('click', () => modalBackdrop.classList.remove('open'));
      modalBackdrop.addEventListener('click', (e) => {
        if (e.target === modalBackdrop) modalBackdrop.classList.remove('open');
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalBackdrop.classList.contains('open')) {
          modalBackdrop.classList.remove('open');
        }
      });
    }

    // Print Report
    const printBtn = document.getElementById('printReportBtn');
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        window.print();
      });
    }

    // Export All / Filtered CSV
    const exportCsvBtn = document.getElementById('exportAllCsvBtn');
    if (exportCsvBtn) {
      exportCsvBtn.addEventListener('click', () => {
        exportFilteredProjectsCsv();
      });
    }

    // Projects Search & Filters
    const searchInput = document.getElementById('projectSearchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.trim().toLowerCase();
        if (clearSearchBtn) clearSearchBtn.style.display = state.searchQuery ? 'block' : 'none';
        state.pagination.page = 1;
        renderProjectsTable();
      });
    }
    if (clearSearchBtn && searchInput) {
      clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        state.searchQuery = '';
        clearSearchBtn.style.display = 'none';
        state.pagination.page = 1;
        renderProjectsTable();
      });
    }

    // Filter Dropdowns
    const bindFilterSelect = (id, key) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', (e) => {
          state.filters[key] = e.target.value;
          state.pagination.page = 1;
          renderProjectsTable();
        });
      }
    };
    bindFilterSelect('filterYearSelect', 'year');
    bindFilterSelect('filterTypeSelect', 'type');
    bindFilterSelect('filterMethodSelect', 'method');
    bindFilterSelect('filterCatSelect', 'category');
    bindFilterSelect('filterTierSelect', 'tier');

    // Reset Filters
    const resetBtn = document.getElementById('btnResetFilters');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        document.getElementById('filterYearSelect').value = 'all';
        document.getElementById('filterTypeSelect').value = 'all';
        document.getElementById('filterMethodSelect').value = 'all';
        document.getElementById('filterCatSelect').value = 'all';
        document.getElementById('filterTierSelect').value = 'all';
        if (searchInput) searchInput.value = '';
        state.searchQuery = '';
        if (clearSearchBtn) clearSearchBtn.style.display = 'none';
        state.filters = { year: 'all', type: 'all', method: 'all', category: 'all', tier: 'all' };
        state.pagination.page = 1;
        renderProjectsTable();
        showToast('ล้างตัวกรองทั้งหมดเรียบร้อยแล้ว');
      });
    }

    // Page Size
    const pageSizeSelect = document.getElementById('pageSizeSelect');
    if (pageSizeSelect) {
      pageSizeSelect.addEventListener('change', (e) => {
        state.pagination.pageSize = parseInt(e.target.value, 10);
        state.pagination.page = 1;
        renderProjectsTable();
      });
    }

    // Sortable Table Headers
    const sortHeaders = document.querySelectorAll('#projectsTable th.sortable');
    sortHeaders.forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.sort;
        if (state.sort.column === col) {
          state.sort.order = state.sort.order === 'asc' ? 'desc' : 'asc';
        } else {
          state.sort.column = col;
          state.sort.order = 'desc';
        }
        sortHeaders.forEach(h => h.classList.remove('active'));
        th.classList.add('active');
        renderProjectsTable();
      });
    });

    // Vendor Search
    const vendorSearchInput = document.getElementById('vendorSearchInput');
    if (vendorSearchInput) {
      vendorSearchInput.addEventListener('input', (e) => {
        state.vendorSearchQuery = e.target.value.trim().toLowerCase();
        renderVendorsLeaderboard();
      });
    }

    // Map Year Filter
    const mapYearBtns = document.querySelectorAll('#mapYearFilter .pill-btn');
    mapYearBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        mapYearBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.mapYearFilter = btn.dataset.mapYear;
        updateMapMarkers();
      });
    });
  }

  // ================= OVERVIEW STATS & KPIS =================
  function updateOverviewStats() {
    const s = state.data.summary;
    const y68 = s.y68;
    const y69 = s.y69;
    const comb = s.combined;
    const ins = s.insights;

    const bannerTitle = document.getElementById('bannerTitle');
    const bannerDesc = document.getElementById('bannerDesc');
    const bannerHighlights = document.getElementById('bannerHighlights');

    const kpiBudgetVal = document.getElementById('kpiBudgetVal');
    const kpiBudgetSub = document.getElementById('kpiBudgetSub');
    const kpiBudgetBadge = document.getElementById('kpiBudgetBadge');

    const kpiAgreeVal = document.getElementById('kpiAgreeVal');
    const kpiAgreeSub = document.getElementById('kpiAgreeSub');
    const kpiAgreeBadge = document.getElementById('kpiAgreeBadge');

    const kpiSavingsVal = document.getElementById('kpiSavingsVal');
    const kpiSavingsSub = document.getElementById('kpiSavingsSub');
    const kpiSavingsBadge = document.getElementById('kpiSavingsBadge');

    const kpiCountVal = document.getElementById('kpiCountVal');
    const kpiCountSub = document.getElementById('kpiCountSub');
    const kpiCountBadge = document.getElementById('kpiCountBadge');

    const kpiAvgVal = document.getElementById('kpiAvgVal');
    const kpiAvgSub = document.getElementById('kpiAvgSub');
    const kpiAvgBadge = document.getElementById('kpiAvgBadge');

    const kpiEbiddingVal = document.getElementById('kpiEbiddingVal');
    const kpiEbiddingSub = document.getElementById('kpiEbiddingSub');
    const kpiEbiddingBadge = document.getElementById('kpiEbiddingBadge');

    if (state.currentYear === 'compare') {
      bannerTitle.textContent = 'สรุปเปรียบเทียบภาพรวมงบประมาณ ปี 2568 และ ปี 2569';
      bannerDesc.innerHTML = `เทศบาลเมืองศรีสัชนาลัยมีงบประมาณจัดซื้อจัดจ้างรวม 2 ปี เป็นเงิน <strong>${fmt.money(comb.total_budget)}</strong> โดยปี 2569 มีการขยายตัวของงบประมาณเพิ่มขึ้นถึง <strong>+${ins.growth.budget_pct}%</strong> เพื่อรองรับงานก่อสร้างและพัฒนาถนนสายหลักในพื้นที่`;
      bannerHighlights.innerHTML = `
        <div class="banner-stat">
          <span class="bs-label">การเติบโตของงบประมาณ</span>
          <span class="bs-value positive">+${ins.growth.budget_pct}%</span>
        </div>
        <div class="banner-stat">
          <span class="bs-label">ประหยัดงบได้รวม</span>
          <span class="bs-value highlight">${fmt.shortMoney(comb.total_savings)}</span>
        </div>
      `;

      kpiBudgetVal.textContent = fmt.money(comb.total_budget);
      kpiBudgetSub.textContent = `ปี 68: ${fmt.shortMoney(y68.total_budget)} ➔ ปี 69: ${fmt.shortMoney(y69.total_budget)}`;
      kpiBudgetBadge.textContent = `+${ins.growth.budget_pct}% YoY`;

      kpiAgreeVal.textContent = fmt.money(comb.total_price_agree);
      kpiAgreeSub.textContent = `รวมทั้งสิ้น ${fmt.num(comb.total_count)} โครงการ`;
      kpiAgreeBadge.textContent = `+${ins.growth.agree_pct}% YoY`;

      kpiSavingsVal.textContent = fmt.money(comb.total_savings);
      kpiSavingsSub.textContent = `ปี 68: ฿1.41M (5.57%) | ปี 69: ฿1.05M (2.65%)`;
      kpiSavingsBadge.textContent = 'ประหยัดรวม 3.78%';

      kpiCountVal.textContent = `${fmt.num(comb.total_count)} โครงการ`;
      kpiCountSub.textContent = `ปี 68: 521 โครงการ ➔ ปี 69: 644 โครงการ`;
      kpiCountBadge.textContent = `+${ins.growth.count_delta} โครงการ (+${ins.growth.count_pct}%)`;

      kpiAvgVal.textContent = fmt.money((comb.total_price_agree / comb.total_count));
      kpiAvgSub.textContent = `ปี 68: ฿45.8k ➔ ปี 69: ฿60.2k`;
      kpiAvgBadge.textContent = `+${ins.growth.avg_price_pct}% เฉลี่ยต่อสัญญา`;

      kpiEbiddingVal.textContent = `${(y69.method_stats['ประกวดราคาอิเล็กทรอนิกส์ (e-bidding)'].agree / y69.total_price_agree * 100).toFixed(1)}%`;
      kpiEbiddingSub.textContent = `e-Bidding รวม 2 ปี: ฿33.01M (17 โครงการ)`;
      kpiEbiddingBadge.textContent = 'กฎพาเรโต 80/20';
    } 
    else if (state.currentYear === '2569') {
      bannerTitle.textContent = 'ภาพรวมการใช้งบประมาณ ปีงบประมาณ 2569 (Fiscal Year 2569)';
      bannerDesc.innerHTML = `ปีงบประมาณ 2569 มีการจัดซื้อจัดจ้างรวม <strong>${fmt.num(y69.total_count)} โครงการ</strong> วงเงินสัญญา <strong>${fmt.money(y69.total_price_agree)}</strong> เน้นการปรับปรุงผิวจราจรแอสฟัลท์ติกคอนกรีตขนาดใหญ่ และโครงการจัดส่งอาหารเสริมนมโรงเรียน`;
      bannerHighlights.innerHTML = `
        <div class="banner-stat">
          <span class="bs-label">งบประมาณตั้งไว้</span>
          <span class="bs-value highlight">${fmt.shortMoney(y69.total_budget)}</span>
        </div>
        <div class="banner-stat">
          <span class="bs-label">ประหยัดงบได้</span>
          <span class="bs-value positive">${fmt.money(y69.total_savings)}</span>
        </div>
      `;

      kpiBudgetVal.textContent = fmt.money(y69.total_budget);
      kpiBudgetSub.textContent = `ราคากลางรวม: ${fmt.money(y69.total_price_build)}`;
      kpiBudgetBadge.textContent = 'ปีงบฯ 2569';

      kpiAgreeVal.textContent = fmt.money(y69.total_price_agree);
      kpiAgreeSub.textContent = `สัดส่วนเบิกจ่ายสัญญา: 97.35% ของงบฯ`;
      kpiAgreeBadge.textContent = '644 สัญญา';

      kpiSavingsVal.textContent = fmt.money(y69.total_savings);
      kpiSavingsSub.textContent = `ประหยัดได้ 2.65% จากงบประมาณที่ตั้งไว้`;
      kpiSavingsBadge.textContent = '2.65% ประหยัด';

      kpiCountVal.textContent = `${fmt.num(y69.total_count)} โครงการ`;
      kpiCountSub.textContent = `ซื้อ 389 | จ้างเหมา 243 | ก่อสร้าง 7 | เช่า 5`;
      kpiCountBadge.textContent = '100% ดำเนินการ';

      kpiAvgVal.textContent = fmt.money(y69.avg_project_price);
      kpiAvgSub.textContent = `มูลค่าสัญญาเฉลี่ยต่อโครงการ`;
      kpiAvgBadge.textContent = '฿60,171 ต่อสัญญา';

      const eb69 = y69.method_stats['ประกวดราคาอิเล็กทรอนิกส์ (e-bidding)'];
      kpiEbiddingVal.textContent = `${((eb69.agree / y69.total_price_agree) * 100).toFixed(1)}%`;
      kpiEbiddingSub.textContent = `7 โครงการ e-Bidding มูลค่า ฿20.02M`;
      kpiEbiddingBadge.textContent = 'e-Bidding';
    } 
    else if (state.currentYear === '2568') {
      bannerTitle.textContent = 'ภาพรวมการใช้งบประมาณ ปีงบประมาณ 2568 (Fiscal Year 2568)';
      bannerDesc.innerHTML = `ปีงบประมาณ 2568 มีการจัดซื้อจัดจ้างรวม <strong>${fmt.num(y68.total_count)} โครงการ</strong> วงเงินสัญญา <strong>${fmt.money(y68.total_price_agree)}</strong> มีการแข่งขันราคาที่มีประสิทธิภาพ ประหยัดงบประมาณได้ถึง <strong>5.57%</strong>`;
      bannerHighlights.innerHTML = `
        <div class="banner-stat">
          <span class="bs-label">งบประมาณตั้งไว้</span>
          <span class="bs-value highlight">${fmt.shortMoney(y68.total_budget)}</span>
        </div>
        <div class="banner-stat">
          <span class="bs-label">ประหยัดงบได้</span>
          <span class="bs-value positive">${fmt.money(y68.total_savings)} (5.57%)</span>
        </div>
      `;

      kpiBudgetVal.textContent = fmt.money(y68.total_budget);
      kpiBudgetSub.textContent = `ราคากลางรวม: ${fmt.money(y68.total_price_build)}`;
      kpiBudgetBadge.textContent = 'ปีงบฯ 2568';

      kpiAgreeVal.textContent = fmt.money(y68.total_price_agree);
      kpiAgreeSub.textContent = `สัดส่วนเบิกจ่ายสัญญา: 94.43% ของงบฯ`;
      kpiAgreeBadge.textContent = '521 สัญญา';

      kpiSavingsVal.textContent = fmt.money(y68.total_savings);
      kpiSavingsSub.textContent = `ประหยัดได้ 5.57% จากการแข่งขันเสนอราคา`;
      kpiSavingsBadge.textContent = '5.57% ประหยัด';

      kpiCountVal.textContent = `${fmt.num(y68.total_count)} โครงการ`;
      kpiCountSub.textContent = `ซื้อ 272 | จ้างเหมา 231 | ก่อสร้าง 10 | เช่า 8`;
      kpiCountBadge.textContent = '100% ดำเนินการ';

      kpiAvgVal.textContent = fmt.money(y68.avg_project_price);
      kpiAvgSub.textContent = `มูลค่าสัญญาเฉลี่ยต่อโครงการ`;
      kpiAvgBadge.textContent = '฿45,844 ต่อสัญญา';

      const eb68 = y68.method_stats['ประกวดราคาอิเล็กทรอนิกส์ (e-bidding)'];
      kpiEbiddingVal.textContent = `${((eb68.agree / y68.total_price_agree) * 100).toFixed(1)}%`;
      kpiEbiddingSub.textContent = `10 โครงการ e-Bidding มูลค่า ฿12.99M`;
      kpiEbiddingBadge.textContent = 'e-Bidding';
    }
  }

  // ================= CHARTS WITH CHART.JS =================
  function getThemeColors() {
    const isDark = state.theme === 'dark';
    return {
      textColor: isDark ? '#f8fafc' : '#0f172a',
      mutedColor: isDark ? '#94a3b8' : '#334155',
      gridColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0',
      cardBg: isDark ? '#111827' : '#ffffff'
    };
  }

  function initCharts() {
    initCategoryChart();
    initMethodChart();
    initTimelineChart();
    initTypeChart();
    initTierChart();
  }

  function updateChartThemes() {
    const colors = getThemeColors();
    Object.values(state.charts).forEach(chart => {
      if (!chart) return;
      if (chart.options.scales) {
        if (chart.options.scales.x) {
          if (chart.options.scales.x.ticks) chart.options.scales.x.ticks.color = colors.mutedColor;
          if (chart.options.scales.x.grid) chart.options.scales.x.grid.color = colors.gridColor;
        }
        if (chart.options.scales.y) {
          if (chart.options.scales.y.ticks) chart.options.scales.y.ticks.color = colors.mutedColor;
          if (chart.options.scales.y.grid) chart.options.scales.y.grid.color = colors.gridColor;
        }
      }
      if (chart.options.plugins && chart.options.plugins.legend) {
        chart.options.plugins.legend.labels.color = colors.textColor;
      }
      chart.update();
    });
  }

  function updateCharts() {
    updateCategoryChart();
    updateMethodChart();
    updateTimelineChart();
    updateTypeChart();
    updateTierChart();
  }

  // 1. Category Chart
  function initCategoryChart() {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;
    const colors = getThemeColors();

    state.charts.category = new Chart(ctx, {
      type: 'bar',
      data: { labels: [], datasets: [] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { color: colors.textColor, font: { family: 'Prompt', size: 12 } }
          },
          tooltip: {
            backgroundColor: '#0f172a',
            titleColor: '#38bdf8',
            bodyColor: '#ffffff',
            borderColor: 'rgba(255,255,255,0.15)',
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${fmt.money(ctx.parsed.y)}`
            }
          }
        },
        scales: {
          x: {
            ticks: { color: colors.mutedColor, font: { family: 'Prompt', size: 11 }, maxRotation: 30 },
            grid: { color: colors.gridColor }
          },
          y: {
            ticks: {
              color: colors.mutedColor,
              font: { family: 'Plus Jakarta Sans', size: 11 },
              callback: (v) => fmt.shortMoney(v)
            },
            grid: { color: colors.gridColor }
          }
        }
      }
    });

    updateCategoryChart();
  }

  function updateCategoryChart() {
    if (!state.charts.category) return;
    const s = state.data.summary;
    const isDark = state.theme === 'dark';

    if (state.currentYear === 'compare') {
      const allCats = new Set([...Object.keys(s.y68.cat_stats), ...Object.keys(s.y69.cat_stats)]);
      let labels = Array.from(allCats);
      if (state.catSortAsc) {
        labels.sort((a, b) => ((s.y68.cat_stats[a]?.agree || 0) + (s.y69.cat_stats[a]?.agree || 0)) - ((s.y68.cat_stats[b]?.agree || 0) + (s.y69.cat_stats[b]?.agree || 0)));
      } else {
        labels.sort((a, b) => ((s.y68.cat_stats[b]?.agree || 0) + (s.y69.cat_stats[b]?.agree || 0)) - ((s.y68.cat_stats[a]?.agree || 0) + (s.y69.cat_stats[a]?.agree || 0)));
      }
      const data68 = labels.map(c => s.y68.cat_stats[c]?.agree || 0);
      const data69 = labels.map(c => s.y69.cat_stats[c]?.agree || 0);

      state.charts.category.data.labels = labels;
      state.charts.category.data.datasets = [
        {
          label: 'ปีงบฯ 2568 (วงเงินสัญญา)',
          data: data68,
          backgroundColor: isDark ? '#6366f1' : '#4f46e5',
          borderRadius: 6
        },
        {
          label: 'ปีงบฯ 2569 (วงเงินสัญญา)',
          data: data69,
          backgroundColor: isDark ? '#0ea5e9' : '#0284c7',
          borderRadius: 6
        }
      ];
    } else {
      const yearObj = state.currentYear === '2569' ? s.y69 : s.y68;
      let sortedCats = Object.entries(yearObj.cat_stats);
      if (state.catSortAsc) {
        sortedCats.sort((a, b) => a[1].agree - b[1].agree);
      } else {
        sortedCats.sort((a, b) => b[1].agree - a[1].agree);
      }
      const labels = sortedCats.map(x => x[0]);
      const budgets = sortedCats.map(x => x[1].budget);
      const agrees = sortedCats.map(x => x[1].agree);

      state.charts.category.data.labels = labels;
      state.charts.category.data.datasets = [
        {
          label: 'งบประมาณตั้งไว้ (Budget)',
          data: budgets,
          backgroundColor: isDark ? 'rgba(148, 163, 184, 0.4)' : '#cbd5e1',
          borderColor: isDark ? 'transparent' : '#94a3b8',
          borderWidth: isDark ? 0 : 1,
          borderRadius: 6
        },
        {
          label: 'วงเงินสัญญา (Contract Agree)',
          data: agrees,
          backgroundColor: state.currentYear === '2569' 
            ? (isDark ? '#0ea5e9' : '#0284c7') 
            : (isDark ? '#6366f1' : '#4f46e5'),
          borderRadius: 6
        }
      ];
    }
    state.charts.category.update();
  }

  // 2. Method Chart (Donut)
  function initMethodChart() {
    const ctx = document.getElementById('methodChart');
    if (!ctx) return;
    const colors = getThemeColors();

    state.charts.method = new Chart(ctx, {
      type: 'doughnut',
      data: { labels: [], datasets: [] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: colors.textColor, font: { family: 'Prompt', size: 11 }, boxWidth: 12 }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: ${fmt.money(ctx.parsed)}`
            }
          }
        }
      }
    });

    updateMethodChart();
  }

  function updateMethodChart() {
    if (!state.charts.method) return;
    const s = state.data.summary;
    let ebAgree = 0, dirAgree = 0;
    let ebCount = 0, dirCount = 0;

    if (state.currentYear === 'compare') {
      ebAgree = s.y68.method_stats['ประกวดราคาอิเล็กทรอนิกส์ (e-bidding)'].agree + s.y69.method_stats['ประกวดราคาอิเล็กทรอนิกส์ (e-bidding)'].agree;
      dirAgree = s.y68.method_stats['เฉพาะเจาะจง'].agree + s.y69.method_stats['เฉพาะเจาะจง'].agree;
      ebCount = s.y68.method_stats['ประกวดราคาอิเล็กทรอนิกส์ (e-bidding)'].count + s.y69.method_stats['ประกวดราคาอิเล็กทรอนิกส์ (e-bidding)'].count;
      dirCount = s.y68.method_stats['เฉพาะเจาะจง'].count + s.y69.method_stats['เฉพาะเจาะจง'].count;
    } else {
      const cur = state.currentYear === '2569' ? s.y69 : s.y68;
      ebAgree = cur.method_stats['ประกวดราคาอิเล็กทรอนิกส์ (e-bidding)'].agree;
      dirAgree = cur.method_stats['เฉพาะเจาะจง'].agree;
      ebCount = cur.method_stats['ประกวดราคาอิเล็กทรอนิกส์ (e-bidding)'].count;
      dirCount = cur.method_stats['เฉพาะเจาะจง'].count;
    }

    const totalVal = ebAgree + dirAgree;
    const ebPct = ((ebAgree / totalVal) * 100).toFixed(1);
    const dirPct = ((dirAgree / totalVal) * 100).toFixed(1);

    state.charts.method.data.labels = [
      `e-Bidding (${ebPct}%)`,
      `เฉพาะเจาะจง (${dirPct}%)`
    ];
    state.charts.method.data.datasets = [{
      data: [ebAgree, dirAgree],
      backgroundColor: ['#f43f5e', '#0ea5e9'],
      borderWidth: 0
    }];
    state.charts.method.update();

    // Render HTML Legend
    const legendEl = document.getElementById('methodLegendStats');
    if (legendEl) {
      legendEl.innerHTML = `
        <div class="legend-stat-row">
          <div class="lsr-left">
            <span class="lsr-dot" style="background:#f43f5e;"></span>
            <span>e-Bidding (ประกวดราคา)</span>
          </div>
          <div class="lsr-right">
            <span>${ebCount} โครงการ</span>
            <strong class="text-rose">${fmt.shortMoney(ebAgree)}</strong>
          </div>
        </div>
        <div class="legend-stat-row">
          <div class="lsr-left">
            <span class="lsr-dot" style="background:#0ea5e9;"></span>
            <span>เฉพาะเจาะจง</span>
          </div>
          <div class="lsr-right">
            <span>${dirCount} โครงการ</span>
            <strong class="text-blue">${fmt.shortMoney(dirAgree)}</strong>
          </div>
        </div>
      `;
    }
  }

  // 3. Timeline Chart (Fiscal Month Ordering)
  function initTimelineChart() {
    const ctx = document.getElementById('timelineChart');
    if (!ctx) return;
    const colors = getThemeColors();

    state.charts.timeline = new Chart(ctx, {
      type: 'line',
      data: { labels: [], datasets: [] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { color: colors.textColor, font: { family: 'Prompt', size: 12 } } },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${fmt.money(ctx.parsed.y)}`
            }
          }
        },
        scales: {
          x: {
            ticks: { color: colors.mutedColor, font: { family: 'Prompt', size: 11 } },
            grid: { color: colors.gridColor }
          },
          y: {
            ticks: {
              color: colors.mutedColor,
              font: { family: 'Plus Jakarta Sans', size: 11 },
              callback: (v) => fmt.shortMoney(v)
            },
            grid: { color: colors.gridColor }
          }
        }
      }
    });

    updateTimelineChart();
  }

  function updateTimelineChart() {
    if (!state.charts.timeline) return;
    const s = state.data.summary;
    const months = ['ต.ค.', 'พ.ย.', 'ธ.ค.', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.'];

    // Map month stats
    const getMonthData = (yearStats) => {
      return months.map(m => {
        const item = Object.values(yearStats.month_stats).find(x => x.month === m);
        return item ? item.agree : 0;
      });
    };

    const data68 = getMonthData(s.y68);
    const data69 = getMonthData(s.y69);

    state.charts.timeline.data.labels = months;

    if (state.currentYear === 'compare') {
      state.charts.timeline.data.datasets = [
        {
          label: 'ปีงบประมาณ 2568',
          data: data68,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          fill: true,
          tension: 0.35,
          pointRadius: 4
        },
        {
          label: 'ปีงบประมาณ 2569',
          data: data69,
          borderColor: '#0ea5e9',
          backgroundColor: 'rgba(14, 165, 233, 0.1)',
          fill: true,
          tension: 0.35,
          pointRadius: 4
        }
      ];
    } else if (state.currentYear === '2569') {
      state.charts.timeline.data.datasets = [
        {
          label: 'การเบิกจ่ายสัญญาปี 2569',
          data: data69,
          borderColor: '#0ea5e9',
          backgroundColor: 'rgba(14, 165, 233, 0.18)',
          fill: true,
          tension: 0.35,
          pointRadius: 5
        }
      ];
    } else {
      state.charts.timeline.data.datasets = [
        {
          label: 'การเบิกจ่ายสัญญาปี 2568',
          data: data68,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.18)',
          fill: true,
          tension: 0.35,
          pointRadius: 5
        }
      ];
    }

    state.charts.timeline.update();
  }

  // 4. Project Type Chart
  function initTypeChart() {
    const ctx = document.getElementById('typeChart');
    if (!ctx) return;
    const colors = getThemeColors();

    state.charts.type = new Chart(ctx, {
      type: 'polarArea',
      data: { labels: [], datasets: [] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: colors.textColor, font: { family: 'Prompt', size: 10 }, boxWidth: 10 } }
        },
        scales: {
          r: {
            ticks: { display: false },
            grid: { color: colors.gridColor }
          }
        }
      }
    });

    updateTypeChart();
  }

  function updateTypeChart() {
    if (!state.charts.type) return;
    const s = state.data.summary;
    let typeStats = {};

    if (state.currentYear === 'compare') {
      const keys = ['ซื้อ', 'จ้างทำของ/จ้างเหมาบริการ', 'จ้างก่อสร้าง', 'เช่า'];
      keys.forEach(k => {
        typeStats[k] = (s.y68.type_stats[k]?.agree || 0) + (s.y69.type_stats[k]?.agree || 0);
      });
    } else {
      const cur = state.currentYear === '2569' ? s.y69 : s.y68;
      typeStats = Object.fromEntries(Object.entries(cur.type_stats).map(([k, v]) => [k, v.agree]));
    }

    const labels = Object.keys(typeStats);
    const data = Object.values(typeStats);

    state.charts.type.data.labels = labels;
    state.charts.type.data.datasets = [{
      data: data,
      backgroundColor: [
        'rgba(14, 165, 233, 0.75)',
        'rgba(99, 102, 241, 0.75)',
        'rgba(244, 63, 94, 0.75)',
        'rgba(245, 158, 11, 0.75)'
      ],
      borderWidth: 0
    }];
    state.charts.type.update();
  }

  // 5. Tier Chart
  function initTierChart() {
    const ctx = document.getElementById('tierChart');
    if (!ctx) return;
    const colors = getThemeColors();

    state.charts.tier = new Chart(ctx, {
      type: 'bar',
      data: { labels: [], datasets: [] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.parsed.x} โครงการ (${fmt.money(ctx.raw.amount)})`
            }
          }
        },
        scales: {
          x: {
            ticks: { color: colors.mutedColor, font: { family: 'Plus Jakarta Sans', size: 10 } },
            grid: { color: colors.gridColor }
          },
          y: {
            ticks: { color: colors.mutedColor, font: { family: 'Prompt', size: 10 } },
            grid: { display: false }
          }
        }
      }
    });

    updateTierChart();
  }

  function updateTierChart() {
    if (!state.charts.tier) return;
    const s = state.data.summary;
    const tiers = ['ต่ำกว่า 50,000 บาท', '50,000 - 100,000 บาท', '100,001 - 500,000 บาท', '500,001 - 1,000,000 บาท', 'มากกว่า 1,000,000 บาท'];

    let counts = [], amounts = [];
    tiers.forEach(t => {
      if (state.currentYear === 'compare') {
        const c = (s.y68.tier_stats[t]?.count || 0) + (s.y69.tier_stats[t]?.count || 0);
        const a = (s.y68.tier_stats[t]?.agree || 0) + (s.y69.tier_stats[t]?.agree || 0);
        counts.push({ x: c, amount: a });
      } else {
        const cur = state.currentYear === '2569' ? s.y69 : s.y68;
        const c = cur.tier_stats[t]?.count || 0;
        const a = cur.tier_stats[t]?.agree || 0;
        counts.push({ x: c, amount: a });
      }
    });

    state.charts.tier.data.labels = tiers;
    state.charts.tier.data.datasets = [{
      data: counts,
      backgroundColor: '#06b6d4',
      borderRadius: 4
    }];
    state.charts.tier.update();
  }

  // ================= TOP 5 TABLE (OVERVIEW TAB) =================
  function initTop5Table() {
    const tbody = document.getElementById('top5TableBody');
    if (!tbody) return;

    const projects = getCurrentProjects();
    const sorted = [...projects].sort((a, b) => b.price_agree - a.price_agree).slice(0, 5);

    tbody.innerHTML = sorted.map((p, idx) => {
      const isEb = p.method.includes('bidding');
      return `
        <tr>
          <td><strong style="color:var(--accent-sky); font-family:var(--font-num);">#${idx + 1}</strong></td>
          <td class="project-name-cell">
            <span class="p-name-link" data-project-id="${p.id}">${escapeHtml(p.name)}</span>
            <div class="p-meta-sub">รหัส: ${p.id} | สัญญา: ${p.contract_no}</div>
          </td>
          <td><span class="badge-type">${p.type}</span></td>
          <td>
            <span class="badge-method ${isEb ? 'ebidding' : 'specific'}">
              ${isEb ? 'e-Bidding' : 'เฉพาะเจาะจง'}
            </span>
          </td>
          <td class="text-right">${fmt.money(p.budget)}</td>
          <td class="text-right"><strong class="text-emerald">${fmt.money(p.price_agree)}</strong></td>
          <td class="text-right text-emerald">${fmt.money(p.savings)}</td>
          <td>${escapeHtml(p.winner_name)}</td>
          <td>${p.contract_date}</td>
        </tr>
      `;
    }).join('');

    // Attach click listener to title links
    tbody.querySelectorAll('.p-name-link').forEach(link => {
      link.addEventListener('click', () => {
        openProjectModal(link.dataset.projectId);
      });
    });
  }

  // ================= GIS MAP (LEAFLET) =================
  function initMap() {
    const mapEl = document.getElementById('leafletMap');
    if (!mapEl) return;

    // Centered around Si Satchanalai town
    state.map = L.map('leafletMap').setView([17.425, 99.815], 13);

    // OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© OpenStreetMap contributors'
    }).addTo(state.map);

    updateMapMarkers();
  }

  function updateMapMarkers() {
    if (!state.map) return;

    // Clear existing markers
    state.mapMarkers.forEach(m => state.map.removeLayer(m));
    state.mapMarkers = [];

    const allGeo = [...state.data.projects69, ...state.data.projects68].filter(p => p.lat && p.lon);
    const filteredGeo = allGeo.filter(p => {
      if (state.mapYearFilter === 'all') return true;
      return String(p.year) === state.mapYearFilter;
    });

    const sidebarList = document.getElementById('mapProjectsList');
    if (sidebarList) {
      sidebarList.innerHTML = filteredGeo.map(p => {
        return `
          <div class="map-item-card" data-proj-id="${p.id}">
            <div class="mic-header">
              <span class="badge-year ${p.year === 2569 ? 'y69' : 'y68'}">ปี ${p.year}</span>
              <span class="badge-method ebidding">e-Bidding</span>
            </div>
            <div class="mic-title">${escapeHtml(p.name)}</div>
            <div class="mic-meta">
              <span class="mic-price">${fmt.money(p.price_agree)}</span>
              <span class="text-muted">${p.contract_date}</span>
            </div>
          </div>
        `;
      }).join('');

      // Click card to zoom
      sidebarList.querySelectorAll('.map-item-card').forEach(card => {
        card.addEventListener('click', () => {
          sidebarList.querySelectorAll('.map-item-card').forEach(c => c.classList.remove('active'));
          card.classList.add('active');
          const p = filteredGeo.find(item => item.id === card.dataset.projId);
          if (p && p.marker) {
            state.map.flyTo([p.lat, p.lon], 15, { animate: true, duration: 1.2 });
            p.marker.openPopup();
          }
        });
      });
    }

    // Add pins to map
    const bounds = L.latLngBounds();

    filteredGeo.forEach(p => {
      const is69 = p.year === 2569;
      const markerColor = is69 ? '#0ea5e9' : '#6366f1';

      const customIcon = L.divIcon({
        className: 'custom-map-pin',
        html: `<div style="background:${markerColor}; width:16px; height:16px; border-radius:50%; border:2px solid #ffffff; box-shadow:0 0 10px ${markerColor};"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });

      const popupHtml = `
        <div class="popup-inner">
          <span class="popup-year-badge">ปีงบฯ ${p.year} | e-Bidding</span>
          <div class="popup-title">${escapeHtml(p.name)}</div>
          <div class="popup-stat">วงเงินสัญญา: <strong>${fmt.money(p.price_agree)}</strong></div>
          <div class="popup-stat">ผู้ชนะ: <span>${escapeHtml(p.winner_name)}</span></div>
          <div class="popup-stat">วันที่: <span>${p.contract_date}</span></div>
          <button class="popup-btn" onclick="window.viewProjectDetails('${p.id}')">ดูรายละเอียดโครงการ</button>
        </div>
      `;

      const marker = L.marker([p.lat, p.lon], { icon: customIcon })
        .addTo(state.map)
        .bindPopup(popupHtml, { className: 'custom-leaflet-popup' });

      p.marker = marker;
      state.mapMarkers.push(marker);
      bounds.extend([p.lat, p.lon]);
    });

    if (filteredGeo.length > 0) {
      state.map.fitBounds(bounds, { padding: [50, 50] });
    }
  }

  // Global helper for leaflet popup button
  window.viewProjectDetails = function (projId) {
    openProjectModal(projId);
  };

  // ================= VENDORS LEADERBOARD =================
  function renderVendorsLeaderboard() {
    const tbody = document.getElementById('vendorsTableBody');
    if (!tbody || !state.data) return;

    let winners = state.data.summary.combined.top_winners;

    if (state.vendorSearchQuery) {
      winners = winners.filter(w => 
        w.name.toLowerCase().includes(state.vendorSearchQuery) || 
        (w.tin && w.tin.includes(state.vendorSearchQuery))
      );
    }

    if (winners.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="padding:2rem; color:var(--text-muted);">ไม่พบคู่สัญญาที่ตรงกับคำค้นหา</td></tr>`;
      return;
    }

    tbody.innerHTML = winners.map((w, idx) => {
      const yearBadges = (w.years || ['2568', '2569']).map(y => `<span class="badge-year ${y === 2569 ? 'y69' : 'y68'}">${y}</span>`).join(' ');
      const methodBadges = (w.methods || []).map(m => {
        const isEb = m.includes('bidding');
        return `<span class="badge-method ${isEb ? 'ebidding' : 'specific'}">${isEb ? 'e-Bidding' : 'เฉพาะเจาะจง'}</span>`;
      }).join(' ');

      return `
        <tr>
          <td><strong style="color:var(--accent-sky); font-family:var(--font-num);">#${idx + 1}</strong></td>
          <td><strong>${escapeHtml(w.name)}</strong></td>
          <td style="font-family:var(--font-num); color:var(--text-muted);">${w.tin || '-'}</td>
          <td class="text-center"><span class="badge-type">${w.count} สัญญา</span></td>
          <td class="text-right"><strong class="text-emerald">${fmt.money(w.amount)}</strong></td>
          <td>${yearBadges}</td>
          <td>${methodBadges}</td>
          <td class="text-center">
            <button class="mini-btn primary filter-vendor-btn" data-vendor="${escapeHtml(w.name)}" title="ดูโครงการของผู้ค้ารายนี้">
              ดูโครงการ
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Attach click event to filter by vendor
    tbody.querySelectorAll('.filter-vendor-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const vendorName = btn.dataset.vendor;
        const projectsTabBtn = document.getElementById('tabProjectsBtn');
        const searchInput = document.getElementById('projectSearchInput');
        if (projectsTabBtn && searchInput) {
          projectsTabBtn.click();
          searchInput.value = vendorName;
          state.searchQuery = vendorName.toLowerCase();
          document.getElementById('clearSearchBtn').style.display = 'block';
          state.pagination.page = 1;
          renderProjectsTable();
          showToast(`กรองโครงการของ: ${vendorName}`);
        }
      });
    });
  }

  // ================= PROJECTS TABLE & EXPLORER =================
  function getFilteredProjects() {
    if (!state.data) return [];
    let list = [...state.data.projects69, ...state.data.projects68];

    // Filter by Year
    if (state.filters.year !== 'all') {
      list = list.filter(p => String(p.year) === state.filters.year);
    }

    // Filter by Type
    if (state.filters.type !== 'all') {
      list = list.filter(p => p.type === state.filters.type);
    }

    // Filter by Method
    if (state.filters.method !== 'all') {
      list = list.filter(p => p.method === state.filters.method);
    }

    // Filter by Category
    if (state.filters.category !== 'all') {
      list = list.filter(p => p.category === state.filters.category);
    }

    // Filter by Tier
    if (state.filters.tier !== 'all') {
      list = list.filter(p => {
        const val = p.price_agree;
        if (state.filters.tier === 'tier1') return val <= 50000;
        if (state.filters.tier === 'tier2') return val > 50000 && val <= 100000;
        if (state.filters.tier === 'tier3') return val > 100000 && val <= 500000;
        if (state.filters.tier === 'tier4') return val > 500000 && val <= 1000000;
        if (state.filters.tier === 'tier5') return val > 1000000;
        return true;
      });
    }

    // Search query
    if (state.searchQuery) {
      const q = state.searchQuery;
      list = list.filter(p => {
        return (
          (p.name && p.name.toLowerCase().includes(q)) ||
          (p.id && p.id.includes(q)) ||
          (p.winner_name && p.winner_name.toLowerCase().includes(q)) ||
          (p.contract_no && p.contract_no.toLowerCase().includes(q)) ||
          (p.winner_tin && p.winner_tin.includes(q))
        );
      });
    }

    // Sort
    const col = state.sort.column;
    const isAsc = state.sort.order === 'asc';

    list.sort((a, b) => {
      let valA = a.price_agree;
      let valB = b.price_agree;
      if (col === 'budget') {
        valA = a.budget;
        valB = b.budget;
      } else if (col === 'savings') {
        valA = a.savings;
        valB = b.savings;
      }
      return isAsc ? valA - valB : valB - valA;
    });

    return list;
  }

  function renderProjectsTable() {
    const tbody = document.getElementById('projectsTableBody');
    const matchCountEl = document.getElementById('filterMatchCount');
    const matchSumEl = document.getElementById('filterMatchSum');
    const pageInfoText = document.getElementById('pageInfoText');
    const paginationButtons = document.getElementById('paginationButtons');

    if (!tbody) return;

    const filtered = getFilteredProjects();
    const total = filtered.length;
    const totalAgreeSum = filtered.reduce((acc, cur) => acc + cur.price_agree, 0);

    if (matchCountEl) matchCountEl.textContent = fmt.num(total);
    if (matchSumEl) matchSumEl.textContent = fmt.shortMoney(totalAgreeSum);

    // Pagination slice
    const { page, pageSize } = state.pagination;
    const totalPages = Math.ceil(total / pageSize) || 1;
    const safePage = Math.min(Math.max(1, page), totalPages);
    state.pagination.page = safePage;

    const startIdx = (safePage - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, total);
    const pagedItems = filtered.slice(startIdx, endIdx);

    if (pageInfoText) {
      pageInfoText.textContent = total > 0 
        ? `แสดง ${startIdx + 1} - ${endIdx} จาก ${fmt.num(total)} รายการ`
        : 'ไม่พบรายการ';
    }

    // Render Table Rows
    if (pagedItems.length === 0) {
      tbody.innerHTML = `<tr><td colspan="11" class="text-center" style="padding: 2.5rem; color: var(--text-muted);">ไม่พบข้อมูลโครงการที่ตรงกับเงื่อนไขการค้นหา</td></tr>`;
    } else {
      tbody.innerHTML = pagedItems.map(p => {
        const isEb = p.method.includes('bidding');
        return `
          <tr>
            <td><span class="badge-year ${p.year === 2569 ? 'y69' : 'y68'}">${p.year}</span></td>
            <td style="font-family:var(--font-num); font-size:0.8rem; color:var(--text-muted);">${p.id}</td>
            <td class="project-name-cell">
              <span class="p-name-link" data-project-id="${p.id}">${escapeHtml(p.name)}</span>
              <div class="p-meta-sub">${p.category} | สัญญา: ${p.contract_no}</div>
            </td>
            <td><span class="badge-type">${p.type}</span></td>
            <td>
              <span class="badge-method ${isEb ? 'ebidding' : 'specific'}">
                ${isEb ? 'e-Bidding' : 'เฉพาะเจาะจง'}
              </span>
            </td>
            <td class="text-right">${fmt.money(p.budget)}</td>
            <td class="text-right"><strong class="text-emerald">${fmt.money(p.price_agree)}</strong></td>
            <td class="text-right ${p.savings > 0 ? 'text-emerald' : 'text-muted'}">${fmt.money(p.savings)}</td>
            <td>${escapeHtml(p.winner_name)}</td>
            <td>${p.contract_date}</td>
            <td class="text-center">
              <button class="btn-icon-table view-detail-btn" data-project-id="${p.id}" title="ดูรายละเอียดโครงการ">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
            </td>
          </tr>
        `;
      }).join('');

      tbody.querySelectorAll('.p-name-link, .view-detail-btn').forEach(el => {
        el.addEventListener('click', () => {
          openProjectModal(el.dataset.projectId);
        });
      });
    }

    // Render Pagination Controls
    if (paginationButtons) {
      let btnsHtml = `
        <button class="pg-btn" data-pg="prev" ${safePage === 1 ? 'disabled' : ''}>&lt;</button>
      `;

      let startPage = Math.max(1, safePage - 2);
      let endPage = Math.min(totalPages, safePage + 2);

      if (startPage > 1) {
        btnsHtml += `<button class="pg-btn" data-pg="1">1</button>`;
        if (startPage > 2) btnsHtml += `<span style="padding:0 4px; color:var(--text-muted);">...</span>`;
      }

      for (let i = startPage; i <= endPage; i++) {
        btnsHtml += `<button class="pg-btn ${i === safePage ? 'active' : ''}" data-pg="${i}">${i}</button>`;
      }

      if (endPage < totalPages) {
        if (endPage < totalPages - 1) btnsHtml += `<span style="padding:0 4px; color:var(--text-muted);">...</span>`;
        btnsHtml += `<button class="pg-btn" data-pg="${totalPages}">${totalPages}</button>`;
      }

      btnsHtml += `
        <button class="pg-btn" data-pg="next" ${safePage === totalPages ? 'disabled' : ''}>&gt;</button>
      `;

      paginationButtons.innerHTML = btnsHtml;

      paginationButtons.querySelectorAll('.pg-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const targetPg = btn.dataset.pg;
          if (targetPg === 'prev') {
            state.pagination.page = Math.max(1, state.pagination.page - 1);
          } else if (targetPg === 'next') {
            state.pagination.page = Math.min(totalPages, state.pagination.page + 1);
          } else {
            state.pagination.page = parseInt(targetPg, 10);
          }
          renderProjectsTable();
        });
      });
    }
  }

  // ================= PROJECT MODAL =================
  function openProjectModal(projectId) {
    if (!state.data) return;
    const all = [...state.data.projects69, ...state.data.projects68];
    const p = all.find(x => x.id === projectId);
    if (!p) return;

    const modalBackdrop = document.getElementById('projectModalBackdrop');
    const modalYear = document.getElementById('modalProjectYear');
    const modalId = document.getElementById('modalProjectId');
    const modalBody = document.getElementById('modalBody');

    if (!modalBackdrop || !modalBody) return;

    modalYear.textContent = `ปีงบประมาณ ${p.year}`;
    modalYear.className = `modal-badge ${p.year === 2569 ? 'y69' : 'y68'}`;
    modalId.textContent = `รหัสโครงการ: ${p.id}`;

    const hasGeo = p.lat && p.lon;

    modalBody.innerHTML = `
      <h2 class="modal-p-title">${escapeHtml(p.name)}</h2>

      <div class="modal-stat-grid">
        <div class="msg-card">
          <span class="msg-label">งบประมาณตั้งไว้</span>
          <span class="msg-val">${fmt.money(p.budget)}</span>
        </div>
        <div class="msg-card">
          <span class="msg-label">ราคากลาง (Price Build)</span>
          <span class="msg-val text-blue">${fmt.money(p.price_build)}</span>
        </div>
        <div class="msg-card">
          <span class="msg-label">วงเงินสัญญา (Contract Agreed)</span>
          <span class="msg-val text-emerald">${fmt.money(p.price_agree)}</span>
        </div>
      </div>

      <div class="modal-detail-list">
        <div class="mdl-row">
          <span class="mdl-label">ส่วนต่างที่ประหยัดได้:</span>
          <span class="mdl-value text-emerald"><strong>${fmt.money(p.savings)}</strong> (${p.saving_pct}%)</span>
        </div>
        <div class="mdl-row">
          <span class="mdl-label">ประเภทโครงการ:</span>
          <span class="mdl-value"><span class="badge-type">${p.type}</span></span>
        </div>
        <div class="mdl-row">
          <span class="mdl-label">วิธีการจัดหา:</span>
          <span class="mdl-value">
            <span class="badge-method ${p.method.includes('bidding') ? 'ebidding' : 'specific'}">
              ${p.method}
            </span>
          </span>
        </div>
        <div class="mdl-row">
          <span class="mdl-label">หมวดหมู่งาน:</span>
          <span class="mdl-value">${p.category}</span>
        </div>
        <div class="mdl-row">
          <span class="mdl-label">คู่สัญญา / ผู้ชนะ:</span>
          <span class="mdl-value"><strong>${escapeHtml(p.winner_name)}</strong> (TIN: ${p.winner_tin || '-'})</span>
        </div>
        <div class="mdl-row">
          <span class="mdl-label">เลขที่สัญญา:</span>
          <span class="mdl-value">${p.contract_no}</span>
        </div>
        <div class="mdl-row">
          <span class="mdl-label">วันที่ลงนามสัญญา:</span>
          <span class="mdl-value">${p.contract_date} (สิ้นสุดสัญญา: ${p.contract_finish_date})</span>
        </div>
        <div class="mdl-row">
          <span class="mdl-label">หน่วยงานเจ้าของโครงการ:</span>
          <span class="mdl-value">${p.dept} (ต.${p.subdistrict} อ.${p.district} จ.${p.province})</span>
        </div>
        <div class="mdl-row">
          <span class="mdl-label">สถานะโครงการ:</span>
          <span class="mdl-value"><span style="color:var(--accent-emerald);">● ${p.status}</span></span>
        </div>
        ${hasGeo ? `
        <div class="mdl-row">
          <span class="mdl-label">พิกัดทางภูมิศาสตร์:</span>
          <span class="mdl-value">ละติจูด ${p.lat.toFixed(6)}, ลองจิจูด ${p.lon.toFixed(6)} 
            <a href="https://www.google.com/maps?q=${p.lat},${p.lon}" target="_blank" style="margin-left:8px; color:var(--accent-sky);">เปิดใน Google Maps ↗</a>
          </span>
        </div>` : ''}
      </div>
    `;

    modalBackdrop.classList.add('open');
  }

  // ================= EXPORT CSV =================
  function exportFilteredProjectsCsv() {
    const list = getFilteredProjects();
    if (list.length === 0) {
      showToast('ไม่พบข้อมูลที่จะส่งออก');
      return;
    }

    const headers = [
      'ปีงบประมาณ',
      'รหัสโครงการ',
      'ชื่อโครงการ',
      'ประเภทโครงการ',
      'หมวดหมู่งาน',
      'วิธีการจัดซื้อจัดจ้าง',
      'งบประมาณ (บาท)',
      'ราคากลาง (บาท)',
      'วงเงินสัญญา (บาท)',
      'ส่วนต่างประหยัด (บาท)',
      'ผู้ชนะการเสนอราคา',
      'เลขประจำตัวผู้เสียภาษี (TIN)',
      'เลขที่สัญญา',
      'วันที่ทำสัญญา',
      'วันที่สิ้นสุดสัญญา',
      'ตำบล',
      'อำเภอ',
      'จังหวัด',
      'สถานะโครงการ'
    ];

    const rows = list.map(p => [
      p.year,
      `"${p.id}"`,
      `"${(p.name || '').replace(/"/g, '""')}"`,
      `"${p.type}"`,
      `"${p.category}"`,
      `"${p.method}"`,
      p.budget,
      p.price_build,
      p.price_agree,
      p.savings,
      `"${(p.winner_name || '').replace(/"/g, '""')}"`,
      `"${p.winner_tin || ''}"`,
      `"${p.contract_no || ''}"`,
      `"${p.contract_date || ''}"`,
      `"${p.contract_finish_date || ''}"`,
      `"${p.subdistrict || ''}"`,
      `"${p.district || ''}"`,
      `"${p.province || ''}"`,
      `"${p.status || ''}"`
    ]);

    // Prepend UTF-8 BOM so Excel opens Thai characters seamlessly
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `si_satchanalai_procurement_report_${state.currentYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`ส่งออกข้อมูลเรียบร้อยแล้ว (${list.length} รายการ)`);
  }

  // HTML entity escaper
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ====================================================================
  // VISITOR COUNTER ENGINE
  // Multi-layered counter with cloud sync, session protection & offline fallback
  // ====================================================================
  function initVisitorCounter() {
    const headerCountEl = document.getElementById('headerVisitorCount');
    const totalCountEl = document.getElementById('totalVisitorCount');
    const todayCountEl = document.getElementById('todayVisitorCount');
    const todayDateEl = document.getElementById('visitorTodayDate');
    const lastActiveEl = document.getElementById('visitorLastActiveText');

    // Format current date in Thai (e.g. "27 ต.ค. 2569")
    const now = new Date();
    const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const todayDateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const thaiYear = now.getFullYear() + 543;
    const formattedThaiDate = `${now.getDate()} ${thaiMonths[now.getMonth()]} ${thaiYear}`;

    if (todayDateEl) {
      todayDateEl.textContent = formattedThaiDate;
    }

    if (lastActiveEl) {
      const hours = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      lastActiveEl.textContent = `อัปเดตข้อมูลล่าสุด: ${formattedThaiDate} เวลา ${hours}:${mins} น.`;
    }

    // Number roll/count animation helper
    function animateCount(elem, target) {
      if (!elem) return;
      const targetNum = parseInt(target, 10);
      if (isNaN(targetNum)) {
        elem.textContent = target;
        return;
      }
      const start = 0;
      const duration = 1200;
      const startTime = performance.now();

      function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // EaseOutExpo
        const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        const current = Math.floor(start + (targetNum - start) * ease);
        elem.textContent = current.toLocaleString('th-TH');
        if (progress < 1) {
          requestAnimationFrame(update);
        } else {
          elem.textContent = targetNum.toLocaleString('th-TH');
        }
      }
      requestAnimationFrame(update);
    }

    // Daily visit handling via localStorage
    const savedDate = localStorage.getItem('khondee_today_date');
    let todayCount = parseInt(localStorage.getItem('khondee_today_count') || '0', 10);
    const sessionActive = sessionStorage.getItem('khondee_session_active');

    if (savedDate !== todayDateKey) {
      todayCount = 1;
      localStorage.setItem('khondee_today_date', todayDateKey);
      localStorage.setItem('khondee_today_count', todayCount.toString());
    } else if (!sessionActive) {
      todayCount += 1;
      localStorage.setItem('khondee_today_count', todayCount.toString());
    }

    // Base offset for portal
    const BASE_OFFSET = 128;
    let localTotal = parseInt(localStorage.getItem('khondee_local_total') || '0', 10);
    if (!localTotal || localTotal < BASE_OFFSET) {
      localTotal = BASE_OFFSET + todayCount;
      localStorage.setItem('khondee_local_total', localTotal.toString());
    } else if (!sessionActive) {
      localTotal += 1;
      localStorage.setItem('khondee_local_total', localTotal.toString());
    }

    // Immediate snappy UI display
    animateCount(todayCountEl, todayCount);
    animateCount(totalCountEl, localTotal);
    if (headerCountEl) {
      headerCountEl.textContent = localTotal.toLocaleString('th-TH');
    }

    // Mark current session as active
    sessionStorage.setItem('khondee_session_active', 'true');

    // Cloud Hit or Get via CountAPI
    const counterKey = 'sutirach1_khondeesrisat_v1';
    const action = sessionActive ? 'get' : 'hit';
    const apiUrl = `https://countapi.mileshilliard.com/api/v1/${action}/${counterKey}`;

    // Fetch with 4-second timeout to avoid any hang
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    fetch(apiUrl, { signal: controller.signal })
      .then(res => {
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error('Counter API status error');
        return res.json();
      })
      .then(data => {
        if (data && typeof data.value === 'number') {
          const finalCount = BASE_OFFSET + data.value;
          localStorage.setItem('khondee_local_total', finalCount.toString());
          animateCount(totalCountEl, finalCount);
          if (headerCountEl) {
            headerCountEl.textContent = finalCount.toLocaleString('th-TH');
          }
        }
      })
      .catch(err => {
        // Fallback silently uses localTotal already displayed
        console.debug('Visitor counter local fallback in effect:', err.message);
      });
  }

  // Initialize on load
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    loadData();
    initVisitorCounter();
  });

})();
