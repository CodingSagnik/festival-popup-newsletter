const fs = require('fs').promises;
const path = require('path');

/**
 * Shopify-Compatible Database Replacement
 * Drop-in replacement for MongoDB operations using file-based storage
 * Maintains exact same data structure and API compatibility
 * No special Shopify permissions required!
 */

class ShopifyMetafieldsDB {
  constructor() {
    this.namespace = 'festival_popup';
    this.dataDir = path.join(process.cwd(), 'data', 'shops');
    this.ensureDataDir();
  }

  /**
   * Ensure data directory exists
   */
  async ensureDataDir() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch (error) {
      // Directory might already exist, ignore error
    }
  }

  /**
   * Get file path for shop data
   */
  getShopDataPath(shopDomain, key) {
    const safeShopDomain = shopDomain.replace(/[^a-zA-Z0-9.-]/g, '_');
    return path.join(this.dataDir, `${safeShopDomain}_${key}.json`);
  }

  /**
   * Get metafield by key (file-based storage)
   */
  async getMetafield(shopDomain, key) {
    try {
      const filePath = this.getShopDataPath(shopDomain, key);
      
      try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
      } catch (readError) {
        if (readError.code === 'ENOENT') {
          // File doesn't exist, return null
          return null;
        }
        throw readError;
      }
    } catch (error) {
      console.error(`Error getting metafield ${key} for ${shopDomain}:`, error.message);
      return null;
    }
  }

  /**
   * Set metafield value (file-based storage)
   */
  async setMetafield(shopDomain, key, value, type = 'json') {
    try {
      await this.ensureDataDir();
      const filePath = this.getShopDataPath(shopDomain, key);
      
      await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf8');
      
      return {
        namespace: this.namespace,
        key: key,
        value: JSON.stringify(value),
        type: type
      };
    } catch (error) {
      console.error(`Error setting metafield ${key} for ${shopDomain}:`, error.message);
      throw error;
    }
  }

  /**
   * Update existing metafield (file-based storage)
   */
  async updateMetafield(shopDomain, key, value) {
    try {
      // For file-based storage, update is the same as set
      return await this.setMetafield(shopDomain, key, value);
    } catch (error) {
      console.error(`Error updating metafield ${key} for ${shopDomain}:`, error.message);
      throw error;
    }
  }

  /**
   * Delete metafield (file-based storage)
   */
  async deleteMetafield(shopDomain, key) {
    try {
      const filePath = this.getShopDataPath(shopDomain, key);
      
      try {
        await fs.unlink(filePath);
        return true;
      } catch (deleteError) {
        if (deleteError.code === 'ENOENT') {
          // File doesn't exist, consider it already deleted
          return true;
        }
        throw deleteError;
      }
    } catch (error) {
      console.error(`Error deleting metafield ${key} for ${shopDomain}:`, error.message);
      throw error;
    }
  }

  /**
   * Get all metafields for a shop (file-based storage)
   */
  async getAllMetafields(shopDomain) {
    try {
      await this.ensureDataDir();
      const safeShopDomain = shopDomain.replace(/[^a-zA-Z0-9.-]/g, '_');
      const files = await fs.readdir(this.dataDir);
      
      const metafields = {};
      const shopFiles = files.filter(file => file.startsWith(`${safeShopDomain}_`) && file.endsWith('.json'));
      
      for (const file of shopFiles) {
        const key = file.replace(`${safeShopDomain}_`, '').replace('.json', '');
        const filePath = path.join(this.dataDir, file);
        
        try {
          const data = await fs.readFile(filePath, 'utf8');
          metafields[key] = JSON.parse(data);
        } catch (readError) {
          console.error(`Error reading file ${file}:`, readError.message);
        }
      }
      
      return metafields;
    } catch (error) {
      console.error(`Error getting all metafields for ${shopDomain}:`, error.message);
      return {};
    }
  }
}

/**
 * MongoDB-Compatible Data Models using Shopify Metafields
 * These classes provide the exact same interface as the original Mongoose models
 */

class PopupSettings {
  constructor(data = {}) {
    this.shopDomain = data.shopDomain;
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.festivals = data.festivals || [];
    this.displaySettings = data.displaySettings || {
      showDelay: 3000,
      displayFrequency: 'once_per_session',
      position: 'center'
    };
    this.blogPopupSettings = data.blogPopupSettings || {
      enabled: false,
      delay: 3000,
      frequency: 'once_per_session',
      titlePrefix: 'DO YOU WANNA STAY UP TO DATE REGARDING'
    };
  }

