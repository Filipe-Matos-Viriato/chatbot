// Vercel serverless function wrapper for the database-backed service
const { createApp } = require('../packages/backend/src/index.js');

let app;

module.exports = async (req, res) => {
  try {
    // Add debugging for all requests
    console.log('🔍 DATABASE FUNCTION HIT:');
    console.log('  URL:', req.url);
    console.log('  Method:', req.method);
    console.log('  Headers:', JSON.stringify(req.headers, null, 2));
    
    // Check if this is a widget static file request that shouldn't be here
    // Allow /api/v1/widget/config/* but block static widget files like /widget/loader.js
    console.log('🔍 Widget URL check:', {
      url: req.url,
      includesWidget: req.url && req.url.includes('/widget/'),
      includesWidgetConfig: req.url && req.url.includes('/api/v1/widget/config/'),
      shouldBlock: req.url && req.url.includes('/widget/') && !req.url.includes('/api/v1/widget/config/')
    });
    
    if (req.url && req.url.includes('/widget/') && !req.url.includes('/api/v1/widget/config/')) {
      console.error('❌ WIDGET FILE REQUEST HITTING DATABASE FUNCTION!');
      console.error('  This should be served statically, not by this function');
      console.error('  URL:', req.url);
      return res.status(500).json({ 
        error: 'Widget file incorrectly routed to database function',
        url: req.url,
        debug: 'This should be served as static file'
      });
    }
    
    // Initialize the app if not already done (singleton pattern for performance)
    if (!app) {
      console.log('🚀 Initializing database-backed service...');
      app = createApp();
      console.log('✅ Database-backed service initialized successfully');
    }
    
    console.log('📡 Forwarding request to Express app...');
    
    // Handle the request using the database-backed Express app
    app(req, res);
  } catch (error) {
    console.error('💥 Error in database backend function:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};