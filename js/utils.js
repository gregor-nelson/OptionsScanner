/**
 * Utility functions for the Options Scanner
 */

/**
 * Calculate days to expiration from a date string
 * @param {string} expirationDate - Date in YYYY-MM-DD format
 * @returns {number} Days until expiration
 */
export function calculateDTE(expirationDate) {
  const expiry = new Date(expirationDate + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = expiry - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Format a number as currency
 * @param {number} value 
 * @param {number} decimals 
 * @returns {string}
 */
export function formatCurrency(value, decimals = 2) {
  if (value == null) return '-';
  return '$' + value.toFixed(decimals);
}

/**
 * Format a decimal as percentage
 * @param {number} value - Decimal value (0.25 = 25%)
 * @param {number} decimals 
 * @returns {string}
 */
export function formatPercent(value, decimals = 1) {
  if (value == null) return '-';
  return (value * 100).toFixed(decimals) + '%';
}

/**
 * Format a date string for display
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @returns {string} Formatted date (e.g., "Jan 17, 2027")
 */
export function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
}

/**
 * Format a number with commas
 * @param {number} value 
 * @returns {string}
 */
export function formatNumber(value) {
  if (value == null) return '-';
  return value.toLocaleString();
}

/**
 * Determine moneyness of an option
 * @param {number} strike 
 * @param {number} underlyingPrice 
 * @param {string} contractType - 'call' or 'put'
 * @returns {string} 'ITM', 'ATM', or 'OTM'
 */
export function getMoneyness(strike, underlyingPrice, contractType) {
  if (!strike || !underlyingPrice) return '-';
  
  const pctDiff = (strike - underlyingPrice) / underlyingPrice;
  
  // Within 2% of strike = ATM
  if (Math.abs(pctDiff) <= 0.02) return 'ATM';
  
  if (contractType === 'call') {
    return pctDiff > 0 ? 'OTM' : 'ITM';
  } else {
    return pctDiff < 0 ? 'OTM' : 'ITM';
  }
}

/**
 * Sleep for a specified duration
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise}
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a simple event emitter for progress updates
 */
export class EventEmitter {
  constructor() {
    this.events = {};
  }
  
  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
    return () => this.off(event, callback);
  }
  
  off(event, callback) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter(cb => cb !== callback);
  }
  
  emit(event, ...args) {
    if (!this.events[event]) return;
    this.events[event].forEach(callback => callback(...args));
  }
}

/**
 * Parse the option contract ticker to extract details
 * Format: O:AAPL230616C00150000
 * @param {string} ticker 
 * @returns {object} Parsed details
 */
export function parseOptionTicker(ticker) {
  // Remove the O: prefix if present
  const clean = ticker.startsWith('O:') ? ticker.slice(2) : ticker;
  
  // Basic regex to extract parts
  // Pattern: UNDERLYING + YYMMDD + C/P + STRIKE (8 digits, price * 1000)
  const match = clean.match(/^([A-Z]+)(\d{6})([CP])(\d{8})$/);
  
  if (!match) {
    return { underlying: null, expiration: null, type: null, strike: null };
  }
  
  const [, underlying, dateStr, typeChar, strikeStr] = match;
  
  // Parse date (YYMMDD)
  const year = 2000 + parseInt(dateStr.slice(0, 2));
  const month = dateStr.slice(2, 4);
  const day = dateStr.slice(4, 6);
  const expiration = `${year}-${month}-${day}`;
  
  // Parse type
  const type = typeChar === 'C' ? 'call' : 'put';
  
  // Parse strike (stored as price * 1000)
  const strike = parseInt(strikeStr) / 1000;
  
  return { underlying, expiration, type, strike };
}

/**
 * Chunk an array into smaller arrays
 * @param {Array} array 
 * @param {number} size 
 * @returns {Array[]}
 */
export function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
