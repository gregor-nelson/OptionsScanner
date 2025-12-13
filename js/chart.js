/**
 * Chart Module - ECharts Heatmap Visualization
 *
 * Provides a hierarchical heatmap overview:
 * - Default: Industry × Expiration (collapsed view)
 * - Expanded: Tickers within industry × Expiration
 * - Click cell for contract details in side panel
 */

import { formatCurrency, formatPercent, formatNumber } from './utils.js';

// Module state
let heatmapChart = null;
let heatmap3dChart = null;
let currentContracts = [];      // All contracts from last render
let expandedIndustries = new Set();  // Which industries are expanded (2D only)
let contractMap = {};           // Stores contracts by key for drill-down
let currentView = '2d';         // '2d' | 'bar3d' | 'scatter3d'
let colorMetric = 'iv';         // 'iv' | 'price' | 'count'
let selectedIndustry = 'all';   // 'all' or specific industry name (3D views)

// Industry colors for scatter plot (consistent with rest of app)
const INDUSTRY_COLORS = [
  '#00d4aa', '#3b82f6', '#ffa502', '#ff4757', '#a855f7',
  '#14b8a6', '#f97316', '#ec4899', '#84cc16', '#06b6d4'
];

/**
 * Initialize the heatmap chart
 * @param {string} containerId - DOM element ID for the chart
 * @returns {object} ECharts instance
 */
export function initChart(containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error('Chart container not found:', containerId);
    return null;
  }

  // Dispose existing chart if any
  if (heatmapChart) {
    heatmapChart.dispose();
  }

  heatmapChart = echarts.init(container);

  // Handle window resize
  window.addEventListener('resize', () => {
    if (heatmapChart) {
      heatmapChart.resize();
    }
  });

  return heatmapChart;
}

/**
 * Initialize the 3D chart
 * @param {string} containerId - DOM element ID for the chart
 * @returns {object} ECharts instance
 */
export function init3dChart(containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error('3D Chart container not found:', containerId);
    return null;
  }

  // Dispose existing chart if any
  if (heatmap3dChart) {
    heatmap3dChart.dispose();
  }

  heatmap3dChart = echarts.init(container);

  // Handle window resize
  window.addEventListener('resize', () => {
    if (heatmap3dChart) {
      heatmap3dChart.resize();
    }
  });

  return heatmap3dChart;
}

/**
 * Set the current view mode and update UI
 * @param {string} view - '2d' | 'bar3d' | 'scatter3d'
 */
export function setViewMode(view) {
  currentView = view;

  // Update chart section data attribute for CSS
  const chartSection = document.getElementById('chartSection');
  if (chartSection) {
    chartSection.setAttribute('data-view', view);
  }

  // Update sub-tab active states
  document.querySelectorAll('.heatmap-view-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.view === view);
  });

  // Toggle UI elements based on view
  const controls2d = document.getElementById('heatmap2dControls');
  const controls3d = document.getElementById('heatmap3dControls');
  const chartHint2d = document.getElementById('chartHint');
  const chartHint3d = document.getElementById('chartHint3d');
  const ivLegend = document.getElementById('heatmapIvLegend');
  const scatterLegend = document.getElementById('heatmapScatterLegend');

  if (controls2d) controls2d.style.display = view === '2d' ? 'flex' : 'none';
  if (controls3d) controls3d.classList.toggle('visible', view !== '2d');
  if (chartHint2d) chartHint2d.style.display = view === '2d' ? 'block' : 'none';
  if (chartHint3d) chartHint3d.classList.toggle('visible', view !== '2d');
  if (ivLegend) ivLegend.classList.toggle('visible', view === 'bar3d');
  if (scatterLegend) scatterLegend.classList.toggle('visible', view === 'scatter3d');

  // Re-render with current contracts after CSS has applied
  if (currentContracts.length > 0) {
    // Use requestAnimationFrame + setTimeout to ensure container is visible and sized
    requestAnimationFrame(() => {
      setTimeout(() => {
        renderCurrentView();
      }, 50);
    });
  }
}

/**
 * Set the color metric for 3D bar chart
 * @param {string} metric - 'iv' | 'price' | 'count'
 */
export function setColorMetric(metric) {
  colorMetric = metric;
  if (currentView === 'bar3d' && currentContracts.length > 0) {
    renderBar3D(currentContracts);
  }
}

/**
 * Set the industry filter for 3D views and re-render
 * @param {string} industry - 'all' or specific industry name
 */
