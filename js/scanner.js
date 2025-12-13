/**
 * Options Scanner - Core scanning logic
 * 
 * Orchestrates:
 * - Fetching data from API
 * - Normalizing responses
 * - Applying filters
 * - Sorting results
 */

import { ApiClient } from './api.js';
import { applyFilters, createFilterChain } from './filters.js';
import { calculateDTE, getMoneyness } from './utils.js';
import { CONFIG, DEFAULT_UNIVERSE } from './config.js';

export class OptionsScanner {
  /**
   * @param {ApiClient} apiClient - Configured API client
   * @param {object[]} universe - Array of ticker objects with metadata
   */
  constructor(apiClient, universe = null) {
    this.api = apiClient;
    this.universe = universe || DEFAULT_UNIVERSE;
    this.lastScanResults = null;
    this.lastScanParams = null;
  }
  
  /**
   * Build universe lookup map for enriching contracts with metadata
   * @returns {Map}
   */
  _buildUniverseMap() {
    const map = new Map();
    for (const item of this.universe) {
      map.set(item.ticker, item);
    }
    return map;
  }
  
  /**
   * Normalize a raw API contract to flat structure
   * @param {object} raw - Raw API response contract
   * @param {Map} universeMap - Ticker metadata lookup
   * @returns {object} Normalized contract
   */
  _normalizeContract(raw, universeMap) {
    // Extract nested data safely
    const details = raw.details || {};
    const greeks = raw.greeks || {};
    const lastQuote = raw.last_quote || {};
    const lastTrade = raw.last_trade || {};
    const day = raw.day || {};
    const underlying = raw.underlying_asset || {};
    
    // Get ticker from details or fallback
    const underlyingTicker = details.underlying_ticker || 
                             underlying.ticker || 
                             raw._ticker || 
                             '';
    
    // Look up universe metadata
    const meta = universeMap.get(underlyingTicker) || {};
    
    // Calculate derived fields
    const expiration = details.expiration_date || '';
    const dte = expiration ? calculateDTE(expiration) : null;
    
    const bid = lastQuote.bid ?? null;
    const ask = lastQuote.ask ?? null;
    const mid = lastQuote.midpoint ?? (bid && ask ? (bid + ask) / 2 : null);
    const last = lastTrade.price ?? null;
    
    // Calculate spread
    let spread = null;
    let spreadPct = null;
    if (bid != null && ask != null && mid != null && mid > 0) {
      spread = ask - bid;
      spreadPct = (spread / mid) * 100;
    }
    
    const strike = details.strike_price ?? null;
    const underlyingPrice = underlying.price ?? null;
    const contractType = details.contract_type || '';
    
    const moneynessValue = getMoneyness(strike, underlyingPrice, contractType);
    
    return {
      // Identifiers
      contractTicker: details.ticker || '',
      underlying: underlyingTicker,
      type: contractType,
      
      // Contract specs
      strike: strike,
      expiration: expiration,
      dte: dte,
      
      // Pricing
      bid: bid,
      ask: ask,
      mid: mid,
      last: last,
      spread: spread,
      spreadPct: spreadPct,
      
      // Volatility
      iv: raw.implied_volatility ?? null,
      
      // Greeks
      delta: greeks.delta ?? null,
      gamma: greeks.gamma ?? null,
      theta: greeks.theta ?? null,
      vega: greeks.vega ?? null,
      
      // Liquidity
      volume: day.volume ?? null,
      openInterest: raw.open_interest ?? null,
      
      // Context
      underlyingPrice: underlyingPrice,
      breakEven: raw.break_even_price ?? null,
      moneyness: moneynessValue,
      
      // Metadata from universe
      _meta: {
        company: meta.company || '',
        industry: meta.industry || '',
        country: meta.country || ''
      }
    };
  }
  
  /**
   * Sort contracts by a field
   * @param {object[]} contracts 
   * @param {string} field - Field to sort by
   * @param {string} direction - 'asc' or 'desc'
   * @returns {object[]}
   */
  _sortContracts(contracts, field = 'ask', direction = 'asc') {
    return [...contracts].sort((a, b) => {
      let aVal = a[field];
      let bVal = b[field];
      
      // Handle nulls - push to end
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      
      // Compare
      if (direction === 'asc') {
        return aVal - bVal;
      } else {
        return bVal - aVal;
      }
    });
  }
  