  static async findOne(query) {
    const db = new ShopifyMetafieldsDB();
    const shopDomain = query.shopDomain;
    
    if (!shopDomain) {
      return null;
    }

    const data = await db.getMetafield(shopDomain, 'popup_settings');
    if (data) {
      return new PopupSettings({ shopDomain, ...data });
    }
    
    return null;
  }

  static async findOneAndUpdate(query, updateData, options = {}) {
    const db = new ShopifyMetafieldsDB();
    const shopDomain = query.shopDomain;
    
    if (!shopDomain) {
      throw new Error('shopDomain is required');
    }

    // Get existing data
    let existingData = await db.getMetafield(shopDomain, 'popup_settings');
    
    if (!existingData && options.upsert) {
      // Create new document
      existingData = {
        isActive: true,
        festivals: [],
        displaySettings: {
          showDelay: 3000,
          displayFrequency: 'once_per_session',
          position: 'center'
        },
        blogPopupSettings: {
          enabled: false,
          delay: 3000,
          frequency: 'once_per_session',
          titlePrefix: 'DO YOU WANNA STAY UP TO DATE REGARDING'
        }
      };
    }

    if (!existingData) {
      return null;
    }

    // Merge update data
    const mergedData = { ...existingData, ...updateData };
    
    // Save updated data
    await db.updateMetafield(shopDomain, 'popup_settings', mergedData);
    
    return new PopupSettings({ shopDomain, ...mergedData });
  }

  async save() {
    const db = new ShopifyMetafieldsDB();
    const dataToSave = {
      isActive: this.isActive,
      festivals: this.festivals,
      displaySettings: this.displaySettings,
      blogPopupSettings: this.blogPopupSettings
    };
    
    await db.updateMetafield(this.shopDomain, 'popup_settings', dataToSave);
    return this;
  }

  toObject() {
    return {
      shopDomain: this.shopDomain,
      isActive: this.isActive,
      festivals: this.festivals,
      displaySettings: this.displaySettings,
      blogPopupSettings: this.blogPopupSettings
    };
  }

  // MongoDB-compatible static methods
  static async countDocuments(query) {
    const settings = await this.find(query);
    return settings.length;
  }

  static async count(query) {
    return await this.countDocuments(query);
  }

  static async find(query) {
    const shopDomain = query.shopDomain;
    if (!shopDomain) {
      return [];
    }

    const settings = await this.findOne(query);
    return settings ? [settings] : [];
  }
}

class NewsletterSubscriber {
  constructor(data = {}) {
    this.email = data.email;
    this.shopDomain = data.shopDomain;
    this.subscribedAt = data.subscribedAt || new Date();
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.subscriptionType = data.subscriptionType || 'festival';
    this.preferences = data.preferences || {
      festivals: false,
      offers: false,
      blogUpdates: false
    };
  }

  static async find(query) {
    const db = new ShopifyMetafieldsDB();
    const shopDomain = query.shopDomain;
    
    if (!shopDomain) {
      return [];
    }

    const data = await db.getMetafield(shopDomain, 'newsletter_subscribers');
    if (!data || !Array.isArray(data)) {
      return [];
    }

    // Filter based on query
    let filteredData = data;
    
    if (query.isActive !== undefined) {
      filteredData = filteredData.filter(sub => sub.isActive === query.isActive);
    }
    
    if (query.subscriptionType) {
      filteredData = filteredData.filter(sub => sub.subscriptionType === query.subscriptionType);
    }

    if (query['preferences.blogUpdates']) {
      filteredData = filteredData.filter(sub => sub.preferences && sub.preferences.blogUpdates === query['preferences.blogUpdates']);
    }

    if (query['preferences.festivals']) {
      filteredData = filteredData.filter(sub => sub.preferences && sub.preferences.festivals === query['preferences.festivals']);
    }

    return filteredData.map(subData => new NewsletterSubscriber(subData));
  }

  static async findOne(query) {
    const subscribers = await this.find(query);
    return subscribers.length > 0 ? subscribers[0] : null;
  }

  async save() {
    const db = new ShopifyMetafieldsDB();
    
    // Get existing subscribers
    let subscribers = await db.getMetafield(this.shopDomain, 'newsletter_subscribers') || [];
    
    // Check for duplicates (same email, shopDomain, and subscriptionType)
    const existingIndex = subscribers.findIndex(sub => 
      sub.email === this.email && 
      sub.shopDomain === this.shopDomain && 
      sub.subscriptionType === this.subscriptionType
    );

    const subscriberData = {
      email: this.email,
      shopDomain: this.shopDomain,
      subscribedAt: this.subscribedAt,
      isActive: this.isActive,
      subscriptionType: this.subscriptionType,
      preferences: this.preferences
    };

    if (existingIndex >= 0) {
      // Update existing subscriber
      subscribers[existingIndex] = subscriberData;
    } else {
      // Add new subscriber
      subscribers.push(subscriberData);
    }

    // Save updated subscribers list
    await db.updateMetafield(this.shopDomain, 'newsletter_subscribers', subscribers);
    
    return this;
  }

