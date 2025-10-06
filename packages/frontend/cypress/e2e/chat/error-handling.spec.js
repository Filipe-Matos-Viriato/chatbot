/**
 * FR-1: Core Chat Functionality - Error Handling
 * High-performance E2E tests for error scenarios and recovery
 */

describe('Error Handling', { tags: ['core', 'error-handling', 'resilience'] }, () => {
  beforeEach(() => {
    cy.clearChatHistory()
    cy.startChatSession()
  })

  it('should handle network failures gracefully', () => {
    // Intercept and mock network failure
    cy.intercept('POST', '**/chat', { forceNetworkError: true })

    cy.sendChatMessage('Test message')

    // Should show user-friendly error message
    cy.contains('Erro de conexão', { timeout: 5000 }).should('be.visible')
    cy.contains('Tentar novamente').should('be.visible')

    // UI should remain functional
    cy.get('[data-cy="chat-input"]').should('be.enabled')
  })

  it('should handle backend errors with appropriate messages', () => {
    cy.intercept('POST', '**/chat', { statusCode: 500 })

    cy.sendChatMessage('Test message')

    cy.contains('Erro interno do servidor').should('be.visible')
  })

  it('should handle timeout errors', () => {
    cy.intercept('POST', '**/chat', { delay: 35000 }) // Longer than timeout

    cy.sendChatMessage('Test message')

    cy.contains(/Timeout|timeout/i).should('be.visible')
  })

  it('should allow retry after errors with exponential backoff simulation', () => {
    let attemptCount = 0

    cy.intercept('POST', '**/chat', (req) => {
      attemptCount++
      if (attemptCount === 1) {
        req.reply({ forceNetworkError: true })
      } else {
        req.reply({ response: 'Olá! Como posso ajudar?' })
      }
    })

    cy.sendChatMessage('Test message')
    cy.contains('Tentar novamente').click()

    cy.waitForChatResponse()
    cy.verifyResponseContains('Olá')
  })

  it('should handle rate limiting responses', () => {
    cy.intercept('POST', '**/chat', {
      statusCode: 429,
      headers: { 'retry-after': '60' }
    })

    cy.sendChatMessage('Test message')

    cy.contains('Limite de mensagens excedido').should('be.visible')
    cy.contains('Tente novamente em 60 segundos').should('be.visible')
  })

  it('should handle malformed responses gracefully', () => {
    cy.intercept('POST', '**/chat', {
      statusCode: 200,
      body: { invalid: 'response format' } // Missing required fields
    })

    cy.sendChatMessage('Test message')

    // Should show generic error rather than crash
    cy.contains(/Erro|erro/i).should('be.visible')
  })

  it('should handle authentication failures', () => {
    cy.intercept('POST', '**/chat', { statusCode: 401 })

    cy.sendChatMessage('Test message')

    cy.contains('Erro de autenticação').should('be.visible')
    cy.contains('Faça login novamente').should('be.visible')
  })

  it('should maintain message history during errors', () => {
    // Send successful message first
    cy.sendChatMessage('Working message')
    cy.waitForChatResponse()

    // Then send message that fails
    cy.intercept('POST', '**/chat', { forceNetworkError: true })
    cy.sendChatMessage('Failing message')

    // Should still have the first message
    cy.verifyMessageHistory(2) // 1 user + 1 bot message
    cy.contains('Erro de conexão').should('be.visible')
  })

  it('should handle CORS errors', () => {
    cy.intercept('POST', '**/chat', (req) => {
      req.reply({
        statusCode: 0,
        body: 'CORS error',
        headers: {
          'access-control-allow-origin': 'http://blocked-origin.com'
        }
      })
    })

    cy.sendChatMessage('CORS test')

    cy.contains('Erro de segurança').should('be.visible')
  })

  it('should handle service unavailable scenarios', () => {
    cy.intercept('POST', '**/chat', { statusCode: 503 })

    cy.sendChatMessage('Service unavailable test')

    cy.contains('Serviço temporariamente indisponível').should('be.visible')
    cy.contains('Tente novamente em alguns minutos').should('be.visible')
  })

  it('should recover from temporary service issues', () => {
    // First request fails
    let requestCount = 0
    cy.intercept('POST', '**/chat', (req) => {
      requestCount++
      if (requestCount === 1) {
        req.reply({ statusCode: 503 })
      } else {
        req.reply({ response: 'Serviço recuperado!' })
      }
    })

    cy.sendChatMessage('First message')
    cy.contains('Serviço temporariamente indisponível').should('be.visible')

    // Retry should succeed
    cy.contains('Tentar novamente').click()
    cy.waitForChatResponse()
    cy.verifyResponseContains('recuperado')
  })

  it('should handle large payload rejections', () => {
    // Simulate payload too large error
    cy.intercept('POST', '**/chat', { statusCode: 413 })

    cy.sendChatMessage('Test message')

    cy.contains('Mensagem muito longa').should('be.visible')
  })

  it('should maintain UI state during error recovery', () => {
    cy.intercept('POST', '**/chat', { forceNetworkError: true })

    cy.sendChatMessage('Error test')

    // UI elements should remain accessible
    cy.get('[data-cy="chat-input"]').should('be.enabled')
    cy.get('[data-cy="send-button"]').should('be.visible')

    // Error message should be visible
    cy.contains('Erro de conexão').should('be.visible')

    // Should be able to try again
    cy.contains('Tentar novamente').should('be.visible').click()

    // Should attempt retry (will fail again but shows the flow works)
    cy.contains('Erro de conexão').should('be.visible')
  })
})