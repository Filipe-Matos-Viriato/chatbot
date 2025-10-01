import { expect } from 'chai';
import {
  selectQuestionTemplate,
  validateLLMQuestions,
  generateHybridQuestions,
  getEngagementLevel
} from '../src/utils/question-strategies.js';

describe('Question Strategies', () => {
  describe('getEngagementLevel', () => {
    it('should return HIGH_ENGAGEMENT for score >= 70', () => {
      expect(getEngagementLevel(70)).to.equal('HIGH_ENGAGEMENT');
      expect(getEngagementLevel(85)).to.equal('HIGH_ENGAGEMENT');
      expect(getEngagementLevel(100)).to.equal('HIGH_ENGAGEMENT');
    });

    it('should return MEDIUM_ENGAGEMENT for score 40-69', () => {
      expect(getEngagementLevel(40)).to.equal('MEDIUM_ENGAGEMENT');
      expect(getEngagementLevel(55)).to.equal('MEDIUM_ENGAGEMENT');
      expect(getEngagementLevel(69)).to.equal('MEDIUM_ENGAGEMENT');
    });

    it('should return LOW_ENGAGEMENT for score < 40', () => {
      expect(getEngagementLevel(0)).to.equal('LOW_ENGAGEMENT');
      expect(getEngagementLevel(20)).to.equal('LOW_ENGAGEMENT');
      expect(getEngagementLevel(39)).to.equal('LOW_ENGAGEMENT');
    });
  });

  describe('selectQuestionTemplate', () => {
    it('should select listing-specific questions for high engagement', () => {
      const context = {
        leadScore: 80,
        hasListingContext: true,
        preferences: {}
      };
      const questions = selectQuestionTemplate(context);

      expect(questions).to.have.length(3);
      expect(questions[0]).to.include('marcar uma visita');
    });

    it('should select general questions for low engagement', () => {
      const context = {
        leadScore: 20,
        hasListingContext: false,
        preferences: {}
      };
      const questions = selectQuestionTemplate(context);

      expect(questions).to.have.length(3);
      expect(questions[0]).to.include('começar a procurar');
    });

    it('should return questions for medium engagement general inquiry', () => {
      const context = {
        leadScore: 50,
        hasListingContext: false,
        preferences: {
          tipologia: 'T2',
          budget: 250000
        }
      };
      const questions = selectQuestionTemplate(context);

      expect(questions).to.have.length(3);
      expect(questions[0]).to.include('comparar preços');
    });
  });

  describe('validateLLMQuestions', () => {
    it('should validate good LLM questions', () => {
      const questions = [
        "Estou interessado em marcar uma visita",
        "Quero saber sobre financiamento",
        "Posso falar com um consultor?"
      ];
      const result = validateLLMQuestions(questions, {});

      expect(result.isValid).to.equal(true);
      expect(result.questions).to.have.length(3);
    });

    it('should reject generic questions', () => {
      const questions = [
        "Como posso ajudá-lo?",
        "Se desejar mais informações...",
        "Tem mais alguma dúvida?"
      ];
      const result = validateLLMQuestions(questions, {});

      expect(result.isValid).to.equal(false);
    });

    it('should reject questions not in first person', () => {
      const questions = [
        "Quer saber mais sobre o imóvel?",        // Third person
        "Como posso ajudá-lo?",                   // Chatbot-like
        "Tem mais alguma dúvida?"                 // Third person generic
      ];
      const result = validateLLMQuestions(questions, {});

      expect(result.isValid).to.equal(false);
    });
  });

  describe('generateHybridQuestions', () => {
    it('should use LLM questions when valid', () => {
      const llmQuestions = [
        "Estou interessado em marcar uma visita",
        "Quero saber sobre financiamento",
        "Posso falar com um consultor?"
      ];
      const context = { leadScore: 50, hasListingContext: true };

      const result = generateHybridQuestions(llmQuestions, context);

      expect(result).to.deep.equal(llmQuestions);
    });

    it('should fallback to templates when LLM fails', () => {
      const llmQuestions = [];
      const context = { leadScore: 50, hasListingContext: true };

      const result = generateHybridQuestions(llmQuestions, context);

      expect(result).to.have.length(3);
      expect(result[0]).to.be.ok;
    });

    it('should blend LLM and template questions when partial', () => {
      const llmQuestions = [
        "Estou interessado em marcar uma visita",
        "Quero saber sobre financiamento"
      ];
      const context = { leadScore: 50, hasListingContext: true };

      const result = generateHybridQuestions(llmQuestions, context);

      expect(result).to.have.length(3);
      expect(result.slice(0, 2)).to.deep.equal(llmQuestions);
    });
  });
});