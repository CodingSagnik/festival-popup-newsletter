# 📧 Mailjet App Domain Setup Guide

This guide shows you how to set up domain verification with Mailjet so merchants can send emails without manual validation.

## 🎯 What This Achieves

- ✅ **No manual email validation** for each merchant
- ✅ **Merchants use their email for replies** (reply-to)
- ✅ **Professional branded sender** (your app domain)
- ✅ **200 emails/day FREE** with Mailjet
- ✅ **Works on Render free plan**

## 📋 Prerequisites

You need **any domain** you control. Options:

### Free Domain Options:
1. **Your existing domain** (cheapest - if you have one)
2. **Vercel subdomain**: `yourapp.vercel.app` (free)
3. **Netlify subdomain**: `yourapp.netlify.app` (free)
4. **Railway subdomain**: `yourapp.railway.app` (free)
5. **GitHub Pages**: `username.github.io` (free)

## 🚀 Step-by-Step Setup

### Step 1: Choose Your Domain

Replace `your-app-domain.com` in your `.env` file:

```bash
# Example options:
APP_EMAIL_DOMAIN=festivalapp.vercel.app
# or
APP_EMAIL_DOMAIN=yourdomain.com
# or  
APP_EMAIL_DOMAIN=yourapp.railway.app
```

### Step 2: Login to Mailjet

1. Go to [Mailjet.com](https://app.mailjet.com/)
2. Login with your account
3. Navigate to **Account Settings** → **Domains**

### Step 3: Add Your Domain

1. Click **"Add a Domain"**
2. Enter your domain (e.g., `festivalapp.vercel.app`)
3. Choose **"Validate domain ownership"**

### Step 4: Domain Validation

Mailjet will give you **two options**:

#### Option A: DNS Record (Recommended)
1. Add a **TXT record** to your domain's DNS:
   ```
   Name: @
   Value: [mailjet-provided-value]
   ```

#### Option B: File Upload
1. Create a file with the name Mailjet provides
2. Upload to your domain's root directory
3. Make it accessible at: `yourdomain.com/filename`

### Step 5: Set Up SPF Record

Add this **TXT record** to your DNS:
```
Name: @
Value: v=spf1 include:spf.mailjet.com ~all
```

### Step 6: Set Up DKIM

1. In Mailjet, go to **Domain** → **Authentication**
2. Enable **DKIM** for your domain
3. Add the **TXT record** Mailjet provides:
   ```
   Name: mailjet._domainkey
   Value: [mailjet-provided-dkim-key]
   ```

### Step 7: Update Your App

Update your `.env` file:
```bash
APP_EMAIL_DOMAIN=yourdomain.com
```

### Step 8: Test

Restart your app and test email sending. Check the logs for:
```
📧 Using app domain for FROM: noreply@yourdomain.com
📧 Reply-to (merchant email): merchant@gmail.com
```

## 🔍 How It Works

### Before (Current Issue):
```
FROM: merchant@gmail.com  ❌ Requires manual validation
TO: customer@example.com
```

### After (With App Domain):
```
FROM: "Merchant Name" <noreply@yourdomain.com>  ✅ Pre-verified
REPLY-TO: merchant@gmail.com                     ✅ Customer replies go to merchant
TO: customer@example.com
```

## 🎨 Customer Experience

Customers will see:
- **Sender**: "John's Festival Store"
- **From**: `noreply@yourdomain.com`
- **When they reply**: Goes to `john@gmail.com`

This is **exactly how Shopify, WooCommerce, and other platforms work!**

## 🆓 Free Domain Setup Examples

### Using Vercel (Free):
1. Deploy any simple page to Vercel
2. Get subdomain: `yourapp.vercel.app`
3. Use this domain in Mailjet
4. Add DNS records in Vercel dashboard

### Using GitHub Pages (Free):
1. Create a GitHub repo: `yourapp.github.io`
2. Enable GitHub Pages
3. Use domain: `yourapp.github.io`
4. Add DNS records in GitHub settings

## ✅ Verification

After setup, test with:
- Send a test email from your app
- Check that emails arrive in inbox (not spam)
- Verify reply-to works correctly
- Check Mailjet dashboard for domain status

## 🆘 Troubleshooting

### Domain Not Verified:
- Wait 24-48 hours for DNS propagation
- Check DNS records with [MXToolbox](https://mxtoolbox.com/)
- Ensure TXT records are added correctly

### Emails Going to Spam:
- Verify SPF and DKIM are set up
- Add DMARC record (optional):
  ```
  Name: _dmarc
  Value: v=DMARC1; p=none; rua=mailto:admin@yourdomain.com
  ```

### Domain Rejected:
- Ensure you control the domain
- Check domain is accessible via browser
- Try alternative validation method (file vs DNS)

## 🎉 Success!

Once set up:
- **No more manual email validation**
- **Unlimited merchant emails** from any provider
- **Professional appearance**
- **200 free emails/day** with Mailjet
- **Perfect customer experience**

This is the industry-standard solution used by all major platforms! 🚀
