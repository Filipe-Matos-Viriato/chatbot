const fs = require('fs-extra');
const path = require('path');

async function copyWidget() {
  const sourceDir = path.join(__dirname, 'packages/widget/dist');
  const targetDir = path.join(__dirname, 'packages/frontend/public/widget');
  
  try {
    // Ensure target directory exists
    await fs.ensureDir(targetDir);
    
    // Copy widget files
    await fs.copy(sourceDir, targetDir);
    
    console.log('✅ Widget files copied successfully');
    console.log(`📁 Source: ${sourceDir}`);
    console.log(`📁 Target: ${targetDir}`);
  } catch (error) {
    console.error('❌ Error copying widget files:', error);
    process.exit(1);
  }
}

copyWidget(); 