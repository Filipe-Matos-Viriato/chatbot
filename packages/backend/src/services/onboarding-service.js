const supabase = require('../config/supabase');

/**
 * OnboardingService handles all onboarding-related operations
 * including getting client default questions, managing visitor onboarding status,
 * and processing onboarding answers.
 */
class OnboardingService {

  /**
   * Get onboarding status and questions for a visitor
   * @param {string} visitorId - The visitor ID
   * @param {string} clientId - The client ID
   * @returns {Promise<object>} Onboarding status and questions
   */
  async getVisitorOnboardingStatus(visitorId, clientId) {
    try {
      // Get visitor's onboarding status
      const { data: visitor, error: visitorError } = await supabase
        .from('visitors')
        .select('onboarding_completed, onboarding_questions')
        .eq('visitor_id', visitorId)
        .single();

      if (visitorError) {
        console.error('Error fetching visitor onboarding status:', visitorError);
        throw new Error('Failed to get visitor onboarding status');
      }

      // If onboarding is already completed, return status without questions
      if (visitor.onboarding_completed) {
        return {
          completed: true,
          answers: visitor.onboarding_questions,
          questions: null
        };
      }

      // Get client's default onboarding questions
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('default_onboarding_questions')
        .eq('client_id', clientId)
        .single();

      if (clientError) {
        console.error('Error fetching client onboarding questions:', clientError);
        throw new Error('Failed to get client onboarding questions');
      }

      return {
        completed: false,
        answers: visitor.onboarding_questions || null,
        questions: client.default_onboarding_questions
      };

    } catch (error) {
      console.error('Error in getVisitorOnboardingStatus:', error);
      throw error;
    }
  }

  /**
   * Submit onboarding answers for a visitor
   * @param {string} visitorId - The visitor ID
   * @param {object} answers - The onboarding answers
   * @param {boolean} completed - Whether onboarding is completed
   * @returns {Promise<object>} Updated visitor data
   */
  async submitOnboardingAnswers(visitorId, answers, completed = true) {
    try {
      const updateData = {
        onboarding_questions: answers,
        onboarding_completed: completed,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('visitors')
        .update(updateData)
        .eq('visitor_id', visitorId)
        .select();

      if (error) {
        console.error('Error updating visitor onboarding:', error);
        throw new Error('Failed to submit onboarding answers');
      }

      if (!data || data.length === 0) {
        throw new Error('Visitor not found');
      }

      console.log(`Onboarding answers submitted for visitor: ${visitorId}`);
      return data[0];

    } catch (error) {
      console.error('Error in submitOnboardingAnswers:', error);
      throw error;
    }
  }

  /**
   * Update existing onboarding answers for a visitor
   * @param {string} visitorId - The visitor ID
   * @param {object} answers - The updated onboarding answers
   * @returns {Promise<object>} Updated visitor data
   */
  async updateOnboardingAnswers(visitorId, answers) {
    try {
      const { data, error } = await supabase
        .from('visitors')
        .update({
          onboarding_questions: answers,
          updated_at: new Date().toISOString()
        })
        .eq('visitor_id', visitorId)
        .select();

      if (error) {
        console.error('Error updating visitor onboarding answers:', error);
        throw new Error('Failed to update onboarding answers');
      }

      if (!data || data.length === 0) {
        throw new Error('Visitor not found');
      }

      console.log(`Onboarding answers updated for visitor: ${visitorId}`);
      return data[0];

    } catch (error) {
      console.error('Error in updateOnboardingAnswers:', error);
      throw error;
    }
  }

  /**
   * Get client's default onboarding questions template
   * @param {string} clientId - The client ID
   * @returns {Promise<object>} Client's onboarding questions template
   */
  async getClientOnboardingTemplate(clientId) {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('default_onboarding_questions')
        .eq('client_id', clientId)
        .single();

      if (error) {
        console.error('Error fetching client onboarding template:', error);
        throw new Error('Failed to get client onboarding template');
      }

      return data.default_onboarding_questions;

    } catch (error) {
      console.error('Error in getClientOnboardingTemplate:', error);
      throw error;
    }
  }

