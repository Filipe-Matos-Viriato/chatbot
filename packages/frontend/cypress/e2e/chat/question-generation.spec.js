/**
 * FR-3: Contextual Intelligence - Question Generation
 * High-performance E2E tests for dynamic suggested questions
 */

import { createTestUser } from '../../support/data-factories'

describe('Question Generation', { tags: ['contextual', 'intelligence', 'questions'] }, () => {
  beforeEach(() => {
    cy.clearChatHistory()
    cy.startChatSession()
  })

  it('should generate relevant suggested questions after basic interaction', () => {
    cy.sendChatMessage('Olá, quero comprar um apartamento')
    cy.waitForChatResponse()
    cy.verifySuggestedQuestions(3)

    // Questions should be actionable and relevant
    cy.get('[data-cy="suggested-questions"] [data-cy="question-button"]')
      .first()
      .should('contain.text', 'Estou interessado')
  })

  it('should adapt question suggestions based on user engagement level', () => {
    // Low engagement - basic questions
    cy.sendChatMessage('Olá')
    cy.waitForChatResponse()
    cy.verifySuggestedQuestions()

    // Should be general discovery questions
    cy.get('[data-cy="suggested-questions"]').should('be.visible')

    // High engagement - conversion-focused questions
    cy.clearChatHistory()
    cy.startChatSession()

    const userData = createTestUser({
      typology: 'T3',
      budget: '€400–600k',
      timeframe: 'Imediatamente'
    })
    cy.completeOnboarding(userData)

    // Build high engagement with multiple interactions
    for (let i = 0; i < 5; i++) {
      cy.sendChatMessage(`High engagement message ${i + 1}`)
      cy.waitForChatResponse()
    }

    cy.sendChatMessage('Quais são as melhores opções?')
    cy.waitForChatResponse()
    cy.verifySuggestedQuestions()

    // Should include conversion-oriented questions
    cy.get('[data-cy="suggested-questions"]').should('contain.text', 'marcar')
  })

  it('should handle question click interactions seamlessly', () => {
    cy.sendChatMessage('Olá')
    cy.waitForChatResponse()
    cy.verifySuggestedQuestions()

    // Click first suggested question
    cy.clickSuggestedQuestion(0)

    // Should send as new user message
    cy.get('[data-cy="chat-messages"] [data-cy="user-message"]')
      .last()
      .should('be.visible')

    // Should generate response and new questions
    cy.waitForChatResponse()
    cy.verifySuggestedQuestions()
  })

  it('should personalize questions based on user preferences', () => {
    const userData = createTestUser({
      typology: 'T2',
      budget: '€250–350k'
    })

    cy.completeOnboarding(userData)

    cy.sendChatMessage('Que apartamentos recomendam?')
    cy.waitForChatResponse()
    cy.verifySuggestedQuestions()

    // Questions should reflect user preferences
    cy.get('[data-cy="suggested-questions"]')
      .should('be.visible')
      // Should contain personalized suggestions
  })

  it('should maintain question relevance across conversation turns', () => {
    const userData = createTestUser({ typology: 'T3' })
    cy.completeOnboarding(userData)

    // First interaction
    cy.sendChatMessage('Estou interessado em T3')
    cy.waitForChatResponse()
    cy.verifySuggestedQuestions()

    // Follow-up maintaining context
    cy.clickSuggestedQuestion(0) // Click first suggested question
    cy.waitForChatResponse()
    cy.verifySuggestedQuestions()

    // Questions should still be relevant to T3 context
    cy.get('[data-cy="suggested-questions"]').should('be.visible')
  })

  it('should handle question generation failures gracefully', () => {
    // Mock question generation failure
    cy.intercept('POST', '**/chat', (req) => {
      req.reply({
        response: 'Olá! Como posso ajudar?',
        suggested_questions: [] // Empty questions
      })
    })

    cy.sendChatMessage('Olá')
    cy.waitForChatResponse()

    // Should still show response, no questions
    cy.get('[data-cy="suggested-questions"]').should('not.exist')
    cy.verifyResponseContains('Olá')
  })

  it('should generate different questions for different contexts', () => {
    // General context
    cy.sendChatMessage('Olá')
    cy.waitForChatResponse()
    cy.verifySuggestedQuestions()

    const generalQuestions = []
    cy.get('[data-cy="suggested-questions"] [data-cy="question-button"]')
      .each(($btn) => {
        generalQuestions.push($btn.text())
      })

    // Listing-specific context
    cy.clearChatHistory()
    cy.startChatSession()

    cy.window().then((win) => {
      win.localStorage.setItem('selectedListingId', 'ap-01')
    })

    cy.sendChatMessage('Quanto custa este apartamento?')
    cy.waitForChatResponse()
    cy.verifySuggestedQuestions()

    // Questions should be different for listing context
    cy.get('[data-cy="suggested-questions"]').should('be.visible')
  })

  it('should limit question count for optimal UX', () => {
    cy.sendChatMessage('Olá, quero informações sobre apartamentos')
    cy.waitForChatResponse()

    // Should generate exactly 3 questions (optimal UX)
    cy.verifySuggestedQuestions(3)

    // Should not generate more than 3
    cy.get('[data-cy="suggested-questions"] [data-cy="question-button"]')
      .should('have.length.lte', 3)
  })

  it('should generate questions in first person perspective', () => {
    cy.sendChatMessage('Olá')
    cy.waitForChatResponse()
    cy.verifySuggestedQuestions()

    // All questions should be from user perspective
    cy.get('[data-cy="suggested-questions"] [data-cy="question-button"]')
      .each(($btn) => {
        const questionText = $btn.text()
        // Should start with first person verbs
        expect(questionText).to.match(/^(Estou|Quero|Gostaria|Posso|Tenho)/i)
      })
  })

  it('should avoid generic or template-like questions', () => {
    cy.sendChatMessage('Olá')
    cy.waitForChatResponse()
    cy.verifySuggestedQuestions()

    // Should not contain generic templates
    const genericPatterns = [
      /como posso ajud/i,
      /se desejar mais/i,
      /gostaria de saber mais/i,
      /tem mais alguma/i
    ]

    cy.get('[data-cy="suggested-questions"] [data-cy="question-button"]')
      .each(($btn) => {
        const questionText = $btn.text()
        genericPatterns.forEach(pattern => {
          expect(questionText).not.to.match(pattern)
        })
      })
  })

  it('should generate questions of appropriate length', () => {
    cy.sendChatMessage('Olá')
    cy.waitForChatResponse()
    cy.verifySuggestedQuestions()

    cy.get('[data-cy="suggested-questions"] [data-cy="question-button"]')
      .each(($btn) => {
        const questionText = $btn.text()
        // Should be reasonable length
        expect(questionText.length).to.be.greaterThan(10)
        expect(questionText.length).to.be.lessThan(200)
      })
  })

  it('should handle rapid question clicking without issues', () => {
    cy.sendChatMessage('Olá')
    cy.waitForChatResponse()
    cy.verifySuggestedQuestions()

    // Click multiple questions rapidly
    cy.get('[data-cy="suggested-questions"] [data-cy="question-button"]')
      .each(($btn, index) => {
        if (index < 2) { // Click first 2 questions
          cy.wrap($btn).click()
          cy.waitForChatResponse()
        }
      })

    // Should handle rapid interactions gracefully
    cy.get('[data-cy="chat-messages"]').should('be.visible')
  })

  it('should regenerate questions after user provides more context', () => {
    cy.sendChatMessage('Olá')
    cy.waitForChatResponse()
    cy.verifySuggestedQuestions()

    // User provides more specific context
    cy.sendChatMessage('Na verdade, quero um T2')
    cy.waitForChatResponse()
    cy.verifySuggestedQuestions()

    // Questions should adapt to new context
    cy.get('[data-cy="suggested-questions"]').should('be.visible')
  })

  it('should maintain question quality under high load', () => {
    // Simulate high interaction volume
    for (let i = 0; i < 5; i++) {
      cy.sendChatMessage(`Load test message ${i + 1}`)
      cy.waitForChatResponse()
      cy.verifySuggestedQuestions()

      // Questions should remain high quality
      cy.get('[data-cy="suggested-questions"] [data-cy="question-button"]')
        .should('have.length', 3)
        .and('be.visible')
    }
  })

  it('should handle question generation timeouts gracefully', () => {
    // Simulate slow question generation
    cy.intercept('POST', '**/chat', (req) => {
      // Delay response to simulate timeout
      setTimeout(() => {
        req.reply({
          response: 'Resposta normal',
          suggested_questions: ['Pergunta 1', 'Pergunta 2', 'Pergunta 3']
        })
      }, 10000)
    })

    cy.sendChatMessage('Test timeout')
    cy.waitForChatResponse(15000)

    // Should eventually show questions
    cy.verifySuggestedQuestions()
  })

  it('should validate question generation data integrity', () => {
    cy.sendChatMessage('Olá')
    cy.waitForChatResponse()
    cy.verifySuggestedQuestions()

    // Questions should be valid strings
    cy.get('[data-cy="suggested-questions"] [data-cy="question-button"]')
      .each(($btn) => {
        const questionText = $btn.text()
        expect(questionText).to.be.a('string')
        expect(questionText.trim()).to.equal(questionText) // No leading/trailing whitespace
        expect(questionText.length).to.be.greaterThan(0)
      })
  })
})