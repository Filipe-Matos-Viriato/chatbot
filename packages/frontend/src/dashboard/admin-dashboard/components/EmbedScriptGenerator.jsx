import React, { useState } from 'react';

const EmbedScriptGenerator = ({ clientId, clientName }) => {
  const [copied, setCopied] = useState({});

  // Get the current domain for the widget URL
  const getWidgetUrl = () => {
    if (window.location.hostname === 'localhost') {
      return 'http://localhost:5173'; // Development URL
    }
    return window.location.origin; // Production URL
  };

  const widgetUrl = getWidgetUrl();

  // Basic embed script
  const basicEmbedScript = `<script 
  src="${widgetUrl}/widget/loader.js"
  data-client-id="${clientId}"
  data-api-url="${widgetUrl}">
</script>`;

  // Advanced embed script with customization
  const advancedEmbedScript = `<!-- Advanced Chatbot Widget Integration -->
<script 
  src="${widgetUrl}/widget/loader.js"
  data-client-id="${clientId}"
  data-api-url="${widgetUrl}"
  data-theme="light"
  data-position="bottom-right"
  data-primary-color="#3b82f6">
</script>

<!-- Optional: Custom styling -->
<style>
  #viriato-chatbot-container {
    /* Custom widget positioning */
    bottom: 20px !important;
    right: 20px !important;
    /* Custom z-index if needed */
    z-index: 999999 !important;
  }
</style>`;

  // JavaScript initialization script
  const jsInitScript = `<script src="${widgetUrl}/widget/loader.js"></script>
<script>
  // Initialize widget with custom configuration
  window.initViriatoChatbot({
    clientId: '${clientId}',
    apiUrl: '${widgetUrl}',
    theme: {
      primaryColor: '#3b82f6',
      secondaryColor: '#6b7280',
      backgroundColor: '#ffffff',
      textColor: '#1e293b',
      position: 'bottom-right',
      borderRadius: '16px'
    },
    widgetSettings: {
      enableSounds: false,
      showBranding: true,
      mobileFullScreen: true,
      maxHeight: '600px'
    }
  });
</script>`;

  // Copy to clipboard function
  const copyToClipboard = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied({ ...copied, [type]: true });
      setTimeout(() => {
        setCopied({ ...copied, [type]: false });
      }, 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  const CodeBlock = ({ title, code, type, description }) => (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-lg font-semibold text-gray-800">{title}</h4>
        <button
          onClick={() => copyToClipboard(code, type)}
          className={`px-3 py-1 text-sm rounded transition-colors ${
            copied[type]
              ? 'bg-green-500 text-white'
              : 'bg-blue-500 text-white hover:bg-blue-600'
          }`}
        >
          {copied[type] ? '✓ Copied!' : 'Copy Code'}
        </button>
      </div>
      <p className="text-sm text-gray-600 mb-3">{description}</p>
      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
        <code>{code}</code>
      </pre>
    </div>
  );

  return (
    <div className="md:col-span-3">
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700">
          Website Integration Scripts
          <span className="text-xs text-gray-500 ml-2">
            (Embed codes for {clientName} website)
          </span>
        </label>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="text-blue-800 font-semibold mb-2">🔗 Client Information</h3>
        <div className="text-sm text-blue-700">
          <p><strong>Client ID:</strong> <code className="bg-blue-100 px-2 py-1 rounded">{clientId}</code></p>
          <p><strong>Widget URL:</strong> <code className="bg-blue-100 px-2 py-1 rounded">{widgetUrl}/widget/loader.js</code></p>
          <p><strong>API Endpoint:</strong> <code className="bg-blue-100 px-2 py-1 rounded">{widgetUrl}/api</code></p>
        </div>
      </div>

      <CodeBlock
        title="🚀 Basic Integration (Recommended)"
        type="basic"
        description="Simple script tag - just paste this before closing </body> tag on your website."
        code={basicEmbedScript}
      />

      <CodeBlock
        title="⚙️ Advanced Integration with Custom Styling"
        type="advanced"
        description="Includes theme customization and positioning options. Modify colors and position as needed."
        code={advancedEmbedScript}
      />

      <CodeBlock
        title="💻 JavaScript Initialization (For Dynamic Loading)"
        type="javascript"
        description="For websites that need programmatic control over widget initialization and configuration."
        code={jsInitScript}
      />

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-6">
        <h4 className="text-yellow-800 font-semibold mb-2">⚠️ Implementation Notes</h4>
        <ul className="text-sm text-yellow-700 space-y-1">
          <li>• Place the script tag at the bottom of your HTML page, just before the closing <code>&lt;/body&gt;</code> tag</li>
          <li>• The widget will automatically load and position itself in the bottom-right corner</li>
          <li>• Make sure your domain is whitelisted in the client configuration</li>
          <li>• The widget is responsive and will adapt to mobile devices automatically</li>
          <li>• Test the integration on your staging environment before deploying to production</li>
        </ul>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
        <h4 className="text-green-800 font-semibold mb-2">✅ Ready to Use</h4>
        <p className="text-sm text-green-700">
          These scripts are production-ready and configured specifically for <strong>{clientName}</strong>. 
          Simply copy and paste the preferred integration method into your website's HTML.
        </p>
      </div>
    </div>
  );
};

export default EmbedScriptGenerator;