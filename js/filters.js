/**
 * Filter functions for options contracts
 * 
 * Each filter is a higher-order function that returns a predicate.
 * This allows composable, reusable filters.
 */

/**
 * Filter by price range
 * @param {number} min - Minimum price
 * @param {number} max - Maximum price  
 * @param {string} field - Price field to check ('ask', 'bid', 'last', 'mid')
 * @returns {function}
 */
export function priceRange(min, max, field = 'ask') {
  return (contract) => {
    const price = contract[field];
    if (price == null || price === 0) return false;
    return price >= min && price <= max;
  };
}

/**
 * Filter by minimum price
 * @param {number} min 
 * @param {string} field 
 * @returns {function}
 */
export function minPrice(min, field = 'ask') {
  return (contract) => {
    const price = contract[field];
    if (price == null) return false;
    return price >= min;
  };
}

/**
 * Filter by maximum price
 * @param {number} max 
 * @param {string} field 
 * @returns {function}
 */
export function maxPrice(max, field = 'ask') {
  return (contract) => {
    const price = contract[field];
    if (price == null) return false;
    return price <= max;
  };
}

/**
 * Filter by minimum days to expiration
 * @param {number} days 
 * @returns {function}
 */
export function minDte(days) {
  return (contract) => contract.dte >= days;
}

/**
 * Filter by maximum days to expiration
 * @param {number} days 
 * @returns {function}
 */
export function maxDte(days) {
  return (contract) => contract.dte <= days;
}

/**
 * Filter by DTE range
 * @param {number} min 
 * @param {number} max 
 * @returns {function}
 */
export function dteRange(min, max) {
  return (contract) => contract.dte >= min && contract.dte <= max;
}

/**
 * Filter by implied volatility range
 * @param {number} min - Minimum IV (as decimal, e.g., 0.20 for 20%)
 * @param {number} max - Maximum IV
 * @returns {function}
 */
export function ivRange(min, max) {
  return (contract) => {
    // Don't exclude contracts missing IV data
    if (contract.iv == null) return true;
    return contract.iv >= min && contract.iv <= max;
  };
}

/**
 * Filter by maximum IV
 * @param {number} max
 * @returns {function}
 */
export function maxIv(max) {
  return (contract) => {
    // Don't exclude contracts missing IV data
    if (contract.iv == null) return true;
    return contract.iv <= max;
  };
}

/**
 * Filter by delta range (uses absolute value)
 * @param {number} min - Minimum absolute delta
 * @param {number} max - Maximum absolute delta
 * @returns {function}
 */
export function deltaRange(min, max) {
  return (contract) => {
    // Don't exclude contracts missing delta data
    if (contract.delta == null) return true;
    const absDelta = Math.abs(contract.delta);
    return absDelta >= min && absDelta <= max;
  };
}

/**
 * Filter by minimum open interest
 * @param {number} min 
 * @returns {function}
 */
export function minOpenInterest(min) {
  return (contract) => {
    if (contract.openInterest == null) return true; // Don't exclude if missing
    return contract.openInterest >= min;
  };
}

/**
 * Filter by minimum volume
 * @param {number} min 
 * @returns {function}
 */
export function minVolume(min) {
  return (contract) => {
    if (contract.volume == null) return true; // Don't exclude if missing
    return contract.volume >= min;
  };
}

/**
 * Filter by contract type
 * @param {string} type - 'call' or 'put'
 * @returns {function}
 */
export function contractType(type) {
  return (contract) => contract.type === type;
}

/**
 * Filter by moneyness
 * @param {string[]} moneyness - Array of allowed values: 'ITM', 'ATM', 'OTM'
 * @returns {function}
 */
export function moneyness(allowed) {
  return (contract) => allowed.includes(contract.moneyness);
}

/**
 * Filter by industry (from universe metadata)
 * @param {string[]} industries - Array of allowed industries
 * @returns {function}
 */
export function industry(industries) {
  return (contract) => {
    if (!contract._meta?.industry) return true; // Don't exclude if no metadata
    return industries.includes(contract._meta.industry);
  };
}

/**
 * Filter by country (from universe metadata)
 * @param {string[]} countries - Array of allowed countries
 * @returns {function}
 */
export function country(countries) {
  return (contract) => {
    if (!contract._meta?.country) return true;
    return countries.includes(contract._meta.country);
  };
}

