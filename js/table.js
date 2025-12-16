/**
 * Table Module - Contract Table Rendering & Management
 * 
 * Handles:
 * - Table rendering with configurable columns
 * - Column sorting with indicators
 * - Secondary (post-scan) filtering with debounce
 * - CSV export
 * - Results info display
 */

import { formatCurrency, formatPercent, formatDate, formatNumber } from './utils.js';

// =============================================================================
// Configuration
// =============================================================================

/**
 * Column definitions for the contracts table
 * Each column defines: key (data path), label, sortable, formatter, align
 */
const COLUMN_DEFS = [
  { key: 'underlying',      label: 'Ticker',   sortable: true,  format: 'text',     align: 'left',   className: 'ticker' },
  { key: '_meta.company',   label: 'Company',  sortable: true,  format: 'text',     align: 'left',   className: 'company' },
  { key: '_meta.industry',  label: 'Industry', sortable: false, format: 'text',     align: 'left',   className: 'industry' },
  { key: 'strike',          label: 'Strike',   sortable: true,  format: 'strike',   align: 'right',  className: 'strike' },
  { key: 'expiration',      label: 'Exp',      sortable: true,  format: 'date',     align: 'left',   className: 'expiration' },
  { key: 'dte',             label: 'DTE',      sortable: true,  format: 'number',   align: 'right',  className: 'dte' },
  { key: 'bid',             label: 'Bid',      sortable: true,  format: 'currency', align: 'right',  className: 'bid' },
  { key: 'ask',             label: 'Ask',      sortable: true,  format: 'currency', align: 'right',  className: 'ask' },
  { key: 'last',            label: 'Last',     sortable: true,  format: 'currency', align: 'right',  className: 'last' },
  { key: 'iv',              label: 'IV',       sortable: true,  format: 'percent',  align: 'right',  className: 'iv' },
  { key: 'delta',           label: 'Delta',    sortable: true,  format: 'delta',    align: 'right',  className: 'delta' },
  { key: 'volume',          label: 'Vol',      sortable: true,  format: 'number',   align: 'right',  className: 'volume' },
  { key: 'openInterest',    label: 'OI',       sortable: true,  format: 'number',   align: 'right',  className: 'oi' }
];

/**
 * Secondary filter definitions
 * Maps filter input IDs to their configuration
 */
const FILTER_DEFS = [
  // Text filters
  { id: 'filterTicker',    key: 'underlying',     type: 'text' },
  { id: 'filterCompany',   key: '_meta.company',  type: 'text' },
  // Range filters
  { id: 'filterStrikeMin', key: 'strike',         type: 'min' },
  { id: 'filterStrikeMax', key: 'strike',         type: 'max' },
  { id: 'filterDTEMin',    key: 'dte',            type: 'min' },
  { id: 'filterDTEMax',    key: 'dte',            type: 'max' },
  { id: 'filterIVMin',     key: 'iv',             type: 'min',  transform: v => v / 100 }, // Convert % to decimal
  { id: 'filterIVMax',     key: 'iv',             type: 'max',  transform: v => v / 100 },
  { id: 'filterBidMin',    key: 'bid',            type: 'min' },
  { id: 'filterBidMax',    key: 'bid',            type: 'max' },
  { id: 'filterDeltaMin',  key: 'delta',          type: 'min',  useAbs: true },
  { id: 'filterDeltaMax',  key: 'delta',          type: 'max',  useAbs: true },
  { id: 'filterVolumeMin', key: 'volume',         type: 'min' },
  { id: 'filterOIMin',     key: 'openInterest',   type: 'min' }
];

const CONFIG = {
  maxDisplayRows: 500,
  debounceMs: 300
};

// =============================================================================
// Module State
// =============================================================================

let allContracts = [];           // Full dataset from last render
let filteredContracts = [];      // After secondary filters applied
let sortState = { field: 'last', dir: 'asc' };
let filterDebounceTimer = null;
let callbacks = {};              // External callbacks (onFilterChange, onRowClick)

// =============================================================================
// Formatting Helpers
// =============================================================================

/**
 * Get a potentially nested field value from an object
 * @param {object} obj - The object to get the value from
 * @param {string} path - Dot-separated path (e.g., "_meta.company")
 * @returns {any}
 */
