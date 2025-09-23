// packages/frontend/src/App.jsx
// Defines the main App component that serves as the root of the React application, handling routing between the dashboard and chatbot interface.
// This file exists to provide the entry point for the React app, managing client context and navigation.
// packages/frontend/src/main.jsx, packages/frontend/src/dashboard/Dashboard.jsx, packages/frontend/src/chatbot/ChatInterface.jsx, packages/frontend/src/context/ClientContext.jsx

import ChatInterface from './chatbot/ChatInterface';
import './index.css';

function App() {
  return (
    <ChatInterface />
  );
}

export default App;