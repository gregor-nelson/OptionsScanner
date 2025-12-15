/**
 * Main Application - Wires together all modules and handles UI
 * Dashboard Layout Version
 */

import { ApiClient } from './api.js';
import { OptionsScanner } from './scanner.js';
import { CONFIG, DEFAULT_UNIVERSE } from './config.js';
import { formatCurrency, formatPercent, formatDate, formatNumber } from './utils.js';
import { renderHeatmap, hideChart, resetChartState, resizeChart, initViewTabs, init3dChart, populateIndustryDropdown, setIndustryFilter } from './chart.js';
import { cacheManager } from './cache.js';
import { renderVolumeChart, refreshVolumeChart, setupVolumeControls, resizeVolumeChart, renderIndustryLegend } from './volume.js';

// Global state
let scanner = null;
let currentResults = null;
let currentOptionType = 'calls'; // 'calls' or 'puts'
let activeTab = 'heatmap';
let forceRefresh = false; // Skip cache when true

// Secondary filter state (post-scan filtering)
let fullResults = null; // Store unfiltered results
let secondaryFilterDebounceTimer = null;

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

  // Back to All Industries button
  const backToAllBtn = document.getElementById('backToAllBtn');
  if (backToAllBtn) {
    backToAllBtn.addEventListener('click', () => {
      setIndustryFilter('all');
    });
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

  // Set up mobile sidebar toggles
  setupMobileSidebars();

  // Set up secondary filters (post-scan)
  setupSecondaryFilters();
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
 * Set up mobile sidebar toggles with swipe-to-close gesture
 */
function setupMobileSidebars() {
  const filtersToggle = document.getElementById('filtersToggle');
  const universeToggle = document.getElementById('universeToggle');
  const filtersClose = document.getElementById('filtersClose');
  const universeClose = document.getElementById('universeClose');
  const filtersSidebar = document.getElementById('filtersSidebar');
  const universeSidebar = document.getElementById('universeSidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');

  // Helper to close all sidebars
  const closeAllSidebars = () => {
    filtersSidebar?.classList.remove('open');
    universeSidebar?.classList.remove('open');
    sidebarOverlay?.classList.remove('visible');
    filtersToggle?.classList.remove('active');
    universeToggle?.classList.remove('active');
    document.body.style.overflow = '';
  };

  // Filters toggle
  if (filtersToggle && filtersSidebar) {
    filtersToggle.addEventListener('click', () => {
      const isOpen = filtersSidebar.classList.contains('open');
      closeAllSidebars();
      if (!isOpen) {
        filtersSidebar.classList.add('open');
        sidebarOverlay?.classList.add('visible');
        filtersToggle.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
    });
  }

  // Universe toggle
  if (universeToggle && universeSidebar) {
    universeToggle.addEventListener('click', () => {
      const isOpen = universeSidebar.classList.contains('open');
      closeAllSidebars();
      if (!isOpen) {
        universeSidebar.classList.add('open');
        sidebarOverlay?.classList.add('visible');
        universeToggle.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
    });
  }

  // Close buttons
  filtersClose?.addEventListener('click', closeAllSidebars);
  universeClose?.addEventListener('click', closeAllSidebars);

  // Overlay click closes sidebars
  sidebarOverlay?.addEventListener('click', closeAllSidebars);

  // ESC key closes sidebars
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (filtersSidebar?.classList.contains('open') || universeSidebar?.classList.contains('open')) {
        closeAllSidebars();
      }
    }
  });

  // Close sidebars on window resize to desktop size
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (window.innerWidth > 768) {
        closeAllSidebars();
      }
    }, 150);
  });

  // Swipe-to-close gesture for sidebars
  setupSwipeToClose(filtersSidebar, 'left', closeAllSidebars);
  setupSwipeToClose(universeSidebar, 'right', closeAllSidebars);
}

/**
 * Set up swipe-to-close gesture for a sidebar with visual feedback
 * @param {HTMLElement} sidebar - The sidebar element
 * @param {string} direction - 'left' or 'right' (direction to swipe to close)
 * @param {Function} onClose - Callback when closed
 */