function getFieldValue(obj, path) {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

/**
 * Format a cell value based on column definition
 * @param {any} value - The raw value
 * @param {string} format - The format type
 * @returns {string}
 */
function formatCell(value, format) {
  if (value == null) return '-';
  
  switch (format) {
    case 'currency':
      return formatCurrency(value);
    case 'percent':
      return formatPercent(value);
    case 'date':
      return formatDate(value);
    case 'number':
      return formatNumber(value);
    case 'strike':
      return value.toFixed(2);
    case 'delta':
      return value.toFixed(3);
    case 'text':
    default:
      return value || '-';
  }
}

// =============================================================================
// Conditional Coloring
// =============================================================================

/**
 * Color thresholds for opportunity detection
 * - 'positive' class = opportunity/good (teal)
 * - 'neutral' class = neutral (default)
 * - 'negative' class = caution/expensive (red)
 */
const COLOR_THRESHOLDS = {
  iv: {
    low: 0.25,    // < 25% IV = cheap volatility (opportunity)
    high: 0.50    // > 50% IV = expensive
  },
  delta: {
    low: 0.20,    // < 0.20 = far OTM
    high: 0.50    // > 0.50 = ITM
  },
  dte: {
    low: 30,      // < 30 days = short-term (urgent)
    high: 90      // > 90 days = LEAPS (time)
  },
  price: {
    low: 0.50,    // < $0.50 = cheap
    high: 2.00    // > $2.00 = expensive
  }
};

/**
 * Get color class for IV value
 * Low IV = opportunity (green), High IV = expensive (red)
 * @param {number} iv - IV as decimal (0.25 = 25%)
 * @returns {string} CSS class
 */
function getIvColorClass(iv) {
  if (iv == null) return '';
  if (iv < COLOR_THRESHOLDS.iv.low) return 'cell-positive';  // Low IV = opportunity
  if (iv > COLOR_THRESHOLDS.iv.high) return 'cell-negative'; // High IV = expensive
  return 'cell-neutral';
}

/**
 * Get color class for Delta value
 * Uses absolute delta - shows proximity to ATM
 * @param {number} delta - Delta value
 * @returns {string} CSS class
 */
function getDeltaColorClass(delta) {
  if (delta == null) return '';
  const absDelta = Math.abs(delta);
  if (absDelta < COLOR_THRESHOLDS.delta.low) return 'cell-muted';    // Far OTM
  if (absDelta > COLOR_THRESHOLDS.delta.high) return 'cell-accent';  // ITM
  return 'cell-neutral';
}

/**
 * Get color class for DTE value
 * Short DTE = urgent (warm), Long DTE = time (cool)
 * @param {number} dte - Days to expiration
 * @returns {string} CSS class
 */
function getDteColorClass(dte) {
  if (dte == null) return '';
  if (dte < COLOR_THRESHOLDS.dte.low) return 'cell-warning';   // Short-term, urgent
  if (dte > COLOR_THRESHOLDS.dte.high) return 'cell-cool';     // LEAPS, plenty of time
  return 'cell-neutral';
}

/**
 * Get color class for price (last/bid/ask)
 * Cheap = opportunity, Expensive = caution
 * @param {number} price - Option price
 * @returns {string} CSS class
 */
function getPriceColorClass(price) {
  if (price == null || price === 0) return '';
  if (price < COLOR_THRESHOLDS.price.low) return 'cell-positive';  // Cheap
  if (price > COLOR_THRESHOLDS.price.high) return 'cell-negative'; // Expensive
  return 'cell-neutral';
}

/**
 * Get the appropriate color class for a cell based on column and value
 * @param {string} columnKey - Column key from COLUMN_DEFS
 * @param {any} value - Cell value
 * @returns {string} CSS class for coloring
 */
function getCellColorClass(columnKey, value) {
  switch (columnKey) {
    case 'iv':
      return getIvColorClass(value);
    case 'delta':
      return getDeltaColorClass(value);
    case 'dte':
      return getDteColorClass(value);
    case 'last':
    case 'bid':
    case 'ask':
      return getPriceColorClass(value);
    default:
      return '';
  }
}

// =============================================================================
// Sorting
// =============================================================================

/**
 * Sort contracts array by a field
 * @param {object[]} contracts - Array to sort
 * @param {string} field - Field path to sort by
 * @param {string} dir - 'asc' or 'desc'
 * @returns {object[]} Sorted array (mutates original)
 */
function sortContracts(contracts, field, dir) {
  return contracts.sort((a, b) => {
    let aVal = getFieldValue(a, field);
    let bVal = getFieldValue(b, field);
    
    // Handle nulls - push to end
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    
    // String comparison for text fields
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      const cmp = aVal.localeCompare(bVal);
      return dir === 'asc' ? cmp : -cmp;
    }
    
    // Numeric comparison
    return dir === 'asc' ? aVal - bVal : bVal - aVal;
  });
}