  // MongoDB-compatible static methods
  static async countDocuments(query) {
    const subscribers = await this.find(query);
    return subscribers.length;
  }

  static async count(query) {
    return await this.countDocuments(query);
  }
}

class BlogPost {
  constructor(data = {}) {
    this.shopDomain = data.shopDomain;
    this.title = data.title;
    this.content = data.content;
    this.dynamicTitle = data.dynamicTitle;
    this.publishedAt = data.publishedAt || new Date();
    this.tags = data.tags || [];
    this.sentNewsletter = data.sentNewsletter || false;
  }

  static async find(query) {
    const db = new ShopifyMetafieldsDB();
    const shopDomain = query.shopDomain;
    
    if (!shopDomain) {
      return [];
    }

    const data = await db.getMetafield(shopDomain, 'blog_posts');
    if (!data || !Array.isArray(data)) {
      return [];
    }

    const results = data.map(postData => new BlogPost(postData));
    
    // Add MongoDB-compatible methods to the results array
    results.sort = function(sortObj) {
      if (sortObj.publishedAt === -1) {
        return Array.prototype.sort.call(this, (a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
      } else if (sortObj.publishedAt === 1) {
        return Array.prototype.sort.call(this, (a, b) => new Date(a.publishedAt) - new Date(b.publishedAt));
      }
      return this;
    };
    
    results.limit = function(num) {
      return this.slice(0, num);
    };
    
    return results;
  }

  async save() {
    const db = new ShopifyMetafieldsDB();
    
    // Get existing blog posts
    let blogPosts = await db.getMetafield(this.shopDomain, 'blog_posts') || [];
    
    const postData = {
      shopDomain: this.shopDomain,
      title: this.title,
      content: this.content,
      dynamicTitle: this.dynamicTitle,
      publishedAt: this.publishedAt,
      tags: this.tags,
      sentNewsletter: this.sentNewsletter
    };

    // Add new blog post
    blogPosts.push(postData);

    // Save updated blog posts list
    await db.updateMetafield(this.shopDomain, 'blog_posts', blogPosts);
    
    return this;
  }

  // MongoDB-compatible static methods
  static async countDocuments(query) {
    const blogPosts = await this.find(query);
    return blogPosts.length;
  }

  static async count(query) {
    return await this.countDocuments(query);
  }
}

class ShopSettings {
  constructor(data = {}) {
    this.shop = data.shop;
    this.emailSettings = data.emailSettings || {
      enabled: false,
      provider: 'gmail',
      fromEmail: '',
      fromName: '',
      smtpHost: '',
      smtpPort: 587,
      secure: true,
      encryptedPassword: ''
    };
    this.festivalSettings = data.festivalSettings || {
      autoGenerate: true,
      emailTemplate: {
        subject: '🎉 Special Festival Offer from {{storeName}}!',
        message: 'Celebrate {{festivalName}} with exclusive deals!'
      }
    };
    this.analytics = data.analytics || {
      emailsSent: 0
    };
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  static async findOne(query) {
    const db = new ShopifyMetafieldsDB();
    const shop = query.shop;
    
    if (!shop) {
      return null;
    }

    const data = await db.getMetafield(shop, 'shop_settings');
    if (data) {
      return new ShopSettings({ shop, ...data });
    }
    
    return null;
  }

  static async findOneAndUpdate(query, updateData, options = {}) {
    const db = new ShopifyMetafieldsDB();
    const shop = query.shop;
    
    if (!shop) {
      throw new Error('shop is required');
    }

    // Get existing data
    let existingData = await db.getMetafield(shop, 'shop_settings');
    
    if (!existingData && options.upsert) {
      // Create new document
      existingData = {
        emailSettings: {
          enabled: false,
          provider: 'gmail',
          fromEmail: '',
          fromName: '',
          smtpHost: '',
          smtpPort: 587,
          secure: true,
          encryptedPassword: ''
        },
        festivalSettings: {
          autoGenerate: true,
          emailTemplate: {
            subject: '🎉 Special Festival Offer from {{storeName}}!',
            message: 'Celebrate {{festivalName}} with exclusive deals!'
          }
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }

    if (!existingData) {
      return null;
    }

    // Merge update data
    const mergedData = { ...existingData, ...updateData, updatedAt: new Date() };
    
    // Save updated data
    await db.updateMetafield(shop, 'shop_settings', mergedData);
    
    return new ShopSettings({ shop, ...mergedData });
  }

  static async getShopSettings(shop) {
    let settings = await this.findOne({ shop });
    
    if (!settings) {
      // Create default settings for new shop
      settings = new ShopSettings({ shop });
      await settings.save();
    }
    
    return settings;
  }

  static async updateEmailSettings(shop, emailData) {
    const { fromEmail, fromName, password, provider = 'gmail', smtpHost, smtpPort, secure = true } = emailData;
    
    // For Mailjet, password is optional since we use app-level API keys
    if (!fromEmail || !fromName) {
      throw new Error('Email and name are required');
    }
    
    // Password is required for SMTP providers but optional for HTTP API providers like Mailjet
    if (provider !== 'mailjet' && !password) {
      throw new Error('Password is required for this email provider');
    }
    
    try {
      // Import encryption utility
      const { encrypt } = require('./encryption');
      
      // Encrypt the password (if provided)
      const encryptedPassword = password ? encrypt(password) : '';
      
      const updateData = {
        shop,
        emailSettings: {
          enabled: true,
          provider,
          fromEmail,
          fromName,
          encryptedPassword,
          secure
        }
      };
      
      // Add SMTP settings for custom provider
      if (provider === 'custom') {
        if (!smtpHost || !smtpPort) {
          throw new Error('SMTP host and port are required for custom provider');
        }
        updateData.emailSettings.smtpHost = smtpHost;
        updateData.emailSettings.smtpPort = smtpPort;
      }
      
      const result = await this.findOneAndUpdate(
        { shop },
        updateData,
        { upsert: true, new: true }
      );
      
      return result;
    } catch (error) {
      console.error('Failed to update email settings:', error);
      throw error;
    }
  }

  async save() {
    const db = new ShopifyMetafieldsDB();
    const dataToSave = {
      emailSettings: this.emailSettings,
      festivalSettings: this.festivalSettings,
      analytics: this.analytics,
      createdAt: this.createdAt,
      updatedAt: new Date()
    };
    
    await db.updateMetafield(this.shop, 'shop_settings', dataToSave);
    return this;
  }

  // Helper methods (same as original)
  getSmtpConfig() {
    const configs = {
      mailjet: {
        // Mailjet uses HTTP API, not SMTP, but we include this for consistency
        host: 'in-v3.mailjet.com',
        port: 587,
        secure: false,
        connectionTimeout: 60000,
        greetingTimeout: 30000,
        socketTimeout: 60000,
        isHttpApi: true // Flag to indicate this uses HTTP API
      },
      gmail: {
        host: 'smtp.gmail.com',
        port: 465, // Use SSL port for better cloud compatibility
        secure: true, // Use SSL
        connectionTimeout: 60000,
        greetingTimeout: 30000,
        socketTimeout: 60000
      },
      outlook: {
        host: 'smtp-mail.outlook.com',
        port: 587,
        secure: false,
        connectionTimeout: 60000,
        greetingTimeout: 30000,
        socketTimeout: 60000
      },
      yahoo: {
        host: 'smtp.mail.yahoo.com',
        port: 587,
        secure: false,
        connectionTimeout: 60000,
        greetingTimeout: 30000,
        socketTimeout: 60000
      },
      custom: {
        host: this.emailSettings.smtpHost,
        port: this.emailSettings.smtpPort,
        secure: this.emailSettings.secure,
        connectionTimeout: 60000,
        greetingTimeout: 30000,
        socketTimeout: 60000
      }
    };
    
    return configs[this.emailSettings.provider] || configs.gmail;
  }

  getEmailCredentials() {
    if (!this.emailSettings.enabled) {
      return null;
    }
    
    // For Mailjet, we don't need encrypted password since we use app-level API keys
    if (this.emailSettings.provider === 'mailjet') {
      return {
        user: this.emailSettings.fromEmail,
        pass: 'mailjet-app-level' // Placeholder - actual API keys are in environment
      };
    }
    
    // For other providers, decrypt the password
    if (!this.emailSettings.encryptedPassword) {
      return null;
    }
    
    try {
      const { decrypt } = require('./encryption');
      const decryptedPassword = decrypt(this.emailSettings.encryptedPassword);
      return {
        user: this.emailSettings.fromEmail,
        pass: decryptedPassword
      };
    } catch (error) {
      console.error('Failed to decrypt email credentials for shop:', this.shop);
      return null;
    }
  }
}

module.exports = {
  ShopifyMetafieldsDB,
  PopupSettings,
  NewsletterSubscriber,
  BlogPost,
  ShopSettings
};