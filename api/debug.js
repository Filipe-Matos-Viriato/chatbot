// Debug endpoint to help understand routing and deployment
module.exports = async (req, res) => {
  console.log('🔧 DEBUG ENDPOINT HIT');
  console.log('  URL:', req.url);
  console.log('  Method:', req.method);
  
  try {
    const fs = require('fs');
    const path = require('path');
    
    // Try to find widget files in the deployment
    const possiblePaths = [
      '/var/task/packages/frontend/dist/widget',
      '/var/task/dist/widget',
      '/vercel/path0/packages/frontend/dist/widget',
      process.cwd() + '/packages/frontend/dist/widget',
      process.cwd() + '/dist/widget'
    ];
    
    let widgetInfo = { found: false, paths: [] };
    
    for (const checkPath of possiblePaths) {
      try {
        if (fs.existsSync(checkPath)) {
          const files = fs.readdirSync(checkPath);
          widgetInfo.found = true;
          widgetInfo.paths.push({
            path: checkPath,
            files: files
          });
        }
      } catch (e) {
        // Ignore errors
      }
    }
    
    const debugInfo = {
      timestamp: new Date().toISOString(),
      deployment: {
        cwd: process.cwd(),
        env: process.env.VERCEL_ENV || 'unknown',
        region: process.env.VERCEL_REGION || 'unknown'
      },
      request: {
        url: req.url,
        method: req.method,
        headers: req.headers
      },
      widget: widgetInfo,
      vercelConfig: {
        message: 'Check if routing is working correctly',
        expectedBehavior: {
          '/api/debug': 'Should hit this function',
          '/api/database-backend': 'Should hit database function', 
          '/widget/loader.js': 'Should serve static file'
        }
      }
    };
    
    res.status(200).json(debugInfo);
    
  } catch (error) {
    console.error('Debug endpoint error:', error);
    res.status(500).json({ 
      error: 'Debug endpoint failed',
      details: error.message 
    });
  }
};