/**
 * Update sort indicator classes on table headers
 * @param {string} field - Active sort field
 * @param {string} dir - Sort direction
 */
function updateSortIndicators(field, dir) {
  // Remove all indicators
  document.querySelectorAll('#resultsTable .sortable').forEach(el => {
    el.classList.remove('sort-asc', 'sort-desc');
  });
  
  // Add indicator to current
  const header = document.querySelector(`#resultsTable .sortable[data-field="${field}"]`);
  if (header) {
    header.classList.add(dir === 'asc' ? 'sort-asc' : 'sort-desc');
  }
}

// =============================================================================
// Secondary Filtering
// =============================================================================

/**
 * Get current filter values from the UI
 * @returns {object} Filter values keyed by filter ID
 */
function getFilterValues() {
  const values = {};
  
  FILTER_DEFS.forEach(def => {
    const el = document.getElementById(def.id);
    if (!el) return;
    
    const rawValue = el.value.trim();
    if (rawValue === '') return;
    
    if (def.type === 'text') {
      values[def.id] = rawValue.toLowerCase();
    } else {
      const num = parseFloat(rawValue);
      if (!isNaN(num)) {
        values[def.id] = def.transform ? def.transform(num) : num;
      }
    }
  });
  
  return values;
}

/**
 * Apply secondary filters to contracts
 * @param {object[]} contracts - Contracts to filter
 * @param {object} filterValues - Current filter values
 * @returns {object[]} Filtered contracts
 */
function applySecondaryFilters(contracts, filterValues) {
  if (Object.keys(filterValues).length === 0) {
    return contracts;
  }
  
  return contracts.filter(contract => {
    for (const def of FILTER_DEFS) {
      const filterValue = filterValues[def.id];
      if (filterValue == null) continue;
      
      let contractValue = getFieldValue(contract, def.key);
      
      // Handle absolute value for delta
      if (def.useAbs && contractValue != null) {
        contractValue = Math.abs(contractValue);
      }
      
      switch (def.type) {
        case 'text':
          if (!contractValue?.toLowerCase().includes(filterValue)) {
            return false;
          }
          break;
        case 'min':
          if (contractValue == null || contractValue < filterValue) {
            return false;
          }
          break;
        case 'max':
          if (contractValue == null || contractValue > filterValue) {
            return false;
          }
          break;
      }
    }
    return true;
  });
}

/**
 * Count active filters for badge display
 * @param {object} filterValues - Current filter values
 * @returns {number}
 */
function countActiveFilters(filterValues) {
  // Group by field to count ranges as single filter
  const activeFields = new Set();
  
  Object.keys(filterValues).forEach(id => {
    const def = FILTER_DEFS.find(d => d.id === id);
    if (def) {
      activeFields.add(def.key);
    }
  });
  
  return activeFields.size;
}

/**
 * Update the active filter count badge
 * @param {number} count 
 */
function updateFilterBadge(count) {
  const badge = document.getElementById('filterActiveCount');
  if (badge) {
    if (count > 0) {
      badge.textContent = `${count} active`;
      badge.classList.add('visible');
    } else {
      badge.classList.remove('visible');
    }
  }
}

/**
 * Clear all secondary filter inputs
 * @param {boolean} triggerUpdate - Whether to trigger re-render
 */
function clearFilterInputs(triggerUpdate = false) {
  FILTER_DEFS.forEach(def => {
    const el = document.getElementById(def.id);
    if (el) el.value = '';
  });
  
  if (triggerUpdate) {
    applyFiltersAndRender();
  }
}

// =============================================================================
// Table Rendering
// =============================================================================

/**
 * Build a single table row HTML
 * @param {object} contract - Contract data
 * @returns {string} HTML string
 */
function buildRow(contract) {
  const cells = COLUMN_DEFS.map(col => {
    const value = getFieldValue(contract, col.key);
    const formatted = formatCell(value, col.format);
    const colorClass = getCellColorClass(col.key, value);
    const classes = [col.className, colorClass].filter(Boolean).join(' ');
    return `<td class="${classes}">${formatted}</td>`;
  }).join('');
  
  return `<tr data-ticker="${contract.contractTicker || ''}">${cells}</tr>`;
}

/**
 * Build the table body HTML
 * @param {object[]} contracts - Contracts to display
 * @returns {string} HTML string
 */
