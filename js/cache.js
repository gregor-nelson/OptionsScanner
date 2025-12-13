/**
 * Cache Manager - IndexedDB-based caching for scan results
 * Persists options scan data across page reloads
 */

const DB_NAME = 'OptionsScanner';
const DB_VERSION = 1;
const STORE_SCANS = 'scans';
const STORE_SETTINGS = 'settings';

// Cache configuration
const CACHE_CONFIG = {
  maxScans: 10,                    // Keep last 10 scans
  softExpiryHours: 4,              // Show "stale" warning after 4h
  hardExpiryDays: 7,               // Auto-delete after 7 days
  maxSizeBytes: 50 * 1024 * 1024   // 50MB limit
};

/**
 * Cache Manager class - handles all IndexedDB operations
 */
export class CacheManager {
  constructor() {
    this.db = null;
    this.isAvailable = false;
  }

  /**
   * Initialize IndexedDB connection
   * @returns {Promise<boolean>} - Whether initialization succeeded
   */
  async init() {
    if (!window.indexedDB) {
      console.warn('IndexedDB not available - caching disabled');
      return false;
    }

    try {
      this.db = await this._openDatabase();
      this.isAvailable = true;

      // Prune expired entries on init
      await this.pruneExpired();

      console.log('Cache manager initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize cache:', error);
      this.isAvailable = false;
      return false;
    }
  }

  /**
   * Open or create the IndexedDB database
   * @private
   */
  _openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create scans store
        if (!db.objectStoreNames.contains(STORE_SCANS)) {
          const scansStore = db.createObjectStore(STORE_SCANS, { keyPath: 'id' });
          scansStore.createIndex('byDate', 'timestamp', { unique: false });
        }