export function setIndustryFilter(industry) {
  selectedIndustry = industry;

  // Update dropdown to match (in case called programmatically)
  const dropdown = document.getElementById('industryFilter');
  if (dropdown && dropdown.value !== industry) {
    dropdown.value = industry;
  }

  // Re-render current 3D view
  if (currentContracts.length > 0) {
    if (currentView === 'bar3d') {
      renderBar3D(currentContracts);
    } else if (currentView === 'scatter3d') {
      renderScatter3D(currentContracts);
    }
  }
}

/**
 * Populate industry dropdown from current contracts
 * @param {object[]} contracts - Array of contracts
 */
export function populateIndustryDropdown(contracts) {
  const dropdown = document.getElementById('industryFilter');
  if (!dropdown) return;

  // Get unique industries sorted alphabetically
  const industries = [...new Set(contracts.map(c => c._meta?.industry || 'Other'))].sort();

  // Count contracts per industry for display
  const industryCounts = {};
  contracts.forEach(c => {
    const ind = c._meta?.industry || 'Other';
    industryCounts[ind] = (industryCounts[ind] || 0) + 1;
  });

  // Build options - keep "All Industries" first, then sorted industries with counts
  dropdown.innerHTML = `<option value="all">All Industries (${contracts.length})</option>`;
  industries.forEach(ind => {
    const count = industryCounts[ind] || 0;
    dropdown.innerHTML += `<option value="${ind}">${ind} (${count})</option>`;
  });

  // Reset selection to 'all' when populating (new scan)
  selectedIndustry = 'all';
  dropdown.value = 'all';
}

/**
 * Initialize view tab event listeners
 * Call this once on app startup
 */
export function initViewTabs() {
  // Sub-tab clicks
  document.querySelectorAll('.heatmap-view-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      setViewMode(tab.dataset.view);
    });
  });

  // Industry filter dropdown
  const industryFilter = document.getElementById('industryFilter');
  if (industryFilter) {
    industryFilter.addEventListener('change', (e) => {
      setIndustryFilter(e.target.value);
    });
  }

  // Color metric dropdown
  const colorMetricSelect = document.getElementById('colorMetric');
  if (colorMetricSelect) {
    colorMetricSelect.addEventListener('change', (e) => {
      setColorMetric(e.target.value);
    });
  }
}

/**
 * Render based on current view mode
 */
function renderCurrentView() {
  switch (currentView) {
    case 'bar3d':
      renderBar3D(currentContracts);
      break;
    case 'scatter3d':
      renderScatter3D(currentContracts);
      break;
    default:
      renderHeatmap(currentContracts);
  }
}

/**
 * Format expiration date to month label (e.g., "Jan'26")
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @returns {string}
 */
function formatExpirationMonth(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  const month = date.toLocaleString('en-US', { month: 'short' });
  const year = date.getFullYear().toString().slice(-2);
  return `${month}'${year}`;
}

/**
 * Sort expiration month labels chronologically
 */
function sortExpirationMonths(months) {
  const parseExpMonth = (str) => {
    const monthMap = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
                       Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
    const [mon, yr] = str.split("'");
    return new Date(2000 + parseInt(yr), monthMap[mon], 1);
  };
  return [...months].sort((a, b) => parseExpMonth(a) - parseExpMonth(b));
}

/**
 * Build hierarchical heatmap data structure
 * @param {object[]} contracts - Array of normalized contracts
 * @returns {object} { industries, tickers, expirations, industryData, tickerData }
 */
function buildHierarchicalData(contracts) {
  // Reset contract map
  contractMap = {};

  // Data structures
  const industryStats = {};      // industry -> { total, byExp: { expMonth -> count } }
  const tickerStats = {};        // ticker -> { industry, total, byExp: { expMonth -> count } }
  const expirationSet = new Set();

  contracts.forEach(contract => {
    const ticker = contract.underlying;
    const industry = contract._meta?.industry || 'Other';
    const expMonth = formatExpirationMonth(contract.expiration);

    expirationSet.add(expMonth);

    // Industry stats
    if (!industryStats[industry]) {
      industryStats[industry] = { total: 0, byExp: {} };
    }
    industryStats[industry].total++;
    industryStats[industry].byExp[expMonth] = (industryStats[industry].byExp[expMonth] || 0) + 1;

    // Ticker stats
    if (!tickerStats[ticker]) {
      tickerStats[ticker] = { industry, total: 0, byExp: {} };
    }
    tickerStats[ticker].total++;
    tickerStats[ticker].byExp[expMonth] = (tickerStats[ticker].byExp[expMonth] || 0) + 1;

    // Store contract for drill-down (both by ticker and by industry)
    const tickerKey = `ticker|${ticker}|${expMonth}`;
    const industryKey = `industry|${industry}|${expMonth}`;

    if (!contractMap[tickerKey]) contractMap[tickerKey] = [];
    contractMap[tickerKey].push(contract);

    if (!contractMap[industryKey]) contractMap[industryKey] = [];
    contractMap[industryKey].push(contract);
  });

  // Sort industries by total count (descending)
  const industries = Object.entries(industryStats)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([name, stats]) => ({ name, ...stats }));

  // Sort tickers by total count within each industry
  const tickersByIndustry = {};
  Object.entries(tickerStats).forEach(([ticker, stats]) => {
    const ind = stats.industry;
    if (!tickersByIndustry[ind]) tickersByIndustry[ind] = [];
    tickersByIndustry[ind].push({ ticker, ...stats });
  });
  Object.values(tickersByIndustry).forEach(tickers => {
    tickers.sort((a, b) => b.total - a.total);
  });

  // Sort expirations chronologically
  const expirations = sortExpirationMonths(expirationSet);

  return { industries, tickersByIndustry, expirations, industryStats, tickerStats };
}

