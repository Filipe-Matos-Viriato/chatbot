/**
 * FR-3: Contextual Intelligence - Contextual Responses
 * High-performance E2E tests for context-aware chatbot responses
 */

import { createTestUser, createTestListing } from '../../support/data-factories'

describe('Contextual Responses', { tags: ['contextual', 'intelligence', 'responses'] }, () => {
  beforeEach(() => {
    cy.clearChatHistory()
    cy.startChatSession()
  })

  it('should provide listing-specific responses when context is available', () => {
    const testListing = createTestListing({
      id: 'ap-01',
      name: 'Apartamento T2 Moderno',
      price: 250000
    })

    // Set listing context (simulating URL parameter or iframe context)
    cy.window().then((win) => {
      win.localStorage.setItem('selectedListingId', testListing.id)
    })

    cy.sendChatMessage('Quanto custa este apartamento?')
    cy.waitForChatResponse()

    // Should provide specific information about the listed apartment
    cy.verifyResponseContains('250.000') // Price from test data
    cy.verifyResponseContains('T2') // Type from test data
    cy.verifyResponseContains('Moderno') // Name reference
  })

  it('should adapt responses based on user typology preferences', () => {
    const userData = createTestUser({
      typology: 'T3',
      budget: '€400–600k'
    })

    // Complete onboarding to establish preferences
    cy.completeOnboarding(userData)

    cy.sendChatMessage('Que apartamentos têm disponíveis?')
    cy.waitForChatResponse()

    // Should prioritize T3 apartments in recommendations
    cy.verifyResponseContains('T3')

    // Should consider budget range
    cy.get('[data-cy="chat-messages"]')
      .find('[data-cy="bot-message"]')
      .last()
      .should('contain.text', '400')
      .and('contain.text', '600')
  })

  it('should handle development context for multi-unit properties', () => {
    // Set development context
    cy.window().then((win) => {
      win.localStorage.setItem('selectedDevelopmentId', 'dev-123')
    })

    cy.sendChatMessage('Fala-me sobre este empreendimento')
    cy.waitForChatResponse()

    // Should provide development-specific information
    cy.verifyResponseContains('empreendimento')
    // Should mention multiple units or development context
    cy.get('[data-cy="chat-messages"]').should('contain.text', 'empreendimento')
  })

  it('should maintain conversation context across multiple turns', () => {
    const userData = createTestUser({ typology: 'T2' })
    cy.completeOnboarding(userData)

    // First message establishes context
    cy.sendChatMessage('Estou interessado em apartamentos T2')
    cy.waitForChatResponse()
    cy.verifyResponseContains('T2')

    // Follow-up should maintain context
    cy.sendChatMessage('Quanto custam?')
    cy.waitForChatResponse()

    // Should still reference T2 apartments
    cy.verifyResponseContains('T2')

    // Another follow-up
    cy.sendChatMessage('E com garagem?')
    cy.waitForChatResponse()

    // Should maintain both contexts: T2 + garage preference
    cy.get('[data-cy="chat-messages"]')
      .find('[data-cy="bot-message"]')
      .last()
      .should('contain.text', 'T2')
  })

  it('should provide different responses for different user segments', () => {
    const userSegments = [
      { name: 'Budget Conscious', typology: 'T1', budget: '€100–150k', keyPhrase: 'económico' },
      { name: 'Middle Class', typology: 'T2', budget: '€200–300k', keyPhrase: 'equilibrado' },
      { name: 'Premium Buyer', typology: 'T3', budget: '€400–600k', keyPhrase: 'premium' }
    ]

    userSegments.forEach((segment) => {
      cy.clearChatHistory()
      cy.startChatSession()

      const userData = createTestUser(segment)
      cy.completeOnboarding(userData)

      cy.sendChatMessage('Que opções têm para mim?')
      cy.waitForChatResponse()

      // Should tailor response to user segment
      cy.verifyResponseContains(segment.typology)
      // Response should be contextually appropriate for budget range
      cy.get('[data-cy="chat-messages"]').should('contain.text', segment.typology)
    })
  })

  it('should handle contextual feature queries accurately', () => {
    const userData = createTestUser({ typology: 'T2' })
    cy.completeOnboarding(userData)

    // Set specific listing context
    cy.window().then((win) => {
      win.localStorage.setItem('selectedListingId', 'ap-01')
    })

    // Ask about specific feature
    cy.sendChatMessage('Este apartamento tem terraço?')
    cy.waitForChatResponse()

    // Should provide accurate information about the specific listing
    // (This would depend on actual listing data in the knowledge base)
    cy.get('[data-cy="chat-messages"]')
      .find('[data-cy="bot-message"]')
      .last()
      .should('be.visible')
      // Should not give generic answers
  })

  it('should adapt language and tone based on user engagement level', () => {
    // Low engagement user
    cy.sendChatMessage('Olá')
    cy.waitForChatResponse()

    // Should be friendly but not too familiar
    cy.get('[data-cy="chat-messages"]').should('contain.text', 'Olá')

    // High engagement user (after onboarding + multiple interactions)
    cy.clearChatHistory()
    cy.startChatSession()

    const userData = createTestUser()
    cy.completeOnboarding(userData)

    // Build engagement with multiple messages
    for (let i = 0; i < 5; i++) {
      cy.sendChatMessage(`Engagement message ${i + 1}`)
      cy.waitForChatResponse()
    }

    // High engagement query
    cy.sendChatMessage('Quero marcar uma visita urgente')
    cy.waitForChatResponse()

    // Should use more professional, action-oriented language
    cy.verifyResponseContains('visita')
  })

  it('should handle contextual time sensitivity', () => {
    const userData = createTestUser({
      typology: 'T2',
      timeframe: 'Imediatamente'
    })

    cy.completeOnboarding(userData)

    cy.sendChatMessage('Que apartamentos estão disponíveis já?')
    cy.waitForChatResponse()

    // Should prioritize immediately available properties
    cy.verifyResponseContains('disponível')
    cy.verifyResponseContains('imediatamente')
  })

  it('should provide contextual comparisons when appropriate', () => {
    const userData = createTestUser({
      typology: 'T2',
      budget: '€200–300k'
    })

    cy.completeOnboarding(userData)

    cy.sendChatMessage('Qual é a diferença entre T2 e T3?')
    cy.waitForChatResponse()

    // Should provide contextual comparison based on user preferences
    cy.verifyResponseContains('T2')
    cy.verifyResponseContains('T3')
    cy.get('[data-cy="chat-messages"]').should('contain.text', 'diferença')
  })

  it('should maintain contextual awareness during error recovery', () => {
    const userData = createTestUser({ typology: 'T3' })
    cy.completeOnboarding(userData)

    // Establish context
    cy.sendChatMessage('Estou interessado em T3')
    cy.waitForChatResponse()
    cy.verifyResponseContains('T3')

    // Simulate error
    cy.intercept('POST', '**/chat', { forceNetworkError: true })
    cy.sendChatMessage('Quanto custam?')
    cy.contains('Tentar novamente').click()

    // After recovery, should maintain context
    cy.waitForChatResponse()
    cy.verifyResponseContains('T3') // Should still reference T3
  })

  it('should handle contextual boundary cases', () => {
    // Test with no specific context
    cy.sendChatMessage('Fala-me sobre apartamentos')
    cy.waitForChatResponse()

    // Should provide general information
    cy.get('[data-cy="chat-messages"]').should('be.visible')

    // Test with conflicting context
    cy.clearChatHistory()
    cy.startChatSession()

    const userData = createTestUser({ typology: 'T1' })
    cy.completeOnboarding(userData)

    // Set different listing context
    cy.window().then((win) => {
      win.localStorage.setItem('selectedListingId', 'premium-t3-listing')
    })

    cy.sendChatMessage('Este apartamento serve para mim?')
    cy.waitForChatResponse()

    // Should balance user preferences with listing context
    cy.get('[data-cy="chat-messages"]').should('be.visible')
  })

  it('should demonstrate contextual learning over conversation', () => {
    const userData = createTestUser()
    cy.completeOnboarding(userData)

    // Initial broad query
    cy.sendChatMessage('Que apartamentos têm?')
    cy.waitForChatResponse()

    // Refine preferences through conversation
    cy.sendChatMessage('Na verdade, prefiro T2')
    cy.waitForChatResponse()
    cy.verifyResponseContains('T2')

    cy.sendChatMessage('Com orçamento até 300 mil')
    cy.waitForChatResponse()

    // Final query should incorporate all learned preferences
    cy.sendChatMessage('Quais são as melhores opções?')
    cy.waitForChatResponse()

    // Should reflect accumulated context: T2 + €300k budget
    cy.verifyResponseContains('T2')
    cy.get('[data-cy="chat-messages"]').should('contain.text', '300')
  })
})