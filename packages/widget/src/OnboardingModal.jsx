import { h, Component } from 'preact';

class OnboardingModal extends Component {
  constructor(props) {
    super(props);
    this.state = {
      currentQuestionIndex: 0,
      answers: {},
      isLoading: false,
      error: null
    };
  }

  componentDidMount() {
    // Add escape key listener
    document.addEventListener('keydown', this.handleEscapeKey);
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.handleEscapeKey);
  }

  handleEscapeKey = (e) => {
    if (e.key === 'Escape' && !this.state.isLoading) {
      this.handleSkip();
    }
  }

  handleAnswer = (questionId, answer) => {
    this.setState(prevState => ({
      answers: {
        ...prevState.answers,
        [questionId]: answer
      }
    }));
  }

  handleNext = () => {
    const { questions } = this.props;
    const { currentQuestionIndex } = this.state;
    
    if (currentQuestionIndex < questions.length - 1) {
      this.setState({ currentQuestionIndex: currentQuestionIndex + 1 });
    } else {
      this.handleSubmit();
    }
  }

  handleBack = () => {
    this.setState(prevState => ({
      currentQuestionIndex: Math.max(0, prevState.currentQuestionIndex - 1)
    }));
  }

  handleSubmit = async () => {
    const { onComplete, visitorId, apiUrl } = this.props;
    const { answers } = this.state;

    this.setState({ isLoading: true, error: null });

    try {
      const response = await fetch(`${apiUrl}/v1/visitors/${visitorId}/onboarding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          answers: answers,
          completed: true
        })
      });

      if (!response.ok) {
        throw new Error('Failed to submit onboarding answers');
      }

      onComplete(answers);
    } catch (error) {
      console.error('Error submitting onboarding:', error);
      this.setState({ 
        error: 'Erro ao submeter respostas. Tente novamente.',
        isLoading: false 
      });
    }
  }

  handleSkip = () => {
    const { onSkip } = this.props;
    if (onSkip) {
      onSkip();
    }
  }

  getCurrentQuestion = () => {
    const { questions } = this.props;
    const { currentQuestionIndex } = this.state;
    return questions[currentQuestionIndex];
  }

  isCurrentQuestionAnswered = () => {
    const currentQuestion = this.getCurrentQuestion();
    const { answers } = this.state;
    
    if (!currentQuestion.required) {
      return true; // Optional questions are always "answered"
    }
    
    const answer = answers[currentQuestion.id];
    if (currentQuestion.type === 'multiple_select') {
      return Array.isArray(answer) && answer.length > 0;
    }
    return answer && answer.toString().trim() !== '';
  }

  renderQuestion = (question) => {
    const { answers } = this.state;
    const answer = answers[question.id];

    switch (question.type) {
      case 'multiple_choice':
      case 'range_select':
        return h('div', { className: 'onboarding-options' }, 
          question.options.map(option => 
            h('label', {
              key: option.value,
              className: `onboarding-option ${answer === option.value ? 'selected' : ''}`,
              onClick: () => this.handleAnswer(question.id, option.value)
            }, [
              h('input', {
                type: 'radio',
                name: question.id,
                value: option.value,
                checked: answer === option.value,
                onChange: () => {} // Handled by label click
              }),
              h('span', { className: 'option-label' }, option.label)
            ])
          )
        );

      case 'multiple_select':
        return h('div', { className: 'onboarding-options' },
          question.options.map(option => {
            const selectedValues = Array.isArray(answer) ? answer : [];
            const isSelected = selectedValues.includes(option.value);
            
            return h('label', {
              key: option.value,
              className: `onboarding-option ${isSelected ? 'selected' : ''}`,
              onClick: () => {
                let newAnswer;
                if (isSelected) {
                  newAnswer = selectedValues.filter(v => v !== option.value);
                } else {
                  newAnswer = [...selectedValues, option.value];
                }
                this.handleAnswer(question.id, newAnswer);
              }
            }, [
              h('input', {
                type: 'checkbox',
                name: question.id,
                value: option.value,
                checked: isSelected,
                onChange: () => {} // Handled by label click
              }),
              h('span', { className: 'option-label' }, option.label)
            ]);
          })
        );

      case 'text_input':
        return h('input', {
          type: 'text',
          className: 'onboarding-text-input',
          placeholder: question.placeholder || '',
          value: answer || '',
          onInput: (e) => this.handleAnswer(question.id, e.target.value),
          'aria-label': question.question
        });

      default:
        return h('div', null, 'Tipo de pergunta não suportado');
    }
  }

  render() {
    const { questions, settings, isOpen } = this.props;
    const { currentQuestionIndex, isLoading, error } = this.state;
    
    if (!isOpen || !questions || questions.length === 0) {
      return null;
    }

    const currentQuestion = this.getCurrentQuestion();
    const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
    const isLastQuestion = currentQuestionIndex === questions.length - 1;
    const canProceed = this.isCurrentQuestionAnswered();

    return h('div', { 
      className: 'onboarding-overlay',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'onboarding-title'
    }, [
      h('div', { className: 'onboarding-modal' }, [
        // Header
        h('div', { className: 'onboarding-header' }, [
          h('h2', { 
            id: 'onboarding-title',
            className: 'onboarding-title' 
          }, settings?.title || 'Ajude-nos a encontrar o seu imóvel ideal'),
          h('p', { className: 'onboarding-subtitle' }, 
            settings?.subtitle || 'Responda a algumas perguntas para recebermos recomendações personalizadas'
          ),
          h('div', { className: 'onboarding-progress' }, [
            h('div', { 
              className: 'onboarding-progress-bar',
              style: `width: ${progress}%`
            }),
            h('span', { className: 'onboarding-progress-text' }, 
              `${currentQuestionIndex + 1} de ${questions.length}`
            )
          ])
        ]),

        // Question Content
        h('div', { className: 'onboarding-content' }, [
          h('div', { className: 'onboarding-question' }, [
            h('h3', { className: 'question-text' }, [
              currentQuestion.question,
              currentQuestion.required && h('span', { className: 'required-asterisk' }, ' *')
            ]),
            this.renderQuestion(currentQuestion)
          ]),

          // Error message
          error && h('div', { 
            className: 'onboarding-error',
            role: 'alert' 
          }, error)
        ]),

        // Footer
        h('div', { className: 'onboarding-footer' }, [
          h('div', { className: 'onboarding-buttons' }, [
            // Back button (except on first question)
            currentQuestionIndex > 0 && h('button', {
              type: 'button',
              className: 'onboarding-button onboarding-button-secondary',
              onClick: this.handleBack,
              disabled: isLoading
            }, 'Anterior'),

            // Skip button
            h('button', {
              type: 'button',
              className: 'onboarding-button onboarding-button-text',
              onClick: this.handleSkip,
              disabled: isLoading
            }, settings?.skip_option || 'Continuar sem responder'),

            // Next/Complete button
            h('button', {
              type: 'button',
              className: `onboarding-button onboarding-button-primary ${!canProceed ? 'disabled' : ''}`,
              onClick: this.handleNext,
              disabled: !canProceed || isLoading
            }, [
              isLoading && h('span', { className: 'loading-spinner' }),
              isLastQuestion ? 'Concluir' : 'Próxima'
            ])
          ])
        ])
      ])
    ]);
  }
}

export default OnboardingModal;