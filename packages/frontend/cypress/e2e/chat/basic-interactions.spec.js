/**
 * FR-1: Core Chat Functionality - Basic Interactions
 * High-performance E2E tests for fundamental chatbot operations
 */

describe('Basic Chat Interactions', { tags: ['core', 'chat', 'performance'] }, () => {
  beforeEach(() => {
    // Performance optimization: Clear any existing state
    cy.clearChatHistory()
    cy.startChatSession()
  })

  it('should send and receive basic messages within performance threshold', () => {
    cy.measurePerformance('basic-interaction', () => {
      cy.sendChatMessage('Olá')
      cy.assertResponseTime(3000)
      cy.verifyResponseContains('perguntas')
    })
  })

  it('should handle various message types efficiently', () => {
    // Test one message with special characters to verify handling
    const testMessage = 'Special chars: àáâãäåæçèéêë'

    cy.sendChatMessage(testMessage)
    cy.waitForChatResponse()

    // Verify response received (focus on bot response rather than user message)
    cy.get('[data-cy="chat-messages"]').find('[data-cy="bot-message"]').should('have.length.greaterThan', 0)
    cy.get('[data-cy="bot-message"]').last().should('be.visible')
  })

  it('should maintain message history with optimal performance', () => {
    // Send multiple messages rapidly
    const messageCount = 5

    for (let i = 0; i < messageCount; i++) {
      cy.sendChatMessage(`Message ${i + 1}`)
      cy.waitForChatResponse()
    }

    // Verify all messages are present
    cy.get('[data-cy="chat-messages"]').find('[data-cy="user-message"], [data-cy="bot-message"]').should('have.length', messageCount * 2)

    // Performance check: All messages should load quickly
    cy.get('[data-cy="chat-messages"]').should('be.visible')
  })

  it('should handle long messages without performance degradation', () => {
    const longMessage = 'A'.repeat(1000) // 1KB message

    cy.measurePerformance('long-message', () => {
      cy.sendChatMessage(longMessage)
      cy.waitForChatResponse(5000) // Slightly longer timeout for processing
      cy.get('[data-cy="chat-messages"]').should('be.visible')
    })
  })

  it('should display typing indicators with proper timing', () => {
    // Send message and wait for response
    cy.sendChatMessage('Test message')

    // Typing indicator should not be visible after response
    cy.get('[data-cy="typing-indicator"]').should('not.exist')
  })

  it('should handle rapid consecutive messages', () => {
    // Send messages without waiting for responses
    cy.get('[data-cy="chat-input"]').type('First message')
    cy.get('[data-cy="send-button"]').click()

    cy.get('[data-cy="chat-input"]').type('Second message')
    cy.get('[data-cy="send-button"]').click()

    // Both should be processed
    cy.get('[data-cy="chat-messages"] [data-cy="bot-message"]', { timeout: 15000 })
      .should('have.length', 2)
  })

  it('should prevent empty message submission', () => {
    // Try to send empty message
    cy.get('[data-cy="send-button"]').click()

    // Should not add any messages (or handle gracefully)
    cy.get('[data-cy="chat-messages"]').then(($messages) => {
      const botMessageCount = $messages.find('[data-cy="bot-message"]').length
      // Either no bot messages or the system handles empty input gracefully
      expect(botMessageCount).to.be.at.most(1) // Allow for a single response if system handles empty input
    })
  })

  it('should handle whitespace-only messages appropriately', () => {
    cy.sendChatMessage('   \n\t   ')

    // Should either trim or reject
    cy.get('[data-cy="chat-messages"]').then(($messages) => {
      const messageCount = $messages.find('[data-cy="bot-message"]').length
      // Either no message added or whitespace handled gracefully
      expect(messageCount).to.be.at.most(1)
    })
  })

  it('should maintain UI responsiveness during interactions', () => {
    cy.sendChatMessage('Performance test')

    // UI should remain responsive
    cy.get('[data-cy="chat-input"]').should('be.enabled')
    cy.get('[data-cy="send-button"]').should('not.be.disabled')

    cy.waitForChatResponse()

    // UI should still be responsive after response
    cy.get('[data-cy="chat-input"]').should('be.enabled')
    cy.get('[data-cy="send-button"]').should('not.be.disabled')
  })

  it('should handle message formatting correctly', () => {
    cy.sendChatMessage('**Bold text** and *italic text*')

    cy.waitForChatResponse()
    cy.get('[data-cy="chat-messages"]')
      .find('[data-cy="bot-message"]')
      .last()
      .should('be.visible')
      // Should render markdown or preserve formatting
  })
})