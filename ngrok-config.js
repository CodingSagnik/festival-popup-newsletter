/**
 * 🔧 SERVER CONFIGURATION - UPDATE ONLY THIS FILE!
 * 
 * When your server URL changes, just update the NGROK_URL below.
 * All other files will automatically use this configuration.
 */

const NGROK_CONFIG = {
  // 🚨 UPDATE THIS WHEN YOUR DEPLOYMENT URL CHANGES
  NGROK_URL: 'https://your-app-name.onrender.com', // Update after Render deployment
  
  // Derived URLs (automatically calculated)
  get API_URL() {
    return `${this.NGROK_URL}/api`;
  },
  
  get AUTH_CALLBACK() {
    return `${this.NGROK_URL}/auth/callback`;
  },
  
  get API_AUTH_CALLBACK() {
    return `${this.NGROK_URL}/api/auth/callback`;
  }
};

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NGROK_CONFIG;
}

// Export for browser
if (typeof window !== 'undefined') {
  window.NGROK_CONFIG = NGROK_CONFIG;
}