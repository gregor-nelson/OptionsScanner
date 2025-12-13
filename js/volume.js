/**
 * Volume & Open Interest Analysis Module
 * Aggregates contract data by ticker and renders bar chart
 */

let volumeChart = null;
let currentData = null;

/**
 * Aggregate contracts by ticker
 * @param {Array} contracts - Array of contract objects
 * @returns {Array} - Aggregated ticker data sorted by ratio
 */
export function aggregateByTicker(contracts) {
  const byTicker = {};

  for (const c of contracts) {
    const ticker = c.underlying;
    if (!byTicker[ticker]) {
      byTicker[ticker] = {
        ticker,
        industry: c._meta?.industry || 'Unknown',
        totalVolume: 0,
        totalOI: 0,
        contractCount: 0
      };
    }
    byTicker[ticker].totalVolume += c.volume || 0;
    byTicker[ticker].totalOI += c.openInterest || 0;
    byTicker[ticker].contractCount++;
  }

  return Object.values(byTicker).map(t => ({
    ...t,
    ratio: t.totalOI > 0 ? t.totalVolume / t.totalOI : 0
  }));
}

/**
 * Calculate summary statistics
 * @param {Array} tickerData - Aggregated ticker data
 * @param {number} threshold - Hot ticker threshold
 * @returns {Object} - Summary stats
 */
function calculateStats(tickerData, threshold) {
  const totalVolume = tickerData.reduce((sum, t) => sum + t.totalVolume, 0);
  const totalOI = tickerData.reduce((sum, t) => sum + t.totalOI, 0);
  const avgRatio = tickerData.length > 0
    ? tickerData.reduce((sum, t) => sum + t.ratio, 0) / tickerData.length
    : 0;
  const hotCount = tickerData.filter(t => t.ratio >= threshold).length;

  return { totalVolume, totalOI, avgRatio, hotCount };
}

/**
 * Theme colors matching TRACE 3D design
 */
const THEME = {
  bg: '#121820',
  border: '#2a3544',
  borderBright: '#3d4f66',
  text: '#e6edf5',
  textSecondary: '#8b9eb3',
  textMuted: '#5a6b7d',
  positive: '#00d4aa',
  negative: '#ff4757',
  neutral: '#ffa502',
  accent: '#3b82f6'
};

/**
 * Industry color palette - distinct colors for each industry
 */
const INDUSTRY_COLORS = {
  'Oil & Gas Integrated': '#3b82f6',      // Blue
  'Oil & Gas E&P': '#10b981',             // Emerald
  'Oil & Gas Equipment & Services': '#f59e0b', // Amber
  'Oil & Gas Midstream': '#8b5cf6',       // Purple
  'Oil & Gas Drilling': '#ef4444',        // Red
  'Uranium': '#06b6d4',                   // Cyan
  'Unknown': '#6b7280'                    // Gray fallback
};

/**
 * Get bar color based on industry
 * @param {string} industry - Industry name
 * @returns {string} - Hex color
 */
function getIndustryColor(industry) {
  return INDUSTRY_COLORS[industry] || INDUSTRY_COLORS['Unknown'];
}

/**
 * Get bar color based on ratio and threshold (legacy - kept for reference)
 * @param {number} ratio - Vol/OI ratio
 * @param {number} threshold - Threshold for "hot"
 * @returns {string} - Hex color
 */
function getBarColor(ratio, threshold) {
  if (ratio >= threshold * 2) return THEME.negative;  // red - very hot
  if (ratio >= threshold) return THEME.neutral;        // orange - hot
  if (ratio >= 1.0) return THEME.accent;               // blue - above baseline
  return THEME.textMuted;                              // gray - below baseline
}

/**
 * Format large numbers compactly
 * @param {number} num - Number to format
 * @returns {string} - Formatted string (e.g., "1.2M", "45K")
 */
