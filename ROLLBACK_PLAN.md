# 🔄 Rollback Plan - MongoDB to Shopify Metafields Migration

## 🚨 Emergency Rollback Instructions

If you need to rollback from Shopify Metafields to MongoDB, follow these steps:

### **Step 1: Restore MongoDB Connection**

1. **Update .env file**:
   ```bash
   # Restore MongoDB configuration
   MONGODB_URI=mongodb+srv://apollo_admin:apollo-admin@cluster0.3cqvcm3.mongodb.net/festival-popup?retryWrites=true&w=majority&appName=Cluster0
   
   # Comment out Shopify database config
   # SHOPIFY_ACCESS_TOKEN=your_shop_access_token_here
   # DEV_ACCESS_TOKEN=your_dev_access_token_here
   ```

### **Step 2: Restore server.js**

1. **Restore MongoDB imports**:
   ```javascript
   // Restore this line
   const mongoose = require('mongoose');
   
   // Remove this line
   // const { ShopifyMetafieldsDB, PopupSettings, NewsletterSubscriber, BlogPost, ShopSettings } = require('./utils/shopifyMetafields');
   ```

2. **Restore MongoDB connection**:
   ```javascript
   // Restore MongoDB connection
   mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/festival-popup', {
     useNewUrlParser: true,
     useUnifiedTopology: true
   });
   ```

3. **Restore MongoDB schemas**:
   ```javascript
   // Restore all the original Mongoose schemas
   const PopupSettingsSchema = new mongoose.Schema({...});
   const NewsletterSubscriberSchema = new mongoose.Schema({...});
   const BlogPostSchema = new mongoose.Schema({...});
   
   const PopupSettings = mongoose.model('PopupSettings', PopupSettingsSchema);
   const NewsletterSubscriber = mongoose.model('NewsletterSubscriber', NewsletterSubscriberSchema);
   const BlogPost = mongoose.model('BlogPost', BlogPostSchema);
   const ShopSettings = require('./models/ShopSettings');
   ```

### **Step 3: Remove Shopify Metafields Files**

1. **Delete new files**:
   ```bash
   rm utils/shopifyMetafields.js
   rm utils/shopifyAuth.js
   rm migration-verification.js
   rm ROLLBACK_PLAN.md
   ```

2. **Restore original models/ShopSettings.js** if modified

### **Step 4: Remove New API Endpoints**

Remove these endpoints from server.js:
- `/health` (if modified)
- `/api/migration-status`
- `/api/shop-settings/*` (if they didn't exist before)
- `/api/newsletter/analytics/*` (if modified)
- `/api/app-embeds/*` (if they didn't exist before)

### **Step 5: Restart Services**

1. **Install MongoDB dependencies**:
   ```bash
   npm install mongoose
   ```

2. **Restart server**:
   ```bash
   node server.js
   ```

3. **Verify MongoDB connection**:
   - Check server logs for MongoDB connection success
   - Test admin panel functionality
   - Verify data retrieval

## 🔍 **Verification After Rollback**

### **Test Checklist**:
- [ ] Server starts without errors
- [ ] MongoDB connection established
- [ ] Admin panel loads correctly
- [ ] Festival creation works
- [ ] Newsletter subscription works
- [ ] Email settings functional
- [ ] All existing data accessible

### **Data Recovery**:
If you had data in Shopify Metafields that needs to be moved back to MongoDB:

1. **Export from Shopify Metafields** (before rollback):
   ```javascript
   // Run this script to export data
   const { ShopifyMetafieldsDB } = require('./utils/shopifyMetafields');
   const db = new ShopifyMetafieldsDB();
   
   async function exportData(shopDomain) {
     const popupSettings = await db.getMetafield(shopDomain, 'popup_settings');
     const subscribers = await db.getMetafield(shopDomain, 'newsletter_subscribers');
     const blogPosts = await db.getMetafield(shopDomain, 'blog_posts');
     const shopSettings = await db.getMetafield(shopDomain, 'shop_settings');
     
     console.log('Exported data:', { popupSettings, subscribers, blogPosts, shopSettings });
     // Save to files or import directly to MongoDB
   }
   ```

2. **Import to MongoDB** (after rollback):
   ```javascript
   // Use standard MongoDB operations to restore data
   ```

## 🚨 **Emergency Contacts**

If rollback fails:
1. Check server logs for specific errors
2. Verify all file changes were reverted
3. Ensure MongoDB service is running
4. Check network connectivity to MongoDB
5. Verify environment variables are correct

## 📋 **Rollback Verification**

After rollback, verify:
- [ ] All original functionality works
- [ ] No new errors in console
- [ ] Database operations successful
- [ ] Admin panel fully functional
- [ ] API endpoints responding correctly

## 🎯 **Prevention for Future**

To avoid needing rollbacks:
1. Always test in development first
2. Create database backups before migrations
3. Use feature flags for gradual rollouts
4. Monitor error rates after deployment
5. Have automated health checks

---

**Note**: This rollback plan assumes you have backups of your original MongoDB data. Always backup before major migrations!