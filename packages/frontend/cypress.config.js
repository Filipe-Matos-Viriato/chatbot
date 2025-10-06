import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5174',
    specPattern: 'cypress/e2e/**/*.spec.js',
    supportFile: 'cypress/support/e2e.js',
    video: true,
    screenshotOnRunFailure: true,
    retries: {
      runMode: 2,
      openMode: 1
    },
    setupNodeEvents(on, config) {
      // Register custom tasks
      on('task', {
        logPerformance({ name, duration, threshold }) {
          console.log(`[Performance] ${name}: ${duration}ms (threshold: ${threshold}ms)`)
          if (duration > threshold) {
            console.warn(`[Performance Warning] ${name} exceeded threshold by ${duration - threshold}ms`)
          }
          return null
        },
        getLeadScore(sessionData) {
          // Mock implementation - in real scenario this would query the backend
          // For testing purposes, return a mock score based on session data
          if (!sessionData) return 0

          // Simple mock logic - in real implementation this would call the backend
          const mockScore = Math.floor(Math.random() * 100)
          console.log(`[Mock Lead Score] Returning score: ${mockScore} for session: ${JSON.stringify(sessionData).substring(0, 50)}...`)
          return mockScore
        },
        getLeadCategory(score) {
          if (score >= 70) return 'Hot Lead'
          if (score >= 40) return 'Warm Lead'
          return 'Cold Lead'
        }
      })
    },
    env: {
      API_BASE_URL: 'http://localhost:3007',
      TEST_CLIENT_ID: 'e6f484a3-c3cb-4e01-b8ce-a276f4b7355c',
      PERFORMANCE_THRESHOLD: 3000, // 3 seconds
      VISUAL_REGRESSION: false
    },
    viewportWidth: 1280,
    viewportHeight: 720,
    defaultCommandTimeout: 10000,
    requestTimeout: 15000,
    responseTimeout: 15000,
    experimentalMemoryManagement: true,
    numTestsKeptInMemory: 5,
    watchForFileChanges: false
  },
  component: {
    devServer: {
      framework: 'create-react-app',
      bundler: 'webpack'
    }
  }
})