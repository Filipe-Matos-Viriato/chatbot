// Vercel serverless function wrapper for the database-backed service

let app;

// Asynchronous initializer for the Express app
async function initializeApp() {
    if (app) {
        return app;
    }
    console.log('🚀 Initializing database-backed service...');
    // Use dynamic import() for ES Module compatibility
    const { createApp } = await import('../packages/backend/src/index.js');
    app = createApp();
    console.log('✅ Database-backed service initialized successfully');
    return app;
}

module.exports = async (req, res) => {
  try {
    // Add debugging for all requests
    console.log('🔍 DATABASE FUNCTION HIT:');
    console.log('  URL:', req.url);
    console.log('  Method:', req.method);
    // Note: Logging all headers can be very verbose.
    // console.log('  Headers:', JSON.stringify(req.headers, null, 2));
    
    // Check if this is a widget static file request that shouldn't be here
    // Allow /api/v1/widget/config/* but block static widget files like /widget/loader.js
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
    
    // Ensure the app is initialized before handling requests
    const expressApp = await initializeApp();
    
    console.log('📡 Forwarding request to Express app...');
    
    // Handle the request using the database-backed Express app
    expressApp(req, res);
  } catch (error) {
    console.error('💥 Error in database backend function:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};