/**
 * Build Y-axis labels and data based on expanded state
 */
function buildDisplayData(hierarchicalData, expandedIndustries) {
  const { industries, tickersByIndustry, expirations } = hierarchicalData;

  const yAxisLabels = [];
  const yAxisMeta = [];  // Track what each row represents
  const data = [];
  let maxCount = 0;

  industries.forEach(industry => {
    const isExpanded = expandedIndustries.has(industry.name);

    if (isExpanded) {
      // Add industry header row (clickable to collapse)
      yAxisLabels.push(`▼ ${industry.name}`);
      yAxisMeta.push({ type: 'industry-header', industry: industry.name, expanded: true });

      const headerYIdx = yAxisLabels.length - 1;
      expirations.forEach((expMonth, xIdx) => {
        const count = industry.byExp[expMonth] || 0;
        if (count > 0) {
          data.push([xIdx, headerYIdx, count]);
          maxCount = Math.max(maxCount, count);
        }
      });

      // Add ticker rows for this industry
      const tickers = tickersByIndustry[industry.name] || [];
      tickers.forEach(tickerData => {
        yAxisLabels.push(`    ${tickerData.ticker}`);
        yAxisMeta.push({ type: 'ticker', ticker: tickerData.ticker, industry: industry.name });

        const tickerYIdx = yAxisLabels.length - 1;
        expirations.forEach((expMonth, xIdx) => {
          const count = tickerData.byExp[expMonth] || 0;
          if (count > 0) {
            data.push([xIdx, tickerYIdx, count]);
            maxCount = Math.max(maxCount, count);
          }
        });
      });
    } else {
      // Collapsed: just show industry row (clickable to expand)
      yAxisLabels.push(`▶ ${industry.name}`);
      yAxisMeta.push({ type: 'industry', industry: industry.name, expanded: false });

      const yIdx = yAxisLabels.length - 1;
      expirations.forEach((expMonth, xIdx) => {
        const count = industry.byExp[expMonth] || 0;
        if (count > 0) {
          data.push([xIdx, yIdx, count]);
          maxCount = Math.max(maxCount, count);
        }
      });
    }
  });

  return { yAxisLabels, yAxisMeta, data, maxCount, xAxis: expirations };
}

/**
 * Render the heatmap chart
 * @param {object[]} contracts - Array of normalized contracts
 */
