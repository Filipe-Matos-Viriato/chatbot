// Custom commands for high-performance chatbot testing
Cypress.Commands.add('startChatSession', () => {
  cy.visit('/chat-testing', { timeout: 15000 })
  cy.get('[data-cy="chat-interface"]', { timeout: 10000 }).should('be.visible')
  cy.get('[data-cy="chat-input"]').should('be.visible').and('be.enabled')
})

Cypress.Commands.add('sendChatMessage', (message) => {
  cy.get('[data-cy="chat-input"]', { timeout: 5000 })
    .should('be.visible')
    .clear()
    .type(message, { delay: 0 }) // Remove typing delay for performance

  cy.get('[data-cy="send-button"]', { timeout: 2000 })
    .should('be.visible')
    .and('not.be.disabled')
    .click()

  // Wait for the response instead of typing indicator
  cy.get('[data-cy="chat-messages"]', { timeout: 10000 })
    .find('[data-cy="bot-message"]')
    .should('be.visible')
})

Cypress.Commands.add('waitForChatResponse', (timeout = 10000) => {
  cy.get('[data-cy="chat-messages"]', { timeout })
    .find('[data-cy="bot-message"]')
    .last({ timeout })
    .should('be.visible')
    .and('not.be.empty')
})

Cypress.Commands.add('verifyResponseContains', (text, timeout = 10000) => {
  cy.get('[data-cy="chat-messages"]', { timeout })
    .find('[data-cy="bot-message"]')
    .last({ timeout })
    .should('contain.text', text)
})

Cypress.Commands.add('completeOnboarding', (userData) => {
  // Start onboarding by sending first message
  cy.sendChatMessage('Olá')
  cy.contains('Antes de continuar', { timeout: 5000 }).should('be.visible')

  // Step 1: Typology
  cy.get('[data-cy="typology-select"]', { timeout: 3000 })
    .should('be.visible')
    .select(userData.typology, { force: true })
  cy.get('[data-cy="onboarding-next"]', { timeout: 2000 }).click()

  // Step 2: Budget
  cy.get('[data-cy="budget_bucket-select"]', { timeout: 3000 })
    .should('be.visible')
    .select(userData.budget, { force: true })
  cy.get('[data-cy="onboarding-next"]', { timeout: 2000 }).click()

  // Step 3: Timeframe
  cy.get('[data-cy="buying_timeframe-select"]', { timeout: 3000 })
    .should('be.visible')
    .select(userData.timeframe, { force: true })
  cy.get('[data-cy="onboarding-next"]', { timeout: 2000 }).click()

  // Step 4: Contact
  cy.get('[data-cy="name-input"]', { timeout: 3000 })
    .should('be.visible')
    .clear()
    .type(userData.name, { delay: 0 })
  cy.get('[data-cy="email-input"]', { timeout: 3000 })
    .should('be.visible')
    .clear()
    .type(userData.email, { delay: 0 })

  if (userData.consent) {
    cy.get('[data-cy="consent-checkbox"]', { timeout: 2000 }).check({ force: true })
  }

  cy.get('[data-cy="onboarding-complete"]', { timeout: 2000 }).click()

  // Verify completion
  cy.contains('Thank you for your preferences', { timeout: 5000 }).should('be.visible')
})

Cypress.Commands.add('verifySuggestedQuestions', (count = 3) => {
  cy.get('[data-cy="suggested-questions"]', { timeout: 5000 })
    .should('be.visible')
    .find('[data-cy="question-button"]')
    .should('have.length', count)
    .each(($btn) => {
      cy.wrap($btn).should('be.visible').and('not.be.disabled')
    })
})

Cypress.Commands.add('clickSuggestedQuestion', (index = 0) => {
  cy.get('[data-cy="suggested-questions"]', { timeout: 3000 })
    .find('[data-cy="question-button"]')
    .eq(index)
    .should('be.visible')
    .click()
})

Cypress.Commands.add('measurePerformance', (action, callback) => {
  const startTime = performance.now()

  callback()

  cy.wrap(null).then(() => {
    const duration = performance.now() - startTime
    cy.task('logPerformance', { action, duration, timestamp: Date.now() })

    // Assert performance threshold
    expect(duration).to.be.lessThan(Cypress.env('PERFORMANCE_THRESHOLD'))
  })
})

Cypress.Commands.add('assertResponseTime', (maxTime = 3000) => {
  cy.window().then((win) => {
    const startTime = win.performance.now()
    cy.waitForChatResponse().then(() => {
      const endTime = win.performance.now()
      const duration = endTime - startTime
      expect(duration).to.be.lessThan(maxTime)
    })
  })
})

Cypress.Commands.add('verifyMessageHistory', (expectedCount) => {
  cy.get('[data-cy="chat-messages"] [data-cy="user-message"], [data-cy="chat-messages"] [data-cy="bot-message"]', { timeout: 3000 })
    .should('have.length', expectedCount)
})

Cypress.Commands.add('clearChatHistory', () => {
  cy.window().then((win) => {
    // Clear local storage and session storage
    win.localStorage.removeItem('chat_history')
    win.sessionStorage.removeItem('chat_messages')
  })
})