# 🚀 Mailjet Integration - Complete Setup Guide

## 📧 Why Mailjet is Perfect for This App

This Festival Popup app is designed for **merchants** who want to use their **own email addresses** for customer communications. Mailjet is the perfect solution because:

✅ **Preserves merchant email addresses** - No domain verification required  
✅ **Works on free hosting** - Uses HTTP API instead of blocked SMTP  
✅ **Professional delivery** - High deliverability rates  
✅ **Best free tier** - 200 emails/day forever (vs 100/day with others)  
✅ **Easy setup** - Just add two environment variables  

## 🎯 The Problem We Solved

**Before:** Merchants couldn't use their own email addresses (gmail, yahoo, etc.) because:
- SMTP is blocked on free hosting platforms
- Other services require domain verification
- Emails would be sent from generic domains

**After:** With Mailjet, merchants can:
- Use ANY email address as sender
- Send professional emails from their own address
- No domain verification needed
- Works perfectly on free hosting
- Get 200 emails/day forever (best free tier!)

## 🚀 Quick Setup (5 Minutes)

### 1. Get Mailjet API Keys
```bash
# Go to: https://app.mailjet.com/account/apikeys
# Copy both API Key and Secret Key
# No special permissions needed - just create account
```

### 2. Add to Environment
```bash
# For Render/Production:
MAILJET_API_KEY=your_api_key_here
MAILJET_SECRET_KEY=your_secret_key_here

# For Local Development (.env file):
MAILJET_API_KEY=your_api_key_here
MAILJET_SECRET_KEY=your_secret_key_here
```

### 3. Deploy & Test
```bash
# Deploy your app with the new environment variable
# Test with any merchant email address
# Email will be sent FROM that address! ✅
```

## 🔧 How It Works

### Priority System
The app uses a smart priority system for email delivery:

1. **🥇 Mailjet API** (if `MAILJET_API_KEY` & `MAILJET_SECRET_KEY` are set)
   - Preserves merchant email addresses
   - Professional delivery
   - 200 emails/day forever
   - **RECOMMENDED**

2. **🥈 Resend API** (if `RESEND_API_KEY` is set)
   - Uses verified domain
   - Merchant email in reply-to
   - Fallback option

3. **🥉 SendGrid API** (if `SENDGRID_API_KEY` is set)
   - Preserves merchant email addresses
   - 100 emails/day free
   - Alternative option

4. **🥉 Simulation** (if no API keys)
   - For development/testing
   - No real emails sent

### Code Implementation
```javascript
// The app automatically detects Mailjet API keys
// and uses them with merchant's email address
const mailjetPayload = {
  Messages: [{
    From: {
      Email: merchantEmail,  // ✅ Preserves merchant email
      Name: merchantName
    },
    To: [{
      Email: recipientEmail
    }],
    Subject: emailSubject,
    HTMLPart: emailHTML
  }]
};
```

## 📊 Testing Your Setup

### Run the Test Script
```bash
node test-mailjet-setup.js
```

### Expected Output (Success)
```json
{
  "success": true,
  "service": "mailjet",
  "real": true,
  "provider": "Mailjet API",
  "fromEmail": "merchant@gmail.com"
}
```

### Verification Checklist
- [ ] Mailjet API key and secret key added to environment
- [ ] Application restarted/redeployed
- [ ] Test email sent successfully
- [ ] Email received with correct "From" address
- [ ] Logs show "Real email sent via Mailjet API"

## 🎉 Benefits for Merchants

### Email Authenticity
- Customers see emails from the actual merchant
- Builds trust and brand recognition
- Professional appearance

### No Technical Barriers
- No domain verification required
- No DNS configuration needed
- Works with any email provider (Gmail, Yahoo, etc.)

### Cost Effective
- 200 emails/day free forever (6,000/month)
- Best free tier in the market
- Perfect for small to medium stores
- Scales with business growth

## 🔍 Troubleshooting

### Common Issues & Solutions

**1. "Still using Resend/Simulation"**
```bash
# Check environment variables
echo $MAILJET_API_KEY
echo $MAILJET_SECRET_KEY

# Both must be set
# Restart application after adding
```

**2. "API Keys Invalid"**
```bash
# Verify both keys are from same Mailjet account
# Check for typos in environment variable names
# Ensure no extra spaces in the keys
# Verify Mailjet account is activated
```

**3. "Email not received"**
```bash
# Check spam folder
# Verify recipient email is correct
# Check SendGrid activity dashboard
```

### Debug Commands
```bash
# Test the integration
node test-mailjet-setup.js

# Check environment variables
node -e "console.log('API Key:', process.env.MAILJET_API_KEY ? 'SET' : 'NOT SET')"
node -e "console.log('Secret Key:', process.env.MAILJET_SECRET_KEY ? 'SET' : 'NOT SET')"

# View server logs
# (Check your hosting platform's log viewer)
```

## 🆚 Comparison with Other Services

| Feature | Mailjet | SendGrid | Resend | SMTP |
|---------|---------|----------|--------|------|
| **Merchant Email Preservation** | ✅ YES | ✅ YES | ❌ NO | ✅ YES |
| **Works on Free Hosting** | ✅ YES | ✅ YES | ✅ YES | ❌ NO |
| **Domain Verification Required** | ❌ NO | ❌ NO | ✅ YES | ❌ NO |
| **Setup Complexity** | 🟢 Easy | 🟢 Easy | 🟡 Medium | 🔴 Hard |
| **Free Tier** | 200/day | 100/day | 3000/month | N/A |
| **Best For** | Merchant Apps | Merchant Apps | Developer Apps | Self-hosted |

## 📈 Scaling Considerations

### Free Tier Limits
- **200 emails/day** (6,000/month) - FOREVER!
- Perfect for testing and small stores
- Monitor usage in Mailjet dashboard

### Upgrade Path
- **Essential**: $9.65/month for 30,000 emails
- **Premium**: $20.95/month for 30,000 emails + advanced features
- Advanced features: A/B testing, segmentation, automation, etc.

### Usage Optimization
- Batch email sends when possible
- Use targeted campaigns
- Monitor bounce rates and engagement

## 🎯 Perfect Solution Achieved

With Mailjet integration, this Festival Popup app now provides:

✅ **True merchant email preservation**  
✅ **Works on any free hosting platform**  
✅ **No domain verification hassles**  
✅ **Professional email delivery**  
✅ **Best free tier (200 emails/day forever)**  
✅ **Easy setup and maintenance**  
✅ **Cost-effective scaling**  

**This is exactly what merchants need for authentic customer communication!** 🚀

---

## 📞 Support

If you encounter any issues:
1. Check the troubleshooting section above
2. Review Mailjet's documentation
3. Test with the provided test script
4. Check server logs for detailed error messages

**The Mailjet integration makes this app production-ready for real merchants with the best free tier available!** 🎉