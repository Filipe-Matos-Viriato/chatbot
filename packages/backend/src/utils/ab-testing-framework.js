/**
 * A/B Testing Framework for Client-Specific LLM Analytics Dashboard
 * Enables testing and validation of optimization strategies
 *
 * This framework provides statistical rigor to optimization experiments,
 * ensuring that changes deliver measurable improvements before full deployment.
 */

import supabase from '../config/supabase.js';
import { EventEmitter } from 'events';

/**
 * @typedef {Object} ABTest
 * @property {string} id - Unique test ID
 * @property {string} name - Human-readable test name
 * @property {string} description - Test description
 * @property {string} clientId - Client identifier
 * @property {string} status - Test status (draft, running, completed, stopped)
 * @property {Object} variants - Test variants configuration
 * @property {string} variants.control - Control variant identifier
 * @property {Array<string>} variants.test - Test variant identifiers
 * @property {Object} metrics - Metrics to track
 * @property {Array<string>} metrics.primary - Primary success metrics
 * @property {Array<string>} metrics.secondary - Secondary metrics
 * @property {Object} targeting - User targeting rules
 * @property {number} targeting.percentage - Percentage of users to include (0-100)
 * @property {Object} targeting.filters - Additional targeting filters
 * @property {Object} schedule - Test schedule
 * @property {Date} schedule.startDate - Test start date
 * @property {Date} schedule.endDate - Test end date
 * @property {Object} results - Test results (populated after completion)
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 */

/**
 * @typedef {Object} VariantResult
 * @property {string} variantId - Variant identifier
 * @property {number} sampleSize - Number of observations
 * @property {Object} metrics - Metric values
 * @property {Object} confidence - Statistical confidence intervals
 * @property {number} improvement - Improvement over control (%)
 * @property {number} pValue - Statistical significance p-value
 */

class ABTestingFramework extends EventEmitter {
  constructor() {
    super();
    this.enabled = String(process.env.AB_TESTING_ENABLED || 'true') === 'true';
    this.minSampleSize = parseInt(process.env.AB_TEST_MIN_SAMPLE_SIZE || '100');
    this.confidenceLevel = parseFloat(process.env.AB_TEST_CONFIDENCE_LEVEL || '0.95');
    this.activeTests = new Map();

    if (this.enabled) {
      this.loadActiveTests();
      this.startTestMonitoring();
    }
  }

  /**
   * Load active tests from database
   */
  async loadActiveTests() {
    try {
      const { data, error } = await supabase
        .from('ab_tests')
        .select('*')
        .eq('status', 'running');

      if (error) {
        console.error('[ABTesting] Error loading active tests:', error);
        return;
      }

      for (const test of data) {
        this.activeTests.set(test.id, this.deserializeTest(test));
      }

      console.log(`[ABTesting] Loaded ${this.activeTests.size} active tests`);
    } catch (error) {
      console.error('[ABTesting] Error in loadActiveTests:', error);
    }
  }

