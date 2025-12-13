/**
 * Main Application - Wires together all modules and handles UI
 * Dashboard Layout Version
 */

import { ApiClient } from './api.js';
import { OptionsScanner } from './scanner.js';
import { CONFIG, DEFAULT_UNIVERSE } from './config.js';
import { formatCurrency, formatPercent, formatDate, formatNumber } from './utils.js';
import { renderHeatmap, hideChart, expandAll, collapseAll, resetChartState, resizeChart, initViewTabs, init3dChart, populateIndustryDropdown } from './chart.js';
import { cacheManager } from './cache.js';
import { renderVolumeChart, refreshVolumeChart, setupVolumeControls, resizeVolumeChart, renderIndustryLegend } from './volume.js';

// Global state
let scanner = null;
let currentResults = null;
let currentOptionType = 'calls'; // 'calls' or 'puts'
let activeTab = 'heatmap';
let forceRefresh = false; // Skip cache when true

// Tab configuration - easy to extend with new tabs
const TAB_CONFIG = [
  {
    id: 'heatmap',
    label: 'Heatmap',
    icon: '\u25A6',
    default: true,
    onActivate: () => {
      // Resize chart when tab becomes visible
      setTimeout(() => resizeChart(), 50);
    }
  },
  {
    id: 'contracts',
    label: 'Contracts',
    icon: '\u2630',
    badge: 'contractsBadge',
    onActivate: null
  },
  {
    id: 'volume',
    label: 'Vol & OI',
    icon: '\uD83D\uDCCA',
    onActivate: () => {
      // Resize and refresh chart when tab becomes visible
      resizeVolumeChart();
      if (currentResults?.contracts) {
        refreshVolumeChart(currentResults.contracts);
      }
    }
  },
  {
    id: 'analysis',
    label: 'Analysis',
    icon: '\uD83D\uDCC8',
    onActivate: null
  }
];

/**
 * Initialize the application
 */
export async function init() {
  console.log('Initializing Options Scanner...');

  // Check for API key
  if (CONFIG.API_KEY === 'YOUR_API_KEY_HERE') {
    showError('Please set your API key in js/config.js');
    return;
  }

  // Initialize cache manager
  await cacheManager.init();

  // Create API client and scanner
  const apiClient = new ApiClient(CONFIG.API_KEY);
  scanner = new OptionsScanner(apiClient, DEFAULT_UNIVERSE);

  // Test API connection
  showProgress({ phase: 'init', message: 'Testing API connection...', progress: 0 });
  const connected = await apiClient.testConnection();

  if (!connected) {
    showError('Failed to connect to API. Check your API key and network connection.');
    return;
  }

  // Set up event listeners
  setupEventListeners();

  // Populate UI with defaults
  populateDefaults();

  // Display universe info
  updateUniverseDisplay();

  // Update cache UI
  updateCacheUI();

  // Try to load from cache on startup - defer slightly to ensure layout is calculated
  requestAnimationFrame(() => {
    setTimeout(async () => {
      await tryLoadFromCache();
      showProgress({ phase: 'ready', message: 'Ready to scan', progress: 100 });
      console.log('Scanner initialized successfully');
    }, 50);
  });
}

/**
 * Set up UI event listeners
 */