function buildTableBody(contracts) {
  if (contracts.length === 0) {
    const colspan = COLUMN_DEFS.length;
    return `<tr><td colspan="${colspan}" class="no-results">No contracts match your filters</td></tr>`;
  }
  
  // Limit display for performance
  const displayContracts = contracts.slice(0, CONFIG.maxDisplayRows);
  let html = displayContracts.map(buildRow).join('');
  
  // Add truncation warning
  if (contracts.length > CONFIG.maxDisplayRows) {
    const colspan = COLUMN_DEFS.length;
    html += `<tr><td colspan="${colspan}" class="truncated">Showing first ${CONFIG.maxDisplayRows} of ${contracts.length} results</td></tr>`;
  }
  
  return html;
}

/**
 * Update the results info text
 * @param {number} showing - Number of contracts shown
 * @param {number} total - Total contracts before filtering
 * @param {boolean} isFiltered - Whether secondary filters are active
 */
function updateResultsInfo(showing, total, isFiltered) {
  const el = document.getElementById('resultsShowing');
  if (!el) return;
  
  if (!isFiltered || showing === total) {
    if (total > CONFIG.maxDisplayRows) {
      el.textContent = `Showing ${CONFIG.maxDisplayRows} of ${total} results`;
    } else {
      el.textContent = `Showing ${total} results`;
    }
  } else {
    if (showing > CONFIG.maxDisplayRows) {
      el.textContent = `Showing ${CONFIG.maxDisplayRows} of ${showing} filtered (${total} total)`;
    } else {
      el.textContent = `Showing ${showing} of ${total} results`;
    }
  }
}

/**
 * Show empty/placeholder state
 * @param {string} message - Message to display
 */
function showEmptyState(message = 'Configure filters and click Scan to search') {
  const tbody = document.getElementById('resultsBody');
  if (!tbody) return;
  
  const colspan = COLUMN_DEFS.length;
  tbody.innerHTML = `<tr><td colspan="${colspan}" class="placeholder">${message}</td></tr>`;
  
  updateResultsInfo(0, 0, false);
}

/**
 * Apply current filters and re-render the table
 */
function applyFiltersAndRender() {
  const filterValues = getFilterValues();
  const activeCount = countActiveFilters(filterValues);
  
  // Apply filters
  filteredContracts = applySecondaryFilters(allContracts, filterValues);
  
  // Render
  const tbody = document.getElementById('resultsBody');
  if (tbody) {
    tbody.innerHTML = buildTableBody(filteredContracts);
  }
  
  // Update UI
  updateFilterBadge(activeCount);
  updateResultsInfo(filteredContracts.length, allContracts.length, activeCount > 0);
  
  // Notify callback
  if (callbacks.onFilterChange) {
    callbacks.onFilterChange(filteredContracts.length, filteredContracts);
  }
}

// =============================================================================
// Event Handlers
// =============================================================================

/**
 * Handle sort header click
 * @param {string} field - Field to sort by
 */
function onSortClick(field) {
  // Toggle direction if same field, else default to asc
  let newDir = 'asc';
  if (field === sortState.field) {
    newDir = sortState.dir === 'asc' ? 'desc' : 'asc';
  }
  
  sortState = { field, dir: newDir };
  
  // Sort the full dataset
  sortContracts(allContracts, field, newDir);
  
  // Re-apply filters and render
  applyFiltersAndRender();
  
  // Update indicators
  updateSortIndicators(field, newDir);
}

/**
 * Handle filter input change (debounced)
 */
function onFilterInput() {
  if (filterDebounceTimer) {
    clearTimeout(filterDebounceTimer);
  }
  
  filterDebounceTimer = setTimeout(() => {
    applyFiltersAndRender();
  }, CONFIG.debounceMs);
}

/**
 * Handle row click
 * @param {Event} e - Click event
 */