function setupSwipeToClose(sidebar, direction, onClose) {
  if (!sidebar) return;

  const SWIPE_THRESHOLD = 50; // Minimum distance for swipe
  const VELOCITY_THRESHOLD = 0.3; // Minimum velocity for quick swipe
  const MAX_SWIPE_DISTANCE = 200; // Max distance for visual feedback calculation

  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  let isSwiping = false;
  let currentDeltaX = 0;

  // Get overlay for opacity feedback
  const overlay = document.getElementById('sidebarOverlay');

  /**
   * Apply visual feedback during swipe
   */
  const applySwipeFeedback = (deltaX) => {
    // Only apply feedback when swiping in close direction
    const isClosingDirection = (direction === 'left' && deltaX < 0) || (direction === 'right' && deltaX > 0);
    if (!isClosingDirection) {
      resetSwipeFeedback();
      return;
    }

    const absDistance = Math.abs(deltaX);
    const progress = Math.min(absDistance / MAX_SWIPE_DISTANCE, 1);

    // Disable transition during drag for smooth feedback
    sidebar.style.transition = 'none';

    // Apply transform (follow finger)
    const translateX = direction === 'left' ? deltaX : deltaX;
    sidebar.style.transform = `translateX(${translateX}px)`;

    // Apply opacity to sidebar based on swipe progress
    sidebar.style.opacity = 1 - (progress * 0.3);

    // Apply opacity to overlay
    if (overlay) {
      overlay.style.transition = 'none';
      overlay.style.opacity = 1 - progress;
    }
  };

  /**
   * Reset visual feedback (snap back)
   */
  const resetSwipeFeedback = () => {
    // Re-enable transition for snap back
    sidebar.style.transition = '';
    sidebar.style.transform = '';
    sidebar.style.opacity = '';

    if (overlay) {
      overlay.style.transition = '';
      overlay.style.opacity = '';
    }
  };

  sidebar.addEventListener('touchstart', (e) => {
    // Only track if sidebar is open
    if (!sidebar.classList.contains('open')) return;

    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStartTime = Date.now();
    isSwiping = false;
    currentDeltaX = 0;
  }, { passive: true });

  sidebar.addEventListener('touchmove', (e) => {
    if (!sidebar.classList.contains('open')) return;

    const touchX = e.touches[0].clientX;
    const touchY = e.touches[0].clientY;
    const deltaX = touchX - touchStartX;
    const deltaY = touchY - touchStartY;

    // Only consider horizontal swipes (more horizontal than vertical movement)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
      isSwiping = true;
      currentDeltaX = deltaX;

      // Check if swiping in the correct direction to close
      if ((direction === 'left' && deltaX < 0) || (direction === 'right' && deltaX > 0)) {
        // Prevent scrolling while swiping
        e.preventDefault();
        // Apply visual feedback
        applySwipeFeedback(deltaX);
      }
    }
  }, { passive: false });

  sidebar.addEventListener('touchend', (e) => {
    if (!sidebar.classList.contains('open')) {
      resetSwipeFeedback();
      return;
    }

    const touchEndX = e.changedTouches[0].clientX;
    const deltaX = touchEndX - touchStartX;
    const deltaTime = Date.now() - touchStartTime;
    const velocity = Math.abs(deltaX) / deltaTime;

    // Check if swipe was in the correct direction and met threshold
    const swipedCorrectDirection = (direction === 'left' && deltaX < 0) || (direction === 'right' && deltaX > 0);
    const swipedFarEnough = Math.abs(deltaX) >= SWIPE_THRESHOLD;
    const swipedFastEnough = velocity >= VELOCITY_THRESHOLD;

    if (isSwiping && swipedCorrectDirection && (swipedFarEnough || swipedFastEnough)) {
      // Close the sidebar - CSS transition will animate the close
      resetSwipeFeedback();
      onClose();
    } else {
      // Snap back with animation
      resetSwipeFeedback();
    }

    isSwiping = false;
    currentDeltaX = 0;
  }, { passive: true });

  // Handle touch cancel (e.g., phone call interrupts)
  sidebar.addEventListener('touchcancel', () => {
    resetSwipeFeedback();
    isSwiping = false;
    currentDeltaX = 0;
  }, { passive: true });
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

  // Store full results for secondary filtering
  fullResults = results;

  // Clear any existing secondary filters when new scan loads
  clearSecondaryFiltersUI();

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
    tbody.innerHTML = '<tr><td colspan="13" class="no-results">No contracts match your filters</td></tr>';
    return;
  }

  // Limit display for performance (pagination TODO)
  const displayContracts = contracts.slice(0, 500);

  tbody.innerHTML = displayContracts.map(c => `
    <tr>
      <td class="ticker">${c.underlying}</td>
      <td class="company">${c._meta?.company || '-'}</td>
      <td class="industry">${c._meta?.industry || '-'}</td>
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
    warning.innerHTML = `<td colspan="13" class="truncated">Showing first 500 of ${contracts.length} results</td>`;
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

// =============================================================================
// Secondary Filter Functions (Post-Scan Filtering)
// =============================================================================

/**
 * Get current secondary filter values from the UI
 */
function getSecondaryFilterValues() {
  const getValue = (id) => {
    const el = document.getElementById(id);
    if (!el) return null;
    const val = el.value.trim();
    return val === '' ? null : val;
  };

  const getNumValue = (id) => {
    const val = getValue(id);
    if (val === null) return null;
    const num = parseFloat(val);
    return isNaN(num) ? null : num;
  };

  // Get moneyness checkboxes
  const moneyness = [];
  if (document.getElementById('filterITM')?.checked) moneyness.push('ITM');
  if (document.getElementById('filterATM')?.checked) moneyness.push('ATM');
  if (document.getElementById('filterOTM')?.checked) moneyness.push('OTM');

  return {
    ticker: getValue('filterTicker'),
    company: getValue('filterCompany'),
    moneyness: moneyness,
    strikeMin: getNumValue('filterStrikeMin'),
    strikeMax: getNumValue('filterStrikeMax'),
    dteMin: getNumValue('filterDTEMin'),
    dteMax: getNumValue('filterDTEMax'),
    ivMin: getNumValue('filterIVMin'),
    ivMax: getNumValue('filterIVMax'),
    bidMin: getNumValue('filterBidMin'),
    bidMax: getNumValue('filterBidMax'),
    deltaMin: getNumValue('filterDeltaMin'),
    deltaMax: getNumValue('filterDeltaMax'),
    volumeMin: getNumValue('filterVolumeMin'),
    oiMin: getNumValue('filterOIMin')
  };
}

/**
 * Apply secondary filters to the full results
 */
function applySecondaryFilters(contracts, filters) {
  return contracts.filter(c => {
    // Text filters (case-insensitive includes)
    if (filters.ticker && !c.underlying?.toLowerCase().includes(filters.ticker.toLowerCase())) {
      return false;
    }
    if (filters.company && !c._meta?.company?.toLowerCase().includes(filters.company.toLowerCase())) {
      return false;
    }

    // Moneyness checkboxes (OR logic)
    if (filters.moneyness.length > 0 && filters.moneyness.length < 3) {
      if (!filters.moneyness.includes(c.moneyness)) {
        return false;
      }
    }

    // Range filters
    if (filters.strikeMin != null && (c.strike == null || c.strike < filters.strikeMin)) {
      return false;
    }
    if (filters.strikeMax != null && (c.strike == null || c.strike > filters.strikeMax)) {
      return false;
    }

    if (filters.dteMin != null && (c.dte == null || c.dte < filters.dteMin)) {
      return false;
    }
    if (filters.dteMax != null && (c.dte == null || c.dte > filters.dteMax)) {
      return false;
    }

    // IV filters (convert from percentage input to decimal)
    if (filters.ivMin != null && (c.iv == null || c.iv * 100 < filters.ivMin)) {
      return false;
    }
    if (filters.ivMax != null && (c.iv == null || c.iv * 100 > filters.ivMax)) {
      return false;
    }

    if (filters.bidMin != null && (c.bid == null || c.bid < filters.bidMin)) {
      return false;
    }
    if (filters.bidMax != null && (c.bid == null || c.bid > filters.bidMax)) {
      return false;
    }

    if (filters.deltaMin != null && (c.delta == null || Math.abs(c.delta) < filters.deltaMin)) {
      return false;
    }
    if (filters.deltaMax != null && (c.delta == null || Math.abs(c.delta) > filters.deltaMax)) {
      return false;
    }

    // Min-only filters
    if (filters.volumeMin != null && (c.volume == null || c.volume < filters.volumeMin)) {
      return false;
    }
    if (filters.oiMin != null && (c.openInterest == null || c.openInterest < filters.oiMin)) {
      return false;
    }

    return true;
  });
}

/**
 * Handle secondary filter changes with debounce
 */
function onSecondaryFilterChange() {
  // Clear any existing debounce timer
  if (secondaryFilterDebounceTimer) {
    clearTimeout(secondaryFilterDebounceTimer);
  }

  // Debounce the filter application
  secondaryFilterDebounceTimer = setTimeout(() => {
    applyAndDisplaySecondaryFilters();
  }, 300);
}

/**
 * Apply secondary filters and update the display
 */
function applyAndDisplaySecondaryFilters() {
  if (!fullResults || !fullResults.contracts) return;

  const filters = getSecondaryFilterValues();
  const filteredContracts = applySecondaryFilters(fullResults.contracts, filters);

  // Create a new results object with filtered contracts
  const filteredResults = {
    ...fullResults,
    contracts: filteredContracts
  };

  // Update the display
  displayFilteredResults(filteredResults, fullResults.contracts.length);
}

/**
 * Display filtered results (similar to displayResults but shows filter count)
 */
function displayFilteredResults(results, totalCount) {
  const { contracts, stats } = results;

  // Update tab badge with filtered contract count
  updateTabBadge('contracts', contracts.length);

  // Build table body
  const tbody = document.getElementById('resultsBody');
  if (!tbody) return;

  if (contracts.length === 0) {
    tbody.innerHTML = '<tr><td colspan="13" class="no-results">No contracts match your filters</td></tr>';
    updateResultsInfo(0, totalCount);
    return;
  }

  // Limit display for performance
  const displayContracts = contracts.slice(0, 500);

  tbody.innerHTML = displayContracts.map(c => `
    <tr>
      <td class="ticker">${c.underlying}</td>
      <td class="company">${c._meta?.company || '-'}</td>
      <td class="industry">${c._meta?.industry || '-'}</td>
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
    warning.innerHTML = `<td colspan="13" class="truncated">Showing first 500 of ${contracts.length} filtered results</td>`;
    tbody.appendChild(warning);
  }

  // Update results info with filter count
  updateResultsInfo(contracts.length, totalCount);
}

