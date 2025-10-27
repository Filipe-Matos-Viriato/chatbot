// packages/backend/src/services/terminology-manager.js
// Centralized service for managing client-specific terminology configurations with caching
// To provide efficient, cached access to terminology mappings for Portuguese language localization
// Relevant files: client-config-service.js, rag-service.js, index.js
import supabase from '../config/supabase.js';
import NodeCache from 'node-cache';

// Initialize cache with a standard TTL of 15 minutes (900 seconds)
const terminologyCache = new NodeCache({ stdTTL: 900, checkperiod: 60 }); // Check for expired keys every minute

/**
 * TerminologyManager class for centralized term mapping management
 */
class TerminologyManager {
  constructor() {
    this.cache = terminologyCache;
    this.CACHE_TTL = 900000; // 15 minutes in milliseconds
  }

  /**
   * Gets client terminology configuration with caching
   * @param {string} clientId - Client UUID
   * @returns {Promise<Object>} Terminology configuration
   */
  async getClientTerminology(clientId) {
    const cacheKey = `terminology_${clientId}`;
    const cachedConfig = this.cache.get(cacheKey);

    if (cachedConfig && Date.now() - cachedConfig.timestamp < this.CACHE_TTL) {
      console.log(`[TerminologyManager] CACHE HIT for client: ${clientId}`);
      return cachedConfig.config;
    }

    console.log(`[TerminologyManager] CACHE MISS for client: ${clientId}. Fetching from database.`);
    const config = await this.fetchFromDatabase(clientId);

    // Cache result
    this.cache.set(cacheKey, { config, timestamp: Date.now() });
    return config;
  }

  /**
   * Fetches terminology configuration from database
   * @param {string} clientId - Client UUID
   * @returns {Promise<Object>} Terminology configuration
   */
  async fetchFromDatabase(clientId) {
    const { data, error } = await supabase
      .from('client_terminology')
      .select('*')
      .eq('client_id', clientId)
      .single();

    if (error || !data) {
      console.log(`[TerminologyManager] No terminology config found for client ${clientId}, using defaults`);
      return this.getDefaultConfig();
    }

    return {
      clientId,
      primaryDialect: data.primary_dialect,
      termMappings: data.term_mappings || [],
      customRules: data.custom_rules || [],
      enabled: data.enabled !== false
    };
  }

  /**
   * Returns default terminology configuration
   * @returns {Object} Default configuration
   */
  getDefaultConfig() {
    return {
      clientId: null,
      primaryDialect: 'european',
      termMappings: [
        {
          sourceTerm: 'banheiros',
          targetTerm: 'quartos de banho',
          wordBoundary: true,
          caseSensitive: false
        }
      ],
      customRules: [],
      enabled: true
    };
  }

  /**
   * Updates client terminology configuration
   * @param {string} clientId - Client UUID
   * @param {Object} updates - Configuration updates
   * @returns {Promise<Object>} Updated configuration
   */
  async updateClientTerminology(clientId, updates) {
    const { data, error } = await supabase
      .from('client_terminology')
      .upsert({
        client_id: clientId,
        ...updates,
        updated_at: new Date().toISOString()
      })
      .select('*')
      .single();

    if (error) {
      console.error(`[TerminologyManager] Error updating terminology for client ${clientId}:`, error);
      throw new Error('Failed to update terminology configuration');
    }

    // Invalidate cache
    const cacheKey = `terminology_${clientId}`;
    this.cache.del(cacheKey);
    console.log(`[TerminologyManager] CACHE INVALIDATED for client: ${clientId}`);

    return {
      clientId,
      primaryDialect: data.primary_dialect,
      termMappings: data.term_mappings || [],
      customRules: data.custom_rules || [],
      enabled: data.enabled !== false
    };
  }

  /**
   * Creates default terminology configuration for a client
   * @param {string} clientId - Client UUID
   * @returns {Promise<Object>} Created configuration
   */
  async createDefaultTerminology(clientId) {
    const defaultConfig = this.getDefaultConfig();
    return await this.updateClientTerminology(clientId, {
      primary_dialect: defaultConfig.primaryDialect,
      term_mappings: defaultConfig.termMappings,
      custom_rules: defaultConfig.customRules,
      enabled: defaultConfig.enabled
    });
  }

  /**
   * Logs terminology replacement for analytics
   * @param {string} clientId - Client UUID
   * @param {string} visitorId - Visitor ID (optional)
   * @param {string} originalTerm - Original term
   * @param {string} replacedTerm - Replaced term
   * @param {string} context - Usage context
   */
  async logTerminologyUsage(clientId, visitorId, originalTerm, replacedTerm, context = null) {
    try {
      await supabase
        .from('terminology_analytics')
        .insert({
          client_id: clientId,
          visitor_id: visitorId,
          original_term: originalTerm,
          replaced_term: replacedTerm,
          context
        });
    } catch (error) {
      console.error('[TerminologyManager] Error logging terminology usage:', error);
      // Don't throw - analytics failure shouldn't break functionality
    }
  }

  /**
   * Gets terminology analytics for a client
   * @param {string} clientId - Client UUID
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} Analytics data
   */
  async getTerminologyAnalytics(clientId, filters = {}) {
    let query = supabase
      .from('terminology_analytics')
      .select('*')
      .eq('client_id', clientId)
      .order('timestamp', { ascending: false })
      .limit(1000);

    if (filters.startDate) {
      query = query.gte('timestamp', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('timestamp', filters.endDate);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[TerminologyManager] Error fetching analytics:', error);
      throw new Error('Failed to fetch terminology analytics');
    }

    return data || [];
  }

  /**
   * Clears cache for a specific client
   * @param {string} clientId - Client UUID
   */
  clearCache(clientId) {
    const cacheKey = `terminology_${clientId}`;
    this.cache.del(cacheKey);
    console.log(`[TerminologyManager] CACHE CLEARED for client: ${clientId}`);
  }

  /**
   * Clears all cache entries
   */
  clearAllCache() {
    this.cache.flushAll();
    console.log('[TerminologyManager] ALL CACHE CLEARED');
  }
}

// Export singleton instance
const terminologyManager = new TerminologyManager();

export default terminologyManager;
export { TerminologyManager };