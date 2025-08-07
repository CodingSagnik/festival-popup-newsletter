# 🚀 Easy Ngrok URL Management

## 🎯 Problem Solved
No more updating 5+ files every time your ngrok URL changes!

## ✅ Simple Solution

### When your ngrok URL changes:

1. **Open `ngrok-config.js`**
2. **Update the `NGROK_URL`** (line 11):
   ```javascript
   NGROK_URL: 'https://YOUR-NEW-NGROK-URL.ngrok-free.app',
   ```
3. **Run the update script**:
   ```bash
   node update-ngrok.js
   ```
   Or double-click: `update-ngrok.bat`

4. **Restart your services**:
   ```bash
   # Restart Shopify CLI
   shopify app dev --tunnel-url=https://YOUR-NEW-NGROK-URL.ngrok-free.app:443
   
   # Restart Node.js server
   node server.js
   ```

## 📁 Files That Get Auto-Updated

The script automatically updates these files:
- ✅ `.env`
- ✅ `.env.shopify` 
- ✅ `festival-newsletter-popup/shopify.app.toml`
- ✅ `festival-newsletter-popup/extensions/newsletter-popup/assets/shopify-app-settings-fix.js`
- ✅ `admin/shopify-embedded.html`

## 🎉 That's It!

**Before**: Update 5 files manually 😫  
**After**: Update 1 file + run 1 command 🎯

---

### 💡 Pro Tip
You can also create a simple batch script to do everything at once:

```batch
@echo off
echo Updating ngrok URLs...
node update-ngrok.js
echo Starting Shopify CLI...
cd festival-newsletter-popup
shopify app dev --tunnel-url=https://YOUR-NGROK-URL.ngrok-free.app:443
```