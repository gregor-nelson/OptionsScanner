/**
 * API Client for Massive.com (Polygon.io) Options Data
 * 
 * Handles:
 * - Authentication
 * - Pagination (following next_url)
 * - Rate limiting / throttling
 * - Retry with exponential backoff
 */

import { CONFIG } from './config.js';
import { sleep, chunk } from './utils.js';

export class ApiClient {
  /**
   * @param {string} apiKey - Massive.com API key
   * @param {object} options - Configuration options
   */
  constructor(apiKey, options = {}) {
    this.apiKey = apiKey || CONFIG.API_KEY;
    this.baseUrl = options.baseUrl || CONFIG.API.BASE_URL;
    this.concurrency = options.concurrency || CONFIG.API.CONCURRENCY;
    this.requestDelay = options.requestDelay || CONFIG.API.REQUEST_DELAY;
    this.maxRetries = options.maxRetries || CONFIG.API.MAX_RETRIES;
    this.retryDelay = options.retryDelay || CONFIG.API.RETRY_DELAY;
    this.pageLimit = options.pageLimit || CONFIG.API.PAGE_LIMIT;
    
    // Request tracking for debugging
    this.requestCount = 0;
    this.lastRequestTime = null;
  }
  
  /**
   * Make a single authenticated request
   * @param {string} url - Full URL to fetch
   * @returns {Promise<object>} JSON response
   */
  async _fetch(url) {
    // Add API key to URL
    const separator = url.includes('?') ? '&' : '?';
    const authUrl = `${url}${separator}apiKey=${this.apiKey}`;
    
    this.requestCount++;
    this.lastRequestTime = new Date();
    
    const response = await fetch(authUrl);
    
    if (!response.ok) {
      const error = new Error(`API request failed: ${response.status} ${response.statusText}`);
      error.status = response.status;
      error.url = url;
      throw error;
    }
    
    return response.json();
  }
  
  /**
   * Make a request with retry logic
   * @param {string} url 
   * @returns {Promise<object>}
   */
  async _fetchWithRetry(url) {
    let lastError;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await this._fetch(url);
      } catch (error) {
        lastError = error;
        
        // Don't retry on auth errors
        if (error.status === 401 || error.status === 403) {
          throw error;
        }
        
        // Rate limited - wait longer
        if (error.status === 429) {
          const delay = this.retryDelay * Math.pow(2, attempt + 1);
          console.warn(`Rate limited, waiting ${delay}ms before retry...`);
          await sleep(delay);
          continue;
        }
        
        // Server error - retry with backoff
        if (error.status >= 500) {
          const delay = this.retryDelay * Math.pow(2, attempt);
          console.warn(`Server error, retrying in ${delay}ms...`);
          await sleep(delay);
          continue;
        }
        
        // Other errors - throw immediately
        throw error;
      }
    }
    
    throw lastError;
  }
  
  /**
   * Fetch all pages of a paginated endpoint
   * @param {string} initialUrl 
   * @returns {Promise<object[]>} All results combined
   */
  async _fetchAllPages(initialUrl) {
    const allResults = [];
    let url = initialUrl;
    let pageCount = 0;
    
    while (url) {
      pageCount++;
      const response = await this._fetchWithRetry(url);
      
      if (response.results && Array.isArray(response.results)) {
        allResults.push(...response.results);
      }
      
      // Check for next page
      url = response.next_url || null;
      
      // Add delay between pages to avoid rate limiting
      if (url) {
        await sleep(this.requestDelay);
      }
    }
    
    return allResults;
  }
  
  /**
   * Build URL for options snapshot endpoint
   * @param {string} ticker - Underlying ticker symbol
   * @param {object} params - Query parameters
   * @returns {string}
   */
  _buildOptionsUrl(ticker, params = {}) {
    const url = new URL(`${this.baseUrl}/v3/snapshot/options/${ticker}`);
    
    if (params.contractType) {
      url.searchParams.set('contract_type', params.contractType);
    }
    if (params.expirationGte) {
      url.searchParams.set('expiration_date.gte', params.expirationGte);
    }
    if (params.expirationLte) {
      url.searchParams.set('expiration_date.lte', params.expirationLte);
    }
    if (params.strikeGte) {
      url.searchParams.set('strike_price.gte', params.strikeGte);
    }
    if (params.strikeLte) {
      url.searchParams.set('strike_price.lte', params.strikeLte);
    }
    
    url.searchParams.set('limit', this.pageLimit.toString());
    
    return url.toString();
  }
  
  /**
   * Get options chain for a single ticker
   * @param {string} ticker - Underlying ticker symbol
   * @param {object} params - Query parameters
   * @returns {Promise<object[]>} Array of option contracts
   */
  async getOptionsChain(ticker, params = {}) {
    const url = this._buildOptionsUrl(ticker, params);
    return this._fetchAllPages(url);
  }
  
  /**
   * Get options chains for multiple tickers with throttling
   * @param {string[]} tickers - Array of ticker symbols
   * @param {object} params - Query parameters applied to all
   * @param {function} onProgress - Progress callback (ticker, index, total)
   * @returns {Promise<object[]>} Aggregated results from all tickers
   */
  async getOptionsChainForTickers(tickers, params = {}, onProgress = null) {
    const allResults = [];
    const errors = [];
    
    // Process tickers in batches based on concurrency
    const tickerBatches = chunk(tickers, this.concurrency);
    let processedCount = 0;
    
    for (const batch of tickerBatches) {
      // Process batch concurrently
      const batchPromises = batch.map(async (ticker) => {
        try {
          if (onProgress) {
            onProgress(ticker, processedCount + 1, tickers.length, 'fetching');
          }
          
          const results = await this.getOptionsChain(ticker, params);
          
          // Attach underlying ticker to each result for reference
          results.forEach(r => {
            if (!r._ticker) r._ticker = ticker;
          });
          
          return { ticker, results, error: null };
        } catch (error) {
          console.error(`Error fetching options for ${ticker}:`, error.message);
          return { ticker, results: [], error: error.message };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      
      // Collect results and errors
      for (const { ticker, results, error } of batchResults) {
        if (error) {
          errors.push({ ticker, error });
        } else {
          allResults.push(...results);
        }
        processedCount++;
        
        if (onProgress) {
          onProgress(ticker, processedCount, tickers.length, 'complete');
        }
      }
      
      // Delay between batches
      if (tickerBatches.indexOf(batch) < tickerBatches.length - 1) {
        await sleep(this.requestDelay);
      }
    }
    
    // Log summary
    console.log(`Fetched ${allResults.length} contracts from ${tickers.length - errors.length}/${tickers.length} tickers`);
    if (errors.length > 0) {
      console.warn('Errors:', errors);
    }
    
    return allResults;
  }
  
  /**
   * Get ticker details (for SIC code, market cap, etc.)
   * @param {string} ticker 
   * @returns {Promise<object>}
   */
  async getTickerDetails(ticker) {
    const url = `${this.baseUrl}/v3/reference/tickers/${ticker}`;
    const response = await this._fetchWithRetry(url);
    return response.results;
  }
  
  /**
   * Test API connectivity and key validity
   * @returns {Promise<boolean>}
   */
  async testConnection() {
    try {
      // Use a lightweight endpoint to test
      const url = `${this.baseUrl}/v3/reference/tickers?limit=1`;
      await this._fetch(url);
      return true;
    } catch (error) {
      console.error('API connection test failed:', error.message);
      return false;
    }
  }
  
  /**
   * Get request statistics
   * @returns {object}
   */
  getStats() {
    return {
      requestCount: this.requestCount,
      lastRequestTime: this.lastRequestTime
    };
  }
}
