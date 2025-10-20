// packages/backend/src/services/batch-settings-service.js
// Service for managing dynamic batch processing settings per client
// Provides CRUD operations for batch settings with client isolation

import supabase from '../config/supabase.js';

/**
 * Batch Settings Service
 * Manages batch processing settings for different systems per client
 */
class BatchSettingsService {
  /**
   * Get batch settings for a specific client and system
   * @param {string} clientId - Client identifier
   * @param {string} systemName - System name ('learning_engine' or 'analytics_logger')
   * @returns {Promise<Object|null>} Batch settings or null if not found
   */
  async getBatchSettings(clientId, systemName) {
    try {
      const { data, error } = await supabase
        .from('batch_processing_settings')
        .select('*')
        .eq('client_id', clientId)
        .eq('system_name', systemName)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('[BatchSettingsService] Error fetching batch settings:', error);
        throw error;
      }

      return data || null;
    } catch (error) {
      console.error('[BatchSettingsService] Failed to get batch settings:', error);
      throw error;
    }
  }

  /**
   * Get all batch settings for a client
   * @param {string} clientId - Client identifier
   * @returns {Promise<Array>} Array of batch settings
   */
  async getAllBatchSettings(clientId) {
    try {
      const { data, error } = await supabase
        .from('batch_processing_settings')
        .select('*')
        .eq('client_id', clientId)
        .eq('is_active', true)
        .order('system_name');

      if (error) {
        console.error('[BatchSettingsService] Error fetching all batch settings:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('[BatchSettingsService] Failed to get all batch settings:', error);
      throw error;
    }
  }

  /**
   * Create or update batch settings for a client and system
   * @param {string} clientId - Client identifier
   * @param {string} systemName - System name
   * @param {Object} settings - Settings object
   * @param {string} updatedBy - User who made the change
   * @returns {Promise<Object>} Updated batch settings
   */
  async upsertBatchSettings(clientId, systemName, settings, updatedBy = 'system') {
    try {
      const { batch_trigger_threshold, description, is_active = true } = settings;

      // Validate input
      if (!batch_trigger_threshold || batch_trigger_threshold <= 0) {
        throw new Error('batch_trigger_threshold must be a positive integer');
      }

      if (!['learning_engine', 'analytics_logger'].includes(systemName)) {
        throw new Error('system_name must be either "learning_engine" or "analytics_logger"');
      }

      const upsertData = {
        client_id: clientId,
        system_name: systemName,
        batch_trigger_threshold,
        description: description || null,
        is_active,
        updated_by: updatedBy,
        updated_at: new Date().toISOString()
      };

      // For new records, also set created_by
      const existing = await this.getBatchSettings(clientId, systemName);
      if (!existing) {
        upsertData.created_by = updatedBy;
        upsertData.created_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('batch_processing_settings')
        .upsert(upsertData, {
          onConflict: 'client_id,system_name',
          returning: 'representation'
        })
        .select()
        .single();

      if (error) {
        console.error('[BatchSettingsService] Error upserting batch settings:', error);
        throw error;
      }

      console.log(`[BatchSettingsService] ✅ Updated batch settings for ${systemName} (client: ${clientId})`);
      return data;
    } catch (error) {
      console.error('[BatchSettingsService] Failed to upsert batch settings:', error);
      throw error;
    }
  }

  /**
   * Delete batch settings for a client and system (soft delete by setting is_active = false)
   * @param {string} clientId - Client identifier
   * @param {string} systemName - System name
   * @param {string} deletedBy - User who deleted the settings
   * @returns {Promise<boolean>} Success status
   */
  async deleteBatchSettings(clientId, systemName, deletedBy = 'system') {
    try {
      const { error } = await supabase
        .from('batch_processing_settings')
        .update({
          is_active: false,
          updated_by: deletedBy,
          updated_at: new Date().toISOString()
        })
        .eq('client_id', clientId)
        .eq('system_name', systemName);

      if (error) {
        console.error('[BatchSettingsService] Error deleting batch settings:', error);
        throw error;
      }

      console.log(`[BatchSettingsService] ✅ Soft deleted batch settings for ${systemName} (client: ${clientId})`);
      return true;
    } catch (error) {
      console.error('[BatchSettingsService] Failed to delete batch settings:', error);
      throw error;
    }
  }

  /**
   * Get batch trigger threshold for a client and system, with fallback to defaults
   * @param {string} clientId - Client identifier
   * @param {string} systemName - System name
   * @returns {Promise<number>} Batch trigger threshold
   */
  async getBatchTriggerThreshold(clientId, systemName) {
    try {
      const settings = await this.getBatchSettings(clientId, systemName);

      if (settings && settings.is_active) {
        return settings.batch_trigger_threshold;
      }

      // Fallback to system defaults
      const defaults = {
        learning_engine: 100,
        analytics_logger: 50
      };

      return defaults[systemName] || 50;
    } catch (error) {
      console.error('[BatchSettingsService] Error getting batch trigger threshold, using default:', error);
      // Return safe defaults on error
      return systemName === 'learning_engine' ? 100 : 50;
    }
  }

  /**
   * Validate batch settings before saving
   * @param {Object} settings - Settings to validate
   * @returns {Object} Validation result {isValid, errors}
   */
  validateBatchSettings(settings) {
    const errors = [];

    if (!settings.batch_trigger_threshold || typeof settings.batch_trigger_threshold !== 'number') {
      errors.push('batch_trigger_threshold must be a number');
    } else if (settings.batch_trigger_threshold <= 0) {
      errors.push('batch_trigger_threshold must be greater than 0');
    } else if (settings.batch_trigger_threshold > 10000) {
      errors.push('batch_trigger_threshold cannot exceed 10,000');
    }

    if (settings.description && settings.description.length > 500) {
      errors.push('description cannot exceed 500 characters');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export default new BatchSettingsService();