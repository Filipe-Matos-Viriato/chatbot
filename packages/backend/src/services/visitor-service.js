// packages/backend/src/services/visitor-service.js
const clientConfigService = require('./client-config-service');

class VisitorService {
  constructor() {
    this.visitors = new Map(); // In-memory store for demonstration. Replace with actual database.
  }

  createVisitor(clientId) {
    const visitorId = `visitor_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const newVisitor = {
      visitor_id: visitorId,
      client_id: clientId,
      lead_score: 0,
      created_at: new Date(),
      updated_at: new Date(),
      events: []
    };
    this.visitors.set(visitorId, newVisitor);
    console.log(`Visitor created: ${visitorId} for client ${clientId}`);
    return newVisitor;
  }

  async getClientScoringRules(clientId) {
    try {
      const clientConfig = await clientConfigService.getClientConfig(clientId);
      if (!clientConfig || !clientConfig.leadScoringRules) {
        console.warn(`No scoring rules found for client ${clientId}`);
        return null;
      }
      return clientConfig.leadScoringRules;
    } catch (error) {
      console.error(`Error loading scoring rules for client ${clientId}:`, error);
      return null;
    }
  }

  async calculateScoreImpact(eventType, visitor, clientId) {
    const scoringRules = await this.getClientScoringRules(clientId);
    if (!scoringRules) {
      return 0;
    }

    // Calculate score impact based on event type
    let scoreImpact = 0;

    // Engagement Behavior
    if (eventType.startsWith('QUESTIONS_')) {
      const questionsCount = parseInt(eventType.split('_')[1]);
      if (questionsCount >= 3 && questionsCount <= 5) {
        scoreImpact = scoringRules.engagementBehavior.questions_3_5;
      } else if (questionsCount >= 6 && questionsCount <= 10) {
        scoreImpact = scoringRules.engagementBehavior.questions_6_10;
      } else if (questionsCount > 10) {
        scoreImpact = scoringRules.engagementBehavior.questions_10_plus;
      }
    } else if (eventType === 'TIME_5_10_MIN') {
      scoreImpact = scoringRules.engagementBehavior.time_5_10_min;
    } else if (eventType === 'TIME_10_PLUS_MIN') {
      scoreImpact = scoringRules.engagementBehavior.time_10_plus_min;
    } else if (eventType === 'CLICKED_LISTING') {
      scoreImpact = scoringRules.engagementBehavior.clicked_listing;
    } else if (eventType === 'RETURNED_WITHIN_48H') {
      scoreImpact = scoringRules.engagementBehavior.returned_within_48h;
    }

    // Question Intent & Quality
    else if (eventType === 'ASKED_PRICING') {
      scoreImpact = scoringRules.questionIntentQuality.asked_pricing;
    } else if (eventType === 'ASKED_LOCATION') {
      scoreImpact = scoringRules.questionIntentQuality.asked_location;
    } else if (eventType === 'ASKED_LEGAL') {
      scoreImpact = scoringRules.questionIntentQuality.asked_legal;
    } else if (eventType === 'ASKED_REMOTE_BUYING') {
      scoreImpact = scoringRules.questionIntentQuality.asked_remote_buying;
    } else if (eventType === 'ASKED_DETAILS') {
      scoreImpact = scoringRules.questionIntentQuality.asked_details;
    } else if (eventType === 'ASKED_AVAILABILITY') {
      scoreImpact = scoringRules.questionIntentQuality.asked_availability;
    }

    // Conversion Actions
    else if (eventType === 'SUBMITTED_CONTACT') {
      scoreImpact = scoringRules.conversionActions.submitted_contact;
    } else if (eventType === 'BOOKED_VIEWING') {
      scoreImpact = scoringRules.conversionActions.booked_viewing;
    } else if (eventType === 'ASKED_CONTACT_AGENT') {
      scoreImpact = scoringRules.conversionActions.asked_contact_agent;
    } else if (eventType === 'REQUESTED_BROCHURE') {
      scoreImpact = scoringRules.conversionActions.requested_brochure;
    }

    return scoreImpact;
  }

  async logEvent(visitorId, eventType, clientId) {
    const visitor = this.visitors.get(visitorId);
    if (!visitor) {
      console.warn(`Visitor with ID ${visitorId} not found.`);
      return null;
    }

    const scoreImpact = await this.calculateScoreImpact(eventType, visitor, clientId);

    const event = {
      type: eventType,
      timestamp: new Date(),
      score_impact: scoreImpact
    };
    visitor.events.push(event);
    visitor.lead_score += scoreImpact;
    visitor.updated_at = new Date();
    console.log(`Event logged for ${visitorId}: ${eventType}, score impact: ${scoreImpact}, new score: ${visitor.lead_score}`);
    return visitor;
  }

  getVisitor(visitorId) {
    return this.visitors.get(visitorId);
  }
}

module.exports = new VisitorService();