  /**
   * Update client's default onboarding questions template
   * @param {string} clientId - The client ID
   * @param {object} template - The onboarding questions template
   * @returns {Promise<object>} Updated client data
   */
  async updateClientOnboardingTemplate(clientId, template) {
    try {
      // Validate template structure
      this.validateOnboardingTemplate(template);

      const { data, error } = await supabase
        .from('clients')
        .update({
          default_onboarding_questions: template,
          updated_at: new Date().toISOString()
        })
        .eq('client_id', clientId)
        .select();

      if (error) {
        console.error('Error updating client onboarding template:', error);
        throw new Error('Failed to update client onboarding template');
      }

      if (!data || data.length === 0) {
        throw new Error('Client not found');
      }

      console.log(`Onboarding template updated for client: ${clientId}`);
      return data[0];

    } catch (error) {
      console.error('Error in updateClientOnboardingTemplate:', error);
      throw error;
    }
  }

  /**
   * Format onboarding answers for use in RAG system
   * @param {object} answers - The raw onboarding answers
   * @param {object} questions - The questions template for context
   * @returns {string} Formatted answers for RAG context
   */
  formatOnboardingAnswersForRAG(answers, questions) {
    if (!answers || !questions) {
      return "Nenhuma informação de preferências disponível";
    }

    try {
      const formattedAnswers = [];
      
      questions.questions.forEach(question => {
        const answer = answers[question.id];
        if (answer) {
          let formattedAnswer = `${question.question}: `;
          
          if (question.type === 'multiple_select' && Array.isArray(answer)) {
            const labels = answer.map(value => {
              const option = question.options.find(opt => opt.value === value);
              return option ? option.label : value;
            });
            formattedAnswer += labels.join(', ');
          } else if (question.type === 'multiple_choice' || question.type === 'range_select') {
            const option = question.options.find(opt => opt.value === answer);
            formattedAnswer += option ? option.label : answer;
          } else {
            formattedAnswer += answer;
          }
          
          formattedAnswers.push(formattedAnswer);
        }
      });

      return formattedAnswers.length > 0 
        ? `Preferências do Visitante:\n${formattedAnswers.join('\n')}`
        : "Preferências não especificadas";

    } catch (error) {
      console.error('Error formatting onboarding answers for RAG:', error);
      return "Erro ao processar preferências do visitante";
    }
  }

  /**
   * Check if visitor needs onboarding
   * @param {string} visitorId - The visitor ID
   * @returns {Promise<boolean>} Whether visitor needs onboarding
   */
  async visitorNeedsOnboarding(visitorId) {
    try {
      const { data, error } = await supabase
        .from('visitors')
        .select('onboarding_completed')
        .eq('visitor_id', visitorId)
        .single();

      if (error) {
        console.error('Error checking visitor onboarding status:', error);
        return true; // Default to showing onboarding if unsure
      }

      return !data.onboarding_completed;

    } catch (error) {
      console.error('Error in visitorNeedsOnboarding:', error);
      return true; // Default to showing onboarding if error
    }
  }

  /**
   * Validate onboarding template structure
   * @param {object} template - The template to validate
   * @throws {Error} If template is invalid
   */
  validateOnboardingTemplate(template) {
    if (!template || typeof template !== 'object') {
      throw new Error('Template must be an object');
    }

    if (!Array.isArray(template.questions)) {
      throw new Error('Template must have a questions array');
    }

    template.questions.forEach((question, index) => {
      if (!question.id || !question.question || !question.type) {
        throw new Error(`Question ${index + 1} is missing required fields (id, question, type)`);
      }

      const validTypes = ['multiple_choice', 'multiple_select', 'text_input', 'range_select'];
      if (!validTypes.includes(question.type)) {
        throw new Error(`Question ${index + 1} has invalid type: ${question.type}`);
      }

      if (question.type !== 'text_input' && !Array.isArray(question.options)) {
        throw new Error(`Question ${index + 1} with type ${question.type} must have options array`);
      }
    });

    if (!template.settings || typeof template.settings !== 'object') {
      throw new Error('Template must have settings object');
    }
  }
}

module.exports = new OnboardingService();