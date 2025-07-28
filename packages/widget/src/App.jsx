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
      error: null
    };
  }

  componentDidMount() {
    this.loadConfig();
  }

  loadConfig = async () => {
    try {
      const { clientId = 'default', apiUrl } = this.props.config || {};
      const response = await fetch(`${apiUrl}/api/v1/widget/config/${clientId}`);
      
      if (!response.ok) {
        throw new Error('Failed to load configuration');
      }
      
      const config = await response.json();
      this.setState({ 
        config,
        messages: [{
          id: Date.now(),
          text: config.widgetSettings?.welcomeMessage || 'Hello! How can I help you?',
          sender: 'bot',
          timestamp: new Date()
        }]
      });
    } catch (error) {
      console.error('Widget config error:', error);
      this.setState({ error: 'Failed to load chatbot configuration' });
    }
  };

  toggleChat = () => {
    this.setState(prev => ({ isOpen: !prev.isOpen }));
  };

  sendMessage = async () => {
    const { inputValue, messages, config } = this.state;
    const { apiUrl } = this.props.config || {};
    
    if (!inputValue.trim()) return;

    const userMessage = {
      id: Date.now(),
      text: inputValue,
      sender: 'user',
      timestamp: new Date()
    };

    this.setState({
      messages: [...messages, userMessage],
      inputValue: '',
      isTyping: true
    });

    try {
      const response = await fetch(`${apiUrl}/api/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: inputValue,
          context: messages.slice(-5), // Last 5 messages for context
          clientId: this.props.config?.clientId || 'default'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      
      const botMessage = {
        id: Date.now() + 1,
        text: data.response || 'Sorry, I encountered an error.',
        sender: 'bot',
        timestamp: new Date()
      };

      this.setState(prev => ({
        messages: [...prev.messages, botMessage],
        isTyping: false
      }));

    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = {
        id: Date.now() + 1,
        text: 'Sorry, I\'m having trouble responding right now. Please try again.',
        sender: 'bot',
        timestamp: new Date()
      };
      
      this.setState(prev => ({
        messages: [...prev.messages, errorMessage],
        isTyping: false
      }));
    }
  };

  handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      this.sendMessage();
    }
  };

  render() {
    const { isOpen, messages, inputValue, isTyping, config, error } = this.state;
    
    if (error) {
      return h('div', { style: 'color: red; padding: 10px;' }, error);
    }

    if (!config) {
      return h('div', { style: 'padding: 10px;' }, 'Loading...');
    }

    const primaryColor = config.widgetSettings?.primaryColor || '#007bff';
    const chatIcon = config.widgetSettings?.chatIcon || '💬';

    return h(Fragment, null,
      // Chat Button
      h('button', {
        onClick: this.toggleChat,
        style: `
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: ${primaryColor};
          color: white;
          border: none;
          cursor: pointer;
          font-size: 24px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          transition: transform 0.2s;
        `,
        onMouseOver: (e) => e.target.style.transform = 'scale(1.1)',
        onMouseOut: (e) => e.target.style.transform = 'scale(1)'
      }, chatIcon),

      // Chat Window
      isOpen && h('div', {
        style: `
          position: absolute;
          bottom: 70px;
          right: 0;
          width: 350px;
          height: 500px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.15);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        `
      }, [
        // Header
        h('div', {
          style: `
            background: ${primaryColor};
            color: white;
            padding: 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          `
        }, [
          h('h3', { style: 'margin: 0; font-size: 16px;' }, 
            config.widgetSettings?.headerText || 'Chat with us!'
          ),
          h('button', {
            onClick: this.toggleChat,
            style: `
              background: none;
              border: none;
              color: white;
              font-size: 20px;
              cursor: pointer;
              padding: 0;
              width: 24px;
              height: 24px;
            `
          }, '×')
        ]),

        // Messages
        h('div', {
          style: `
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 12px;
          `
        }, [
          ...messages.map(msg => 
            h('div', {
              key: msg.id,
              style: `
                align-self: ${msg.sender === 'user' ? 'flex-end' : 'flex-start'};
                background: ${msg.sender === 'user' ? primaryColor : '#f1f1f1'};
                color: ${msg.sender === 'user' ? 'white' : 'black'};
                padding: 8px 12px;
                border-radius: 12px;
                max-width: 80%;
                word-wrap: break-word;
              `
            }, msg.text)
          ),
          isTyping && h('div', {
            style: 'align-self: flex-start; color: #666; font-style: italic;'
          }, 'Typing...')
        ]),

        // Input
        h('div', {
          style: `
            padding: 16px;
            border-top: 1px solid #eee;
            display: flex;
            gap: 8px;
          `
        }, [
          h('input', {
            type: 'text',
            value: inputValue,
            onInput: (e) => this.setState({ inputValue: e.target.value }),
            onKeyPress: this.handleKeyPress,
            placeholder: 'Type your message...',
            style: `
              flex: 1;
              padding: 8px 12px;
              border: 1px solid #ddd;
              border-radius: 20px;
              outline: none;
            `
          }),
          h('button', {
            onClick: this.sendMessage,
            disabled: !inputValue.trim(),
            style: `
              background: ${primaryColor};
              color: white;
              border: none;
              padding: 8px 16px;
              border-radius: 20px;
              cursor: pointer;
              opacity: ${inputValue.trim() ? '1' : '0.5'};
            `
          }, 'Send')
        ])
      ])
    );
  }
}

export default App; 