function setupEventListeners() {
  // Scan button
  const scanBtn = document.getElementById('scanBtn');
  if (scanBtn) {
    scanBtn.addEventListener('click', runScan);
  }

  // Enter key in inputs triggers scan
  const inputs = document.querySelectorAll('input');
  inputs.forEach(input => {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        runScan();
      }
    });
  });

  // Sort headers
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('sortable')) {
      const field = e.target.dataset.field;
      if (field) {
        sortResults(field);
      }
    }
  });

  // Chart expand/collapse buttons
  const expandAllBtn = document.getElementById('expandAllBtn');
  if (expandAllBtn) {
    expandAllBtn.addEventListener('click', expandAll);
  }

  const collapseAllBtn = document.getElementById('collapseAllBtn');
  if (collapseAllBtn) {
    collapseAllBtn.addEventListener('click', collapseAll);
  }

  // Filter toggles (Calls/Puts)
  const filterToggles = document.querySelectorAll('.filter-toggle');
  filterToggles.forEach(toggle => {
    toggle.addEventListener('click', () => {
      filterToggles.forEach(t => t.classList.remove('active'));
      toggle.classList.add('active');
      currentOptionType = toggle.dataset.type;
    });
  });

  // Side panel close
  const closeSidePanel = document.getElementById('closeSidePanel');
  const sidePanelOverlay = document.getElementById('sidePanelOverlay');

  if (closeSidePanel) {
    closeSidePanel.addEventListener('click', closeSidePanelFn);
  }
  if (sidePanelOverlay) {
    sidePanelOverlay.addEventListener('click', closeSidePanelFn);
  }

  // Set up tabs
  setupTabs();

  // Set up settings dropdown
  setupSettingsDropdown();

  // Set up scan picker modal
  setupScanPickerModal();

  // Set up volume controls
  setupVolumeControls(() => {
    if (currentResults?.contracts) {
      refreshVolumeChart(currentResults.contracts);
    }
  });

  // Set up heatmap 3D view tabs
  initViewTabs();
}

/**
 * Set up tab navigation
 */
function setupTabs() {
  const tabs = document.querySelectorAll('.tab');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.dataset.tab;
      switchTab(tabId);
    });
  });

  // Keyboard shortcuts (1, 2, 3 to switch tabs)
  document.addEventListener('keydown', (e) => {
    // Don't trigger if user is typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const num = parseInt(e.key);
    if (num >= 1 && num <= TAB_CONFIG.length) {
      e.preventDefault();
      switchTab(TAB_CONFIG[num - 1].id);
    }
  });
}

/**
 * Switch to a specific tab
 * @param {string} tabId - The tab ID to switch to
 */
function switchTab(tabId) {
  const config = TAB_CONFIG.find(t => t.id === tabId);
  if (!config) return;

  activeTab = tabId;

  // Update tab buttons
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabId);
  });

  // Update panels
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `panel-${tabId}`);
  });

  // Call activation hook
  if (config.onActivate) {
    config.onActivate();
  }
}

/**
 * Update a tab badge value
 * @param {string} tabId - The tab ID
 * @param {number} value - The badge value
 */
function updateTabBadge(tabId, value) {
  const config = TAB_CONFIG.find(t => t.id === tabId);
  if (!config || !config.badge) return;

  const badge = document.getElementById(config.badge);
  if (badge) {
    badge.textContent = formatNumber(value);
    badge.classList.toggle('visible', value > 0);
  }
}

/**
 * Close side panel
 */
function closeSidePanelFn() {
  const sidePanel = document.getElementById('sidePanel');
  const overlay = document.getElementById('sidePanelOverlay');
  if (sidePanel) sidePanel.classList.remove('open');
  if (overlay) overlay.classList.remove('visible');
}

/**
 * Populate form with default values
 */
function populateDefaults() {
  setInputValue('priceMin', CONFIG.DEFAULTS.PRICE_MIN);
  setInputValue('priceMax', CONFIG.DEFAULTS.PRICE_MAX);
  setInputValue('expMin', CONFIG.DEFAULTS.EXPIRATION_GTE);
  setInputValue('deltaMin', CONFIG.DEFAULTS.DELTA_MIN);
  setInputValue('deltaMax', CONFIG.DEFAULTS.DELTA_MAX);
  setInputValue('ivMax', CONFIG.DEFAULTS.IV_MAX * 100); // Convert to percentage
  setInputValue('minOI', CONFIG.DEFAULTS.MIN_OPEN_INTEREST);
}

/**
 * Helper to set input value
 */
function setInputValue(id, value) {
  const el = document.getElementById(id);
  if (el && value != null) {
    el.value = value;
  }
}

/**
 * Helper to get input value
 */
function getInputValue(id, type = 'string') {
  const el = document.getElementById(id);
  if (!el) return null;
  
  const value = el.value.trim();
  if (value === '') return null;
  
  if (type === 'number') {
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  }
  
  return value;
}

/**
 * Update universe display
 */