/**
 * Update results info text
 */
function updateResultsInfo(filteredCount, totalCount) {
  const resultsShowing = document.getElementById('resultsShowing');
  if (resultsShowing) {
    if (filteredCount === totalCount) {
      if (totalCount > 500) {
        resultsShowing.textContent = `Showing 500 of ${totalCount} results`;
      } else {
        resultsShowing.textContent = `Showing ${totalCount} results`;
      }
    } else {
      if (filteredCount > 500) {
        resultsShowing.textContent = `Showing 500 of ${filteredCount} filtered (${totalCount} total)`;
      } else {
        resultsShowing.textContent = `Showing ${filteredCount} of ${totalCount} results`;
      }
    }
  }
}

/**
 * Clear secondary filter UI elements (without triggering re-filter)
 */
function clearSecondaryFiltersUI() {
  // Clear text inputs
  const textInputs = ['filterTicker', 'filterCompany'];
  textInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  // Clear number inputs
  const numInputs = [
    'filterStrikeMin', 'filterStrikeMax',
    'filterDTEMin', 'filterDTEMax',
    'filterIVMin', 'filterIVMax',
    'filterBidMin', 'filterBidMax',
    'filterDeltaMin', 'filterDeltaMax',
    'filterVolumeMin', 'filterOIMin'
  ];
  numInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  // Reset moneyness checkboxes to all checked
  ['filterITM', 'filterATM', 'filterOTM'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.checked = true;
  });
}

