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
      isLoadingConfig: false
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

  loadConfig = async () => {
    // Prevent duplicate API calls
    if (this.state.isLoadingConfig || this.state.config) {
      return;
    }

    this.setState({ isLoadingConfig: true });

    try {
      const { clientId = 'default', apiUrl } = this.props.config || {};
      const response = await fetch(`${apiUrl}/api/v1/widget/config/${clientId}`);
      
      if (!response.ok) {
        throw new Error('Failed to load configuration');
      }
      
      const config = await response.json();
      this.setState({ 
        config,
        isLoadingConfig: false,
        messages: [{
          id: Date.now(),
          text: config.widgetSettings?.welcomeMessage || 'Hello! How can I help you?',
          sender: 'bot',
          timestamp: new Date(),
          ariaLabel: 'Welcome message from chatbot'
        }]
      });
    } catch (error) {
      console.error('Widget config error:', error);
      this.setState({ 
        error: 'Failed to load chatbot configuration',
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
          'X-Client-Id': this.props.config?.clientId || 'default'
        },
        body: JSON.stringify({
          message: inputValue,
          query: inputValue, // Add both for compatibility
          context: messages.slice(-5), // Last 5 messages for context
          clientId: this.props.config?.clientId || 'default'
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
    
    // Theme-based colors
    const isDarkTheme = widgetSettings.theme === 'dark';
    const backgroundColor = widgetSettings.backgroundColor || (isDarkTheme ? '#1f2937' : '#ffffff');
    const textColor = widgetSettings.textColor || (isDarkTheme ? '#f9fafb' : '#1e293b');
    const secondaryBg = isDarkTheme ? '#374151' : '#f1f5f9';
    const borderColor = isDarkTheme ? '#4b5563' : '#e2e8f0';
    
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
        borderRadius: isMobile ? '0' : (widgetSettings.borderRadius || '16px'),
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
        width: isMobile ? '56px' : '64px',
        height: isMobile ? '56px' : '64px',
        borderRadius: '50%',
        border: 'none',
        cursor: 'pointer',
        fontSize: isMobile ? '20px' : '24px',
        boxShadow: isDarkTheme
          ? '0 6px 20px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.2)'
          : '0 6px 20px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.1)',
        transition: 'all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      },
      messagesContainer: {
        flex: '1',
        overflowY: 'auto',
        padding: isMobile ? '12px' : '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: isMobile ? '8px' : '12px',
        scrollBehavior: 'smooth',
        background: backgroundColor
      },
      inputContainer: {
        padding: isMobile ? '12px' : '20px',
        borderTop: `1px solid ${borderColor}`,
        display: 'flex',
        gap: isMobile ? '8px' : '12px',
        alignItems: 'flex-end',
        background: backgroundColor
      },
      input: {
        flex: '1',
        padding: isMobile ? '12px 16px' : '14px 18px',
        border: `1px solid ${borderColor}`,
        borderRadius: isMobile ? '24px' : '28px',
        outline: 'none',
        fontSize: isMobile ? '16px' : widgetSettings.fontSize || '14px', // 16px on mobile to prevent zoom
        resize: 'none',
        fontFamily: 'inherit',
        minHeight: isMobile ? '40px' : '44px',
        maxHeight: '120px',
        transition: 'border-color 0.2s ease',
        background: isDarkTheme ? '#374151' : '#f8fafc',
        color: textColor
      },
      sendButton: {
        padding: isMobile ? '12px 16px' : '14px 20px',
        border: 'none',
        borderRadius: isMobile ? '24px' : '28px',
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
        background: secondaryBg,
        color: textColor,
        borderRadius: '20px 20px 20px 6px'
      },
      messageUser: {
        borderRadius: '20px 20px 6px 20px'
      }
    };
  };

  render() {
    const { isOpen, messages, inputValue, isTyping, config, error } = this.state;
    
    if (error) {
      return h('div', { 
        style: 'color: #ef4444; padding: 12px; font-size: 14px; background: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);' 
      }, error);
    }

    if (!config) {
      return h('div', { 
        style: 'padding: 12px; font-size: 14px; background: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);' 
      }, 'Loading...');
    }

    const widgetSettings = config.widgetSettings || {};
    const isDarkTheme = widgetSettings.theme === 'dark';
    const primaryColor = widgetSettings.primaryColor || '#3b82f6';
    const textColor = widgetSettings.textColor || (isDarkTheme ? '#f9fafb' : '#1e293b');
    const secondaryBg = isDarkTheme ? '#374151' : '#f1f5f9';
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
      }, chatIcon),

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
                border-radius: 50%;
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
              border-radius: 50%;
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
                  background: ${msg.sender === 'user' ? primaryColor : secondaryBg};
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
              }, msg.text)
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
        h('div', {
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
                background: ${inputValue.trim() ? primaryColor : '#94a3b8'};
                color: white;
                opacity: ${inputValue.trim() ? '1' : '0.7'};
              `,
              'aria-label': 'Send message',
              'aria-disabled': !inputValue.trim(),
              className: 'widget-button widget-send-button'
            }, isMobile ? '→' : 'Send')
        ])
      ])
    );
  }
}

export default App; 