function updateUniverseDisplay() {
  const universeEl = document.getElementById('universeList');
  if (!universeEl || !scanner) return;

  const universe = scanner.getUniverse();
  const tickers = universe.map(u => u.ticker);
  universeEl.textContent = tickers.join(' · ');

  const countEl = document.getElementById('universeCount');
  if (countEl) {
    countEl.textContent = tickers.length;
  }

  // Update industry breakdown
  const breakdownEl = document.getElementById('industryBreakdown');
  if (breakdownEl) {
    const industries = {};
    universe.forEach(u => {
      const ind = u.industry || 'Other';
      industries[ind] = (industries[ind] || 0) + 1;
    });

    const sorted = Object.entries(industries).sort((a, b) => b[1] - a[1]);
    breakdownEl.innerHTML = sorted.map(([name, count]) => `
      <div class="breakdown-item">
        <span class="breakdown-name">${name}</span>
        <span class="breakdown-count">${count}</span>
      </div>
    `).join('');
  }
}

/**
 * Run the scan with current form values
 */
async function runScan() {
  if (!scanner) {
    showError('Scanner not initialized');
    return;
  }

  // Reset chart state for fresh scan
  resetChartState();

  // Disable scan button
  const scanBtn = document.getElementById('scanBtn');
  const scanBtnSpan = scanBtn?.querySelector('span:not(.action-btn-icon)');
  if (scanBtn) {
    scanBtn.disabled = true;
    if (scanBtnSpan) scanBtnSpan.textContent = 'Scanning...';
  }

  try {
    // Check for test ticker (single ticker mode)
    const testTicker = getInputValue('testTicker');
    const tickers = testTicker ? [testTicker.toUpperCase()] : null;

    // Build params from form
    const params = {
      contractType: currentOptionType === 'puts' ? 'put' : 'call',
      expirationGte: getInputValue('expMin'),
      expirationLte: getInputValue('expMax'),
      priceMin: getInputValue('priceMin', 'number'),
      priceMax: getInputValue('priceMax', 'number'),
      priceField: 'last',    // Use 'last' trade price - illiquid options often lack bid/ask quotes
      deltaMin: getInputValue('deltaMin', 'number'),
      deltaMax: getInputValue('deltaMax', 'number'),
      ivMax: (getInputValue('ivMax', 'number') || 100) / 100,  // Convert from % to decimal
      minOpenInterest: getInputValue('minOI', 'number'),
      sortBy: 'last',        // Sort by last price
      sortDir: 'asc',
      tickers: tickers  // Override universe if test ticker specified
    };

    console.log('Scan params:', params);

    // Run scan
    const results = await scanner.scan(params, showProgress);

    // Store and display results
    currentResults = results;
    displayResults(results);

    // Save to cache
    const universe = tickers || scanner.getUniverse().map(u => u.ticker);
    await cacheManager.saveScan(results, params, universe);
    updateCacheUI();
    showToast('Scan saved to cache', 'success');

    // Reset force refresh flag
    forceRefresh = false;

  } catch (error) {
    console.error('Scan error:', error);
    showError(`Scan failed: ${error.message}`);
  } finally {
    // Re-enable scan button
    if (scanBtn) {
      scanBtn.disabled = false;
      if (scanBtnSpan) scanBtnSpan.textContent = 'Scan';
    }
  }
}

/**
 * Show progress update
 */
function showProgress(update) {
  // Update old-style progress element (for compatibility)
  const progressEl = document.getElementById('progress');
  if (progressEl) {
    progressEl.textContent = update.message || '';
    progressEl.className = `progress ${update.phase || ''}`;
  }

  // Update new dashboard progress bar
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');
  const scanStatus = document.getElementById('scanStatus');

  if (progressBar) {
    progressBar.style.width = `${update.progress || 0}%`;
  }

  if (progressText) {
    progressText.textContent = update.message || 'Ready to scan';
  }

  if (scanStatus) {
    const statusSpan = scanStatus.querySelector('span');

    // Update status badge based on phase
    scanStatus.className = 'scan-status';
    if (update.phase === 'ready' || update.phase === 'complete') {
      scanStatus.classList.add('ready');
      if (statusSpan) statusSpan.textContent = 'Ready';
    } else if (update.phase === 'error') {
      scanStatus.classList.add('error');
      if (statusSpan) statusSpan.textContent = 'Error';
    } else if (update.phase === 'fetching' || update.phase === 'processing' || update.phase === 'init') {
      scanStatus.classList.add('scanning');
      if (statusSpan) statusSpan.textContent = 'Scanning';
    }
  }
}

