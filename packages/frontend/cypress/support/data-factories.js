// Optimized data factories for high-performance test data generation
export const createTestUser = (overrides = {}) => ({
  name: 'Test User',
  email: `test-${Date.now()}@example.com`,
  typology: 'T2',
  budget: '€200–300k',
  timeframe: '1–3 meses',
  consent: true,
  ...overrides
})

export const createTestListing = (overrides = {}) => ({
  id: `listing-${Date.now()}`,
  name: 'Apartamento T2 Moderno',
  price: 250000,
  beds: 2,
  baths: 1,
  type: 'T2',
  address: 'Lisboa, Portugal',
  ...overrides
})

export const createTestConversation = (overrides = {}) => ({
  visitorId: `visitor-${Date.now()}`,
  messages: [
    { from: 'user', text: 'Olá, quero comprar um apartamento', timestamp: Date.now() - 300000 },
    { from: 'bot', text: 'Olá! Que tipo de apartamento procura?', timestamp: Date.now() - 250000 },
    { from: 'user', text: 'Um T2', timestamp: Date.now() - 200000 }
  ],
  ...overrides
})

// Pre-computed test data for better performance
export const TEST_USERS = {
  basic: createTestUser(),
  highEngagement: createTestUser({
    typology: 'T3',
    budget: '€300–400k',
    timeframe: 'Imediatamente'
  }),
  lowEngagement: createTestUser({
    typology: 'T1',
    budget: '€100–150k',
    timeframe: '6–12 meses'
  })
}

export const TEST_LISTINGS = {
  standard: createTestListing(),
  premium: createTestListing({
    name: 'Apartamento T3 Premium',
    price: 450000,
    beds: 3,
    baths: 2,
    type: 'T3'
  }),
  budget: createTestListing({
    name: 'Apartamento T1 Económico',
    price: 150000,
    beds: 1,
    baths: 1,
    type: 'T1'
  })
}

// Performance-optimized factory functions
export const createBulkTestData = (count, factory, overrides = {}) => {
  return Array.from({ length: count }, (_, i) =>
    factory({ ...overrides, id: `${factory.name.toLowerCase()}-${i + 1}` })
  )
}

export const createSequentialTestUsers = (count) => {
  return Array.from({ length: count }, (_, i) => ({
    ...TEST_USERS.basic,
    name: `Test User ${i + 1}`,
    email: `test-user-${i + 1}@example.com`
  }))
}

export const createTestLeadScore = (engagement = 'medium') => {
  const scores = {
    low: { score: 25, level: 'LOW_ENGAGEMENT' },
    medium: { score: 55, level: 'MEDIUM_ENGAGEMENT' },
    high: { score: 85, level: 'HIGH_ENGAGEMENT' }
  }
  return scores[engagement] || scores.medium
}

// Cached test data for repeated use
let _cachedTestData = null
export const getCachedTestData = () => {
  if (!_cachedTestData) {
    _cachedTestData = {
      users: TEST_USERS,
      listings: TEST_LISTINGS,
      conversations: createTestConversation()
    }
  }
  return _cachedTestData
}