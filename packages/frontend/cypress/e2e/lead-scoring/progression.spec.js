/**
 * FR-2: User Journey Testing - Lead Scoring Progression
 * High-performance E2E tests for lead scoring mechanics and progression
 */

import { createTestUser, createTestLeadScore } from '../../support/data-factories'

describe('Lead Scoring Progression', { tags: ['journey', 'lead-scoring', 'progression'] }, () => {
  beforeEach(() => {
    cy.clearChatHistory()
    cy.startChatSession()
  })

  it('should track lead score progression through engagement', () => {
    const userData = createTestUser()

    // Complete onboarding (establishes baseline)
    cy.completeOnboarding(userData)

    // Initial lead score should be established
    cy.window().then((win) => {
      // This would depend on how lead score is exposed
      // Could be via API call or UI element
      cy.task('getLeadScore', win.localStorage.getItem('visitor_session_test-client'))
        .then((initialScore) => {
          expect(initialScore).to.be.at.least(0)
          expect(initialScore).to.be.at.most(100)
        })
    })

    // Send multiple messages to increase engagement
    const engagementMessages = [
      'Quanto custa um T2?',
      'Quais são as opções de financiamento?',
      'Pode marcar uma visita?',
      'Qual é a localização exacta?',
      'Há estacionamento incluído?'
    ]

    engagementMessages.forEach((message, index) => {
      cy.sendChatMessage(message)
      cy.waitForChatResponse()

      // Lead score should increase with engagement
      if (index > 2) { // After several interactions
        cy.window().then((win) => {
          cy.task('getLeadScore', win.localStorage.getItem('visitor_session_test-client'))
            .then((currentScore) => {
              expect(currentScore).to.be.greaterThan(20) // Should show engagement
            })
        })
      }
    })
  })

  it('should categorize leads correctly based on score thresholds', () => {
    const testScenarios = [
      { engagement: 'low', expectedCategory: 'Cold Lead', minScore: 0, maxScore: 39 },
      { engagement: 'medium', expectedCategory: 'Warm Lead', minScore: 40, maxScore: 69 },
      { engagement: 'high', expectedCategory: 'Hot Lead', minScore: 70, maxScore: 100 }
    ]

    testScenarios.forEach((scenario) => {
      cy.clearChatHistory()
      cy.startChatSession()

      const userData = createTestUser()
      cy.completeOnboarding(userData)

      // Generate appropriate engagement level
      const messageCount = scenario.engagement === 'low' ? 1 :
                          scenario.engagement === 'medium' ? 3 : 8

      for (let i = 0; i < messageCount; i++) {
        cy.sendChatMessage(`Engagement message ${i + 1}`)
        cy.waitForChatResponse()
      }

      // Verify lead categorization
      cy.window().then((win) => {
        cy.task('getLeadScore', win.localStorage.getItem('visitor_session_test-client'))
          .then((score) => {
            expect(score).to.be.at.least(scenario.minScore)
            expect(score).to.be.at.most(scenario.maxScore)

            // Verify categorization logic
            cy.task('getLeadCategory', score).then((category) => {
              expect(category).to.equal(scenario.expectedCategory)
            })
          })
      })
    })
  })

  it('should reward high-intent behaviors with score increases', () => {
    const userData = createTestUser()
    cy.completeOnboarding(userData)

    // Baseline score
    cy.window().then((win) => {
      cy.task('getLeadScore', win.localStorage.getItem('visitor_session_test-client'))
        .then((baselineScore) => {

          // High-intent message about pricing
          cy.sendChatMessage('Qual é o melhor preço que conseguem oferecer?')
          cy.waitForChatResponse()

          // Score should increase significantly
          cy.task('getLeadScore', win.localStorage.getItem('visitor_session_test-client'))
            .then((newScore) => {
              expect(newScore).to.be.greaterThan(baselineScore + 5)
            })
        })
    })
  })

  it('should track conversion actions with maximum score impact', () => {
    const userData = createTestUser()
    cy.completeOnboarding(userData)

    // Send messages to build some engagement
    for (let i = 0; i < 3; i++) {
      cy.sendChatMessage(`Building engagement ${i + 1}`)
      cy.waitForChatResponse()
    }

    cy.window().then((win) => {
      cy.task('getLeadScore', win.localStorage.getItem('visitor_session_test-client'))
        .then((preConversionScore) => {

          // Conversion action: request contact
          cy.sendChatMessage('Por favor, um agente contacte-me')
          cy.waitForChatResponse()

          // Score should increase dramatically
          cy.task('getLeadScore', win.localStorage.getItem('visitor_session_test-client'))
            .then((postConversionScore) => {
              expect(postConversionScore).to.be.greaterThan(preConversionScore + 15)
              expect(postConversionScore).to.be.at.most(100)
            })
        })
    })
  })

  it('should maintain lead score across sessions', () => {
    const userData = createTestUser()
    cy.completeOnboarding(userData)

    // Build engagement
    for (let i = 0; i < 5; i++) {
      cy.sendChatMessage(`Session 1 message ${i + 1}`)
      cy.waitForChatResponse()
    }

    // Capture score before refresh
    cy.window().then((win) => {
      cy.task('getLeadScore', win.localStorage.getItem('visitor_session_test-client'))
        .then((scoreBeforeRefresh) => {

          // Refresh page
          cy.reload()
          cy.startChatSession()

          // Continue engagement
          cy.sendChatMessage('Post-refresh message')
          cy.waitForChatResponse()

          // Score should be maintained
          cy.task('getLeadScore', win.localStorage.getItem('visitor_session_test-client'))
            .then((scoreAfterRefresh) => {
              expect(scoreAfterRefresh).to.be.at.least(scoreBeforeRefresh - 5) // Allow small variance
            })
        })
    })
  })

  it('should handle lead score calculation edge cases', () => {
    // Test with minimal engagement
    cy.sendChatMessage('Single message only')
    cy.waitForChatResponse()

    cy.window().then((win) => {
      cy.task('getLeadScore', win.localStorage.getItem('visitor_session_test-client'))
        .then((score) => {
          expect(score).to.be.at.least(0)
          expect(score).to.be.at.most(100)
          // Single message should result in low but valid score
          expect(score).to.be.lessThan(30)
        })
    })

    // Test with maximum engagement scenario
    cy.clearChatHistory()
    cy.startChatSession()

    const userData = createTestUser()
    cy.completeOnboarding(userData)

    // Simulate maximum engagement: many messages + conversion
    for (let i = 0; i < 10; i++) {
      cy.sendChatMessage(`High engagement message ${i + 1}`)
      cy.waitForChatResponse()
    }

    // Add conversion action
    cy.sendChatMessage('Quero marcar uma visita urgente')
    cy.waitForChatResponse()

    cy.window().then((win) => {
      cy.task('getLeadScore', win.localStorage.getItem('visitor_session_test-client'))
        .then((maxScore) => {
          expect(maxScore).to.be.at.most(100)
          expect(maxScore).to.be.greaterThan(80) // Should be very high
        })
    })
  })

  it('should update lead score in real-time during conversation', () => {
    const userData = createTestUser()
    cy.completeOnboarding(userData)

    let previousScore = 0

    // Send messages and check score progression
    const messages = [
      'Olá', // Basic greeting
      'Quanto custa?', // Price inquiry - should increase score
      'Quais são as opções de pagamento?', // Financing inquiry - big increase
      'Pode enviar-me informações por email?', // Contact request - major increase
    ]

    messages.forEach((message, index) => {
      cy.sendChatMessage(message)
      cy.waitForChatResponse()

      // Allow time for score calculation
      cy.wait(500)

      cy.window().then((win) => {
        cy.task('getLeadScore', win.localStorage.getItem('visitor_session_test-client'))
          .then((currentScore) => {
            if (index > 0) {
              // Score should generally increase with engagement
              expect(currentScore).to.be.at.least(previousScore)
            }
            previousScore = currentScore
            expect(currentScore).to.be.at.most(100)
          })
      })
    })
  })

  it('should handle lead scoring system failures gracefully', () => {
    const userData = createTestUser()
    cy.completeOnboarding(userData)

    // Simulate lead scoring service failure
    cy.intercept('POST', '**/events', { statusCode: 500 })

    // Send message that would normally increase score
    cy.sendChatMessage('Quero saber sobre financiamento')
    cy.waitForChatResponse()

    // Chat should still work despite scoring failure
    cy.verifyResponseContains('financiamento')

    // System should continue functioning
    cy.sendChatMessage('Obrigado')
    cy.waitForChatResponse()
  })

  it('should validate lead score data integrity', () => {
    const userData = createTestUser()
    cy.completeOnboarding(userData)

    // Send various messages to generate scoring events
    const testMessages = [
      'Olá',
      'Preços por favor',
      'Localização?',
      'Contacto urgente'
    ]

    testMessages.forEach(message => {
      cy.sendChatMessage(message)
      cy.waitForChatResponse()
    })

    // Verify score is within valid range and reasonable
    cy.window().then((win) => {
      cy.task('getLeadScore', win.localStorage.getItem('visitor_session_test-client'))
        .then((finalScore) => {
          expect(finalScore).to.be.at.least(0)
          expect(finalScore).to.be.at.most(100)
          expect(finalScore).to.be.greaterThan(10) // Should show some engagement

          // Verify score is a valid number
          expect(typeof finalScore).to.equal('number')
          expect(isNaN(finalScore)).to.be.false
        })
    })
  })
})