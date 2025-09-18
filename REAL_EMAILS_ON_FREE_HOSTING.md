# 📧 How to Send Real Emails on Free Hosting

## 🎯 **The Problem**
Free hosting services (Render, Heroku, Vercel) block SMTP ports (25, 465, 587) to prevent spam.

## ✅ **The Solution**
Use HTTP-based email APIs that work on ports 80/443 (not blocked).

## 🚀 **Quick Setup (5 minutes)**

### **Option 1: Resend (Recommended)**
**Free Tier:** 3,000 emails/month

1. **Sign up**: Go to [resend.com](https://resend.com)
2. **Get API Key**: Visit [API Keys](https://resend.com/api-keys)
3. **Add to Render**: 
   - Go to your Render dashboard
   - Select your service
   - Go to "Environment" tab
   - Add: `RESEND_API_KEY=re_your_api_key_here`
4. **Restart**: Click "Manual Deploy" → "Deploy Latest Commit"

### **Option 2: SendGrid**
**Free Tier:** 100 emails/day

1. **Sign up**: Go to [sendgrid.com](https://sendgrid.com)
2. **Get API Key**: Visit [API Keys](https://app.sendgrid.com/settings/api_keys)
3. **Add to Render**: 
   - Add: `SENDGRID_API_KEY=SG.your_api_key_here`
4. **Restart**: Deploy latest commit

## 🧪 **Testing**

After adding the API key:
1. Go to your Shopify admin → Festival Newsletter Popup
2. Configure email settings (any Gmail/provider works for "from" address)
3. Click "Send Test Email"
4. You should see: **"Real email sent successfully!"**

## 🔍 **Troubleshooting**

**Still seeing simulated emails?**
- Check API key is correctly added to Render environment
- Restart the service after adding environment variables
- Check Render logs for any API errors

**API errors?**
- Verify API key is valid and active
- Check your email service dashboard for usage limits
- Ensure "from" email is verified in your email service

## 💰 **Cost Comparison**

| Service | Free Tier | Paid Plans |
|---------|-----------|------------|
| Resend | 3,000/month | $20/month for 50k |
| SendGrid | 100/day | $15/month for 40k |
| Mailgun | 5,000/month (3 months) | $35/month for 50k |
| AWS SES | 62,000/month | $0.10 per 1k emails |

## 🎉 **Benefits**

✅ **Real email delivery** on free hosting  
✅ **Better deliverability** than SMTP  
✅ **Analytics and tracking** included  
✅ **No server configuration** needed  
✅ **Scales automatically**  

Your Festival Popup app will send real emails to customers! 🚀