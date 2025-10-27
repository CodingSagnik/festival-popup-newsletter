# ⚡ QUICK SETUP GUIDE - Get Permanent Data Storage in 5 Minutes

## 🎯 **What You Need To Do**

Your subscriber data **WILL RESET** until you complete these steps:

### Step 1: Create Shopify Custom App (2 minutes)

1. Go to: `https://test-festival-popup.myshopify.com/admin/settings/apps`
2. Click "Develop apps" (at the bottom)
3. Click "Create an app"
4. Name: `Festival Newsletter Data`
5. Click "Create app"

### Step 2: Add Metafields Permissions (1 minute)

1. Click "Configure Admin API scopes"
2. Search and enable:
   - ✅ `read_metafields`
   - ✅ `write_metafields`
3. Click "Save"

### Step 3: Install & Get Token (1 minute)

1. Click "Install app"
2. Click "Reveal token once"
3. **COPY THE TOKEN** (you can only see it once!)
   - It looks like: `shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### Step 4: Add to Render (1 minute)

1. Go to: https://dashboard.render.com
2. Find your service: `festival-popup-newsletter`
3. Click "Environment"
4. Click "Add Environment Variable"
5. Key: `SHOPIFY_ACCESS_TOKEN`
6. Value: Paste your token from Step 3
7. Click "Save Changes"
8. Render will automatically restart

### Step 5: Test It Works (30 seconds)

1. Visit your store
2. Sign up with a test email
3. Go to Shopify app → "Signed up users"
4. You should see: `✅ SHOPIFY DB: Saved newsletter_subscribers`
5. **Wait 5 minutes, refresh page**
6. ✅ Data still there? SUCCESS!

---

## 🔍 **How To Know If It's Working**

### Check Render Logs:

**✅ WORKING** (Token configured):
```
✅ SHOPIFY DB: Saved newsletter_subscribers for test-festival-popup.myshopify.com permanently!
```

**❌ NOT WORKING** (Token missing):
```
⚠️ No access token for test-festival-popup.myshopify.com, using file storage
📁 File backup: Saved newsletter_subscribers
```

If you see the second message, token is not configured correctly!

---

## 📊 **What Changed**

| Before | After |
|--------|-------|
| Data in local files | Data in Shopify DB |
| Resets on every restart | **Never resets** ✅ |
| Needs Render disk | No disk needed |
| Lost forever if server crashes | Always safe in Shopify |

---

## ⚠️ **IMPORTANT**

**Until you add the token to Render:**
- ⚠️ Data will still reset on server restart
- ⚠️ File-based fallback is temporary
- ⚠️ Subscribers will be lost

**After you add the token:**
- ✅ Data persists forever
- ✅ No more resets
- ✅ Safe in Shopify's database

---

## 🚀 **All Set!**

Once you complete these 5 steps, your subscriber data will **NEVER** reset again!

**Questions?** Check:
- `SHOPIFY_METAFIELDS_SETUP.md` - Full detailed guide
- `DATA_PERSISTENCE_FIX.md` - Technical explanation

---

**Estimated Time**: 5 minutes  
**Difficulty**: Easy  
**Result**: Permanent data storage! 🎉