/**
 * Show error message
 */
function showError(message) {
  const progressEl = document.getElementById('progress');
  if (progressEl) {
    progressEl.textContent = message;
    progressEl.className = 'progress error';
  }
  console.error(message);
}

/**
 * Display scan results in table
 */
function displayResults(results) {
  const { contracts, stats } = results;

  // Render heatmap visualization
  if (contracts.length > 0) {
    renderHeatmap(contracts);
    // Populate industry filter dropdown for 3D views
    populateIndustryDropdown(contracts);
  } else {
    hideChart();
  }

  // Update tab badge with contract count
  updateTabBadge('contracts', contracts.length);

  // Render volume chart and legend (will show when tab is active)
  renderVolumeChart(contracts);
  renderIndustryLegend(contracts);

  // Update old-style stats (for compatibility)
  const statsEl = document.getElementById('stats');
  if (statsEl) {
    statsEl.innerHTML = `
      Found <strong>${formatNumber(stats.afterFilters)}</strong> contracts
      (from ${formatNumber(stats.totalFetched)} total)
      across ${stats.tickersScanned} tickers
      in ${(stats.scanTime / 1000).toFixed(1)}s
    `;
  }

  // Update dashboard stats
  updateDashboardStats(contracts, stats);

  // Build table body
  const tbody = document.getElementById('resultsBody');
  if (!tbody) return;

  if (contracts.length === 0) {
    tbody.innerHTML = '<tr><td colspan="12" class="no-results">No contracts match your filters</td></tr>';
    return;
  }

  // Limit display for performance (pagination TODO)
  const displayContracts = contracts.slice(0, 500);

  tbody.innerHTML = displayContracts.map(c => `
    <tr>
      <td class="ticker">${c.underlying}</td>
      <td class="industry">${c._meta.industry || '-'}</td>
      <td class="strike">${c.strike != null ? c.strike.toFixed(2) : '-'}</td>
      <td class="expiration">${formatDate(c.expiration)}</td>
      <td class="dte">${c.dte != null ? c.dte : '-'}</td>
      <td class="bid">${formatCurrency(c.bid)}</td>
      <td class="ask">${formatCurrency(c.ask)}</td>
      <td class="last">${formatCurrency(c.last)}</td>
      <td class="iv">${formatPercent(c.iv)}</td>
      <td class="delta">${c.delta != null ? c.delta.toFixed(3) : '-'}</td>
      <td class="volume">${formatNumber(c.volume)}</td>
      <td class="oi">${formatNumber(c.openInterest)}</td>
    </tr>
  `).join('');

  // Show truncation warning if needed
  if (contracts.length > 500) {
    const warning = document.createElement('tr');
    warning.innerHTML = `<td colspan="12" class="truncated">Showing first 500 of ${contracts.length} results</td>`;
    tbody.appendChild(warning);
  }

  // Update results info
  const resultsShowing = document.getElementById('resultsShowing');
  if (resultsShowing) {
    if (contracts.length > 500) {
      resultsShowing.textContent = `Showing 500 of ${contracts.length} results`;
    } else {
      resultsShowing.textContent = `Showing ${contracts.length} results`;
    }
  }
}

/**
 * Update dashboard stats (header, bottom bar, sidebar)
 */
