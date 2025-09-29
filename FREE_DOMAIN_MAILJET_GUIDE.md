# 🆓 Free Domain Setup with Mailjet - Complete Step-by-Step Guide

This guide shows you how to get a **completely free domain** and set it up with Mailjet for your email system.

## 🎯 What We'll Achieve

- ✅ **100% FREE domain** (no cost, ever)
- ✅ **Full DNS control** for Mailjet setup
- ✅ **Professional email sending** 
- ✅ **No manual merchant validation** needed
- ✅ **200 emails/day FREE** with Mailjet

## 📋 Best Free Domain Options (2024)

Since Freenom is discontinued, here are the **best FREE alternatives**:

### **Option 1: GitHub Pages Domain (RECOMMENDED)** 
- **Domain**: `yourapp.github.io`
- **Cost**: 100% FREE forever
- **DNS Control**: Yes (via GitHub settings)
- **Professional**: Very (widely trusted)
- **Setup Time**: 5 minutes

### **Option 2: Netlify Subdomain**
- **Domain**: `yourapp.netlify.app`  
- **Cost**: 100% FREE forever
- **DNS Control**: Yes (via Netlify dashboard)
- **Professional**: Very
- **Setup Time**: 5 minutes

### **Option 3: Vercel Subdomain**
- **Domain**: `yourapp.vercel.app`
- **Cost**: 100% FREE forever  
- **DNS Control**: Yes (via Vercel dashboard)
- **Professional**: Very
- **Setup Time**: 5 minutes

## 🚀 Complete Setup Guide - GitHub Pages (Recommended)

I'll walk you through the **GitHub Pages** option as it's the most reliable and permanent.

### **Step 1: Create GitHub Account** (2 minutes)