function onRowClick(e) {
  const row = e.target.closest('tr');
  if (!row || !row.dataset.ticker) return;
  
  const contractTicker = row.dataset.ticker;
  const contract = filteredContracts.find(c => c.contractTicker === contractTicker);
  
  if (contract && callbacks.onRowClick) {
    callbacks.onRowClick(contract);
  }
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Render the table with new contract data
 * @param {object[]} contracts - Array of normalized contracts
 * @param {object} options - Render options
 * @param {string} options.sortBy - Field to sort by
 * @param {string} options.sortDir - Sort direction ('asc' or 'desc')
 * @param {boolean} options.clearFilters - Whether to clear secondary filters
 */
export function renderTable(contracts, options = {}) {
  // Store contracts
  allContracts = [...contracts];
  
  // Apply initial sort
  if (options.sortBy) {
    sortState.field = options.sortBy;
  }
  if (options.sortDir) {
    sortState.dir = options.sortDir;
  }
  
  sortContracts(allContracts, sortState.field, sortState.dir);
  updateSortIndicators(sortState.field, sortState.dir);
  
  // Clear secondary filters if requested (default for new scan)
  if (options.clearFilters !== false) {
    clearFilterInputs(false);
  }
  
  // Apply filters and render
  applyFiltersAndRender();
}

/**
 * Refresh the table with current state (no new data)
 */
export function refreshTable() {
  applyFiltersAndRender();
}

/**
 * Sort the table by a column
 * @param {string} field - Field to sort by
 */
export function sortByColumn(field) {
  onSortClick(field);
}

/**
 * Clear all secondary filters
 */
export function clearFilters() {
  clearFilterInputs(true);
}

/**
 * Get the currently visible (filtered) contracts
 * @returns {object[]}
 */
export function getVisibleContracts() {
  return [...filteredContracts];
}

/**
 * Get all contracts (unfiltered)
 * @returns {object[]}
 */
export function getAllContracts() {
  return [...allContracts];
}

/**
 * Get current sort state
 * @returns {object} { field, dir }
 */
export function getSortState() {
  return { ...sortState };
}

/**
 * Set up table event listeners and callbacks
 * @param {object} opts - Callback options
 * @param {function} opts.onFilterChange - Called when filter changes: (count, contracts) => {}
 * @param {function} opts.onRowClick - Called when row is clicked: (contract) => {}
 */
export function setupTableControls(opts = {}) {
  callbacks = opts;
  
  // Sort header clicks (event delegation)
  const table = document.getElementById('resultsTable');
  if (table) {
    table.addEventListener('click', (e) => {
      const th = e.target.closest('.sortable');
      if (th && th.dataset.field) {
        onSortClick(th.dataset.field);
      }
    });
    
    // Row clicks
    const tbody = document.getElementById('resultsBody');
    if (tbody) {
      tbody.addEventListener('click', onRowClick);
    }
  }
  
  // Secondary filter inputs
  FILTER_DEFS.forEach(def => {
    const el = document.getElementById(def.id);
    if (el) {
      el.addEventListener('input', onFilterInput);
    }
  });
  
  // Clear filters button
  const clearBtn = document.getElementById('clearSecondaryFilters');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => clearFilters());
  }
  
  // Toggle collapse/expand
  const toggleBtn = document.getElementById('toggleSecondaryFilters');
  const filtersContainer = document.getElementById('secondaryFilters');
  if (toggleBtn && filtersContainer) {
    toggleBtn.addEventListener('click', () => {
      filtersContainer.classList.toggle('collapsed');
    });
  }
}

/**
 * Export current table data to CSV
 * @param {string} filename - Optional filename (defaults to date-based)
 */
export function exportTableToCSV(filename) {
  const contracts = filteredContracts.length > 0 ? filteredContracts : allContracts;
  
  if (contracts.length === 0) {
    alert('No results to export');
    return;
  }
  
  // Build headers from column defs plus contract ticker
  const headers = [
    ...COLUMN_DEFS.map(col => col.label),
    'Contract'
  ];
  
  // Build rows
  const rows = contracts.map(c => [
    c.underlying,
    c._meta?.company || '',
    c._meta?.industry || '',
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
    c.contractTicker
  ]);
  
  // Convert to CSV string
  const csv = [headers, ...rows]
    .map(row => row.map(cell => {
      if (cell == null) return '';
      if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"'))) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    }).join(','))
    .join('\n');
  
  // Download
  const defaultFilename = `options-scan-${new Date().toISOString().slice(0, 10)}.csv`;
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || defaultFilename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Show placeholder state (for initial load)
 */
export function showPlaceholder() {
  showEmptyState('Configure filters and click Scan to search');
}

/**
 * Reset table state completely
 */
export function resetTable() {
  allContracts = [];
  filteredContracts = [];
  sortState = { field: 'last', dir: 'asc' };
  clearFilterInputs(false);
  showEmptyState();
  updateFilterBadge(0);
}

// =============================================================================
// Export column defs for external use (e.g., dynamic table generation)
// =============================================================================

export { COLUMN_DEFS, CONFIG as TABLE_CONFIG, COLOR_THRESHOLDS };