function updateDashboardStats(contracts, stats) {
  // Header stats
  const resultCount = document.getElementById('resultCount');
  const tickerCount = document.getElementById('tickerCount');
  const avgIV = document.getElementById('avgIV');

  if (resultCount) resultCount.textContent = formatNumber(contracts.length);
  if (tickerCount) tickerCount.textContent = stats.tickersScanned || 0;

  // Calculate average IV
  if (avgIV) {
    const validIVs = contracts.filter(c => c.iv != null).map(c => c.iv);
    if (validIVs.length > 0) {
      const avg = validIVs.reduce((a, b) => a + b, 0) / validIVs.length;
      avgIV.textContent = formatPercent(avg);
    } else {
      avgIV.textContent = '--';
    }
  }

  // Bottom bar stats
  const bottomResultCount = document.getElementById('bottomResultCount');
  const avgDelta = document.getElementById('avgDelta');

  if (bottomResultCount) bottomResultCount.textContent = formatNumber(contracts.length);

  if (avgDelta) {
    const validDeltas = contracts.filter(c => c.delta != null).map(c => c.delta);
    if (validDeltas.length > 0) {
      const avg = validDeltas.reduce((a, b) => a + b, 0) / validDeltas.length;
      avgDelta.textContent = avg.toFixed(3);
    } else {
      avgDelta.textContent = '--';
    }
  }

  // Sidebar summary stats
  const lowIVCount = document.getElementById('lowIVCount');
  const highOICount = document.getElementById('highOICount');
  const deepITMCount = document.getElementById('deepITMCount');

  if (lowIVCount) {
    const count = contracts.filter(c => c.iv != null && c.iv < 0.30).length;
    lowIVCount.textContent = formatNumber(count);
  }

  if (highOICount) {
    const count = contracts.filter(c => c.openInterest != null && c.openInterest > 1000).length;
    highOICount.textContent = formatNumber(count);
  }

  if (deepITMCount) {
    const count = contracts.filter(c => c.delta != null && c.delta > 0.7).length;
    deepITMCount.textContent = formatNumber(count);
  }
}

/**
 * Sort results by field
 */
function sortResults(field) {
  if (!currentResults || !currentResults.contracts) return;
  
  // Determine sort direction (toggle if same field)
  const currentSort = currentResults.params?.sortBy;
  const currentDir = currentResults.params?.sortDir || 'asc';
  
  let newDir = 'asc';
  if (field === currentSort) {
    newDir = currentDir === 'asc' ? 'desc' : 'asc';
  }
  
  // Sort
  currentResults.contracts.sort((a, b) => {
    let aVal = a[field];
    let bVal = b[field];
    
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    
    if (newDir === 'asc') {
      return aVal - bVal;
    } else {
      return bVal - aVal;
    }
  });
  
  // Update params
  currentResults.params.sortBy = field;
  currentResults.params.sortDir = newDir;
  
  // Re-display
  displayResults(currentResults);
  
  // Update header indicators
  updateSortIndicators(field, newDir);
}

/**
 * Update sort indicators in table headers
 */
function updateSortIndicators(field, dir) {
  // Remove all indicators
  document.querySelectorAll('.sortable').forEach(el => {
    el.classList.remove('sort-asc', 'sort-desc');
  });
  
  // Add indicator to current
  const header = document.querySelector(`.sortable[data-field="${field}"]`);
  if (header) {
    header.classList.add(dir === 'asc' ? 'sort-asc' : 'sort-desc');
  }
}

// =============================================================================
// Cache Management Functions
// =============================================================================

/**
 * Set up settings dropdown interactions
 */
function setupSettingsDropdown() {
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsMenu = document.getElementById('settingsMenu');
  const forceRefreshBtn = document.getElementById('forceRefreshBtn');
  const loadPreviousBtn = document.getElementById('loadPreviousBtn');
  const clearCacheBtn = document.getElementById('clearCacheBtn');

  if (!settingsBtn || !settingsMenu) return;

  // Toggle dropdown
  settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    settingsMenu.classList.toggle('open');
    settingsBtn.classList.toggle('active');
    if (settingsMenu.classList.contains('open')) {
      updateCacheUI();
    }
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!settingsBtn.contains(e.target) && !settingsMenu.contains(e.target)) {
      settingsMenu.classList.remove('open');
      settingsBtn.classList.remove('active');
    }
  });

  // Force refresh button
  if (forceRefreshBtn) {
    forceRefreshBtn.addEventListener('click', () => {
      forceRefresh = true;
      settingsMenu.classList.remove('open');
      settingsBtn.classList.remove('active');
      runScan();
    });
  }

  // Load previous scan button
  if (loadPreviousBtn) {
    loadPreviousBtn.addEventListener('click', () => {
      settingsMenu.classList.remove('open');
      settingsBtn.classList.remove('active');
      openScanPicker();
    });
  }

  // Clear cache button
  if (clearCacheBtn) {
    clearCacheBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to clear all cached scans?')) {
        await cacheManager.clearAll();
        updateCacheUI();
        settingsMenu.classList.remove('open');
        settingsBtn.classList.remove('active');
        showToast('Cache cleared', 'success');
      }
    });
  }
}