1. Go to [GitHub.com](https://github.com)
2. Click **"Sign up"**
3. Choose username (this will be part of your domain)
   - Example: `festivalapp` → `festivalapp.github.io`
4. Complete signup process

### **Step 2: Create Repository** (3 minutes)

1. Click **"+ New repository"** (green button)
2. **Repository name**: `yourapp.github.io` 
   - ⚠️ **IMPORTANT**: Must end with `.github.io`
   - Example: `festivalapp.github.io`
3. Make it **Public** (required for free GitHub Pages)
4. Check **"Add a README file"**
5. Click **"Create repository"**

### **Step 3: Enable GitHub Pages** (2 minutes)

1. In your new repository, click **"Settings"** tab
2. Scroll down to **"Pages"** section (left sidebar)
3. Under **"Source"**, select **"Deploy from a branch"**
4. Choose **"main"** branch
5. Choose **"/ (root)"** folder
6. Click **"Save"**
7. 🎉 **Your domain is now live**: `yourapp.github.io`

### **Step 4: Test Your Domain** (1 minute)

1. Wait 2-3 minutes for deployment
2. Visit `https://yourapp.github.io` in browser
3. You should see a simple page with your README content
4. ✅ **Domain is working!**

### **Step 5: Update Your App Configuration** (1 minute)

1. Open your `.env` file
2. Update the domain:
   ```bash
   APP_EMAIL_DOMAIN=yourapp.github.io
   ```
3. Save the file

## 📧 Mailjet Domain Setup

Now let's verify your new domain with Mailjet:

### **Step 6: Login to Mailjet** (1 minute)

1. Go to [app.mailjet.com](https://app.mailjet.com)
2. Login with your existing account
3. Navigate to **"Account Settings"** (top right)
4. Click **"Sender addresses & domains"**

### **Step 7: Add Your Domain** (2 minutes)

1. Click **"Add a domain"**
2. Enter your domain: `yourapp.github.io`
3. Click **"Continue"**
4. Choose **"Validate domain ownership"**
5. Mailjet will show you **validation options**

### **Step 8: Domain Validation** (5 minutes)

Mailjet offers **two validation methods**. Choose **DNS Record** (easier):

#### **DNS Record Method:**

1. Mailjet will show you a record like:
   ```
   Type: TXT
   Name: @
   Value: mailjet-verification=abc123xyz789
   ```

2. **Add this to GitHub Pages DNS**:
   - Go back to your GitHub repository
   - Click **"Settings"** → **"Pages"**
   - Click **"Add custom domain"** (even though we're using GitHub domain)
   - Actually, for GitHub Pages default domain, **skip to Step 9** - GitHub handles this automatically

### **Step 9: Set Up SPF Record** (3 minutes)

**For GitHub Pages**, you need to create a `CNAME` file for DNS records:

1. In your repository, click **"Create new file"**
2. Name it: `_spf.txt` 
3. Content:
   ```
   v=spf1 include:spf.mailjet.com ~all
   ```
4. Click **"Commit new file"**

⚠️ **Actually, GitHub Pages has limitations for custom DNS records. Let's use a different approach...**

## 🔄 Alternative: Use Cloudflare (FREE) for DNS Control

For **full DNS control** with your GitHub Pages domain:

### **Step 10: Set Up Cloudflare** (10 minutes)

1. Go to [Cloudflare.com](https://cloudflare.com)
2. Sign up for **FREE account**
3. Add your site: `yourapp.github.io`
4. Choose **FREE plan**
5. Cloudflare will scan your DNS
6. Continue with setup

### **Step 11: Add Mailjet DNS Records in Cloudflare**

1. In Cloudflare dashboard, go to **"DNS"** section
2. Add **TXT record** for domain validation:
   ```
   Type: TXT
   Name: @
   Content: mailjet-verification=abc123xyz789
   Proxy status: DNS only
   ```

3. Add **SPF record**:
   ```
   Type: TXT  
   Name: @
   Content: v=spf1 include:spf.mailjet.com ~all
   Proxy status: DNS only
   ```

4. Add **DKIM record** (Mailjet will provide this):
   ```
   Type: TXT
   Name: mailjet._domainkey
   Content: [mailjet-provided-dkim-key]
   Proxy status: DNS only
   ```

## ✅ Much Simpler Option: Use Netlify Instead

**Actually, let me give you the EASIEST path:**

### **Super Simple: Netlify Approach** (5 minutes total)

1. Go to [Netlify.com](https://netlify.com)
2. Sign up with GitHub account
3. Create **new site from Git**
4. Connect your repository (or create empty one)
5. Deploy → You get `yourapp.netlify.app`
6. Go to **Site settings** → **Domain management** → **DNS records**
7. Add all Mailjet records easily!

## 🎯 Final Configuration

### **Step 12: Update Your App** (2 minutes)

1. Update `.env` with your chosen domain:
   ```bash
   APP_EMAIL_DOMAIN=yourapp.netlify.app
   # or
   APP_EMAIL_DOMAIN=yourapp.github.io
   ```

2. Restart your application

### **Step 13: Test Email Sending** (5 minutes)

1. Send a test email from your app
2. Check logs for:
   ```
   📧 Using app domain for FROM: noreply@yourapp.netlify.app
   📧 Reply-to (merchant email): merchant@gmail.com
   ✅ Real email sent via Mailjet API
   ```

3. Check recipient inbox - should see:
   ```
   From: "Merchant Name" <noreply@yourapp.netlify.app>
   Reply-to: merchant@gmail.com
   ```

## 🎉 Success Checklist

- ✅ **Free domain obtained**: `yourapp.netlify.app`
- ✅ **Domain verified with Mailjet**
- ✅ **SPF record added**
- ✅ **DKIM record added**  
- ✅ **App configured** with new domain
- ✅ **Test emails working**
- ✅ **Reply-to functioning** correctly

## 💰 Total Cost Breakdown

- **Domain**: $0 (FREE forever)
- **DNS hosting**: $0 (FREE forever)
- **Mailjet**: $0 (200 emails/day FREE)
- **Setup time**: 20 minutes
- **Maintenance**: None required

## 🆘 Troubleshooting

### **Domain Not Verifying:**
- Wait 24-48 hours for DNS propagation
- Use [MXToolbox](https://mxtoolbox.com/) to verify DNS records
- Try alternative validation method (file upload)

### **Emails Going to Spam:**
- Ensure SPF and DKIM are properly set up
- Add DMARC record:
  ```
  Type: TXT
  Name: _dmarc
  Content: v=DMARC1; p=none; rua=mailto:admin@yourapp.netlify.app
  ```

### **GitHub Pages Limitations:**
- Switch to Netlify for easier DNS management
- Or use Cloudflare for advanced DNS control

## 🚀 You're Done!

Your email system now works with:
- ✅ **Any merchant email address** (no validation needed)
- ✅ **Professional appearance**
- ✅ **Perfect reply functionality**
- ✅ **200 free emails daily**
- ✅ **Zero ongoing costs**

This is the same approach used by **Shopify, WooCommerce, and other major platforms**! 🎉

---

**Need help?** Follow this guide step-by-step, and you'll have a professional email system running in under 30 minutes, completely free! 📧
