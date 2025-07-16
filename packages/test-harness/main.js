const contextInput = document.getElementById('context-input');
const contextTypeSelect = document.getElementById('context-type');
const sendContextBtn = document.getElementById('send-context-btn');
const clearContextBtn = document.getElementById('clear-context-btn');
const iframe = document.querySelector('iframe');

const sendContext = (contextPayload) => {
  if (iframe.contentWindow) {
    const message = {
      type: 'SET_CHATBOT_CONTEXT',
      payload: contextPayload
    };
    iframe.contentWindow.postMessage(message, 'http://localhost:5173');
    console.log(`Sent context to iframe:`, message);
  }
};

sendContextBtn.addEventListener('click', () => {
  const contextValue = contextInput.value;
  const contextType = contextTypeSelect.value;
  if (contextValue) {
    sendContext({
      type: contextType,
      value: contextValue
    });
  }
});

clearContextBtn.addEventListener('click', () => {
  sendContext(null);
  contextInput.value = '';
});