/**
 * Set up scan picker modal interactions
 */
function setupScanPickerModal() {
  const modal = document.getElementById('scanPickerModal');
  const backdrop = document.getElementById('scanPickerBackdrop');
  const closeBtn = document.getElementById('closeScanPicker');
  const cancelBtn = document.getElementById('cancelScanPicker');
  const deleteAllBtn = document.getElementById('deleteAllScans');
  const listEl = document.getElementById('scanPickerList');

  if (!modal) return;

  // Close handlers
  const closeModal = () => {
    modal.classList.remove('open');
  };

  if (backdrop) backdrop.addEventListener('click', closeModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  // Delete all button
  if (deleteAllBtn) {
    deleteAllBtn.addEventListener('click', async () => {
      if (confirm('Delete all cached scans?')) {
        await cacheManager.clearAll();
        updateCacheUI();
        closeModal();
        showToast('All cached scans deleted', 'success');
      }
    });
  }

  // Event delegation for scan list items (prevents memory leak)
  if (listEl) {
    listEl.addEventListener('click', async (e) => {
      const loadBtn = e.target.closest('.scan-picker-load');
      const deleteBtn = e.target.closest('.scan-picker-delete');
      const item = e.target.closest('.scan-picker-item');

      if (loadBtn) {
        e.stopPropagation();
        const scanId = parseInt(loadBtn.dataset.scanId);
        await loadScanFromCache(scanId);
        modal.classList.remove('open');
      } else if (deleteBtn) {
        e.stopPropagation();
        const scanId = parseInt(deleteBtn.dataset.scanId);
        await cacheManager.deleteScan(scanId);
        updateCacheUI();
        openScanPicker(); // Refresh the list
        showToast('Scan deleted', 'success');
      } else if (item && !loadBtn && !deleteBtn) {
        // Click on row to select
        listEl.querySelectorAll('.scan-picker-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
      }
    });
  }

  // ESC to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) {
      closeModal();
    }
  });
}

/**
 * Try to load the most recent scan from cache on startup
 */
async function tryLoadFromCache() {
  if (!cacheManager.isAvailable) return;
  if (forceRefresh) return; // Skip cache when force refresh requested

  const latestScan = await cacheManager.getLatestScan();
  if (!latestScan) return;

  // Check if data is stale
  const scanAge = Date.now() - new Date(latestScan.timestamp).getTime();
  const isStale = scanAge > 4 * 60 * 60 * 1000; // 4 hours

  // Load the cached data
  currentResults = latestScan.results;
  displayResults(latestScan.results);

  // Show appropriate toast
  const timeAgo = formatRelativeTime(latestScan.timestamp);
  if (isStale) {
    showToast(`Loaded cached data from ${timeAgo} (may be outdated)`, 'warning');
  } else {
    showToast(`Loaded cached data from ${timeAgo}`, 'success');
  }

  console.log('Loaded scan from cache:', latestScan.label);
}

/**
 * Update cache-related UI elements
 */
async function updateCacheUI() {
  const lastScanEl = document.getElementById('cacheLastScan');
  const sizeInfoEl = document.getElementById('cacheSizeInfo');

  if (!cacheManager.isAvailable) {
    if (lastScanEl) lastScanEl.textContent = 'Unavailable';
    if (sizeInfoEl) sizeInfoEl.textContent = 'Cache disabled';
    return;
  }

  const stats = await cacheManager.getStats();
  const scans = await cacheManager.listScans();

  // Update last scan time
  if (lastScanEl) {
    if (scans.length > 0) {
      lastScanEl.textContent = formatRelativeTime(scans[0].timestamp);
    } else {
      lastScanEl.textContent = 'Never';
    }
  }

  // Update size info
  if (sizeInfoEl) {
    sizeInfoEl.textContent = `${stats.totalSizeFormatted} (${stats.scanCount} scans)`;
  }
}

/**
 * Open the scan picker modal
 */