/**
 * Filter by underlying ticker
 * @param {string[]} tickers - Array of allowed tickers
 * @returns {function}
 */
export function underlyingTicker(tickers) {
  return (contract) => tickers.includes(contract.underlying);
}

/**
 * Filter by maximum bid-ask spread percentage
 * @param {number} maxSpreadPct - Maximum spread as percentage (e.g., 10 for 10%)
 * @returns {function}
 */
export function maxSpread(maxSpreadPct) {
  return (contract) => {
    if (contract.spreadPct == null) return true;
    return contract.spreadPct <= maxSpreadPct;
  };
}

/**
 * Require valid price data
 * @param {string} field - Price field that must exist
 * @returns {function}
 */
export function hasPrice(field = 'ask') {
  return (contract) => contract[field] != null && contract[field] > 0;
}

/**
 * Require valid Greeks
 * @returns {function}
 */
export function hasGreeks() {
  return (contract) => contract.delta != null;
}

/**
 * Apply multiple filters to a list of contracts
 * @param {object[]} contracts - Array of normalized contracts
 * @param {...function} filterFns - Filter functions to apply
 * @returns {object[]} Filtered contracts
 */
export function applyFilters(contracts, ...filterFns) {
  return contracts.filter(contract => 
    filterFns.every(fn => fn(contract))
  );
}

/**
 * Create a filter chain from a parameters object
 * @param {object} params - Filter parameters
 * @returns {function[]} Array of filter functions with .filterName property
 */
export function createFilterChain(params) {
  const filters = [];

  // Helper to add a named filter
  const addFilter = (name, fn) => {
    fn.filterName = name;
    filters.push(fn);
  };

  // Price filter
  if (params.priceMin != null || params.priceMax != null) {
    const min = params.priceMin ?? 0;
    const max = params.priceMax ?? Infinity;
    const field = params.priceField || 'ask';
    addFilter(`priceRange(${min}-${max}, ${field})`, priceRange(min, max, field));
  }

  // Require valid price
  if (params.priceField) {
    addFilter(`hasPrice(${params.priceField})`, hasPrice(params.priceField));
  }

  // DTE filter
  if (params.dteMin != null) {
    addFilter(`minDte(${params.dteMin})`, minDte(params.dteMin));
  }
  if (params.dteMax != null) {
    addFilter(`maxDte(${params.dteMax})`, maxDte(params.dteMax));
  }

  // IV filter
  if (params.ivMin != null || params.ivMax != null) {
    const min = params.ivMin ?? 0;
    const max = params.ivMax ?? Infinity;
    addFilter(`ivRange(${min}-${max})`, ivRange(min, max));
  }

  // Delta filter
  if (params.deltaMin != null || params.deltaMax != null) {
    const min = params.deltaMin ?? 0;
    const max = params.deltaMax ?? 1;
    addFilter(`deltaRange(${min}-${max})`, deltaRange(min, max));
  }

  // Liquidity filters
  if (params.minOpenInterest != null && params.minOpenInterest > 0) {
    addFilter(`minOpenInterest(${params.minOpenInterest})`, minOpenInterest(params.minOpenInterest));
  }
  if (params.minVolume != null && params.minVolume > 0) {
    addFilter(`minVolume(${params.minVolume})`, minVolume(params.minVolume));
  }

  // Spread filter
  if (params.maxSpreadPct != null) {
    addFilter(`maxSpread(${params.maxSpreadPct}%)`, maxSpread(params.maxSpreadPct));
  }

  // Contract type
  if (params.contractType) {
    addFilter(`contractType(${params.contractType})`, contractType(params.contractType));
  }

  // Industry filter
  if (params.industries && params.industries.length > 0) {
    addFilter(`industry(${params.industries.join(',')})`, industry(params.industries));
  }

  // Country filter
  if (params.countries && params.countries.length > 0) {
    addFilter(`country(${params.countries.join(',')})`, country(params.countries));
  }

  return filters;
}

// Export all filters as a namespace object for convenience
export const filters = {
  priceRange,
  minPrice,
  maxPrice,
  minDte,
  maxDte,
  dteRange,
  ivRange,
  maxIv,
  deltaRange,
  minOpenInterest,
  minVolume,
  contractType,
  moneyness,
  industry,
  country,
  underlyingTicker,
  maxSpread,
  hasPrice,
  hasGreeks,
  applyFilters,
  createFilterChain
};