export function renderHeatmap(contracts) {
  if (!contracts || contracts.length === 0) {
    hideChart();
    return;
  }

  // Store contracts for re-rendering on expand/collapse
  currentContracts = contracts;

  // IMPORTANT: Show the chart section FIRST so container has dimensions
  showChart();

  // Get container and check dimensions
  const container = document.getElementById('heatmapContainer');
  if (!container) return;

  // Check if container has dimensions - if not, wait and retry
  if (container.offsetWidth === 0 || container.offsetHeight === 0) {
    setTimeout(() => renderHeatmap(contracts), 100);
    return;
  }

  const hierarchicalData = buildHierarchicalData(contracts);
  const displayData = buildDisplayData(hierarchicalData, expandedIndustries);

  const { yAxisLabels, yAxisMeta, data, maxCount, xAxis } = displayData;

  // Handle case with no data
  if (data.length === 0) {
    hideChart();
    return;
  }

  // Initialize chart AFTER container is visible and sized
  if (!heatmapChart) {
    initChart('heatmapContainer');
  }
  heatmapChart.resize();

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      position: 'top',
      backgroundColor: '#232d3f',
      borderColor: '#3d4f66',
      textStyle: { color: '#e6edf5' },
      formatter: function(params) {
        const meta = yAxisMeta[params.value[1]];
        const expMonth = xAxis[params.value[0]];
        const count = params.value[2];

        if (meta.type === 'ticker') {
          return `<strong>${meta.ticker}</strong> (${meta.industry})<br/>` +
                 `${expMonth}: ${count} contract${count !== 1 ? 's' : ''}<br/>` +
                 `<em style="color:#5a6b7d">Click to view details</em>`;
        } else {
          return `<strong>${meta.industry}</strong><br/>` +
                 `${expMonth}: ${count} contract${count !== 1 ? 's' : ''}<br/>` +
                 `<em style="color:#5a6b7d">Click to ${meta.expanded ? 'collapse' : 'expand'}</em>`;
        }
      }
    },
    grid: {
      top: 10,
      left: 180,  // More space for industry names
      right: 30,
      bottom: 80
    },
    xAxis: {
      type: 'category',
      data: xAxis,
      splitArea: {
        show: true,
        areaStyle: { color: ['#121820', '#0b0e14'] }
      },
      axisLine: { lineStyle: { color: '#2a3544' } },
      axisLabel: {
        rotate: 45,
        fontSize: 11,
        color: '#8b9eb3'
      }
    },
    yAxis: {
      type: 'category',
      data: yAxisLabels,
      splitArea: {
        show: true,
        areaStyle: { color: ['#121820', '#0b0e14'] }
      },
      axisLine: { lineStyle: { color: '#2a3544' } },
      axisLabel: {
        fontSize: 11,
        color: '#8b9eb3',
        fontWeight: function(value) {
          return value.startsWith('▶') || value.startsWith('▼') ? 'bold' : 'normal';
        },
        formatter: function(value) {
          // Truncate long industry names
          const maxLen = 25;
          if (value.length > maxLen) {
            return value.substring(0, maxLen) + '...';
          }
          return value;
        }
      }
    },
    visualMap: {
      min: 0,
      max: maxCount,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      itemWidth: 15,
      itemHeight: 120,
      text: ['More', 'Fewer'],
      textStyle: { fontSize: 11, color: '#8b9eb3' },
      inRange: {
        color: ['#1a2332', '#0d4a4a', '#0a6b5c', '#00a67d', '#00d4aa']
      }
    },
    series: [{
      name: 'Contracts',
      type: 'heatmap',
      data: data,
      label: {
        show: true,
        fontSize: 10,
        color: '#e6edf5',
        formatter: function(params) {
          return params.value[2];
        }
      },
      itemStyle: {
        borderColor: '#2a3544',
        borderWidth: 1
      },
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowColor: 'rgba(0, 212, 170, 0.4)'
        }
      }
    }]
  };

  heatmapChart.setOption(option, true);  // true = not merge, replace

  // Set up click handler
  heatmapChart.off('click');
  heatmapChart.on('click', function(params) {
    if (params.componentType === 'series') {
      const meta = yAxisMeta[params.value[1]];
      const expMonth = xAxis[params.value[0]];

      if (meta.type === 'ticker') {
        // Show side panel with contracts for this ticker/expiration
        const key = `ticker|${meta.ticker}|${expMonth}`;
        const cellContracts = contractMap[key] || [];
        showSidePanel(cellContracts, meta.ticker, expMonth);
      } else if (meta.type === 'industry' || meta.type === 'industry-header') {
        // Toggle industry expansion
        toggleIndustry(meta.industry);
      }
    }
  });
}

/**
 * Toggle industry expansion and re-render
 */
function toggleIndustry(industryName) {
  if (expandedIndustries.has(industryName)) {
    expandedIndustries.delete(industryName);
  } else {
    expandedIndustries.add(industryName);
  }

  // Re-render with new expanded state
  renderHeatmap(currentContracts);
}

/**
 * Build data for 3D bar chart
 * Uses selectedIndustry filter: 'all' shows aggregated industries, specific shows tickers
 */