/**
 * Clear all secondary filters and re-apply
 */
function clearSecondaryFilters() {
  clearSecondaryFiltersUI();
  // Re-apply filters (which will now show all results)
  applyAndDisplaySecondaryFilters();
}

/**
 * Set up event listeners for secondary filters
 */
function setupSecondaryFilters() {
  // Text inputs
  const textInputs = ['filterTicker', 'filterCompany'];
  textInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', onSecondaryFilterChange);
    }
  });

  // Number inputs
  const numInputs = [
    'filterStrikeMin', 'filterStrikeMax',
    'filterDTEMin', 'filterDTEMax',
    'filterIVMin', 'filterIVMax',
    'filterBidMin', 'filterBidMax',
    'filterDeltaMin', 'filterDeltaMax',
    'filterVolumeMin', 'filterOIMin'
  ];
  numInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', onSecondaryFilterChange);
    }
  });

  // Moneyness checkboxes
  ['filterITM', 'filterATM', 'filterOTM'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', onSecondaryFilterChange);
    }
  });

  // Clear filters button
  const clearBtn = document.getElementById('clearSecondaryFilters');
  if (clearBtn) {
    clearBtn.addEventListener('click', clearSecondaryFilters);
  }
}

/**
 * Sort results by field
 */
function sortResults(field) {
  if (!fullResults || !fullResults.contracts) return;

  // Determine sort direction (toggle if same field)
  const currentSort = fullResults.params?.sortBy;
  const currentDir = fullResults.params?.sortDir || 'asc';

  let newDir = 'asc';
  if (field === currentSort) {
    newDir = currentDir === 'asc' ? 'desc' : 'asc';
  }

  // Helper to get nested field value (e.g., "_meta.company")
  const getFieldValue = (obj, fieldPath) => {
    return fieldPath.split('.').reduce((o, k) => o?.[k], obj);
  };

  // Sort fullResults
  fullResults.contracts.sort((a, b) => {
    let aVal = getFieldValue(a, field);
    let bVal = getFieldValue(b, field);

    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;

    // String comparison for text fields
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      const cmp = aVal.localeCompare(bVal);
      return newDir === 'asc' ? cmp : -cmp;
    }

    if (newDir === 'asc') {
      return aVal - bVal;
    } else {
      return bVal - aVal;
    }
  });

  // Update params
  if (!fullResults.params) fullResults.params = {};
  fullResults.params.sortBy = field;
  fullResults.params.sortDir = newDir;

  // Also update currentResults reference
  currentResults = fullResults;

  // Re-apply secondary filters and display
  applyAndDisplaySecondaryFilters();

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
