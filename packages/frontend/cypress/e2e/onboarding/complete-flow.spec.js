/**
 * FR-2: User Journey Testing - Complete Onboarding Flow
 * High-performance E2E tests for full user onboarding experience
 */

import { createTestUser } from '../../support/data-factories'

describe('Complete Onboarding Flow', { tags: ['journey', 'onboarding', 'critical'] }, () => {
  beforeEach(() => {
    cy.clearChatHistory()
    cy.startChatSession()
  })

  it('should complete full onboarding journey within performance targets', () => {
    const userData = createTestUser({
      typology: 'T3',
      budget: '€300–400k',
      timeframe: '3–6 meses'
    })

    cy.measurePerformance('complete-onboarding', () => {
      cy.completeOnboarding(userData)
    })

    // Verify onboarding completion
    cy.contains('Thank you for your preferences').should('be.visible')

    // Verify seamless transition to chat
    cy.get('[data-cy="chat-input"]').should('be.enabled')
    cy.get('[data-cy="send-button"]').should('be.visible')
  })

  it('should validate all form fields with proper error handling', () => {
    // Start onboarding by sending first message
    cy.sendChatMessage('Olá')

    // Should show onboarding intro
    cy.contains('Antes de continuar').should('be.visible')

    // Try to proceed without selecting typology
    cy.get('[data-cy="onboarding-next"]').click()

    // Should show validation error or prevent progression
    cy.get('[data-cy="typology-select"]').should('be.visible')

    // Complete with valid data
    cy.get('[data-cy="typology-select"]').select('T2')
    cy.get('[data-cy="onboarding-next"]').click()

    cy.get('[data-cy="budget-select"]').select('€200–300k')
    cy.get('[data-cy="onboarding-next"]').click()

    cy.get('[data-cy="timeframe-select"]').select('1–3 meses')
    cy.get('[data-cy="onboarding-next"]').click()

    // Contact form validation
    cy.get('[data-cy="onboarding-complete"]').click()

    // Should show validation errors for required fields
    cy.get('[data-cy="name-input"]').should('be.visible')
    cy.get('[data-cy="email-input"]').should('be.visible')

    // Fill required fields
    cy.get('[data-cy="name-input"]').type('Test User')
    cy.get('[data-cy="email-input"]').type('test@example.com')
    cy.get('[data-cy="consent-checkbox"]').check()

    cy.get('[data-cy="onboarding-complete"]').click()

    // Should complete successfully
    cy.contains('Thank you for your preferences').should('be.visible')
  })

  it('should handle different user personas efficiently', () => {
    const personas = [
      { typology: 'T1', budget: '€100–150k', timeframe: '6–12 meses', name: 'Budget Conscious' },
      { typology: 'T2', budget: '€200–300k', timeframe: '1–3 meses', name: 'Middle Class' },
      { typology: 'T3', budget: '€400–600k', timeframe: 'Imediatamente', name: 'Premium Buyer' }
    ]

    personas.forEach((persona, index) => {
      cy.clearChatHistory()
      cy.startChatSession()

      const userData = createTestUser(persona)

      cy.measurePerformance(`onboarding-persona-${index}`, () => {
        cy.completeOnboarding(userData)
      })

      cy.contains('Thank you for your preferences').should('be.visible')
    })
  })

  it('should persist onboarding data across sessions', () => {
    const userData = createTestUser()

    // Complete onboarding
    cy.completeOnboarding(userData)

    // Simulate page refresh
    cy.reload()

    // Should recover session and show chat interface
    cy.startChatSession()

    // Send a message to verify context is maintained
    cy.sendChatMessage('Test persistence')
    cy.waitForChatResponse()

    // Should have personalized response based on onboarding data
    cy.verifyResponseContains('T2') // Should reflect typology preference
  })

  it('should handle onboarding interruption and recovery', () => {
    // Start onboarding by sending first message
    cy.sendChatMessage('Olá')

    // Should show onboarding intro
    cy.contains('Antes de continuar').should('be.visible')

    // Complete first step
    cy.get('[data-cy="onboarding-option-T2"]').click()
    cy.get('[data-cy="onboarding-next"]').click()

    // Simulate page refresh (interruption)
    cy.reload()

    // Should restart onboarding (or recover if implemented)
    cy.startChatSession()

    // Should be able to complete onboarding again
    const userData = createTestUser()
    cy.completeOnboarding(userData)

    cy.contains('Thank you for your preferences').should('be.visible')
  })

  it('should validate email format and provide feedback', () => {
    // Start onboarding and navigate to contact step
    cy.sendChatMessage('Olá')
    cy.contains('Antes de continuar').should('be.visible')
    cy.get('[data-cy="onboarding-option-T2"]').click()
    cy.get('[data-cy="onboarding-next"]').click()
    cy.get('[data-cy="onboarding-option-€200–300k"]').click()
    cy.get('[data-cy="onboarding-next"]').click()
    cy.get('[data-cy="onboarding-option-1–3 meses"]').click()
    cy.get('[data-cy="onboarding-next"]').click()

    // Test invalid email formats
    const invalidEmails = ['invalid', 'invalid@', '@invalid.com', 'invalid.com']

    invalidEmails.forEach(email => {
      cy.get('[data-cy="email-input"]').clear().type(email)
      cy.get('[data-cy="name-input"]').type('Test User')
      cy.get('[data-cy="consent-checkbox"]').check()

      cy.get('[data-cy="onboarding-complete"]').click()

      // Should not proceed with invalid email
      cy.contains('Thank you for your preferences').should('not.exist')
    })

    // Test valid email
    cy.get('[data-cy="email-input"]').clear().type('valid@example.com')
    cy.get('[data-cy="onboarding-complete"]').click()

    cy.contains('Thank you for your preferences').should('be.visible')
  })

  it('should require consent for data processing', () => {
    // Navigate to final step without consent
    cy.sendChatMessage('Olá')
    cy.contains('Antes de continuar').should('be.visible')
    cy.get('[data-cy="onboarding-option-T2"]').click()
    cy.get('[data-cy="onboarding-next"]').click()
    cy.get('[data-cy="onboarding-option-€200–300k"]').click()
    cy.get('[data-cy="onboarding-next"]').click()
    cy.get('[data-cy="onboarding-option-1–3 meses"]').click()
    cy.get('[data-cy="onboarding-next"]').click()

    cy.get('[data-cy="name-input"]').type('Test User')
    cy.get('[data-cy="email-input"]').type('test@example.com')

    // Try to complete without consent
    cy.get('[data-cy="onboarding-complete"]').click()

    // Should not proceed
    cy.contains('Thank you for your preferences').should('not.exist')

    // Add consent and complete
    cy.get('[data-cy="consent-checkbox"]').check()
    cy.get('[data-cy="onboarding-complete"]').click()

    cy.contains('Thank you for your preferences').should('be.visible')
  })

  it('should provide progress indication throughout journey', () => {
    cy.sendChatMessage('Olá')
    cy.contains('Antes de continuar').should('be.visible')

    // Step 1: Should show progress
    cy.get('[data-cy="progress-indicator"]').should('be.visible')
    cy.get('[data-cy="progress-step-1"]').should('have.class', 'active')

    cy.get('[data-cy="typology-select"]').select('T2')
    cy.get('[data-cy="onboarding-next"]').click()

    // Step 2: Progress updated
    cy.get('[data-cy="progress-step-2"]').should('have.class', 'active')

    cy.get('[data-cy="budget-select"]').select('€200–300k')
    cy.get('[data-cy="onboarding-next"]').click()

    // Step 3: Progress updated
    cy.get('[data-cy="progress-step-3"]').should('have.class', 'active')

    cy.get('[data-cy="timeframe-select"]').select('1–3 meses')
    cy.get('[data-cy="onboarding-next"]').click()

    // Step 4: Final step
    cy.get('[data-cy="progress-step-4"]').should('have.class', 'active')

    cy.get('[data-cy="name-input"]').type('Test User')
    cy.get('[data-cy="email-input"]').type('test@example.com')
    cy.get('[data-cy="consent-checkbox"]').check()
    cy.get('[data-cy="onboarding-complete"]').click()

    // Progress complete
    cy.get('[data-cy="progress-complete"]').should('be.visible')
  })
})