  /**
   * Run a scan with the given parameters
   * @param {object} params - Scan parameters
   * @param {function} onProgress - Progress callback
   * @returns {Promise<object>} Scan results
   */
  async scan(params = {}, onProgress = null) {
    const startTime = Date.now();
    
    // Merge with defaults
    const scanParams = {
      contractType: params.contractType ?? CONFIG.DEFAULTS.CONTRACT_TYPE,
      expirationGte: params.expirationGte ?? CONFIG.DEFAULTS.EXPIRATION_GTE,
      expirationLte: params.expirationLte ?? CONFIG.DEFAULTS.EXPIRATION_LTE,
      priceMin: params.priceMin ?? CONFIG.DEFAULTS.PRICE_MIN,
      priceMax: params.priceMax ?? CONFIG.DEFAULTS.PRICE_MAX,
      priceField: params.priceField ?? CONFIG.DEFAULTS.PRICE_FIELD,
      deltaMin: params.deltaMin ?? CONFIG.DEFAULTS.DELTA_MIN,
      deltaMax: params.deltaMax ?? CONFIG.DEFAULTS.DELTA_MAX,
      ivMin: params.ivMin ?? CONFIG.DEFAULTS.IV_MIN,
      ivMax: params.ivMax ?? CONFIG.DEFAULTS.IV_MAX,
      minOpenInterest: params.minOpenInterest ?? CONFIG.DEFAULTS.MIN_OPEN_INTEREST,
      minVolume: params.minVolume ?? CONFIG.DEFAULTS.MIN_VOLUME,
      sortBy: params.sortBy ?? CONFIG.DEFAULTS.SORT_BY,
      sortDir: params.sortDir ?? CONFIG.DEFAULTS.SORT_DIR,
      // Optional filters
      industries: params.industries || null,
      countries: params.countries || null,
      tickers: params.tickers || null  // Override universe
    };
    
    // Determine which tickers to scan
    let tickersToScan;
    if (scanParams.tickers && scanParams.tickers.length > 0) {
      tickersToScan = scanParams.tickers;
    } else {
      tickersToScan = this.universe.map(u => u.ticker);
    }
    
    // Build API query params (server-side filters)
    const apiParams = {
      contractType: scanParams.contractType,
      expirationGte: scanParams.expirationGte,
      expirationLte: scanParams.expirationLte
    };
    
    // Fetch data from API
    if (onProgress) {
      onProgress({ phase: 'fetching', message: 'Fetching options data...', progress: 0 });
    }
    
    const rawContracts = await this.api.getOptionsChainForTickers(
      tickersToScan,
      apiParams,
      (ticker, current, total, status) => {
        if (onProgress) {
          const progress = Math.round((current / total) * 100);
          onProgress({
            phase: 'fetching',
            message: `Fetching ${ticker}... (${current}/${total})`,
            progress: progress,
            ticker: ticker
          });
        }
      }
    );
    
    if (onProgress) {
      onProgress({ phase: 'processing', message: 'Processing contracts...', progress: 100 });
    }
    
    // Build universe map for metadata lookup
    const universeMap = this._buildUniverseMap();
    
    // Normalize all contracts
    const normalizedContracts = rawContracts.map(raw => 
      this._normalizeContract(raw, universeMap)
    );
    
    // Build and apply filters
    const filterChain = createFilterChain(scanParams);

    // DEBUG: Log filter diagnostics
    console.log('=== FILTER DIAGNOSTICS ===');
    console.log('Scan params:', scanParams);
    console.log('Number of filters:', filterChain.length);
    console.log('Filter chain:', filterChain.map(f => f.filterName || 'unnamed'));

    // Test each filter individually to find the culprit
    if (normalizedContracts.length > 0) {
      const sample = normalizedContracts.slice(0, 3);
      console.log('Sample contracts (first 3):', sample);

      // Check what price fields have data
      const priceFields = ['bid', 'ask', 'mid', 'last'];
      console.log('\n--- Price field availability ---');
      priceFields.forEach(field => {
        const hasValue = normalizedContracts.filter(c => c[field] != null && c[field] > 0).length;
        console.log(`${field}: ${hasValue}/${normalizedContracts.length} have data`);
      });

      // Count how many pass each filter independently
      console.log('\n--- Individual filter pass rates ---');
      filterChain.forEach((filter) => {
        const passing = normalizedContracts.filter(filter).length;
        const pct = ((passing / normalizedContracts.length) * 100).toFixed(1);
        console.log(`${filter.filterName}: ${passing}/${normalizedContracts.length} (${pct}%)`);
      });

      // Show cumulative filtering
      console.log('\n--- Cumulative filtering ---');
      let remaining = normalizedContracts;
      filterChain.forEach((filter) => {
        const before = remaining.length;
        remaining = remaining.filter(filter);
        console.log(`After ${filter.filterName}: ${remaining.length} remaining (removed ${before - remaining.length})`);
      });
    }
    console.log('=== END DIAGNOSTICS ===');

    const filteredContracts = applyFilters(normalizedContracts, ...filterChain);
    
    // Sort results
    const sortedContracts = this._sortContracts(
      filteredContracts, 
      scanParams.sortBy, 
      scanParams.sortDir
    );
    
    const endTime = Date.now();
    
    // Build result object
    const result = {
      contracts: sortedContracts,
      stats: {
        totalFetched: rawContracts.length,
        afterFilters: sortedContracts.length,
        tickersScanned: tickersToScan.length,
        scanTime: endTime - startTime,
        timestamp: new Date().toISOString()
      },
      params: scanParams
    };
    
    // Cache results
    this.lastScanResults = result;
    this.lastScanParams = scanParams;
    
    if (onProgress) {
      onProgress({ 
        phase: 'complete', 
        message: `Found ${sortedContracts.length} contracts`, 
        progress: 100 
      });
    }
    
    return result;
  }
  
