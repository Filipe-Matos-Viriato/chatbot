import { render, h } from 'preact';
import App from './App.jsx';
import './styles.css';

// Global function to initialize the widget
window.initViriatoChatbot = function(config = {}) {
  // Create container if it doesn't exist
  let container = document.getElementById('viriato-chatbot-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'viriato-chatbot-container';
    container.className = 'widget-container';
    container.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
    `;
    
    // Set custom CSS properties for theming
    if (config.theme) {
      if (config.theme.primaryColor) {
        container.style.setProperty('--primary-color', config.theme.primaryColor);
      }
      if (config.theme.fontFamily) {
        container.style.fontFamily = config.theme.fontFamily;
      }
    }
    
    document.body.appendChild(container);
  }

  // Render the widget
  render(h(App, { config }), container);
};

// Auto-initialize if script has data attributes
document.addEventListener('DOMContentLoaded', () => {
  const script = document.querySelector('script[src*="loader.js"]');
  if (script && script.dataset.autoInit !== 'false') {
    const config = {
      clientId: script.dataset.clientId || 'default',
      apiUrl: script.dataset.apiUrl || 'https://chatbot1-eta.vercel.app',
      theme: {
        primaryColor: script.dataset.primaryColor,
        fontFamily: script.dataset.fontFamily
      }
    };
    window.initViriatoChatbot(config);
  }
}); 