function build3dBarData(contracts) {
  const hierarchicalData = buildHierarchicalData(contracts);
  const { industries, tickersByIndustry, expirations } = hierarchicalData;

  const data = [];
  const yAxisLabels = [];
  const yAxisMeta = [];

  if (selectedIndustry === 'all') {
    // Show aggregated view - one bar per industry
    industries.forEach(industry => {
      yAxisLabels.push(industry.name);
      yAxisMeta.push({ type: 'industry', industry: industry.name });

      const yIdx = yAxisLabels.length - 1;
      expirations.forEach((expMonth, xIdx) => {
        const key = `industry|${industry.name}|${expMonth}`;
        const cellContracts = contractMap[key] || [];
        if (cellContracts.length > 0) {
          const metrics = calculateCellMetrics(cellContracts);
          data.push({
            value: [xIdx, yIdx, metrics.count],
            metrics,
            meta: { type: 'industry', industry: industry.name, expMonth }
          });
        }
      });
    });
  } else {
    // Show specific industry - one bar per ticker
    const tickers = tickersByIndustry[selectedIndustry] || [];
    tickers.forEach(tickerData => {
      yAxisLabels.push(tickerData.ticker);
      yAxisMeta.push({ type: 'ticker', ticker: tickerData.ticker, industry: selectedIndustry });

      const tickerYIdx = yAxisLabels.length - 1;
      expirations.forEach((expMonth, xIdx) => {
        const key = `ticker|${tickerData.ticker}|${expMonth}`;
        const cellContracts = contractMap[key] || [];
        if (cellContracts.length > 0) {
          const metrics = calculateCellMetrics(cellContracts);
          data.push({
            value: [xIdx, tickerYIdx, metrics.count],
            metrics,
            meta: { type: 'ticker', ticker: tickerData.ticker, industry: selectedIndustry, expMonth }
          });
        }
      });
    });
  }

  return { data, yAxisLabels, yAxisMeta, xAxis: expirations };
}

/**
 * Calculate aggregated metrics for a cell's contracts
 */
function calculateCellMetrics(contracts) {
  if (!contracts || contracts.length === 0) {
    return { count: 0, avgIv: 0, avgPrice: 0, totalOi: 0 };
  }

  let totalIv = 0;
  let totalPrice = 0;
  let totalOi = 0;
  let ivCount = 0;
  let priceCount = 0;

  contracts.forEach(c => {
    if (c.iv != null && c.iv > 0) {
      totalIv += c.iv;
      ivCount++;
    }
    if (c.last != null && c.last > 0) {
      totalPrice += c.last;
      priceCount++;
    }
    totalOi += c.openInterest || 0;
  });

  return {
    count: contracts.length,
    avgIv: ivCount > 0 ? totalIv / ivCount : 0,
    avgPrice: priceCount > 0 ? totalPrice / priceCount : 0,
    totalOi
  };
}

/**
 * Get color for bar based on metric value
 */
function getBarColor(metrics, metric) {
  if (metric === 'iv') {
    const iv = metrics.avgIv * 100; // Convert to percentage
    if (iv < 25) return '#00d4aa';      // Low IV - opportunity (teal)
    if (iv < 40) return '#3b82f6';      // Mid IV (blue)
    return '#ff4757';                    // High IV (red)
  } else if (metric === 'price') {
    const price = metrics.avgPrice;
    if (price < 0.25) return '#00d4aa';  // Cheap - opportunity
    if (price < 1.00) return '#3b82f6';  // Moderate
    return '#ff4757';                     // Expensive
  } else {
    // Count - use gradient
    return '#00d4aa';
  }
}

/**
 * Render 3D bar chart view
 */
