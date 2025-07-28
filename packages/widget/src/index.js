import { render, h } from 'preact';
import App from './App.jsx';

// Global function to initialize the widget
window.initViriatoChatbot = function(config = {}) {
  // Create container if it doesn't exist
  let container = document.getElementById('viriato-chatbot-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'viriato-chatbot-container';
    container.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
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
      apiUrl: script.dataset.apiUrl || 'https://your-domain.vercel.app'
    };
    window.initViriatoChatbot(config);
  }
}); 