# 🎪 Festival Popup - Quick Fix Reference

## ⚡ What Was Wrong?

Your festival popup wasn't showing because of **5 critical issues**:

1. ❌ **Block was hidden** - Had a metafield requirement that prevented it from appearing in theme customizer
2. ❌ **Session storage not checked** - Popup would show repeatedly even after closing
3. ❌ **No frequency control** - Couldn't control how often popup appears
4. ❌ **No session tracking** - Didn't remember if already shown
5. ❌ **Poor debugging** - Hard to figure out what was wrong

## ✅ What Was Fixed?

All issues are now resolved:

1. ✅ Block is always available in theme customizer
2. ✅ Session storage properly checked before showing
3. ✅ Three frequency options: Always, Once per session, Once per day
4. ✅ Proper tracking of when popup was shown
5. ✅ Comprehensive logging and debug tools

## 🚀 Quick Start (3 Steps)

### Step 1: Deploy to Shopify
```bash
cd festival-newsletter-popup
npm run deploy
```

### Step 2: Enable in Theme
1. Shopify Admin → Themes → Customize
2. Look for "App embeds" (bottom left)
3. Enable "Festival Newsletter Popup" ✅
4. Set "Display Frequency" to **"Always"** (for testing)
5. Save

### Step 3: Test
Open your storefront in **incognito mode** or run in console:
```javascript
forceShowFestivalPopup()
```

## 🔧 Debug Commands

### In Browser Console (F12):

**Force show popup:**
```javascript
forceShowFestivalPopup()
```

**Clear all data:**
```javascript
sessionStorage.clear(); localStorage.clear(); location.reload();
```

**Check status:**
```javascript
console.log({
  closed: sessionStorage.getItem('festival-popup-closed-test-festival-popup.myshopify.com'),
  shown: sessionStorage.getItem('festival-popup-shown-test-festival-popup.myshopify.com')
});
```

## 📊 Test Your Configuration

Use the test page:
```
https://festival-popup-newsletter.onrender.com/test-festival-popup.html
```

Or locally:
```
http://localhost:3000/test-festival-popup.html
```

## ✅ Success Checklist

Check these in browser console (F12):

- [ ] See: `🚀 POPUP CONFIG: { ... }`
- [ ] See: `🎪 Initializing festival popup system...`
- [ ] See: `✅ Festivals loaded: 1` (or more)
- [ ] See: `🎪 Found active festival: [Name]`
- [ ] See: `✅ Festival popup displayed`
- [ ] Popup appears on screen after delay
- [ ] Close button works
- [ ] Popup doesn't reappear after closing (same session)

## 🐛 Still Not Working?

### Issue: Block not in theme customizer
**Fix**: Re-deploy the app (`npm run deploy`)

### Issue: Popup shows but wrong data
**Fix**: Check admin panel - verify festival dates include today

### Issue: Popup shows every time
**Fix**: Change "Display Frequency" to "Once per session"

### Issue: Popup never shows
**Fix**: 
1. Open incognito window
2. Check console for errors
3. Verify festival is active (dates include today)
4. Run `forceShowFestivalPopup()` in console

## 📝 Files Changed

- `festival-newsletter-popup/extensions/newsletter-popup/blocks/newsletter-popup.liquid`
  - Removed `available_if` restriction
  - Added frequency logic
  - Added session storage checks
  - Added debugging tools
  - Added frequency settings to schema

## 🎯 Next Steps

1. Deploy the app
2. Enable in theme customizer
3. Set frequency to "Always" for testing
4. Test in incognito mode
5. Change frequency to "Once per session" for production
6. Enjoy your working festival popup! 🎉

## 📞 Need Help?

1. Check console logs (F12)
2. Use test page: `/test-festival-popup.html`
3. Run `forceShowFestivalPopup()` in console
4. Share console output if you need support

---

**Ready to test? Deploy and enable the block now!** 🚀