  /**
   * Start test monitoring and evaluation
   */
  startTestMonitoring() {
    console.log('[ABTesting] Starting test monitoring');

    // Evaluate tests every hour
    setInterval(async () => {
      try {
        await this.evaluateActiveTests();
      } catch (error) {
        console.error('[ABTesting] Error in test evaluation:', error);
      }
    }, 60 * 60 * 1000); // 1 hour

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('[ABTesting] Test monitoring stopped');
    });
  }

  /**
   * Create a new A/B test
   * @param {Object} testConfig - Test configuration
   * @returns {Promise<ABTest>} Created test
   */
  async createTest(testConfig) {
    const test = {
      id: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: testConfig.name,
      description: testConfig.description,
      clientId: testConfig.clientId,
      status: 'draft',
      variants: {
        control: testConfig.variants.control,
        test: testConfig.variants.test || []
      },
      metrics: {
        primary: testConfig.metrics.primary || [],
        secondary: testConfig.metrics.secondary || []
      },
      targeting: {
        percentage: testConfig.targeting?.percentage || 50,
        filters: testConfig.targeting?.filters || {}
      },
      schedule: {
        startDate: testConfig.schedule?.startDate || new Date(),
        endDate: testConfig.schedule?.endDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 1 week
      },
      results: {},
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Validate test configuration
    this.validateTestConfig(test);

    // Store test
    const { error } = await supabase
      .from('ab_tests')
      .insert(this.serializeTest(test));

    if (error) {
      throw new Error(`Failed to create test: ${error.message}`);
    }

    console.log(`[ABTesting] ✅ Created test: ${test.name} (${test.id})`);
    return test;
  }

  /**
   * Start an A/B test
   * @param {string} testId - Test ID to start
   * @returns {Promise<boolean>} Success status
   */
  async startTest(testId) {
    const test = this.activeTests.get(testId);
    if (!test) {
      throw new Error(`Test ${testId} not found`);
    }

    if (test.status !== 'draft') {
      throw new Error(`Test ${testId} is not in draft status`);
    }

    // Update test status
    test.status = 'running';
    test.updatedAt = new Date();

    const { error } = await supabase
      .from('ab_tests')
      .update({ status: 'running', updated_at: test.updatedAt.toISOString() })
      .eq('id', testId);

    if (error) {
      throw new Error(`Failed to start test: ${error.message}`);
    }

    this.activeTests.set(testId, test);
    this.emit('testStarted', { testId, test });

    console.log(`[ABTesting] ✅ Started test: ${test.name} (${testId})`);
    return true;
  }

  /**
   * Stop an A/B test
   * @param {string} testId - Test ID to stop
   * @param {string} reason - Reason for stopping
   * @returns {Promise<boolean>} Success status
   */
  async stopTest(testId, reason = 'Manual stop') {
    const test = this.activeTests.get(testId);
    if (!test) {
      throw new Error(`Test ${testId} not found`);
    }

    // Final evaluation
    await this.evaluateTest(test);

    // Update test status
    test.status = 'stopped';
    test.updatedAt = new Date();
    test.results.stopReason = reason;

    const { error } = await supabase
      .from('ab_tests')
      .update({
        status: 'stopped',
        results: JSON.stringify(test.results),
        updated_at: test.updatedAt.toISOString()
      })
      .eq('id', testId);

    if (error) {
      throw new Error(`Failed to stop test: ${error.message}`);
    }

    this.activeTests.delete(testId);
    this.emit('testStopped', { testId, test, reason });

    console.log(`[ABTesting] ✅ Stopped test: ${test.name} (${testId}) - ${reason}`);
    return true;
  }

  /**
   * Assign user to test variant
   * @param {string} clientId - Client identifier
   * @param {string} userId - User identifier
   * @param {string} testId - Test identifier (optional, will find applicable test)
   * @returns {string|null} Assigned variant or null if not in test
   */
  async assignUserToVariant(clientId, userId, testId = null) {
    let applicableTest;

    if (testId) {
      applicableTest = this.activeTests.get(testId);
    } else {
      // Find applicable test for this client
      for (const test of this.activeTests.values()) {
        if (test.clientId === clientId && this.isUserEligible(test, userId)) {
          applicableTest = test;
          break;
        }
      }
    }

    if (!applicableTest) {
      return null; // No applicable test
    }

    // Check if user already assigned
    const existingAssignment = await this.getUserAssignment(applicableTest.id, userId);
    if (existingAssignment) {
      return existingAssignment.variant;
    }

    // Assign to variant based on consistent hashing
    const variant = this.assignVariant(applicableTest, userId);

    // Store assignment
    await this.storeUserAssignment(applicableTest.id, userId, variant);

    return variant;
  }

  /**
   * Record metric for user in test
   * @param {string} testId - Test ID
   * @param {string} userId - User ID
   * @param {string} variant - User's variant
   * @param {string} metricName - Metric name
   * @param {number} value - Metric value
   * @param {Object} metadata - Additional metadata
   */
  async recordMetric(testId, userId, variant, metricName, value, metadata = {}) {
    const metricData = {
      test_id: testId,
      user_id: userId,
      variant,
      metric_name: metricName,
      value,
      metadata: JSON.stringify(metadata),
      recorded_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('ab_test_metrics')
      .insert(metricData);

    if (error) {
      console.error('[ABTesting] Error recording metric:', error);
    }
  }

  /**
   * Evaluate active tests for completion or statistical significance
   */
  async evaluateActiveTests() {
    for (const [testId, test] of this.activeTests) {
      try {
        const shouldComplete = await this.evaluateTest(test);

        if (shouldComplete) {
          await this.completeTest(testId, test);
        }
      } catch (error) {
        console.error(`[ABTesting] Error evaluating test ${testId}:`, error);
      }
    }
  }

  /**
   * Evaluate a single test
   * @param {ABTest} test - Test to evaluate
   * @returns {boolean} Whether test should be completed
   */
  async evaluateTest(test) {
    // Check if test should end based on schedule
    if (new Date() > test.schedule.endDate) {
      test.results.completionReason = 'scheduled_end';
      return true;
    }

    // Get current results
    const results = await this.calculateTestResults(test);

    // Check statistical significance
    const significantResults = this.checkStatisticalSignificance(results);

    if (significantResults.length > 0) {
      test.results.completionReason = 'statistical_significance';
      test.results.significantFindings = significantResults;
      return true;
    }

    // Check minimum sample size
    const totalSampleSize = results.reduce((sum, variant) => sum + variant.sampleSize, 0);
    if (totalSampleSize >= this.minSampleSize * (test.variants.test.length + 1)) {
      // Sufficient data, check if we should stop due to lack of significance
      const daysRunning = (Date.now() - test.schedule.startDate.getTime()) / (24 * 60 * 60 * 1000);
      if (daysRunning > 7 && significantResults.length === 0) {
        test.results.completionReason = 'no_significance_after_week';
        return true;
      }
    }

    return false;
  }

  /**
   * Complete a test and store final results
   * @param {string} testId - Test ID
   * @param {ABTest} test - Test object
   */
  async completeTest(testId, test) {
    test.status = 'completed';
    test.updatedAt = new Date();

    // Final results calculation
    test.results.finalResults = await this.calculateTestResults(test);
    test.results.completedAt = new Date().toISOString();

    const { error } = await supabase
      .from('ab_tests')
      .update({
        status: 'completed',
        results: JSON.stringify(test.results),
        updated_at: test.updatedAt.toISOString()
      })
      .eq('id', testId);

    if (error) {
      console.error(`[ABTesting] Error completing test ${testId}:`, error);
    } else {
      this.activeTests.delete(testId);
      this.emit('testCompleted', { testId, test });

      console.log(`[ABTesting] ✅ Completed test: ${test.name} (${testId})`);
    }
  }

  /**
   * Calculate test results
   * @param {ABTest} test - Test object
   * @returns {Array<VariantResult>} Results for each variant
   */
  async calculateTestResults(test) {
    const results = [];

    // Get all variants
    const allVariants = [test.variants.control, ...test.variants.test];

    for (const variant of allVariants) {
      const variantMetrics = await this.getVariantMetrics(test.id, variant);
      const variantResult = {
        variantId: variant,
        sampleSize: variantMetrics.sampleSize,
        metrics: variantMetrics.averages,
        confidence: this.calculateConfidenceIntervals(variantMetrics),
        improvement: 0,
        pValue: 1.0
      };

      results.push(variantResult);
    }

    // Calculate improvements and statistical significance
    const controlResult = results.find(r => r.variantId === test.variants.control);
    if (controlResult) {
      for (const result of results) {
        if (result.variantId !== test.variants.control) {
          // Calculate improvement for primary metrics
          for (const metric of test.metrics.primary) {
            if (controlResult.metrics[metric] && result.metrics[metric]) {
              const improvement = ((result.metrics[metric] - controlResult.metrics[metric]) / controlResult.metrics[metric]) * 100;
              result.improvement = Math.max(result.improvement, improvement);
            }
          }

          // Calculate p-values
          result.pValue = this.calculatePValue(controlResult, result);
        }
      }
    }

    return results;
  }

  /**
   * Get metrics for a test variant
   * @param {string} testId - Test ID
   * @param {string} variant - Variant identifier
   * @returns {Object} Variant metrics
   */
  async getVariantMetrics(testId, variant) {
    const { data, error } = await supabase
      .from('ab_test_metrics')
      .select('metric_name, value')
      .eq('test_id', testId)
      .eq('variant', variant);

    if (error) {
      console.error('[ABTesting] Error fetching variant metrics:', error);
      return { sampleSize: 0, averages: {} };
    }

    const metrics = {};
    const counts = {};

    for (const record of data) {
      if (!metrics[record.metric_name]) {
        metrics[record.metric_name] = 0;
        counts[record.metric_name] = 0;
      }
      metrics[record.metric_name] += record.value;
      counts[record.metric_name]++;
    }

    // Calculate averages
    const averages = {};
    for (const [metric, sum] of Object.entries(metrics)) {
      averages[metric] = sum / counts[metric];
    }

    return {
      sampleSize: data.length,
      averages
    };
  }

  /**
   * Check statistical significance of results
   * @param {Array<VariantResult>} results - Test results
   * @returns {Array<Object>} Significant findings
   */
  checkStatisticalSignificance(results) {
    const significant = [];

    for (const result of results) {
      if (result.pValue < (1 - this.confidenceLevel)) {
        significant.push({
          variant: result.variantId,
          improvement: result.improvement,
          pValue: result.pValue,
          confidence: this.confidenceLevel
        });
      }
    }

    return significant;
  }

  /**
   * Calculate confidence intervals for metrics
   * @param {Object} variantMetrics - Variant metrics data
   * @returns {Object} Confidence intervals
   */
  calculateConfidenceIntervals(variantMetrics) {
    const intervals = {};

    for (const [metric, values] of Object.entries(variantMetrics.averages)) {
      // Simplified confidence interval calculation
      const stdDev = this.calculateStandardDeviation(variantMetrics.rawValues?.[metric] || []);
      const marginOfError = stdDev * 1.96 / Math.sqrt(variantMetrics.sampleSize); // 95% CI

      intervals[metric] = {
        lower: values - marginOfError,
        upper: values + marginOfError,
        marginOfError
      };
    }

    return intervals;
  }

  /**
   * Calculate p-value for statistical significance
   * @param {VariantResult} control - Control variant result
   * @param {VariantResult} variant - Test variant result
   * @returns {number} p-value
   */
  calculatePValue(control, variant) {
    // Simplified t-test implementation
    // In production, you'd use a proper statistical library
    const controlMean = control.metrics.cost_per_request || 0;
    const variantMean = variant.metrics.cost_per_request || 0;
    const controlSize = control.sampleSize;
    const variantSize = variant.sampleSize;

    if (controlSize < 2 || variantSize < 2) return 1.0;

    // Simplified calculation - assumes equal variance
    const pooledStdDev = Math.sqrt(((controlSize - 1) + (variantSize - 1)) / (controlSize + variantSize - 2));
    const tStatistic = Math.abs(controlMean - variantMean) / (pooledStdDev * Math.sqrt(1/controlSize + 1/variantSize));

    // Approximate p-value (two-tailed)
    // This is a rough approximation - use proper statistical functions in production
    if (tStatistic > 2.576) return 0.01; // p < 0.01
    if (tStatistic > 1.96) return 0.05;  // p < 0.05
    if (tStatistic > 1.645) return 0.10; // p < 0.10

    return 0.20; // Not significant
  }

  /**
   * Calculate standard deviation
   * @param {Array<number>} values - Array of values
   * @returns {number} Standard deviation
   */
  calculateStandardDeviation(values) {
    if (values.length < 2) return 0;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / (values.length - 1);

    return Math.sqrt(variance);
  }

  /**
   * Assign variant to user using consistent hashing
   * @param {ABTest} test - Test object
   * @param {string} userId - User identifier
   * @returns {string} Assigned variant
   */
  assignVariant(test, userId) {
    // Simple hash-based assignment for consistency
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash + userId.charCodeAt(i)) & 0xffffffff;
    }

    const normalizedHash = Math.abs(hash) / 0x7fffffff; // Normalize to 0-1
    const allVariants = [test.variants.control, ...test.variants.test];

    // Check targeting percentage
    if (normalizedHash > test.targeting.percentage / 100) {
      return null; // Not selected for test
    }

    // Assign to variant
    const variantIndex = Math.floor(normalizedHash * allVariants.length);
    return allVariants[variantIndex];
  }

  /**
   * Check if user is eligible for test
   * @param {ABTest} test - Test object
   * @param {string} userId - User identifier
   * @returns {boolean} Eligibility status
   */
  isUserEligible(test, userId) {
    // Add targeting logic here based on test.targeting.filters
    // For now, all users are eligible
    return true;
  }

  /**
   * Get user's test assignment
   * @param {string} testId - Test ID
   * @param {string} userId - User ID
   * @returns {Object|null} Assignment data or null
   */
  async getUserAssignment(testId, userId) {
    const { data, error } = await supabase
      .from('ab_test_assignments')
      .select('*')
      .eq('test_id', testId)
      .eq('user_id', userId)
      .single();

    if (error || !data) return null;
    return data;
  }

  /**
   * Store user assignment
   * @param {string} testId - Test ID
   * @param {string} userId - User ID
   * @param {string} variant - Assigned variant
   */
  async storeUserAssignment(testId, userId, variant) {
    const assignment = {
      test_id: testId,
      user_id: userId,
      variant,
      assigned_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('ab_test_assignments')
      .insert(assignment);

    if (error) {
      console.error('[ABTesting] Error storing assignment:', error);
    }
  }

  /**
   * Validate test configuration
   * @param {ABTest} test - Test to validate
   */
  validateTestConfig(test) {
    if (!test.name || !test.clientId) {
      throw new Error('Test must have name and clientId');
    }

    if (!test.variants.control || test.variants.test.length === 0) {
      throw new Error('Test must have control and at least one test variant');
    }

    if (test.metrics.primary.length === 0) {
      throw new Error('Test must have at least one primary metric');
    }

    if (test.targeting.percentage < 0 || test.targeting.percentage > 100) {
      throw new Error('Targeting percentage must be between 0 and 100');
    }
  }

  /**
   * Serialize test for database storage
   * @param {ABTest} test - Test object
   * @returns {Object} Serialized test
   */
  serializeTest(test) {
    return {
      id: test.id,
      name: test.name,
      description: test.description,
      client_id: test.clientId,
      status: test.status,
      variants: JSON.stringify(test.variants),
      metrics: JSON.stringify(test.metrics),
      targeting: JSON.stringify(test.targeting),
      schedule: JSON.stringify({
        startDate: test.schedule.startDate.toISOString(),
        endDate: test.schedule.endDate.toISOString()
      }),
      results: JSON.stringify(test.results),
      created_at: test.createdAt.toISOString(),
      updated_at: test.updatedAt.toISOString()
    };
  }

  /**
   * Deserialize test from database
   * @param {Object} data - Database record
   * @returns {ABTest} Deserialized test
   */
  deserializeTest(data) {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      clientId: data.client_id,
      status: data.status,
      variants: JSON.parse(data.variants || '{}'),
      metrics: JSON.parse(data.metrics || '{}'),
      targeting: JSON.parse(data.targeting || '{}'),
      schedule: {
        startDate: new Date(data.schedule?.startDate || data.created_at),
        endDate: new Date(data.schedule?.endDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
      },
      results: JSON.parse(data.results || '{}'),
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }

  /**
   * Get test by ID
   * @param {string} testId - Test ID
   * @returns {ABTest|null} Test object or null
   */
  async getTest(testId) {
    const { data, error } = await supabase
      .from('ab_tests')
      .select('*')
      .eq('id', testId)
      .single();

    if (error || !data) return null;
    return this.deserializeTest(data);
  }

  /**
   * Get all tests for a client
   * @param {string} clientId - Client ID
   * @param {Object} options - Query options
   * @returns {Array<ABTest>} Array of tests
   */
  async getClientTests(clientId, options = {}) {
    const { status, limit = 50 } = options;

    let query = supabase
      .from('ab_tests')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) query = query.eq('status', status);

    const { data, error } = await query;

    if (error) {
      console.error('[ABTesting] Error fetching client tests:', error);
      return [];
    }

    return data.map(record => this.deserializeTest(record));
  }

  /**
   * Stop the A/B testing framework
   */
  stop() {
    console.log('[ABTesting] A/B testing framework stopped');
  }
}

export default new ABTestingFramework();