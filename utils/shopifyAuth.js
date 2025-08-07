/**
 * Shopify Authentication and Access Token Management
 * Handles access tokens for Shopify API calls
 */

class ShopifyAuth {
  constructor() {
    // In-memory token storage for development
    // In production, this would be stored in a secure database
    this.accessTokens = new Map();
    
    // Default tokens for development/testing
    this.defaultTokens = {
      'test-festival-popup.myshopify.com': process.env.DEV_ACCESS_TOKEN || process.env.SHOPIFY_ACCESS_TOKEN,
      'your-shop.myshopify.com': process.env.DEV_ACCESS_TOKEN || process.env.SHOPIFY_ACCESS_TOKEN,
      'test-shop.myshopify.com': process.env.DEV_ACCESS_TOKEN || process.env.SHOPIFY_ACCESS_TOKEN
    };
  }

  /**
   * Get access token for a shop
   */
  getAccessToken(shopDomain) {
    // Check in-memory storage first
    if (this.accessTokens.has(shopDomain)) {
      return this.accessTokens.get(shopDomain);
    }
    
    // Check default tokens
    if (this.defaultTokens[shopDomain]) {
      return this.defaultTokens[shopDomain];
    }
    
    // Fallback to environment variable
    return process.env.SHOPIFY_ACCESS_TOKEN || process.env.DEV_ACCESS_TOKEN;
  }

  /**
   * Set access token for a shop
   */
  setAccessToken(shopDomain, accessToken) {
    this.accessTokens.set(shopDomain, accessToken);
  }

  /**
   * Remove access token for a shop
   */
  removeAccessToken(shopDomain) {
    this.accessTokens.delete(shopDomain);
  }

  /**
   * Check if we have a valid access token for a shop
   */
  hasAccessToken(shopDomain) {
    return !!(this.getAccessToken(shopDomain));
  }

  /**
   * Validate access token by making a test API call
   */
  async validateAccessToken(shopDomain, accessToken) {
    try {
      const response = await fetch(`https://${shopDomain}/admin/api/2024-01/shop.json`, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        }
      });
      
      return response.ok;
    } catch (error) {
      console.error(`Failed to validate access token for ${shopDomain}:`, error);
      return false;
    }
  }

  /**
   * Get shop information using access token
   */
  async getShopInfo(shopDomain) {
    try {
      const accessToken = this.getAccessToken(shopDomain);
      if (!accessToken) {
        throw new Error(`No access token found for shop: ${shopDomain}`);
      }

      const response = await fetch(`https://${shopDomain}/admin/api/2024-01/shop.json`, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get shop info: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.shop;
    } catch (error) {
      console.error(`Failed to get shop info for ${shopDomain}:`, error);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new ShopifyAuth();