async function openScanPicker() {
  const modal = document.getElementById('scanPickerModal');
  const listEl = document.getElementById('scanPickerList');

  if (!modal || !listEl) return;

  // Get list of scans
  const scans = await cacheManager.listScans();

  // Build list HTML
  if (scans.length === 0) {
    listEl.innerHTML = `
      <div class="scan-picker-empty">
        <i class="ph ph-folder-dashed"></i>
        <p>No cached scans</p>
        <span>Run a scan to save results</span>
      </div>
    `;
  } else {
    listEl.innerHTML = scans.map(scan => `
      <div class="scan-picker-item ${scan.isStale ? 'stale' : ''}" data-scan-id="${scan.id}">
        <div class="scan-picker-radio"></div>
        <div class="scan-picker-info">
          <div class="scan-picker-label">
            ${scan.label}
            ${scan.isStale ? '<span class="stale-badge">STALE</span>' : ''}
          </div>
          <div class="scan-picker-meta">
            <span><i class="ph ph-calendar"></i> ${formatRelativeTime(scan.timestamp)}</span>
            <span><i class="ph ph-database"></i> ${formatBytes(scan.size)}</span>
          </div>
        </div>
        <div class="scan-picker-actions">
          <button class="scan-picker-load" data-scan-id="${scan.id}">Load</button>
          <button class="scan-picker-delete" data-scan-id="${scan.id}" title="Delete this scan">
            <i class="ph ph-trash"></i>
          </button>
        </div>
      </div>
    `).join('');
    // Event listeners handled via delegation in setupScanPickerModal()
  }

  // Open modal
  modal.classList.add('open');
}

/**
 * Load a specific scan from cache
 */
async function loadScanFromCache(scanId) {
  const scan = await cacheManager.loadScan(scanId);
  if (!scan) {
    showToast('Failed to load scan', 'error');
    return;
  }

  currentResults = scan.results;
  displayResults(scan.results);

  const timeAgo = formatRelativeTime(scan.timestamp);
  showToast(`Loaded: ${scan.label}`, 'success');

  console.log('Loaded scan from cache:', scan.label);
}

/**
 * Show a toast notification
 */
let toastTimeout = null;

function showToast(message, type = 'info') {
  const toast = document.getElementById('cacheToast');
  const messageEl = document.getElementById('cacheToastMessage');

  if (!toast || !messageEl) return;

  // Clear any existing timeout to prevent early hide
  if (toastTimeout) {
    clearTimeout(toastTimeout);
  }

  // Update content
  messageEl.textContent = message;

  // Update type class
  toast.classList.remove('success', 'warning', 'error');
  if (type !== 'info') {
    toast.classList.add(type);
  }

  // Show toast
  toast.classList.add('visible');

  // Hide after delay
  toastTimeout = setTimeout(() => {
    toast.classList.remove('visible');
    toastTimeout = null;
  }, 3000);
}

/**
 * Format a timestamp as relative time (e.g., "2 hours ago")
 */
function formatRelativeTime(timestamp) {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diff = now - then;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  // Format as date
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Export results to CSV
 */
export function exportCSV() {
  if (!currentResults || !currentResults.contracts) {
    alert('No results to export');
    return;
  }
  
  const headers = [
    'Ticker', 'Industry', 'Strike', 'Expiration', 'DTE',
    'Bid', 'Ask', 'Last', 'IV', 'Delta', 'Volume', 'Open Interest',
    'Underlying Price', 'Contract'
  ];
  
  const rows = currentResults.contracts.map(c => [
    c.underlying,
    c._meta.industry || '',
    c.strike,
    c.expiration,
    c.dte,
    c.bid,
    c.ask,
    c.last,
    c.iv,
    c.delta,
    c.volume,
    c.openInterest,
    c.underlyingPrice,
    c.contractTicker
  ]);
  
  const csv = [headers, ...rows]
    .map(row => row.map(cell => {
      if (cell == null) return '';
      if (typeof cell === 'string' && cell.includes(',')) {
        return `"${cell}"`;
      }
      return cell;
    }).join(','))
    .join('\n');
  
  // Download
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `options-scan-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Make functions available globally for HTML onclick handlers
window.runScan = runScan;
window.exportCSV = exportCSV;

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