function renderBar3D(contracts) {
  if (!contracts || contracts.length === 0) {
    return;
  }

  showChart();

  const container = document.getElementById('heatmap3dContainer');
  if (!container) return;

  // Check if container has dimensions - if not, wait and retry
  if (container.offsetWidth === 0 || container.offsetHeight === 0) {
    setTimeout(() => renderBar3D(contracts), 100);
    return;
  }

  // Initialize 3D chart if needed
  if (!heatmap3dChart) {
    init3dChart('heatmap3dContainer');
  }
  heatmap3dChart.resize();

  const barData = build3dBarData(contracts);
  const { data, yAxisLabels, yAxisMeta, xAxis } = barData;

  // Find max values for scaling
  let maxCount = 0;
  data.forEach(d => {
    maxCount = Math.max(maxCount, d.value[2]);
  });

  // Transform data for bar3D
  const bar3dData = data.map(d => {
    const color = getBarColor(d.metrics, colorMetric);
    return {
      value: [d.value[0], d.value[1], d.value[2]],
      itemStyle: { color },
      metrics: d.metrics,
      meta: d.meta
    };
  });

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      backgroundColor: '#232d3f',
      borderColor: '#3d4f66',
      textStyle: { color: '#e6edf5', fontSize: 12 },
      formatter: function(params) {
        const d = params.data;
        if (!d || !d.meta) return '';

        const m = d.metrics;
        const label = d.meta.type === 'ticker' ? d.meta.ticker : d.meta.industry;
        const hint = d.meta.type === 'industry'
          ? 'Click to drill down'
          : 'Click for details';

        return `<strong>${label}</strong><br/>` +
               `${d.meta.expMonth}<br/>` +
               `Contracts: ${m.count}<br/>` +
               `Avg IV: ${(m.avgIv * 100).toFixed(1)}%<br/>` +
               `Avg Price: $${m.avgPrice.toFixed(2)}<br/>` +
               `<em style="color:#5a6b7d">${hint}</em>`;
      }
    },
    grid3D: {
      boxWidth: 200,
      boxHeight: 80,
      boxDepth: Math.max(80, yAxisLabels.length * 8),
      viewControl: {
        projection: 'orthographic',
        autoRotate: false,
        distance: 300,
        alpha: 20,
        beta: 40,
        minAlpha: -90,
        maxAlpha: 90
      },
      light: {
        main: { intensity: 1.2, shadow: true },
        ambient: { intensity: 0.3 }
      },
      environment: 'transparent'
    },
    xAxis3D: {
      type: 'category',
      data: xAxis,
      name: 'Expiration',
      nameTextStyle: { color: '#8b9eb3', fontSize: 11 },
      axisLabel: { color: '#8b9eb3', fontSize: 10 },
      axisLine: { lineStyle: { color: '#2a3544' } }
    },
    yAxis3D: {
      type: 'category',
      data: yAxisLabels,
      name: '',
      axisLabel: {
        color: '#8b9eb3',
        fontSize: 9,
        formatter: function(value) {
          return value.length > 20 ? value.substring(0, 20) + '...' : value;
        }
      },
      axisLine: { lineStyle: { color: '#2a3544' } }
    },
    zAxis3D: {
      type: 'value',
      name: 'Count',
      nameTextStyle: { color: '#8b9eb3', fontSize: 11 },
      axisLabel: { color: '#8b9eb3', fontSize: 10 },
      axisLine: { lineStyle: { color: '#2a3544' } },
      max: maxCount
    },
    series: [{
      type: 'bar3D',
      data: bar3dData,
      shading: 'lambert',
      barSize: 8,
      bevelSize: 0.3,
      emphasis: {
        itemStyle: {
          opacity: 1
        }
      }
    }]
  };

  heatmap3dChart.setOption(option, true);

  // Force another resize after option is set (helps with ECharts GL)
  setTimeout(() => {
    if (heatmap3dChart) {
      heatmap3dChart.resize();
    }
  }, 100);

  // Click handler for 3D
  heatmap3dChart.off('click');
  heatmap3dChart.on('click', function(params) {
    if (params.data && params.data.meta) {
      const meta = params.data.meta;
      if (meta.type === 'ticker') {
        // Show side panel with contracts for this ticker/expiration
        const key = `ticker|${meta.ticker}|${meta.expMonth}`;
        const cellContracts = contractMap[key] || [];
        showSidePanel(cellContracts, meta.ticker, meta.expMonth);
      } else if (meta.type === 'industry') {
        // Click industry bar -> drill down to that industry's tickers
        setIndustryFilter(meta.industry);
      }
    }
  });
}

/**
 * Build scatter plot data from contracts
 */
function buildScatterData(contracts) {
  // Get unique industries and assign colors
  const industries = [...new Set(contracts.map(c => c._meta?.industry || 'Other'))];
  const industryColorMap = {};
  industries.forEach((ind, i) => {
    industryColorMap[ind] = INDUSTRY_COLORS[i % INDUSTRY_COLORS.length];
  });

  // Build scatter points
  const data = contracts.map(c => {
    const industry = c._meta?.industry || 'Other';
    return {
      value: [
        c.strike || 0,           // X: Strike
        c.dte || 0,              // Y: DTE
        (c.iv || 0) * 100        // Z: IV as percentage
      ],
      itemStyle: {
        color: industryColorMap[industry],
        opacity: 0.8
      },
      symbolSize: Math.min(20, Math.max(5, Math.log10((c.openInterest || 1) + 1) * 4)),
      contract: c
    };
  });

  return { data, industries, industryColorMap };
}

/**
 * Update scatter legend with industries
 */
function updateScatterLegend(industries, colorMap) {
  const legend = document.getElementById('heatmapScatterLegend');
  if (!legend) return;

  // Keep the title, replace items
  const title = legend.querySelector('.heatmap-scatter-legend-title');
  legend.innerHTML = '';
  if (title) legend.appendChild(title);

  industries.forEach(ind => {
    const item = document.createElement('div');
    item.className = 'heatmap-scatter-legend-item';
    item.innerHTML = `
      <div class="heatmap-scatter-legend-dot" style="background: ${colorMap[ind]}"></div>
      <span class="heatmap-scatter-legend-label">${ind}</span>
    `;
    legend.appendChild(item);
  });
}