        // Create settings store
        if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
          db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
        }
      };
    });
  }

  /**
   * Save scan results to cache
   * @param {Object} results - Scan results from scanner.scan()
   * @param {Object} params - Scan parameters
   * @param {Array} universe - Tickers that were scanned
   * @returns {Promise<number>} - ID of saved scan
   */
  async saveScan(results, params, universe) {
    if (!this.isAvailable) {
      console.warn('Cache not available - scan not saved');
      return null;
    }

    const id = Date.now();
    const timestamp = new Date().toISOString();

    // Calculate approximate size
    const dataStr = JSON.stringify(results.contracts);
    const size = new Blob([dataStr]).size;

    const scanRecord = {
      id,
      timestamp,
      label: this._generateLabel(results, params),
      params: { ...params },
      universe: universe || [],
      results: {
        contracts: results.contracts,
        stats: results.stats
      },
      size
    };

    try {
      // Check if we need to make room
      await this._enforceStorageLimits(size);

      // Save to IndexedDB
      await this._saveToDB(STORE_SCANS, scanRecord);

      console.log(`Scan saved to cache: ${scanRecord.label} (${this._formatBytes(size)})`);
      return id;
    } catch (error) {
      console.error('Failed to save scan to cache:', error);
      return null;
    }
  }

  /**
   * Get the most recent scan from cache
   * @returns {Promise<Object|null>} - Most recent scan or null
   */
  async getLatestScan() {
    if (!this.isAvailable) return null;

    try {
      const scans = await this._getAllFromDB(STORE_SCANS);
      if (scans.length === 0) return null;

      // Sort by timestamp descending
      scans.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      return scans[0];
    } catch (error) {
      console.error('Failed to get latest scan:', error);
      return null;
    }
  }

  /**
   * Get list of all cached scans (metadata only, no contracts)
   * @returns {Promise<Array>} - Array of scan metadata
   */
  async listScans() {
    if (!this.isAvailable) return [];

    try {
      const scans = await this._getAllFromDB(STORE_SCANS);

      // Sort by timestamp descending and return metadata only
      return scans
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .map(scan => ({
          id: scan.id,
          timestamp: scan.timestamp,
          label: scan.label,
          contractCount: scan.results?.contracts?.length || 0,
          size: scan.size,
          isStale: this._isStale(scan.timestamp),
          isExpired: this._isExpired(scan.timestamp),
          params: scan.params
        }));
    } catch (error) {
      console.error('Failed to list scans:', error);
      return [];
    }
  }

  /**
   * Load a specific scan by ID
   * @param {number} id - Scan ID
   * @returns {Promise<Object|null>} - Full scan data or null
   */
  async loadScan(id) {
    if (!this.isAvailable) return null;

    try {
      return await this._getFromDB(STORE_SCANS, id);
    } catch (error) {
      console.error('Failed to load scan:', error);
      return null;
    }
  }

  /**
   * Delete a specific scan
   * @param {number} id - Scan ID
   * @returns {Promise<boolean>} - Whether deletion succeeded
   */
  async deleteScan(id) {
    if (!this.isAvailable) return false;

    try {
      await this._deleteFromDB(STORE_SCANS, id);
      console.log(`Scan ${id} deleted from cache`);
      return true;
    } catch (error) {
      console.error('Failed to delete scan:', error);
      return false;
    }
  }

  /**
   * Clear all cached scans
   * @returns {Promise<boolean>} - Whether clearing succeeded
   */
  async clearAll() {
    if (!this.isAvailable) return false;

    try {
      await this._clearStore(STORE_SCANS);
      console.log('All scans cleared from cache');
      return true;
    } catch (error) {
      console.error('Failed to clear cache:', error);
      return false;
    }
  }

  /**
   * Get cache statistics
   * @returns {Promise<Object>} - Cache stats
   */
  async getStats() {
    if (!this.isAvailable) {
      return { available: false, scanCount: 0, totalSize: 0 };
    }

    try {
      const scans = await this._getAllFromDB(STORE_SCANS);
      const totalSize = scans.reduce((sum, scan) => sum + (scan.size || 0), 0);

      return {
        available: true,
        scanCount: scans.length,
        totalSize,
        totalSizeFormatted: this._formatBytes(totalSize),
        maxScans: CACHE_CONFIG.maxScans,
        maxSize: CACHE_CONFIG.maxSizeBytes,
        maxSizeFormatted: this._formatBytes(CACHE_CONFIG.maxSizeBytes)
      };
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      return { available: false, scanCount: 0, totalSize: 0 };
    }
  }

  /**
   * Remove expired scans
   * @returns {Promise<number>} - Number of scans removed
   */
  async pruneExpired() {
    if (!this.isAvailable) return 0;

    try {
      const scans = await this._getAllFromDB(STORE_SCANS);
      let removed = 0;

      for (const scan of scans) {
        if (this._isExpired(scan.timestamp)) {
          await this._deleteFromDB(STORE_SCANS, scan.id);
          removed++;
        }
      }

      if (removed > 0) {
        console.log(`Pruned ${removed} expired scans from cache`);
      }
      return removed;
    } catch (error) {
      console.error('Failed to prune expired scans:', error);
      return 0;
    }
  }

  /**
   * Save a setting
   * @param {string} key - Setting key
   * @param {any} value - Setting value
   */
  async saveSetting(key, value) {
    if (!this.isAvailable) return;

    try {
      await this._saveToDB(STORE_SETTINGS, { key, value });
    } catch (error) {
      console.error('Failed to save setting:', error);
    }
  }

  /**
   * Get a setting
   * @param {string} key - Setting key
   * @param {any} defaultValue - Default if not found
   * @returns {Promise<any>} - Setting value
   */
  async getSetting(key, defaultValue = null) {
    if (!this.isAvailable) return defaultValue;

    try {
      const record = await this._getFromDB(STORE_SETTINGS, key);
      return record ? record.value : defaultValue;
    } catch (error) {
      console.error('Failed to get setting:', error);
      return defaultValue;
    }
  }

  // ============================================================================
  // Private helpers
  // ============================================================================

  /**
   * Generate a human-readable label for a scan
   * @private
   */
  _generateLabel(results, params) {
    const time = new Date().toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    const type = params.contractType === 'put' ? 'Puts' : 'Calls';
    const count = results.contracts?.length || 0;
    return `${type} · ${count} contracts · ${time}`;
  }

  /**
   * Check if a timestamp is stale (soft expiry)
   * @private
   */
  _isStale(timestamp) {
    const age = Date.now() - new Date(timestamp).getTime();
    const staleMs = CACHE_CONFIG.softExpiryHours * 60 * 60 * 1000;
    return age > staleMs;
  }

  /**
   * Check if a timestamp is expired (hard expiry)
   * @private
   */
  _isExpired(timestamp) {
    const age = Date.now() - new Date(timestamp).getTime();
    const expiredMs = CACHE_CONFIG.hardExpiryDays * 24 * 60 * 60 * 1000;
    return age > expiredMs;
  }

  /**
   * Format bytes to human-readable string
   * @private
   */
  _formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Enforce storage limits by removing old scans
   * @private
   */
  async _enforceStorageLimits(newSize) {
    const scans = await this._getAllFromDB(STORE_SCANS);

    // Sort by timestamp ascending (oldest first)
    scans.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Remove excess scans to stay under maxScans
    while (scans.length >= CACHE_CONFIG.maxScans) {
      const oldest = scans.shift();
      await this._deleteFromDB(STORE_SCANS, oldest.id);
      console.log(`Removed oldest scan to make room: ${oldest.label}`);
    }

    // Check total size
    let totalSize = scans.reduce((sum, scan) => sum + (scan.size || 0), 0);

    // Remove old scans until we have room
    while (totalSize + newSize > CACHE_CONFIG.maxSizeBytes && scans.length > 0) {
      const oldest = scans.shift();
      await this._deleteFromDB(STORE_SCANS, oldest.id);
      totalSize -= oldest.size || 0;
      console.log(`Removed scan to free space: ${oldest.label}`);
    }
  }

  // ============================================================================
  // IndexedDB operations
  // ============================================================================

  _saveToDB(storeName, data) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  _getFromDB(storeName, key) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  _getAllFromDB(storeName) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  _deleteFromDB(storeName, key) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  _clearStore(storeName) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

// Export singleton instance
export const cacheManager = new CacheManager();

// Export config for UI
export { CACHE_CONFIG };
