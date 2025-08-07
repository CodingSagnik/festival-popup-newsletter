#!/usr/bin/env node

/**
 * 🚀 NGROK URL UPDATER SCRIPT
 * 
 * This script automatically updates all files with the ngrok URL from ngrok-config.js
 * 
 * Usage:
 * 1. Update NGROK_URL in ngrok-config.js
 * 2. Run: node update-ngrok.js
 * 3. All files will be automatically updated!
 */

const fs = require('fs');
const path = require('path');

// Import the ngrok configuration
const NGROK_CONFIG = require('./ngrok-config.js');

console.log('🔧 Updating ngrok URLs...');
console.log(`📡 New ngrok URL: ${NGROK_CONFIG.NGROK_URL}`);

// Files to update with their patterns
const filesToUpdate = [
  {
    file: '.env',
    pattern: /SHOPIFY_APP_URL=https:\/\/[^\/\s]+/,
    replacement: `SHOPIFY_APP_URL=${NGROK_CONFIG.NGROK_URL}`
  },
  {
    file: '.env.shopify',
    pattern: /SHOPIFY_APP_URL=https:\/\/[^\/\s]+/,
    replacement: `SHOPIFY_APP_URL=${NGROK_CONFIG.NGROK_URL}`
  },
  {
    file: 'festival-newsletter-popup/shopify.app.toml',
    pattern: /application_url = "https:\/\/[^"]+"/,
    replacement: `application_url = "${NGROK_CONFIG.NGROK_URL}"`
  },
  {
    file: 'festival-newsletter-popup/shopify.app.toml',
    pattern: /"https:\/\/[^"]+\/auth\/callback"/g,
    replacement: `"${NGROK_CONFIG.AUTH_CALLBACK}"`
  },
  {
    file: 'festival-newsletter-popup/shopify.app.toml',
    pattern: /"https:\/\/[^"]+\/api\/auth\/callback"/g,
    replacement: `"${NGROK_CONFIG.API_AUTH_CALLBACK}"`
  },
  {
    file: 'festival-newsletter-popup/extensions/newsletter-popup/assets/shopify-app-settings-fix.js',
    pattern: /'https:\/\/[^']+\/api'/g,
    replacement: `'${NGROK_CONFIG.API_URL}'`
  },
  {
    file: 'admin/shopify-embedded.html',
    pattern: /: 'https:\/\/[^']+\/api'/,
    replacement: `: '${NGROK_CONFIG.API_URL}'`
  }
];

let updatedCount = 0;

filesToUpdate.forEach(({ file, pattern, replacement }) => {
  try {
    if (fs.existsSync(file)) {
      let content = fs.readFileSync(file, 'utf8');
      const originalContent = content;
      
      content = content.replace(pattern, replacement);
      
      if (content !== originalContent) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`✅ Updated: ${file}`);
        updatedCount++;
      } else {
        console.log(`⚠️  No changes needed: ${file}`);
      }
    } else {
      console.log(`❌ File not found: ${file}`);
    }
  } catch (error) {
    console.error(`❌ Error updating ${file}:`, error.message);
  }
});

console.log(`\n🎉 Update complete! ${updatedCount} files updated.`);
console.log('\n📋 Next steps:');
console.log('1. Restart your Shopify CLI: shopify app dev --tunnel-url=' + NGROK_CONFIG.NGROK_URL + ':443');
console.log('2. Restart your Node.js server: node server.js');
console.log('3. Clear browser cache (Ctrl+Shift+R)');