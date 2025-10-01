import { h, Component, Fragment } from 'preact';
import { marked } from 'marked';

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
      visitorId: null,
      sessionId: null, // Add sessionId state
      // Onboarding state
      onboarding: {
        started: false,
        completed: false,
        step: 0,
        answers: {
          typology: null,
          budget_bucket: null,
          buying_timeframe: null,
          name: '',
          email: '',
          consent_marketing: false,
        },
      },
      initialUserMessageBuffer: null,
      hasSentFirstMessage: false,
    };
  }

  // --- Local storage helpers for persistent chat history ---
  getStorageKey = (clientId) => `chat_history_${clientId || 'default'}`;

  loadLocalHistory = (clientId) => {
    try {
      const raw = localStorage.getItem(this.getStorageKey(clientId));
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      return [];
    } catch (_) { return []; }
  };

  // --- Onboarding helpers ---
  setOnboardingAnswer = (field, value) => {
    this.setState(prev => ({
      onboarding: {
        ...prev.onboarding,
        answers: { ...prev.onboarding.answers, [field]: value },
      }
    }));
  };

  detectBuyingIntent = (text) => {
    const t = (text || '').toLowerCase();
    const keywords = ['comprar', 'investir', 'invest', 'buy', 'purchase', 'apartar', 'apartamento', 't0', 't1', 't2', 't3', 'duplex', 'imóvel', 'listing', 'propriedade'];
    return keywords.some(k => t.includes(k));
  };

  submitOnboarding = async () => {
    const { apiUrl } = this.props.config || {};
    const { visitorId, onboarding, initialUserMessageBuffer } = this.state;
    const clientId = this.props.config?.clientId || 'e6f484a3-c3cb-4e01-b8ce-a276f4b7355c';
    if (!visitorId) return;

    try {
      const resp = await fetch(`${apiUrl}/v1/visitors/${visitorId}/onboarding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Id': clientId,
        },
        body: JSON.stringify(onboarding.answers),
      });
      if (!resp.ok) throw new Error('Failed to save onboarding');
      const data = await resp.json();
      console.log('Onboarding saved:', data);
      this.setState(prev => ({ onboarding: { ...prev.onboarding, completed: true } }));

      // Decide next step based on initial message intent
      const buyingIntent = this.detectBuyingIntent(initialUserMessageBuffer);
      if (buyingIntent) {
        // Fetch listings and recommend
        await this.showRecommendationsFromOnboarding();
      } else {
        // Continue with the original user request
        this.setState({ inputValue: initialUserMessageBuffer }, () => this.sendMessage(true));
      }
    } catch (e) {
      console.error('Failed to submit onboarding', e);
      const errMsg = { id: Date.now() + 2, text: 'Não foi possível guardar as respostas. Pode tentar novamente?', sender: 'bot', timestamp: new Date() };
      this.setState(prev => ({ messages: [...prev.messages, errMsg] }));
    }
  };

  showRecommendationsFromOnboarding = async () => {
    const { apiUrl } = this.props.config || {};
    const clientId = this.props.config?.clientId || 'e6f484a3-c3cb-4e01-b8ce-a276f4b7355c';
    const { onboarding } = this.state;
    try {
      const res = await fetch(`${apiUrl}/v1/clients/${clientId}/listings`, {
        headers: { 'X-Client-Id': clientId }
      });
      const listings = res.ok ? await res.json() : [];
      const { typology, budget_bucket } = onboarding.answers;
      const range = (bucket) => {
        if (!bucket) return [0, Infinity];
        const m = bucket.match(/(\d+)[kK].*(\d+)[kK]/);
        if (m) return [parseInt(m[1], 10) * 1000, parseInt(m[2], 10) * 1000];
        if (/500k\+/.test(bucket)) return [500000, Infinity];
        return [0, Infinity];
      };
      const [minPrice, maxPrice] = range(budget_bucket || '0-9999k');
      const filtered = (listings || [])
        .filter(l => {
          const typeOk = typology ? (String(l.type || '').toUpperCase().includes(String(typology).toUpperCase())) : true;
          const price = Number(l.price) || Number(l.price_eur) || 0;
          const priceOk = price >= minPrice && price <= maxPrice;
          return typeOk && priceOk;
        })
        .slice(0, 5);

      if (filtered.length === 0) {
        const msg = { id: Date.now() + 3, text: 'Não encontrei imóveis que correspondam exatamente às preferências. Posso ajudá-lo a afinar os critérios?', sender: 'bot', timestamp: new Date() };
        this.setState(prev => ({ messages: [...prev.messages, msg] }));
        return;
      }

      const listMd = filtered.map((l, idx) => `- ${idx + 1}. ${l.name || 'Imóvel'} — €${(l.price || l.price_eur || 0).toLocaleString()}${l.id ? ` (ID: ${l.id})` : ''}`).join('\n');
      const recMsg = {
        id: Date.now() + 4,
        text: `${this.state.config.onboardingCompletionMessage || 'Com base nas suas preferências, aqui estão algumas opções:'}\n\n${listMd}\n\nQuer falar sobre algum destes?`,
        sender: 'bot',
        timestamp: new Date(),
      };
      this.setState(prev => ({ messages: [...prev.messages, recMsg] }), () => this.saveLocalHistory(this.props.config?.clientId, this.state.messages));
    } catch (e) {
      console.error('Failed to fetch listings for recommendations', e);
    }
  };
  saveLocalHistory = (clientId, messages) => {
    try {
      localStorage.setItem(this.getStorageKey(clientId), JSON.stringify(messages || []));
    } catch (_) {}
  };

  mergeMessages = (existing, incoming) => {
    const byId = new Map();
    [...existing, ...incoming].forEach(m => {
      if (!m || !m.id) return;
      // Keep the earliest instance by id to preserve order
      if (!byId.has(m.id)) byId.set(m.id, m);
    });
    // Sort by timestamp ascending if present, otherwise by id
    return Array.from(byId.values()).sort((a, b) => {
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      if (ta !== tb) return ta - tb;
      return (a.id + '').localeCompare(b.id + '');
    });
  };

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

      // 0) Immediately hydrate from local storage so users see prior messages instantly
      const locallyStored = this.loadLocalHistory(clientId);
      if (locallyStored.length > 0) {
        this.setState({ messages: locallyStored });
        console.log(`🗂️ Restored ${locallyStored.length} messages from local storage.`);
      }
      
      // Load widget config
      const configResponse = await fetch(`${apiUrl}/api/v1/widget/config/${clientId}?cacheBust=${new Date().getTime()}`);
      if (!configResponse.ok) {
        throw new Error('Failed to load configuration');
      }
      const config = await configResponse.json();

      // Store onboarding configuration
      this.setState({
        config: {
          ...config,
          onboardingEnabled: config.onboardingConfig?.enabled ?? true,
          onboardingQuestions: config.onboardingConfig?.questions || null,
          onboardingIntroMessage: config.onboardingConfig?.introMessage || null,
          onboardingCompletionMessage: config.onboardingConfig?.completionMessage || null
        }
      });

      // Check for an existing visitor ID in localStorage
      let visitorId = localStorage.getItem('visitorId');
      let sessionData;
      
      console.log(`🔍 Checking for existing visitorId... Found: ${visitorId || 'None'}`);

      // If a visitorId exists, try to fetch their data and chat history
      if (visitorId) {
        // Fetch visitor data
        const visitorResponse = await fetch(`${apiUrl}/v1/visitor`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ visitorId })
        });
        if (visitorResponse.ok) {
          sessionData = await visitorResponse.json();
          console.log('✅ Found returning visitor:', sessionData);
          // If onboarding already completed, mark it
          if (sessionData.onboarding_completed) {
            this.setState(prev => ({
              onboarding: { ...prev.onboarding, completed: true }
            }));
          }

          // Fetch chat history
          const historyResponse = await fetch(`${apiUrl}/api/v1/history/${visitorId}`, {
            headers: { 'X-Client-Id': clientId }
          });
          if (historyResponse.ok) {
            const history = await historyResponse.json();
            if (history.length > 0) {
              const formattedMessages = history.map(msg => ({
                id: msg.turn_id,
                text: msg.text,
                sender: msg.role === 'user' ? 'user' : 'bot',
                timestamp: new Date(msg.timestamp)
              })).reverse(); // Reverse to show oldest first
              const merged = this.mergeMessages(this.state.messages, formattedMessages);
              this.setState({ messages: merged });
              // Persist merged history locally
              this.saveLocalHistory(clientId, merged);
              console.log(`✅ Loaded ${formattedMessages.length} messages from backend history. Merged total=${merged.length}.`);
            }
          }
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

      this.setState({ 
        config,
        visitorId: sessionData.visitor_id,
        isLoadingConfig: false,
        messages: this.state.messages.length > 0 ? this.state.messages : []
      });
      // Ensure whatever we have is saved locally
      this.saveLocalHistory(clientId, this.state.messages);
      
      console.log(`👤 Visitor ID: ${sessionData.visitor_id}`);
      console.log('--- Initialization Complete ---');

      // Show welcome message only if there are no messages loaded from history
      if (this.state.messages.length === 0) {
        const welcomeMessage = {
          id: Date.now(),
          text: config.widgetSettings?.welcomeMessage || 'Olá! Sou o seu assistente virtual. Como posso ajudar?',
          sender: 'bot',
          timestamp: new Date(),
          ariaLabel: 'Welcome message from chatbot'
        };
        this.setState(prev => ({
          messages: [...prev.messages, welcomeMessage]
        }), () => {
          this.saveLocalHistory(clientId, this.state.messages);
        });
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



  sendMessage = async (isAutoTriggered = false) => {
    const { inputValue, messages, config } = this.state;
    const { apiUrl } = this.props.config || {};
    
    if (!inputValue.trim()) return;

    // Debug logging
    console.log('🔧 Widget Debug Info:');
    console.log('📡 API URL:', apiUrl);
    console.log('⚙️ Props config:', this.props.config);
    console.log('🎯 Target endpoint:', `${apiUrl}/api/chat`);

    if (!isAutoTriggered) {
      const userMessage = {
        id: Date.now(),
        text: inputValue,
        sender: 'user',
        timestamp: new Date(),
        ariaLabel: `You said: ${inputValue}`
      };

      this.setState({
        messages: [...messages, userMessage],
      }, () => {
        // Persist after adding user message
        this.saveLocalHistory(this.props.config?.clientId, this.state.messages);
      });

      // Announce message sent to screen readers
      this.announceToScreenReader('Message sent');
    }

    this.setState({ inputValue: '', isTyping: true });

    // On first user message, if onboarding not completed and enabled, start onboarding and buffer the message instead of calling chat
    const { onboarding, hasSentFirstMessage } = this.state;
    if (!hasSentFirstMessage && !onboarding.completed && !onboarding.started && config.onboardingEnabled) {
      this.setState({
        onboarding: { ...onboarding, started: true, step: 1 },
        initialUserMessageBuffer: inputValue,
        isTyping: false,
        hasSentFirstMessage: true,
      });
      // Show onboarding intro from bot using dynamic message
      const introMsg = {
        id: Date.now() + 1,
        text: config.onboardingIntroMessage || 'Antes de continuar, posso fazer 3 perguntas rápidas para recomendar os melhores apartamentos? (leva < 30s)',
        sender: 'bot',
        timestamp: new Date(),
      };
      this.setState(prev => ({ messages: [...prev.messages, introMsg] }), () => this.saveLocalHistory(this.props.config?.clientId, this.state.messages));
      return;
    }
    this.setState({ hasSentFirstMessage: true });

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
            pageUrl: window.location.href,
            context: messages.slice(-5),
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
      }), () => {
        // Persist after adding bot message
        this.saveLocalHistory(this.props.config?.clientId, this.state.messages);
      });

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
    const { isOpen, messages, inputValue, isTyping, config, error, onboarding } = this.state;

    
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
        }, 'Olivia - Assistente Virtual')
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
                                    max-width: 85%;
                  word-wrap: break-word;
                  font-size: ${isMobile ? '14px' : '15px'};
                  line-height: 1.4;
                  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                `,
                role: 'article',
                'aria-label': msg.ariaLabel || `${msg.sender === 'user' ? 'Your message' : 'Bot message'}: ${msg.text}`,
                className: `widget-message widget-message-${msg.sender}`
              }, [
                msg.sender === 'bot' 
                  ? h('div', { dangerouslySetInnerHTML: { __html: marked.parse(msg.text) } })
                  : msg.text,
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

        // Onboarding flow UI
        onboarding.started && !onboarding.completed && config.onboardingQuestions && h('div', {
          style: Object.entries(styles.inputContainer).map(([key, value]) => `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value}`).join('; ')
        }, [
          // Dynamic question rendering based on config
          config.onboardingQuestions.questions.map((question, index) => {
            const step = index + 1;
            if (onboarding.step !== step) return null;

            if (question.type === 'select') {
              return h('div', { style: 'display:flex; flex-direction:column; gap:8px; width:100%;' }, [
                h('div', { style: 'font-weight:600;' }, question.question),
                h('div', { style: 'display:flex; flex-wrap:wrap; gap:8px;' }, question.options.map(opt =>
                  h('button', {
                    onClick: () => this.setOnboardingAnswer(question.id, opt.value),
                    style: 'padding:8px 12px; border:1px solid #3f3f3f; background:#6b7280; color:white;'
                  }, opt.label)
                )),
                h('div', null, onboarding.answers[question.id] ? `Selecionado: ${question.options.find(opt => opt.value === onboarding.answers[question.id])?.label || onboarding.answers[question.id]}` : ''),
                h('div', { style: 'display:flex; gap:8px; justify-content:space-between;' }, [
                  step > 1 && h('button', {
                    onClick: () => this.setState(prev => ({ onboarding: { ...prev.onboarding, step: step - 1 } })),
                    style: 'padding:8px 12px; border:1px solid #3f3f3f; background:#4b5563; color:white;'
                  }, 'Voltar'),
                  h('button', {
                    onClick: () => this.setState(prev => ({ onboarding: { ...prev.onboarding, step: step + 1 } })),
                    disabled: !onboarding.answers[question.id],
                    style: 'padding:8px 12px; border:1px solid #3f3f3f; background:#6b7280; color:white;'
                  }, step === config.onboardingQuestions.questions.length ? 'Seguinte' : 'Seguinte')
                ])
              ]);
            } else if (question.type === 'contact') {
              return h('div', { style: 'display:flex; flex-direction:column; gap:8px; width:100%;' }, [
                h('div', { style: 'font-weight:600;' }, question.question),
                ...question.fields.map(field =>
                  h('input', {
                    type: field.type,
                    placeholder: field.placeholder,
                    value: onboarding.answers[field.id] || '',
                    onInput: (e) => this.setOnboardingAnswer(field.id, e.target.value),
                    style: 'padding:10px; border:1px solid #3f3f3f; background:rgba(20,20,20,.9); color:white;'
                  })
                ),
                question.consent && h('label', { style: 'display:flex; align-items:center; gap:8px; color:white;' }, [
                  h('input', {
                    type: 'checkbox',
                    checked: onboarding.answers.consent_marketing || false,
                    onChange: (e) => this.setOnboardingAnswer('consent_marketing', e.target.checked)
                  }),
                  question.consent.text
                ]),
                h('div', { style: 'display:flex; gap:8px; justify-content:space-between;' }, [
                  h('button', {
                    onClick: () => this.setState(prev => ({ onboarding: { ...prev.onboarding, step: step - 1 } })),
                    style: 'padding:8px 12px; border:1px solid #3f3f3f; background:#4b5563; color:white;'
                  }, 'Voltar'),
                  h('button', {
                    onClick: this.submitOnboarding,
                    disabled: !question.fields.every(field => onboarding.answers[field.id]),
                    className: 'onboarding-submit-button',
                    style: `
                      padding:8px 12px;
                      border:1px solid #3f3f3f;
                      background:#6b7280;
                      color:white;
                      cursor:pointer;
                      transition: all 0.2s ease;
                      border-radius: 0;
                    `
                  }, 'Concluir')
                ])
              ]);
            }
            return null;
          })
        ]),

        // Input
        h('div', {
          style: Object.entries(styles.inputContainer).map(([key, value]) => `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value}`).join('; ')
        }, [
          h('textarea', {
            value: inputValue,
            onInput: (e) => this.setState({ inputValue: e.target.value }),
            onKeyPress: this.handleKeyPress,
            placeholder: 'Escreva aqui...',
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
                cursor: ${inputValue.trim() ? 'pointer' : 'not-allowed'};
              `,
              onMouseOver: (e) => {
                if (!e.target.disabled && inputValue.trim()) {
                  e.target.style.background = '#7c8187';
                  e.target.style.transform = 'translateY(-1px)';
                }
              },
              onMouseOut: (e) => {
                if (!e.target.disabled && inputValue.trim()) {
                  e.target.style.background = sendButtonBg;
                  e.target.style.transform = 'translateY(0)';
                }
              },
              onMouseDown: (e) => {
                if (!e.target.disabled && inputValue.trim()) {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.2)';
                }
              },
              onMouseUp: (e) => {
                if (!e.target.disabled && inputValue.trim()) {
                  e.target.style.transform = 'translateY(-1px)';
                  e.target.style.boxShadow = 'none';
                }
              },
              'aria-label': 'Send message',
              'aria-disabled': !inputValue.trim(),
              className: 'widget-button widget-send-button'
            }, isMobile ? '→' : 'Enviar')
        ])
      ]),


    );
  }
}

export default App; 