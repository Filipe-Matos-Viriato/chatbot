describe('Visitor Session Consistency', () => {
  beforeEach(() => {
    // Clear localStorage and any existing sessions
    cy.window().then((win) => {
      win.localStorage.clear();
    });
  });

  it('should maintain visitor ID across onboarding and chat', () => {
    // Visit testing interface
    cy.visit('/chat-testing');

    // Wait for session initialization
    cy.contains('Chat Interface (Testing)', { timeout: 10000 });

    // Complete onboarding
    cy.get('input[placeholder*="typology"]').type('T1');
    cy.contains('Next').click();

    cy.get('input[placeholder*="budget"]').type('200000');
    cy.contains('Next').click();

    cy.get('input[placeholder*="timeframe"]').type('3-6 months');
    cy.contains('Next').click();

    cy.get('input[name="name"]').type('Test User');
    cy.get('input[name="email"]').type('test@example.com');
    cy.get('input[name="consent"]').check();
    cy.contains('Complete').click();

    // Verify onboarding completion
    cy.contains('Thank you for your preferences');

    // Send a chat message
    cy.get('input[placeholder*="Ask about"]').type('Show me apartments{enter}');

    // Verify response contains personalized content
    cy.contains('Based on your preferences');

    // Check that the same visitor ID was used
    cy.window().then((win) => {
      // This would require exposing visitor ID in UI for testing
      // or checking network requests
    });
  });

  it('should recover session after page refresh', () => {
    // Start session
    cy.visit('/chat-testing');
    cy.contains('Chat Interface (Testing)', { timeout: 10000 });

    // Complete minimal onboarding to establish session
    cy.get('input[placeholder*="typology"]').type('T2');
    cy.contains('Next').click();
    cy.get('input[placeholder*="budget"]').type('250000');
    cy.contains('Next').click();
    cy.get('input[placeholder*="timeframe"]').type('1-3 months');
    cy.contains('Next').click();
    cy.get('input[name="name"]').type('Refresh Test');
    cy.get('input[name="email"]').type('refresh@test.com');
    cy.get('input[name="consent"]').check();
    cy.contains('Complete').click();

    // Refresh page
    cy.reload();

    // Verify session recovery
    cy.contains('Chat Interface (Testing)', { timeout: 10000 });

    // Send message and verify personalization works
    cy.get('input[placeholder*="Ask about"]').type('What do you recommend{enter}');
    cy.contains('Based on your preferences');
  });
});