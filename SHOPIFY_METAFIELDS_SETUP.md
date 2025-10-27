# 🔧 Shopify Metafields Setup - PERMANENT Data Storage

## ❌ **The Problem**

**Why data was resetting:**
- The old system used **file-based storage** in `data/shops/` folder
- Render's ephemeral filesystem **wipes files on every server restart**
- This caused all subscriber data to disappear when the server restarted
- **You lost all your signed-up users every time!**

## ✅ **The Solution**

**New implementation uses REAL Shopify Metafields:**
- Data stored in **Shopify's database** permanently
- Survives server restarts, deployments, crashes
- **No Render disks needed** - data lives in Shopify!
- File storage only used as backup during development

## 🔑 **Setup Required: Shopify Access Token**

To use Shopify's database, you need a **Shopify Access Token**. Here's how to get one:

### Option 1: Custom App (Recommended for Development)

1. **Go to Shopify Admin**:
   - Navigate to: `https://[your-shop].myshopify.com/admin/settings/apps`
   - Click "Develop apps" (at the bottom)

2. **Create Custom App**:
   - Click "Create an app"
   - App name: `Festival Newsletter Popup`
   - Click "Create app"

3. **Configure API Scopes**:
   - Click "Configure Admin API scopes"
   - Enable these scopes:
     - ✅ `read_metafields`
     - ✅ `write_metafields`
   - Click "Save"

4. **Install App & Get Token**:
   - Click "Install app"
   - Confirm the installation
   - Click "Reveal token once" to see your **Admin API access token**
   - **Copy this token immediately** (you can only see it once!)

5. **Add to Environment Variables**:
   ```bash
   SHOPIFY_ACCESS_TOKEN=shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

### Option 2: Production OAuth Flow

For production apps installed by merchants:
- Access tokens are obtained during OAuth installation
- Tokens are stored in `shopifyAuth.js` (currently in-memory)
- **Recommendation**: Store tokens in a persistent database for production

## 📝 **Adding Token to Your Environment**

### For Local Development:

Create/update your `.env` file:
```bash
# Shopify Access Token (REQUIRED!)
SHOPIFY_ACCESS_TOKEN=shpat_your_actual_token_here
```

### For Render Production:

1. Go to your Render dashboard
2. Navigate to your web service
3. Click "Environment"
4. Add environment variable:
   - Key: `SHOPIFY_ACCESS_TOKEN`
   - Value: `shpat_your_actual_token_here`
5. Click "Save Changes"
6. Render will automatically restart with the new token

## 🧪 **Testing Data Persistence**

Follow these steps to verify data persists:

### 1. Add a Subscriber

Visit your store and sign up for the newsletter with a test email.

### 2. Check Shopify Admin

Look for these logs in your server:
```
✅ SHOPIFY DB: Saved newsletter_subscribers for [shop].myshopify.com permanently!
```

### 3. Restart Server (The Real Test!)

**On Render:**
- Go to Render Dashboard → Your Service → Manual Deploy → "Clear build cache & deploy"
- OR just wait for the server to auto-restart

**Locally:**
- Stop server (Ctrl+C)
- Start server again (`npm start`)

### 4. Check Admin Panel

Go to Shopify app settings → "Signed up users"

**✅ SUCCESS**: Your subscriber data is still there!  
**❌ FAIL**: Data disappeared (token not configured)

## 📊 **How It Works Now**

### With Access Token (Production):
```
User Signs Up
    ↓
Server receives request
    ↓
Saves to Shopify Metafields API ← PERMANENT STORAGE! ✅
    ↓
Also saves to file as backup
    ↓
Server restarts
    ↓
Data retrieved from Shopify ← Still there! ✅
```

### Without Access Token (Development Fallback):
```
User Signs Up
    ↓
Server receives request
    ↓
Saves to file storage (data/shops/)
    ↓
Server restarts
    ↓
Data lost! ❌ (ephemeral storage)
```

## 🔍 **Verify Token is Working**

Check your server logs for these messages:

**✅ Token Working:**
```
✅ SHOPIFY DB: Saved newsletter_subscribers for shop.myshopify.com permanently!
✅ SHOPIFY DB: Retrieved newsletter_subscribers for shop.myshopify.com
```

**⚠️ Token Missing:**
```
⚠️ No access token for shop.myshopify.com, using file storage
📁 File backup: Saved newsletter_subscribers for shop.myshopify.com
```

## 🎯 **What Changed in Code**

### Before (File-Based - EPHEMERAL):
```javascript
class ShopifyMetafieldsDB {
  async getMetafield(shopDomain, key) {
    const filePath = path.join('data/shops', `${shopDomain}_${key}.json`);
    const data = await fs.readFile(filePath);  // ❌ Temporary!
    return JSON.parse(data);
  }
}
```

### After (Shopify API - PERMANENT):
```javascript
class ShopifyMetafieldsDB {
  async getMetafield(shopDomain, key) {
    const accessToken = shopifyAuth.getAccessToken(shopDomain);
    const response = await axios.get(
      `https://${shopDomain}/admin/api/2024-01/metafields.json`,
      {
        headers: { 'X-Shopify-Access-Token': accessToken },
        params: { namespace: 'festival_popup', key: key }
      }
    );
    return JSON.parse(response.data.metafields[0].value);  // ✅ Permanent!
  }
}
```

## 🚀 **Next Steps**

1. ✅ Create Shopify custom app
2. ✅ Get access token
3. ✅ Add `SHOPIFY_ACCESS_TOKEN` to Render environment
4. ✅ Restart server
5. ✅ Test signup
6. ✅ Restart server again
7. ✅ Verify data persists!

## ⚠️ **Important Notes**

- **Token Security**: Keep your access token secret! Never commit it to Git.
- **Scopes Required**: `read_metafields` and `write_metafields` are mandatory
- **Fallback**: If token is missing, system falls back to file storage (data will reset)
- **Production**: Consider using a proper database for access token storage instead of in-memory

## 📞 **Troubleshooting**

### Data Still Resetting?

Check these:
1. Is `SHOPIFY_ACCESS_TOKEN` set in Render environment? ✓
2. Does the token have `read_metafields` and `write_metafields` scopes? ✓
3. Are you seeing "✅ SHOPIFY DB" messages in logs? ✓
4. Is the custom app installed on your shop? ✓

### API Errors?

If you see `❌ Error saving to Shopify`:
- Check token is valid and not expired
- Verify scopes are correct
- Ensure custom app is still installed
- Check Shopify API rate limits

---

**Summary**: With Shopify access token configured, your subscriber data will **NEVER** reset again! 🎉

