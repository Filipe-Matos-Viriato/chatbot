// Vercel serverless function wrapper for the database-backed service
const { createApp } = require('../packages/backend/src/index.js');

let app;

module.exports = async (req, res) => {
  try {
    // Initialize the app if not already done (singleton pattern for performance)
    if (!app) {
      console.log('Initializing database-backed service...');
      app = createApp();
      console.log('Database-backed service initialized successfully');
    }
    
    // Handle the request using the database-backed Express app
    app(req, res);
  } catch (error) {
    console.error('Error in database backend function:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};