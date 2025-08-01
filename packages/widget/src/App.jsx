import { h, Component, Fragment } from 'preact';

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      isOpen: false,
      messages: [],
      inputValue: '',
      isTyping: false,
      config: null,
      error: null,
      isLoadingConfig: false,
      // Onboarding state
      onboardingQuestions: null,
      visitorId: null,
      sessionId: null, // Add sessionId state
      needsOnboarding: false,
      currentOnboardingIndex: 0,
      onboardingAnswers: {},
      isInOnboardingMode: false
    };
  }

  componentDidMount() {
    this.loadConfig();
    this.handleResize();
    window.addEventListener('resize', this.handleResize);
    // Set initial focus management
    this.setupAccessibility();
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.handleResize);
  }

  setupAccessibility = () => {
    // Add escape key listener for closing chat
    document.addEventListener('keydown', this.handleGlobalKeyDown);
  }

  handleGlobalKeyDown = (e) => {
    if (e.key === 'Escape' && this.state.isOpen) {
      this.toggleChat();
    }
  }

  handleResize = () => {
    // Force re-render on resize to update responsive styles
    this.forceUpdate();
  };

  // Helper function to generate sessionId
  generateSessionId = () => {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  };

  loadConfig = async () => {
    // Prevent duplicate API calls
    if (this.state.isLoadingConfig || this.state.config) {
      return;
    }

    this.setState({ isLoadingConfig: true });
    console.log('--- Widget Initialization ---');

    // Generate a new sessionId for this chat session
    const sessionId = this.generateSessionId();
    this.setState({ sessionId });
    console.log(`🆔 Generated new sessionId: ${sessionId}`);

    try {
      const { clientId = 'e6f484a3-c3cb-4e01-b8ce-a276f4b7355c', apiUrl } = this.props.config || {};
      
      // Load widget config
      const configResponse = await fetch(`${apiUrl}/api/v1/widget/config/${clientId}`);
      if (!configResponse.ok) {
        throw new Error('Failed to load configuration');
      }
      const config = await configResponse.json();
      
      // Check for an existing visitor ID in localStorage
      let visitorId = localStorage.getItem('visitorId');
      let sessionData;
      
      console.log(`🔍 Checking for existing visitorId... Found: ${visitorId || 'None'}`);

      // If a visitorId exists, try to fetch their data
      if (visitorId) {
        const visitorResponse = await fetch(`${apiUrl}/v1/visitor`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ visitorId })
        });
        if (visitorResponse.ok) {
          sessionData = await visitorResponse.json();
          console.log('✅ Found returning visitor:', sessionData);
        } else {
            console.log('🤔 Visitor ID found but no record on backend. Clearing invalid ID.');
            localStorage.removeItem('visitorId');
        }
      }
      
      // If no session data (either new visitor or failed fetch), create a new session
      if (!sessionData) {
        console.log('🔄 Creating new visitor session...');
        const sessionResponse = await fetch(`${apiUrl}/v1/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId })
        });
        
        if (!sessionResponse.ok) {
          throw new Error('Failed to create visitor session');
        }
        
        sessionData = await sessionResponse.json();
        console.log('✨ New visitor created:', sessionData);
        
        // Store the new visitor ID
        localStorage.setItem('visitorId', sessionData.visitor_id);
        console.log(`💾 Stored new visitorId in localStorage: ${sessionData.visitor_id}`);
      }

      // Get onboarding questions from client configuration if needed
      let onboardingQuestions = null;
      if (sessionData.needs_onboarding) {
        console.log('➡️ Visitor needs onboarding. Fetching questions...');
        onboardingQuestions = config.defaultOnboardingQuestions;
        
        if (!onboardingQuestions) {
          try {
            const onboardingResponse = await fetch(`${apiUrl}/v1/visitors/${sessionData.visitor_id}/onboarding?clientId=${clientId}`);
            if (onboardingResponse.ok) {
              const onboardingData = await onboardingResponse.json();
              onboardingQuestions = onboardingData.questions;
              console.log('📦 Onboarding questions loaded from API.');
            }
          } catch (onboardingError) {
            console.warn('❌ Could not load onboarding questions:', onboardingError);
          }
        } else {
            console.log('📦 Onboarding questions loaded from widget config.');
        }
      } else {
          console.log('👍 Visitor has already completed onboarding.');
      }

      this.setState({ 
        config,
        visitorId: sessionData.visitor_id,
        needsOnboarding: sessionData.needs_onboarding,
        onboardingQuestions,
        isLoadingConfig: false,
        messages: []
      });
      
      console.log(`👤 Visitor ID: ${sessionData.visitor_id}`);
      console.log('--- Initialization Complete ---');

      // Start onboarding in chat if needed, otherwise show welcome message
      if (sessionData.needs_onboarding && onboardingQuestions) {
        setTimeout(() => {
          this.startOnboardingInChat();
        }, 1000);
      } else {
        const welcomeMessage = {
          id: Date.now(),
          text: config.widgetSettings?.welcomeMessage || 'Olá! Sou o seu assistente virtual. Como posso ajudar?',
          sender: 'bot',
          timestamp: new Date(),
          ariaLabel: 'Welcome message from chatbot'
        };
        this.setState(prev => ({
          messages: [...prev.messages, welcomeMessage]
        }));
      }

    } catch (error) {
      console.error('💥 Widget initialization error:', error);
      this.setState({ 
        error: 'Failed to initialize chatbot',
        isLoadingConfig: false 
      });
    }
  };

  toggleChat = () => {
    this.setState(prev => ({ isOpen: !prev.isOpen }), () => {
      // Focus management for accessibility
      if (this.state.isOpen && this.inputRef) {
        setTimeout(() => this.inputRef.focus(), 100);
      }
      
      // Announce state change to screen readers
      this.announceToScreenReader(
        this.state.isOpen ? 'Chat window opened' : 'Chat window closed'
      );
    });
  };

  announceToScreenReader = (message) => {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.style.position = 'absolute';
    announcement.style.left = '-10000px';
    announcement.style.width = '1px';
    announcement.style.height = '1px';
    announcement.style.overflow = 'hidden';
    announcement.textContent = message;
    
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 1000);
  };



  sendMessage = async () => {
    const { inputValue, messages, config } = this.state;
    const { apiUrl } = this.props.config || {};
    
    if (!inputValue.trim()) return;

    // Debug logging
    console.log('🔧 Widget Debug Info:');
    console.log('📡 API URL:', apiUrl);
    console.log('⚙️ Props config:', this.props.config);
    console.log('🎯 Target endpoint:', `${apiUrl}/api/chat`);

    const userMessage = {
      id: Date.now(),
      text: inputValue,
      sender: 'user',
      timestamp: new Date(),
      ariaLabel: `You said: ${inputValue}`
    };

    this.setState({
      messages: [...messages, userMessage],
      inputValue: '',
      isTyping: true
    });

    // Announce message sent to screen readers
    this.announceToScreenReader('Message sent');

    try {
      const response = await fetch(`${apiUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Id': this.props.config?.clientId || 'e6f484a3-c3cb-4e01-b8ce-a276f4b7355c'
        },
        body: JSON.stringify({
          query: inputValue,
          visitorId: this.state.visitorId,
          sessionId: this.state.sessionId,
          context: messages.slice(-5), // Last 5 messages for context
          onboardingAnswers: this.state.onboardingAnswers
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      const botMessage = {
        id: Date.now() + 1,
        text: data.response || 'Sorry, I encountered an error.',
        sender: 'bot',
        timestamp: new Date(),
        ariaLabel: `Chatbot responded: ${data.response || 'Sorry, I encountered an error.'}`
      };

      this.setState(prev => ({
        messages: [...prev.messages, botMessage],
        isTyping: false
      }));

      // Announce new message to screen readers
      this.announceToScreenReader('New message received');

    } catch (error) {
      console.error('❌ Chat API Error:', error);
      console.error('🌐 Failed URL:', `${apiUrl}/api/chat`);
      
      const errorMessage = {
        id: Date.now() + 1,
        text: 'Sorry, I\'m having trouble responding right now. Please try again.',
        sender: 'bot',
        timestamp: new Date(),
        ariaLabel: 'Error message from chatbot'
      };
      
      this.setState(prev => ({
        messages: [...prev.messages, errorMessage],
        isTyping: false
      }));

      this.announceToScreenReader('Error occurred while sending message');
    }
  };

  // Onboarding methods
  startOnboardingInChat = () => {
    const { onboardingQuestions } = this.state;
    if (!onboardingQuestions?.questions || onboardingQuestions.questions.length === 0) {
      return;
    }

    this.setState({
      isInOnboardingMode: true,
      currentOnboardingIndex: 0
    });

    // Add intro message
    const introMessage = {
      id: Date.now(),
      text: onboardingQuestions.settings?.title || 'Ajude-nos a encontrar o seu imóvel ideal! Responda a algumas perguntas para receber recomendações personalizadas.',
      sender: 'bot',
      timestamp: new Date(),
      type: 'onboarding-intro'
    };

    this.addBotMessage(introMessage);

    // Add first question
    setTimeout(() => {
      this.showCurrentOnboardingQuestion();
    }, 1000);
  };

  showCurrentOnboardingQuestion = () => {
    const { onboardingQuestions, currentOnboardingIndex } = this.state;
    const question = onboardingQuestions.questions[currentOnboardingIndex];

    if (!question) {
      this.completeOnboarding();
      return;
    }

    const questionMessage = {
      id: Date.now(),
      text: question.question + (question.required ? ' *' : ''),
      sender: 'bot',
      timestamp: new Date(),
      type: 'onboarding-question',
      questionData: question,
      questionIndex: currentOnboardingIndex
    };

    this.addBotMessage(questionMessage);
  };

  handleOnboardingAnswer = (questionId, answer, questionIndex) => {
    const { onboardingQuestions, onboardingAnswers } = this.state;
    
    // Ensure we're answering the current question
    if (questionIndex !== this.state.currentOnboardingIndex) {
      console.log('⚠️ Ignoring answer for old question:', { questionIndex, currentIndex: this.state.currentOnboardingIndex });
      return;
    }
    
    // Store the answer
    const newAnswers = {
      ...onboardingAnswers,
      [questionId]: answer
    };

    console.log('📝 Recording answer:', { questionId, answer, questionIndex });

    this.setState({
      onboardingAnswers: newAnswers
    });

    // Show user's response as a message
    const answerText = this.formatAnswerForDisplay(answer, onboardingQuestions.questions[questionIndex]);
    const userMessage = {
      id: Date.now(),
      text: answerText,
      sender: 'user',
      timestamp: new Date()
    };

    this.addUserMessage(userMessage);

    // Move to next question or complete
    const nextIndex = questionIndex + 1;
    if (nextIndex < onboardingQuestions.questions.length) {
      console.log('➡️ Moving to next question:', { from: questionIndex, to: nextIndex });
      setTimeout(() => {
        this.setState({ currentOnboardingIndex: nextIndex }, () => {
          this.showCurrentOnboardingQuestion();
        });
      }, 500);
    } else {
      console.log('✅ Onboarding complete, submitting answers');
      setTimeout(() => {
        this.completeOnboarding();
      }, 500);
    }
  };

  formatAnswerForDisplay = (answer, question) => {
    if (question.type === 'multiple_select' && Array.isArray(answer)) {
      const selectedOptions = question.options.filter(opt => answer.includes(opt.value));
      return selectedOptions.map(opt => opt.label).join(', ');
    } else if (question.type === 'multiple_choice' || question.type === 'range_select') {
      const selectedOption = question.options.find(opt => opt.value === answer);
      return selectedOption ? selectedOption.label : answer;
    }
    return answer;
  };

  completeOnboarding = async () => {
    const { onboardingAnswers, visitorId, onboardingQuestions } = this.state;
    const apiUrl = this.props.config?.apiUrl || 'https://chatbot1-eta.vercel.app';

    console.log('🔄 Submitting onboarding answers:', {
      visitorId,
      answers: onboardingAnswers,
      apiUrl: `${apiUrl}/v1/visitors/${visitorId}/onboarding`
    });

    try {
      // Submit onboarding answers
      const response = await fetch(`${apiUrl}/v1/visitors/${visitorId}/onboarding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          answers: onboardingAnswers,
          completed: true 
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`HTTP ${response.status}: ${errorData.error || response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Onboarding submission successful:', result);

      // Add completion message from settings
      const completionText = onboardingQuestions?.settings?.completion_message || 
                           'Obrigado pelas suas respostas! Agora posso ajudá-lo de forma mais personalizada. Em que posso ajudar?';
      
      const completionMessage = {
        id: Date.now(),
        text: completionText,
        sender: 'bot',
        timestamp: new Date()
      };

      this.addBotMessage(completionMessage);

    } catch (error) {
      console.error('❌ Error submitting onboarding:', error);
      const errorMessage = {
        id: Date.now(),
        text: 'Erro ao guardar as suas respostas, mas posso ajudá-lo na mesma. Em que posso ajudar?',
        sender: 'bot',
        timestamp: new Date()
      };
      this.addBotMessage(errorMessage);
    }

    this.setState({
      isInOnboardingMode: false,
      needsOnboarding: false
    });
  };

  addBotMessage = (message) => {
    this.setState(prev => ({
      messages: [...prev.messages, message]
    }));
  };

  addUserMessage = (message) => {
    this.setState(prev => ({
      messages: [...prev.messages, message]
    }));
  };

  renderOnboardingQuestion = (message) => {
    const { isInOnboardingMode, currentOnboardingIndex } = this.state;
    
    if (!isInOnboardingMode || message.questionIndex !== currentOnboardingIndex) {
      return null;
    }

    const question = message.questionData;
    if (!question) return null;

    return h('div', {
      style: 'margin-top: 12px;'
    }, this.renderQuestionOptions(question, message.questionIndex));
  };

  renderQuestionOptions = (question, questionIndex) => {
    const { onboardingAnswers } = this.state;
    const answer = onboardingAnswers[question.id];

    switch (question.type) {
      case 'multiple_choice':
      case 'range_select':
        return h('div', {
          style: 'display: flex; flex-direction: column; gap: 8px;'
        }, question.options.map(option => 
          h('button', {
            key: option.value,
            onClick: () => this.handleOnboardingAnswer(question.id, option.value, questionIndex),
            style: `
              padding: 10px 12px;
              border: 1px solid #3f3f3f !important;
              background: rgba(20, 20, 20, .9) !important;
              color: white !important;
              border-radius: 0 !important;
              cursor: pointer;
              text-align: left;
              font-size: 14px;
              transition: all 0.2s ease;
            `,
            onMouseOver: (e) => {
              if (answer !== option.value) {
                e.target.style.borderColor = '#3f3f3f';
                e.target.style.backgroundColor = 'rgba(20, 20, 20, .9)';
              }
            },
            onMouseOut: (e) => {
              if (answer !== option.value) {
                e.target.style.borderColor = '#3f3f3f';
                e.target.style.backgroundColor = 'rgba(20, 20, 20, .9)';
              }
            }
          }, option.label)
        ));

      case 'multiple_select':
        const selectedValues = Array.isArray(answer) ? answer : [];
        return h('div', {
          style: 'display: flex; flex-direction: column; gap: 8px;'
        }, [
          ...question.options.map(option => {
            const isSelected = selectedValues.includes(option.value);
            return h('button', {
              key: option.value,
              onClick: () => {
                let newAnswer;
                if (isSelected) {
                  newAnswer = selectedValues.filter(v => v !== option.value);
                } else {
                  newAnswer = [...selectedValues, option.value];
                }
                this.setState(prev => ({
                  onboardingAnswers: {
                    ...prev.onboardingAnswers,
                    [question.id]: newAnswer
                  }
                }));
              },
              style: `
                padding: 10px 12px;
                border: 1px solid #3f3f3f !important;
                background: rgba(20, 20, 20, .9) !important;
                color: white !important;
                border-radius: 0 !important;
                cursor: pointer;
                text-align: left;
                font-size: 14px;
                transition: all 0.2s ease;
              `
            }, option.label);
          }),
          selectedValues.length > 0 && h('button', {
            onClick: () => this.handleOnboardingAnswer(question.id, selectedValues, questionIndex),
            style: `
              padding: 12px;
              background: rgba(20, 20, 20, .9) !important;
              color: white !important;
              border: 1px solid #3f3f3f !important;
              border-radius: 0 !important;
              cursor: pointer;
              font-weight: 600;
              margin-top: 8px;
            `
          }, 'Continuar')
        ]);

      case 'text_input':
        return h('div', {
          style: 'display: flex; gap: 8px; margin-top: 8px;'
        }, [
          h('input', {
            type: 'text',
            placeholder: question.placeholder || '',
            value: answer || '',
            onInput: (e) => {
              this.setState(prev => ({
                onboardingAnswers: {
                  ...prev.onboardingAnswers,
                  [question.id]: e.target.value
                }
              }));
            },
            onKeyPress: (e) => {
              if (e.key === 'Enter' && (answer || '').trim()) {
                this.handleOnboardingAnswer(question.id, answer, questionIndex);
              }
            },
            style: `
              flex: 1;
              padding: 10px 12px;
              border: 1px solid #3f3f3f !important;
              background: rgba(20, 20, 20, .9) !important;
              color: white !important;
              border-radius: 0 !important;
              font-size: 14px;
            `
          }),
          h('button', {
            onClick: () => this.handleOnboardingAnswer(question.id, answer, questionIndex),
            disabled: !(answer || '').trim(),
            style: `
              padding: 10px 16px;
              background: rgba(20, 20, 20, .9) !important;
              color: white !important;
              border: 1px solid #3f3f3f !important;
              border-radius: 0 !important;
              cursor: ${(answer || '').trim() ? 'pointer' : 'not-allowed'};
              font-weight: 600;
            `
          }, '→')
        ]);

      default:
        return h('div', null, 'Tipo de pergunta não suportado');
    }
  };

  handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.sendMessage();
    }
  };

  getResponsiveStyles = () => {
    const isMobile = window.innerWidth <= 768;
    const isSmallMobile = window.innerWidth <= 480;
    const { config } = this.state;
    const widgetSettings = config?.widgetSettings || {};
    
    // Theme-based colors - Custom dark theme
    const isDarkTheme = widgetSettings.theme === 'dark';
    const backgroundColor = 'rgba(20, 20, 20, .9)';
    const textColor = 'white';
    const secondaryBg = 'rgba(20, 20, 20, .9)';
    const borderColor = '#3f3f3f';
    
    // Position settings
    const position = widgetSettings.position || 'bottom-right';
    const [vPos, hPos] = position.split('-');
    
    const positionStyles = {
      bottom: vPos === 'bottom' ? (isMobile ? '0' : '20px') : 'auto',
      top: vPos === 'top' ? (isMobile ? '0' : '20px') : 'auto',
      right: hPos === 'right' ? (isMobile ? '0' : '20px') : 'auto',
      left: hPos === 'left' ? (isMobile ? '0' : '20px') : 'auto'
    };
    
    return {
      chatWindow: {
        position: 'fixed',
        ...positionStyles,
        width: isMobile ? '100%' : '400px',
        height: isMobile && widgetSettings.mobileFullScreen 
          ? '100vh' 
          : isMobile ? '90vh' 
          : widgetSettings.maxHeight || '600px',
        maxHeight: isMobile ? '100vh' : '85vh',
        background: backgroundColor,
        color: textColor,
        borderRadius: '0 !important',
        border: '1px solid #3f3f3f !important',
        boxShadow: isMobile 
          ? 'none' 
          : isDarkTheme
            ? '0 20px 40px rgba(0,0,0,0.4), 0 5px 10px rgba(0,0,0,0.2)'
            : '0 20px 40px rgba(0,0,0,0.15), 0 5px 10px rgba(0,0,0,0.1)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: '999999',
        fontFamily: widgetSettings.fontFamily || 'inherit',
        fontSize: widgetSettings.fontSize || '14px',
        transition: 'all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)'
      },
      chatButton: {
        width: isMobile ? 'auto' : 'auto',
        height: isMobile ? '56px' : '64px',
        padding: isMobile ? '12px 16px' : '16px 20px',
        borderRadius: '0 !important',
        border: '1px solid #3f3f3f !important',
        cursor: 'pointer',
        fontSize: isMobile ? '20px' : '24px',
        boxShadow: isDarkTheme
          ? '0 6px 20px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.2)'
          : '0 6px 20px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.1)',
        transition: 'all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: isMobile ? '8px' : '12px'
      },
      messagesContainer: {
        flex: '1',
        overflowY: 'auto',
        padding: isMobile ? '12px' : '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: isMobile ? '8px' : '12px',
        scrollBehavior: 'smooth',
        background: backgroundColor,
        border: '1px solid #3f3f3f !important'
      },
      inputContainer: {
        padding: isMobile ? '12px' : '20px',
        borderTop: `1px solid ${borderColor}`,
        display: 'flex',
        gap: isMobile ? '8px' : '12px',
        alignItems: 'flex-end',
        background: backgroundColor,
        border: '1px solid #3f3f3f !important'
      },
      input: {
        flex: '1',
        padding: isMobile ? '12px 16px' : '14px 18px',
        border: '1px solid #3f3f3f !important',
        borderRadius: '0 !important',
        outline: 'none',
        fontSize: isMobile ? '16px' : widgetSettings.fontSize || '14px', // 16px on mobile to prevent zoom
        resize: 'none',
        fontFamily: 'inherit',
        minHeight: isMobile ? '40px' : '44px',
        maxHeight: '120px',
        transition: 'border-color 0.2s ease',
        background: 'rgba(20, 20, 20, .9) !important',
        color: 'white !important'
      },
      sendButton: {
        padding: isMobile ? '12px 16px' : '14px 20px',
        border: '1px solid #3f3f3f !important',
        borderRadius: '0 !important',
        cursor: 'pointer',
        fontSize: isMobile ? '14px' : '16px',
        fontWeight: '600',
        minWidth: isMobile ? '60px' : '80px',
        height: isMobile ? '40px' : '44px',
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      },
      messageBot: {
        background: 'rgba(20, 20, 20, .9) !important',
        color: 'white !important',
        borderRadius: '0 !important',
        border: '1px solid #3f3f3f !important'
      },
      messageUser: {
        borderRadius: '0 !important',
        border: '1px solid #3f3f3f !important'
      }
    };
  };

  render() {
    const { isOpen, messages, inputValue, isTyping, config, error } = this.state;
    
    if (error) {
      return h('div', { 
        style: 'color: white !important; padding: 12px; font-size: 14px; background: rgba(20, 20, 20, .9) !important; border-radius: 0 !important; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border: 1px solid #3f3f3f !important;' 
      }, error);
    }

    if (!config) {
      return h('div', { 
        style: 'padding: 12px; font-size: 14px; background: rgba(20, 20, 20, .9) !important; border-radius: 0 !important; box-shadow: 0 4px 12px rgba(0,0,0,0.15); color: white !important; border: 1px solid #3f3f3f !important;' 
      }, 'Loading...');
    }

    const widgetSettings = config.widgetSettings || {};
    const isDarkTheme = widgetSettings.theme === 'dark';
    const primaryColor = 'rgba(20, 20, 20, .9)'; // Remove blue, use dark background
    const userMessageBg = '#6b7280'; // Lighter grey for user messages
    const sendButtonBg = '#6b7280'; // Lighter grey for send button
    const textColor = 'white';
    const secondaryBg = 'rgba(20, 20, 20, .9)';
    const chatIcon = widgetSettings.chatIcon || '💬';
    const styles = this.getResponsiveStyles();
    const isMobile = window.innerWidth <= 768;

    return h(Fragment, null,
      // Chat Button
      h('button', {
        onClick: this.toggleChat,
        style: `
          ${Object.entries(styles.chatButton).map(([key, value]) => `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value}`).join('; ')};
          background: ${primaryColor};
          color: white;
        `,
        onMouseOver: (e) => e.target.style.transform = 'scale(1.05)',
        onMouseOut: (e) => e.target.style.transform = 'scale(1)',
        'aria-label': 'Open chat',
        'aria-expanded': isOpen
      }, [
        h('span', { 
          style: `font-size: ${isMobile ? '20px' : '24px'};` 
        }, chatIcon),
        h('span', { 
          style: `font-size: ${isMobile ? '12px' : '14px'}; font-weight: 600; white-space: nowrap;` 
        }, 'Assistente IA')
      ]),

      // Chat Window
      isOpen && h('div', {
        style: Object.entries(styles.chatWindow).map(([key, value]) => `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value}`).join('; '),
        role: 'dialog',
        'aria-label': 'Chat window'
      }, [
        // Header
        h('div', {
          style: `
            background: ${primaryColor};
            color: white;
            padding: ${isMobile ? '16px' : '20px'};
            display: flex;
            justify-content: space-between;
            align-items: center;
            min-height: ${isMobile ? '60px' : '64px'};
          `
        }, [
          h('div', { style: 'display: flex; align-items: center; gap: 12px;' }, [
            h('div', {
              style: `
                width: ${isMobile ? '32px' : '36px'};
                height: ${isMobile ? '32px' : '36px'};
                background: rgba(255,255,255,0.2);
                border-radius: 0 !important;
                border: 1px solid #3f3f3f !important;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: ${isMobile ? '16px' : '18px'};
              `
            }, chatIcon),
            h('h3', { 
              style: `margin: 0; font-size: ${isMobile ? '16px' : '18px'}; font-weight: 600;` 
            }, config.widgetSettings?.headerText || 'Chat with us!')
          ]),
          h('button', {
            onClick: this.toggleChat,
            style: `
              background: none;
              border: none;
              color: white;
              font-size: ${isMobile ? '24px' : '28px'};
              cursor: pointer;
              padding: 8px;
              border-radius: 0 !important;
              border: 1px solid #3f3f3f !important;
              width: ${isMobile ? '40px' : '44px'};
              height: ${isMobile ? '40px' : '44px'};
              display: flex;
              align-items: center;
              justify-content: center;
              transition: background-color 0.2s ease;
            `,
            onMouseOver: (e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.1)',
            onMouseOut: (e) => e.target.style.backgroundColor = 'transparent',
            'aria-label': 'Close chat'
          }, '×')
        ]),

        // Hidden instructions for screen readers
        h('div', {
          id: 'chat-instructions',
          style: 'position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden;'
        }, 'Press Enter to send message, Escape to close chat'),

        // Messages
        h('div', {
          style: Object.entries(styles.messagesContainer).map(([key, value]) => `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value}`).join('; '),
          ref: (el) => {
            if (el) {
              el.scrollTop = el.scrollHeight;
            }
          },
          role: 'log',
          'aria-live': 'polite',
          'aria-label': 'Chat messages',
          className: 'widget-messages'
        }, [
                      ...messages.map(msg => 
              h('div', {
                key: msg.id,
                style: `
                  align-self: ${msg.sender === 'user' ? 'flex-end' : 'flex-start'};
                  background: ${msg.sender === 'user' ? userMessageBg : secondaryBg};
                  color: ${msg.sender === 'user' ? 'white' : textColor};
                  padding: ${isMobile ? '10px 14px' : '12px 16px'};
                  border-radius: ${msg.sender === 'user' ? styles.messageUser.borderRadius : styles.messageBot.borderRadius};
                  max-width: ${msg.type === 'onboarding-question' ? '95%' : '85%'};
                  word-wrap: break-word;
                  font-size: ${isMobile ? '14px' : '15px'};
                  line-height: 1.4;
                  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                `,
                role: 'article',
                'aria-label': msg.ariaLabel || `${msg.sender === 'user' ? 'Your message' : 'Bot message'}: ${msg.text}`,
                className: `widget-message widget-message-${msg.sender}`
              }, [
                msg.text,
                msg.type === 'onboarding-question' && this.renderOnboardingQuestion(msg)
              ])
          ),
          isTyping && h('div', {
            style: `
              align-self: flex-start;
              background: ${secondaryBg};
              color: ${textColor};
              padding: ${isMobile ? '10px 14px' : '12px 16px'};
                             border-radius: ${styles.messageBot.borderRadius};
              font-style: italic;
              font-size: ${isMobile ? '14px' : '15px'};
              display: flex;
              align-items: center;
              gap: 8px;
            `
          }, [
            h('span', null, 'Typing'),
            h('div', {
              style: `
                display: flex;
                gap: 2px;
              `
            }, [
              h('div', { style: 'width: 4px; height: 4px; background: #64748b; border-radius: 50%; animation: pulse 1.5s ease-in-out infinite;' }),
              h('div', { style: 'width: 4px; height: 4px; background: #64748b; border-radius: 50%; animation: pulse 1.5s ease-in-out 0.1s infinite;' }),
              h('div', { style: 'width: 4px; height: 4px; background: #64748b; border-radius: 50%; animation: pulse 1.5s ease-in-out 0.2s infinite;' })
            ])
          ])
        ]),

        // Input
        !this.state.isInOnboardingMode && h('div', {
          style: Object.entries(styles.inputContainer).map(([key, value]) => `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value}`).join('; ')
        }, [
          h('textarea', {
            value: inputValue,
            onInput: (e) => this.setState({ inputValue: e.target.value }),
            onKeyPress: this.handleKeyPress,
            placeholder: 'Type your message...',
            style: Object.entries(styles.input).map(([key, value]) => `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value}`).join('; '),
            rows: 1,
            'aria-label': 'Type your message here',
            'aria-describedby': 'chat-instructions',
            ref: (el) => { this.inputRef = el; },
            className: 'widget-input'
          }),
          h('button', {
              onClick: this.sendMessage,
              disabled: !inputValue.trim(),
              style: `
                ${Object.entries(styles.sendButton).map(([key, value]) => `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value}`).join('; ')};
                background: ${inputValue.trim() ? sendButtonBg : '#4b5563'};
                color: white;
                opacity: ${inputValue.trim() ? '1' : '0.7'};
              `,
              'aria-label': 'Send message',
              'aria-disabled': !inputValue.trim(),
              className: 'widget-button widget-send-button'
            }, isMobile ? '→' : 'Send')
        ])
      ]),


    );
  }
}

export default App; 