  /**
   * Re-filter last scan results with new parameters (no API call)
   * @param {object} params - New filter parameters
   * @returns {object} Filtered results
   */
  refilter(params) {
    if (!this.lastScanResults) {
      throw new Error('No previous scan results to filter');
    }
    
    // Get the raw normalized contracts before the last filter
    // Note: This would require storing pre-filtered results
    // For now, this is a limitation - we'd need to re-scan
    
    const filterParams = { ...this.lastScanParams, ...params };
    const filterChain = createFilterChain(filterParams);
    
    // We need to store normalized but unfiltered contracts for this to work
    // This is a TODO for optimization
    throw new Error('Refilter not yet implemented - please run a new scan');
  }
  
  /**
   * Update the ticker universe
   * @param {object[]} newUniverse 
   */
  setUniverse(newUniverse) {
    this.universe = newUniverse;
  }
  
  /**
   * Add tickers to universe
   * @param {object[]} tickers 
   */
  addToUniverse(tickers) {
    const existing = new Set(this.universe.map(u => u.ticker));
    const newTickers = tickers.filter(t => !existing.has(t.ticker));
    this.universe = [...this.universe, ...newTickers];
  }
  
  /**
   * Remove tickers from universe
   * @param {string[]} tickerSymbols 
   */
  removeFromUniverse(tickerSymbols) {
    const toRemove = new Set(tickerSymbols);
    this.universe = this.universe.filter(u => !toRemove.has(u.ticker));
  }
  
  /**
   * Get current universe
   * @returns {object[]}
   */
  getUniverse() {
    return [...this.universe];
  }
  
  /**
   * Get unique industries in universe
   * @returns {string[]}
   */
  getIndustries() {
    const industries = new Set(this.universe.map(u => u.industry).filter(Boolean));
    return [...industries].sort();
  }
  
  /**
   * Get unique countries in universe
   * @returns {string[]}
   */
  getCountries() {
    const countries = new Set(this.universe.map(u => u.country).filter(Boolean));
    return [...countries].sort();
  }
}