/**
 * Render 3D scatter plot view
 */
function renderScatter3D(contracts) {
  if (!contracts || contracts.length === 0) {
    return;
  }

  showChart();

  const container = document.getElementById('heatmap3dContainer');
  if (!container) return;

  // Check if container has dimensions - if not, wait and retry
  if (container.offsetWidth === 0 || container.offsetHeight === 0) {
    setTimeout(() => renderScatter3D(contracts), 100);
    return;
  }

  // Initialize 3D chart if needed
  if (!heatmap3dChart) {
    init3dChart('heatmap3dContainer');
  }
  heatmap3dChart.resize();

  // Filter contracts by selected industry
  let filteredContracts = contracts;
  if (selectedIndustry !== 'all') {
    filteredContracts = contracts.filter(c =>
      (c._meta?.industry || 'Other') === selectedIndustry
    );
  }

  // Handle empty filter result
  if (filteredContracts.length === 0) {
    heatmap3dChart.clear();
    return;
  }

  const scatterData = buildScatterData(filteredContracts);
  const { data, industries, industryColorMap } = scatterData;

  // Update legend
  updateScatterLegend(industries, industryColorMap);

  // Calculate axis ranges
  let minStrike = Infinity, maxStrike = 0;
  let minDte = Infinity, maxDte = 0;
  let minIv = Infinity, maxIv = 0;

  data.forEach(d => {
    minStrike = Math.min(minStrike, d.value[0]);
    maxStrike = Math.max(maxStrike, d.value[0]);
    minDte = Math.min(minDte, d.value[1]);
    maxDte = Math.max(maxDte, d.value[1]);
    minIv = Math.min(minIv, d.value[2]);
    maxIv = Math.max(maxIv, d.value[2]);
  });

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      backgroundColor: '#232d3f',
      borderColor: '#3d4f66',
      textStyle: { color: '#e6edf5', fontSize: 12 },
      formatter: function(params) {
        const c = params.data.contract;
        if (!c) return '';

        return `<strong>${c.underlying}</strong> (${c._meta?.industry || 'Other'})<br/>` +
               `Strike: $${c.strike?.toFixed(2) || '-'}<br/>` +
               `DTE: ${c.dte} days<br/>` +
               `IV: ${((c.iv || 0) * 100).toFixed(1)}%<br/>` +
               `Last: ${formatCurrency(c.last)}<br/>` +
               `OI: ${formatNumber(c.openInterest)}<br/>` +
               `<em style="color:#5a6b7d">Click to view in sidebar</em>`;
      }
    },
    grid3D: {
      boxWidth: 150,
      boxHeight: 100,
      boxDepth: 100,
      viewControl: {
        projection: 'orthographic',
        autoRotate: false,
        distance: 250,
        alpha: 15,
        beta: 30,
        minAlpha: -90,
        maxAlpha: 90
      },
      light: {
        main: { intensity: 1.2 },
        ambient: { intensity: 0.4 }
      }
    },
    xAxis3D: {
      type: 'value',
      name: 'Strike ($)',
      nameTextStyle: { color: '#8b9eb3', fontSize: 11 },
      axisLabel: { color: '#8b9eb3', fontSize: 10, formatter: '${value}' },
      axisLine: { lineStyle: { color: '#2a3544' } },
      min: minStrike * 0.95,
      max: maxStrike * 1.05
    },
    yAxis3D: {
      type: 'value',
      name: 'DTE (days)',
      nameTextStyle: { color: '#8b9eb3', fontSize: 11 },
      axisLabel: { color: '#8b9eb3', fontSize: 10 },
      axisLine: { lineStyle: { color: '#2a3544' } },
      min: 0,
      max: Math.ceil(maxDte * 1.1)
    },
    zAxis3D: {
      type: 'value',
      name: 'IV (%)',
      nameTextStyle: { color: '#8b9eb3', fontSize: 11 },
      axisLabel: { color: '#8b9eb3', fontSize: 10, formatter: '{value}%' },
      axisLine: { lineStyle: { color: '#2a3544' } },
      min: 0,
      max: Math.ceil(maxIv * 1.1)
    },
    series: [{
      type: 'scatter3D',
      data: data,
      emphasis: {
        itemStyle: {
          opacity: 1,
          borderColor: '#fff',
          borderWidth: 1
        }
      }
    }]
  };

  heatmap3dChart.setOption(option, true);

  // Force another resize after option is set (helps with ECharts GL)
  setTimeout(() => {
    if (heatmap3dChart) {
      heatmap3dChart.resize();
    }
  }, 100);

  // Click handler for scatter
  heatmap3dChart.off('click');
  heatmap3dChart.on('click', function(params) {
    if (params.data && params.data.contract) {
      const c = params.data.contract;
      const expMonth = formatExpirationMonth(c.expiration);
      showSidePanel([c], c.underlying, expMonth);
    }
  });
}