function formatCompact(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

/**
 * Update summary stat cards
 * @param {Object} stats - Summary statistics
 */
function updateStatCards(stats) {
  const els = {
    totalVolume: document.getElementById('volTotalVolume'),
    totalOI: document.getElementById('volTotalOI'),
    avgRatio: document.getElementById('volAvgRatio'),
    hotCount: document.getElementById('volHotCount')
  };

  if (els.totalVolume) els.totalVolume.textContent = formatCompact(stats.totalVolume);
  if (els.totalOI) els.totalOI.textContent = formatCompact(stats.totalOI);
  if (els.avgRatio) els.avgRatio.textContent = stats.avgRatio.toFixed(2) + 'x';
  if (els.hotCount) els.hotCount.textContent = stats.hotCount;
}

/**
 * Render the volume/OI bar chart
 * @param {Array} contracts - Array of contract objects
 * @param {Object} options - Render options
 */
export function renderVolumeChart(contracts, options = {}) {
  if (!contracts || contracts.length === 0) {
    showEmptyState();
    return;
  }

  const {
    limit = 50,
    sortBy = 'ratio',
    threshold = 0.3
  } = options;

  // Aggregate by ticker
  let data = aggregateByTicker(contracts);
  currentData = data;

  // Update stats (before filtering)
  const stats = calculateStats(data, threshold);
  updateStatCards(stats);

  // Sort
  if (sortBy === 'ticker') {
    data.sort((a, b) => a.ticker.localeCompare(b.ticker));
  } else {
    data.sort((a, b) => b[sortBy] - a[sortBy]);
  }

  // Limit if specified
  if (limit > 0 && data.length > limit) {
    data = data.slice(0, limit);
  }

  // Prepare chart data (reverse for horizontal bar - bottom to top)
  const chartData = [...data].reverse();
  const tickers = chartData.map(d => d.ticker);
  const ratios = chartData.map(d => d.ratio);
  const colors = chartData.map(d => getIndustryColor(d.industry));

  // Calculate dynamic height (30px per bar, min 300px)
  const barHeight = 28;
  const chartHeight = Math.max(300, chartData.length * barHeight + 60);

  // Get or create chart container
  const container = document.getElementById('volumeChart');
  if (!container) return;

  container.style.height = `${chartHeight}px`;

  // Initialize or get chart instance
  if (!volumeChart) {
    volumeChart = echarts.init(container);

    // Handle resize
    window.addEventListener('resize', () => {
      if (volumeChart) volumeChart.resize();
    });
  }

  // Build chart options
  const chartOptions = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: THEME.bg,
      borderColor: THEME.border,
      textStyle: { color: THEME.text, fontFamily: 'IBM Plex Sans' },
      formatter: (params) => {
        const d = chartData[params[0].dataIndex];
        const industryColor = getIndustryColor(d.industry);
        return `
          <strong style="color:${THEME.text}">${d.ticker}</strong><br/>
          <span style="color:${industryColor}">●</span> <span style="color:${THEME.textSecondary}">${d.industry}</span><br/>
          <span style="color:${THEME.textSecondary}">Volume:</span> ${formatCompact(d.totalVolume)}<br/>
          <span style="color:${THEME.textSecondary}">Open Interest:</span> ${formatCompact(d.totalOI)}<br/>
          <span style="color:${THEME.textSecondary}">Ratio:</span> <strong>${d.ratio.toFixed(2)}x</strong><br/>
          <span style="color:${THEME.textSecondary}">Contracts:</span> ${d.contractCount}
        `;
      }
    },
    grid: {
      left: 60,
      right: 60,
      top: 10,
      bottom: 10,
      containLabel: true
    },
    xAxis: {
      type: 'value',
      axisLine: { show: false },
      axisLabel: {
        color: THEME.textMuted,
        fontSize: 10,
        fontFamily: 'IBM Plex Mono',
        formatter: (val) => val.toFixed(1) + 'x'
      },
      splitLine: { lineStyle: { color: THEME.border, type: 'dashed' } }
    },
    yAxis: {
      type: 'category',
      data: tickers,
      axisLine: { show: false },
      axisLabel: {
        color: THEME.textSecondary,
        fontSize: 11,
        fontFamily: 'IBM Plex Mono'
      },
      axisTick: { show: false }
    },
    series: [
      {
        type: 'bar',
        data: ratios.map((val, idx) => ({
          value: val,
          itemStyle: { color: colors[idx] }
        })),
        barWidth: '65%',
        label: {
          show: true,
          position: 'right',
          color: THEME.textMuted,
          fontSize: 10,
          fontFamily: 'IBM Plex Mono',
          formatter: (params) => params.value.toFixed(2) + 'x'
        },
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: {
            color: THEME.neutral,
            type: 'dashed',
            width: 1
          },
          data: [
            { xAxis: threshold, label: { show: false } }
          ]
        }
      }
    ]
  };

  volumeChart.setOption(chartOptions, true);
}

/**
 * Show empty state when no data
 */
function showEmptyState() {
  const container = document.getElementById('volumeChart');
  if (!container) return;

  if (volumeChart) {
    volumeChart.dispose();
    volumeChart = null;
  }

  container.innerHTML = `
    <div class="volume-empty">
      <i class="ph ph-chart-bar-horizontal"></i>
      <p>No data available</p>
      <span>Run a scan to see volume analysis</span>
    </div>
  `;
}

/**
 * Refresh chart with current options from controls
 * @param {Array} contracts - Contract data
 */
export function refreshVolumeChart(contracts) {
  const limitEl = document.getElementById('volShowLimit');
  const sortEl = document.getElementById('volSortBy');
  const thresholdEl = document.getElementById('volThreshold');

  const options = {
    limit: parseInt(limitEl?.value || '50'),
    sortBy: sortEl?.value || 'ratio',
    threshold: parseFloat(thresholdEl?.value || '0.3')
  };

  renderVolumeChart(contracts, options);
}

/**
 * Set up control event listeners
 * @param {Function} onUpdate - Callback when controls change
 */
export function setupVolumeControls(onUpdate) {
  const controls = ['volShowLimit', 'volSortBy', 'volThreshold'];

  controls.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', onUpdate);
    }
  });
}

/**
 * Resize chart (call when tab becomes visible)
 */
export function resizeVolumeChart() {
  if (volumeChart) {
    setTimeout(() => volumeChart.resize(), 50);
  }
}

/**
 * Clean up chart instance
 */
export function disposeVolumeChart() {
  if (volumeChart) {
    volumeChart.dispose();
    volumeChart = null;
  }
}

/**
 * Render the industry color legend
 * @param {Array} contracts - Contract data to determine which industries to show
 */
export function renderIndustryLegend(contracts) {
  const legendEl = document.getElementById('volumeLegend');
  if (!legendEl) return;

  // Get unique industries from the data
  const industries = new Set();
  if (contracts && contracts.length > 0) {
    for (const c of contracts) {
      const industry = c._meta?.industry || 'Unknown';
      industries.add(industry);
    }
  }

  // Build legend HTML - only show industries present in data
  const legendItems = Array.from(industries)
    .sort()
    .map(industry => {
      const color = INDUSTRY_COLORS[industry] || INDUSTRY_COLORS['Unknown'];
      return `
        <div class="legend-item">
          <span class="legend-dot" style="background:${color}"></span>
          <span class="legend-label">${industry}</span>
        </div>
      `;
    })
    .join('');

  legendEl.innerHTML = legendItems || '<span class="legend-empty">No data</span>';
}