/**
 * Expand all industries
 */
export function expandAll() {
  const hierarchicalData = buildHierarchicalData(currentContracts);
  hierarchicalData.industries.forEach(ind => {
    expandedIndustries.add(ind.name);
  });
  renderHeatmap(currentContracts);
}

/**
 * Collapse all industries
 */
export function collapseAll() {
  expandedIndustries.clear();
  renderHeatmap(currentContracts);
}

/**
 * Show the chart section
 */
export function showChart() {
  const section = document.getElementById('chartSection');
  if (section) {
    section.style.display = 'block';
  }
}

/**
 * Hide the chart section
 */
export function hideChart() {
  const section = document.getElementById('chartSection');
  if (section) {
    section.style.display = 'none';
  }
}

/**
 * Show the side panel with contract details
 * @param {object[]} contracts - Contracts for the selected cell
 * @param {string} ticker - Selected ticker
 * @param {string} expMonth - Selected expiration month
 */
export function showSidePanel(contracts, ticker, expMonth) {
  const panel = document.getElementById('sidePanel');
  const overlay = document.getElementById('sidePanelOverlay');
  const title = document.getElementById('sidePanelTitle');
  const content = document.getElementById('sidePanelContent');

  if (!panel || !content) return;

  // Set title
  title.textContent = `${ticker} - ${expMonth} (${contracts.length})`;

  // Sort contracts by price (ascending)
  const sorted = [...contracts].sort((a, b) => (a.last || 0) - (b.last || 0));

  // Build content table
  const html = `
    <table class="side-panel-table">
      <thead>
        <tr>
          <th>Strike</th>
          <th>Last</th>
          <th>Delta</th>
          <th>IV</th>
          <th>OI</th>
        </tr>
      </thead>
      <tbody>
        ${sorted.map(c => `
          <tr>
            <td>${c.strike != null ? c.strike.toFixed(2) : '-'}</td>
            <td>${formatCurrency(c.last)}</td>
            <td>${c.delta != null ? c.delta.toFixed(3) : '-'}</td>
            <td>${formatPercent(c.iv)}</td>
            <td>${formatNumber(c.openInterest)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  content.innerHTML = html;

  // Show panel and overlay
  panel.classList.add('open');
  overlay.classList.add('visible');

  // Set up close handlers
  const closeBtn = document.getElementById('closeSidePanel');
  if (closeBtn) {
    closeBtn.onclick = closeSidePanel;
  }
  overlay.onclick = closeSidePanel;
}

/**
 * Close the side panel
 */
export function closeSidePanel() {
  const panel = document.getElementById('sidePanel');
  const overlay = document.getElementById('sidePanelOverlay');

  if (panel) {
    panel.classList.remove('open');
  }
  if (overlay) {
    overlay.classList.remove('visible');
  }
}

/**
 * Get contracts for a specific cell (for external use)
 * @param {string} ticker
 * @param {string} expMonth
 * @returns {object[]}
 */
export function getContractsForCell(ticker, expMonth) {
  const key = `ticker|${ticker}|${expMonth}`;
  return contractMap[key] || [];
}

/**
 * Reset chart state (call when starting new scan)
 */
export function resetChartState() {
  expandedIndustries.clear();
  currentContracts = [];
  contractMap = {};
  currentView = '2d';
  colorMetric = 'iv';
  selectedIndustry = 'all';

  // Reset view UI
  const chartSection = document.getElementById('chartSection');
  if (chartSection) {
    chartSection.setAttribute('data-view', '2d');
  }
  document.querySelectorAll('.heatmap-view-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.view === '2d');
  });

  // Reset industry dropdown
  const industryFilter = document.getElementById('industryFilter');
  if (industryFilter) {
    industryFilter.value = 'all';
  }
}

/**
 * Resize the chart (call when container size changes)
 */
export function resizeChart() {
  if (heatmapChart) {
    heatmapChart.resize();
  }
  if (heatmap3dChart) {
    heatmap3dChart.resize();
  }
}

/**
 * Get current view mode
 * @returns {string}
 */
export function getCurrentView() {
  return currentView;
}
