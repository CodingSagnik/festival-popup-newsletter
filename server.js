require('dotenv').config();
const express = require('express');
const cors = require('cors');
// const mongoose = require('mongoose'); // Removed - using Shopify Metafields
const nodemailer = require('nodemailer');

// Real email service using Resend API (works on free hosting)
async function sendEmailViaHTTP(emailOptions) {
  try {
    console.log('📧 Using Resend API for real email delivery');
    console.log('📧 Email details:', {
      to: emailOptions.to,
      from: emailOptions.from,
      subject: emailOptions.subject,
      hasHtml: !!emailOptions.html
    });
    
    // Option 1: Try Resend API (if API key is configured)
    const resendApiKey = process.env.RESEND_API_KEY;
    
    if (resendApiKey) {
      try {
        console.log('🔑 Using Resend API key for real email delivery');
        console.log('📧 Using Resend verified domain:', fromEmail);
        console.log('📧 From name:', fromName);
        
        // Resend requires verified domain for "from" address
        // Extract the name from the original "from" field and use Resend's verified domain
        const fromMatch = emailOptions.from.match(/^"?([^"<]+)"?\s*<([^>]+)>$/) || [null, emailOptions.from, emailOptions.from];
        const fromName = fromMatch[1] || 'Festival Popup';
        const fromEmail = 'onboarding@resend.dev'; // Resend's verified domain for testing
        
        const resendPayload = {
          from: `${fromName} <${fromEmail}>`,
          to: [emailOptions.to],
          subject: emailOptions.subject,
          html: emailOptions.html,
          text: emailOptions.text || 'Please enable HTML to view this email.'
        };
        
        const response = await axios.post('https://api.resend.com/emails', resendPayload, {
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        });
        
        console.log('✅ Real email sent via Resend API');
        console.log('📧 Resend response:', response.data);
        return { 
          messageId: response.data.id,
          service: 'resend',
          real: true,
          provider: 'Resend API'
        };
        
      } catch (resendError) {
        console.error('❌ Resend API failed:', resendError.response?.data || resendError.message);
        // Fall through to simulation
      }
    }
    
    // Option 2: Try SendGrid API (if API key is configured)
    const sendgridApiKey = process.env.SENDGRID_API_KEY;
    
    if (sendgridApiKey) {
      try {
        console.log('🔑 Using SendGrid API key for real email delivery');
        
        const sendgridPayload = {
          personalizations: [{
            to: [{ email: emailOptions.to }],
            subject: emailOptions.subject
          }],
          from: { email: emailOptions.from },
          content: [{
            type: 'text/html',
            value: emailOptions.html
          }]
        };
        
        const response = await axios.post('https://api.sendgrid.com/v3/mail/send', sendgridPayload, {
          headers: {
            'Authorization': `Bearer ${sendgridApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        });
        
        console.log('✅ Real email sent via SendGrid API');
        return { 
          messageId: `sendgrid-${Date.now()}`,
          service: 'sendgrid',
          real: true
        };
        
      } catch (sendgridError) {
        console.error('❌ SendGrid API failed:', sendgridError.response?.data || sendgridError.message);
        // Fall through to simulation
      }
    }
    
    // Option 3: Simulation (if no API keys configured)
    console.log('📧 No email API keys configured, using simulation');
    console.log('🔧 To send real emails on free hosting, add one of these to your environment:');
    console.log('   RESEND_API_KEY=your_resend_api_key (Free: 3000 emails/month)');
    console.log('   SENDGRID_API_KEY=your_sendgrid_api_key (Free: 100 emails/day)');
    console.log('');
    console.log('📝 Quick setup guides:');
    console.log('   Resend: https://resend.com/api-keys');
    console.log('   SendGrid: https://app.sendgrid.com/settings/api_keys');
    
    return { 
      messageId: `simulated-${Date.now()}`,
      simulated: true,
      service: 'simulation',
      note: 'Add RESEND_API_KEY or SENDGRID_API_KEY environment variable for real emails'
    };
    
  } catch (error) {
    console.error('❌ HTTP email service failed:', error);
    throw error;
  }
}
const moment = require('moment');
const axios = require('axios');
const cheerio = require('cheerio');
const natural = require('natural');
const path = require('path');
const sharp = require('sharp');
const ColorThief = require('colorthief');

const app = express();
const PORT = process.env.PORT || 10000; // Render uses port 10000

// Middleware - Enhanced CORS for Shopify
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow all Shopify domains
    if (origin.includes('.myshopify.com') || 
        origin.includes('shopify.com') ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1') ||
        origin.includes('festival-popup-newsletter.onrender.com')) {
      return callback(null, true);
    }
    
    // Allow the origin
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning', 'Accept', 'Cache-Control', 'Pragma', 'Expires', 'X-Requested-With']
}));
app.use(express.json());
app.use(express.static('public'));
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// Handle preflight OPTIONS requests
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, ngrok-skip-browser-warning, Accept, Cache-Control, Pragma, Expires, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

// Main app route - serve Shopify-embedded admin interface
app.get('/', (req, res) => {
  // Check if this is a Shopify app request (has shop parameter or Shopify headers)
  const isShopifyRequest = req.query.shop || req.headers['x-shopify-shop-domain'] || req.headers.referer?.includes('shopify');
  
  if (isShopifyRequest) {
    // Serve Shopify-embedded admin interface
    res.sendFile(path.join(__dirname, 'admin', 'shopify-embedded.html'));
  } else {
    // Serve health check for other requests (Railway health checks, etc.)
    res.json({ 
      status: 'OK', 
      message: 'Festival Popup & Newsletter System is running!',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  }
});

// Health check endpoint for Railway (backup)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Festival Popup & Newsletter System is running!',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Simple test popup endpoint for debugging
app.get('/api/popup/test/:shopDomain', (req, res) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, ngrok-skip-browser-warning, Accept',
    'Content-Type': 'application/json'
  });
  
  const { shopDomain } = req.params;
  
  // Return a simple test festival
  const testFestival = {
    shopDomain: shopDomain,
    isActive: true,
    festivals: [{
      name: 'Independence Day',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      offer: '25% OFF',
      discountCode: 'INDA25',
      backgroundColor: '#cb1d11',
      textColor: '#ffffff',
      backgroundImageUrl: 'https://image.pollinations.ai/prompt/beautiful%20festive%20independence%20day%20celebration%20background?width=800&height=600',
      isInfinite: true,
      createdAt: new Date().toISOString()
    }],
    displaySettings: {
      showDelay: 3000,
      displayFrequency: 'always',
      position: 'center'
    }
  };
  
  console.log(`🧪 Test popup endpoint called for: ${shopDomain}`);
  res.json(testFestival);
});

// Serve ngrok config for frontend
app.get('/ngrok-config.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'ngrok-config.js'));
});

// Handle ngrok warning bypass
app.use((req, res, next) => {
  if (req.headers['ngrok-skip-browser-warning']) {
    res.setHeader('ngrok-skip-browser-warning', 'true');
  }
  next();
});

// Shopify Metafields Database - FREE built-in database replacement
// No MongoDB connection needed - using Shopify's built-in storage
console.log('🚀 Using Shopify Metafields Database (FREE) - No external database required!');

// Import Shopify Metafields models (drop-in replacement for MongoDB)
const {
  ShopifyMetafieldsDB,
  PopupSettings,
  NewsletterSubscriber,
  BlogPost,
  ShopSettings
} = require('./utils/shopifyMetafields');

// Email transporter - now created per shop dynamically
// Legacy global transporter for backward compatibility
let transporter = null;

/**
 * Create email transporter for a specific shop using their email settings
 * @param {string} shopDomain - The shop domain to get email settings for
 * @returns {Promise<Object|null>} - Nodemailer transporter or null if not configured
 */
async function createShopEmailTransporter(shopDomain) {
  try {
    console.log(`🔍 DEBUG: Creating email transporter for shop: ${shopDomain}`);
    
    const shopSettings = await ShopSettings.getShopSettings(shopDomain);
    console.log(`🔍 DEBUG: Shop settings found:`, shopSettings ? 'YES' : 'NO');
    
    if (!shopSettings || !shopSettings.emailSettings.enabled) {
      console.log(`📧 No email settings configured for shop: ${shopDomain}`);
      console.log(`🔍 DEBUG: Email enabled:`, shopSettings?.emailSettings?.enabled);
      return null;
    }
    
    console.log(`🔍 DEBUG: Email settings:`, {
      enabled: shopSettings.emailSettings.enabled,
      provider: shopSettings.emailSettings.provider,
      fromEmail: shopSettings.emailSettings.fromEmail,
      fromName: shopSettings.emailSettings.fromName,
      hasEncryptedPassword: !!shopSettings.emailSettings.encryptedPassword
    });
    
    const emailCredentials = shopSettings.getEmailCredentials();
    if (!emailCredentials) {
      console.log(`📧 Failed to get email credentials for shop: ${shopDomain}`);
      console.log(`🔍 DEBUG: Encrypted password exists:`, !!shopSettings.emailSettings.encryptedPassword);
      return null;
    }
    
    console.log(`🔍 DEBUG: Email credentials obtained:`, {
      user: emailCredentials.user,
      hasPassword: !!emailCredentials.pass
    });
    
    // Return a special HTTP-based transporter for cloud hosting
    console.log(`🌐 Using HTTP-based email service (SMTP blocked on free hosting)`);
    
    return {
      isHTTPTransporter: true,
      shopSettings: shopSettings,
      sendMail: async (mailOptions) => {
        return await sendEmailViaHTTP(mailOptions);
      }
    };
    
  } catch (error) {
    console.error(`❌ Failed to create email transporter for shop ${shopDomain}:`, error.message);
    console.error(`🔍 DEBUG: Full error:`, error);
    return null;
  }
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use createShopEmailTransporter instead
 */
function createEmailTransporter() {
  console.warn('⚠️ createEmailTransporter() is deprecated. Use createShopEmailTransporter(shopDomain) instead.');
  return null;
}

// ==================== FESTIVAL NAME DATABASE (NAMES & DATES ONLY) ====================
// This database is used ONLY for festival name suggestions based on dates
// 🚨 IMPORTANT: NO colors, offers, or styling - those are generated dynamically by AI:
//   - Colors: Extracted from AI-generated background images  
//   - Offers: Provided by user (stays constant for infinite festivals)
//   - Background Images: Generated by AI based on festival names
//   - Text Colors: Calculated for optimal contrast with background images

const festivalNameDatabase = {
  // ========== MAJOR INDIAN FESTIVALS ==========
  'Makar Sankranti': { dates: { start: '01-14', end: '01-16' } },
  'Republic Day': { dates: { start: '01-25', end: '01-27' } },
  'Vasant Panchami': { dates: { start: '02-01', end: '02-05' } },
  'Festival of Colors': { dates: { start: '03-13', end: '03-16' } }, // Holi
  'Ram Navami': { dates: { start: '03-29', end: '03-31' } },
  'Baisakhi': { dates: { start: '04-13', end: '04-15' } },
  'Buddha Purnima': { dates: { start: '05-05', end: '05-07' } },
  'Eid al-Fitr': { dates: { start: '03-29', end: '03-31' } },
  'Rath Yatra': { dates: { start: '06-26', end: '06-29' } },
  'Independence Day': { dates: { start: '08-14', end: '08-16' } },
  'Raksha Bandhan': { dates: { start: '08-10', end: '08-12' } },
  'Lord Krishna Festival': { dates: { start: '08-16', end: '08-18' } }, // Janmashtami
  'Elephant God Festival': { dates: { start: '08-31', end: '09-03' } }, // Ganesh Chaturthi
  'Onam': { dates: { start: '08-20', end: '08-30' } },
  'Teachers Day': { dates: { start: '09-04', end: '09-06' } },
  'Sharad Navratri': { dates: { start: '09-15', end: '09-24' } },
  'Durga Puja': { dates: { start: '09-24', end: '09-28' } },
  'Dussehra': { dates: { start: '10-01', end: '10-04' } },
  'Dhanteras': { dates: { start: '10-13', end: '10-15' } },
  'Festival of Lights': { dates: { start: '10-30', end: '11-03' } }, // Diwali
  'Bhai Dooj': { dates: { start: '11-02', end: '11-04' } },
  'Karva Chauth': { dates: { start: '11-08', end: '11-10' } },
  'Children\'s Day': { dates: { start: '11-13', end: '11-15' } },
  'Guru Nanak Jayanti': { dates: { start: '11-15', end: '11-17' } },

  // ========== UNIVERSAL FESTIVALS ==========
  'New Year': { dates: { start: '12-25', end: '01-15' } },
  'Valentine\'s Day': { dates: { start: '02-01', end: '02-20' } },
  'International Women\'s Day': { dates: { start: '03-06', end: '03-10' } },
  'Mother\'s Day': { dates: { start: '05-06', end: '05-10' } },
  'Father\'s Day': { dates: { start: '06-17', end: '06-21' } },
  'Guru Purnima': { dates: { start: '07-12', end: '07-14' } },
  'Halloween': { dates: { start: '10-29', end: '11-01' } },
  'Black Friday': { dates: { start: '11-25', end: '11-29' } },
  'Cyber Monday': { dates: { start: '11-29', end: '12-02' } },
  'Christmas': { dates: { start: '12-20', end: '12-31' } }
};

// Legacy festivals array - kept for backward compatibility but should not be used for new festivals
// TODO: Remove this after migrating all existing festivals to AI-generated system
const festivals = [];

// Helper function to get season from month
function getSeason(month) {
  if (month >= 3 && month <= 5) return 'Spring';
  if (month >= 6 && month <= 8) return 'Summer';
  if (month >= 9 && month <= 11) return 'Autumn';
  return 'Winter';
}

// DeepSeek AI festival name generation
async function generateFestivalNameWithDeepSeek(date) {
  const dateStr = date.format('MMMM Do, YYYY');
  const dayOfWeek = date.format('dddd');
  
  // Check if it's a major Indian festival first
  const month = date.month() + 1;
  const day = date.date();
  
      // Direct mapping for major festivals to avoid AI confusion
  if (month === 3 && (day >= 13 && day <= 16)) {
    return 'Festival of Colors'; // Holi
  }
  if (month === 10 && day === 2) {
    return 'Dussehra'; // Prioritize over Gandhi Jayanti for commerce
  }
  if (month === 10 && (day >= 20 && day <= 27)) {
    return 'Festival of Lights'; // Diwali
  }
  if (month === 11 && (day >= 1 && day <= 15)) {
    return 'Festival of Lights'; // Diwali
  }
  if (month === 12 && day === 25) {
    return 'Christmas Joy';
  }
  if (month === 8 && day === 15) {
    return 'Independence Day';
  }
  
     const prompt = `You are an expert in Indian festivals and cultural celebrations. Generate a beautiful, culturally appropriate festival name for ${dateStr}.

Context: This is for an Indian e-commerce platform's promotional campaign.

MAJOR INDIAN FESTIVALS TO CONSIDER:
- March: Holi (Festival of Colors)
- April: Baisakhi, Ram Navami
- August: Raksha Bandhan, Krishna Janmashtami, Independence Day
- September: Ganesh Chaturthi, Navratri
- October: Dussehra, Durga Puja, Karva Chauth, Diwali (late October)
- November: Diwali, Bhai Dooj, Govardhan Puja
- December: Christmas

SEASONAL GUIDELINES:
- Monsoon (June-September): "Monsoon Magic", "Rainy Season Festival"
- Winter (December-February): "Winter Celebration", "Cozy Festival"
- Spring (March-May): "Spring Bloom", "Harvest Festival"
- Summer (April-June): "Summer Celebration"

RULES:
1. Prioritize major festivals if the date matches
2. For October 2nd: prefer "Dussehra" over "Gandhi Jayanti" (more festive for commerce)
3. Use natural, human-sounding names
4. Keep it 2-4 words maximum
5. Make it celebratory and appealing for shopping

Respond with ONLY the festival name, nothing else.

Date: ${dateStr}
Festival name:`;

  try {
    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: 'google/gemini-2.0-flash-exp:free',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 100,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://festival-popup-newsletter.onrender.com',
        'X-Title': 'Festival Popup Generator'
      },
      timeout: 15000
    });

    let festivalName = response.data.choices[0].message.content.trim();
    
    console.log('🔍 Raw AI response:', JSON.stringify(festivalName));
    
    // Clean up the response - remove quotes, extra text, etc.
    festivalName = festivalName.replace(/["']/g, '');
    festivalName = festivalName.split('\n')[0]; // Take first line only
    festivalName = festivalName.replace(/^(Festival Name:|Answer:|Name:|Response:)/i, '').trim();
    
    console.log('🔍 Cleaned AI response:', JSON.stringify(festivalName));
    
    // If response is too short or just whitespace, throw error to use fallback
    if (!festivalName || festivalName.length < 3 || festivalName === 'Festival') {
      throw new Error('AI response too short or invalid');
    }
    
    // Ensure it ends with "Festival" or "Celebration" if it doesn't already
    if (!festivalName.toLowerCase().includes('festival') && 
        !festivalName.toLowerCase().includes('celebration') &&
        !festivalName.toLowerCase().includes('day') &&
        !festivalName.toLowerCase().includes('eve')) {
      festivalName += ' Festival';
    }
    
    return festivalName;
    
      } catch (error) {
    console.error('OpenRouter Gemini 2.0 Flash API error:', error.message);
    if (error.response) {
      console.error('OpenRouter API response status:', error.response.status);
      console.error('OpenRouter API response data:', error.response.data);
      if (error.response.status === 402) {
        throw new Error('OpenRouter API: Payment required - API credits exhausted');
      } else if (error.response.status === 429) {
        throw new Error('OpenRouter API: Rate limit exceeded');
      } else if (error.response.status === 401) {
        throw new Error('OpenRouter API: Invalid API key');
      }
    }
    throw new Error('OpenRouter DeepSeek API failed');
  }
}

// Enhanced AI-powered festival name generation with comprehensive festival database
function generateContextualFestivalName(date, month, season) {
  const day = date.date();
  const monthNum = date.month() + 1;
  const year = date.year();
  
  // YEAR-SPECIFIC FESTIVAL DATES (2025-2029) for lunar calendar festivals
  const yearSpecificFestivals = {
    2025: {
      // Lunar Calendar Festivals - 2025
      'holi': '3-14',
      'ramNavami': '4-6', 
      'rakshabandhan': '8-9',
      'janmashtami': '8-16',
      'ganeshChaturthi': '8-27',
      'navratriStart': '9-22',
      'dussehra': '10-2',
      'dhanteras': '10-29',
      'diwali': '11-1',
      'bhaiDooj': '11-3',
      'karavChauth': '10-20',
      'gurnanakJayanti': '11-15',
      
      // Islamic Festivals - 2025  
      'eidAlFitr': '3-30',
      'eidAlAdha': '6-6',
      'muharram': '7-6',
      'miladUnNabi': '9-5',
      
      // Other Variable Festivals
      'buddhaPurnima': '5-12',
      'guruPurnima': '7-13',
      'vasantPanchami': '2-3'
    },
    2026: {
      // Lunar Calendar Festivals - 2026
      'holi': '3-3',
      'ramNavami': '3-26',
      'rakshabandhan': '8-28',
      'janmashtami': '9-4',
      'ganeshChaturthi': '9-16',
      'navratriStart': '10-11',
      'dussehra': '10-21',
      'dhanteras': '10-18',
      'diwali': '10-21',
      'bhaiDooj': '10-23',
      'karavChauth': '10-9',
      'gurnanakJayanti': '11-4',
      
      // Islamic Festivals - 2026
      'eidAlFitr': '3-20',
      'eidAlAdha': '5-27',
      'muharram': '6-25',
      'miladUnNabi': '8-25',
      
      // Other Variable Festivals
      'buddhaPurnima': '5-1',
      'guruPurnima': '7-2',
      'vasantPanchami': '1-22'
    },
    2027: {
      // Lunar Calendar Festivals - 2027
      'holi': '3-22',
      'ramNavami': '4-14',
      'rakshabandhan': '8-17',
      'janmashtami': '8-24',
      'ganeshChaturthi': '9-5',
      'navratriStart': '9-30',
      'dussehra': '10-10',
      'dhanteras': '11-7',
      'diwali': '11-9',
      'bhaiDooj': '11-11',
      'karavChauth': '10-28',
      'gurnanakJayanti': '11-24',
      
      // Islamic Festivals - 2027
      'eidAlFitr': '3-9',
      'eidAlAdha': '5-16',
      'muharram': '6-14',
      'miladUnNabi': '8-14',
      
      // Other Variable Festivals
      'buddhaPurnima': '5-19',
      'guruPurnima': '7-21',
      'vasantPanchami': '2-11'
    },
    2028: {
      // Lunar Calendar Festivals - 2028
      'holi': '3-11',
      'ramNavami': '4-2',
      'rakshabandhan': '8-5',
      'janmashtami': '8-12',
      'ganeshChaturthi': '8-25',
      'navratriStart': '9-19',
      'dussehra': '9-29',
      'dhanteras': '10-27',
      'diwali': '10-29',
      'bhaiDooj': '10-31',
      'karavChauth': '10-17',
      'gurnanakJayanti': '11-12',
      
      // Islamic Festivals - 2028
      'eidAlFitr': '2-26',
      'eidAlAdha': '5-4',
      'muharram': '6-3',
      'miladUnNabi': '8-3',
      
      // Other Variable Festivals
      'buddhaPurnima': '5-7',
      'guruPurnima': '7-9',
      'vasantPanchami': '1-31'
    },
    2029: {
      // Lunar Calendar Festivals - 2029
      'holi': '3-30',
      'ramNavami': '4-21',
      'rakshabandhan': '8-24',
      'janmashtami': '8-31',
      'ganeshChaturthi': '9-13',
      'navratriStart': '10-8',
      'dussehra': '10-18',
      'dhanteras': '10-15',
      'diwali': '10-17',
      'bhaiDooj': '10-19',
      'karavChauth': '10-6',
      'gurnanakJayanti': '11-1',
      
      // Islamic Festivals - 2029
      'eidAlFitr': '2-14',
      'eidAlAdha': '4-24',
      'muharram': '5-23',
      'miladUnNabi': '7-23',
      
      // Other Variable Festivals
      'buddhaPurnima': '5-26',
      'guruPurnima': '7-28',
      'vasantPanchami': '2-20'
    }
  };
  
  // Check year-specific festivals first
  if (yearSpecificFestivals[year]) {
    const yearFestivals = yearSpecificFestivals[year];
    const currentDate = `${monthNum}-${day}`;
    
    // Check exact matches for major festivals
    for (const [festivalKey, festivalDate] of Object.entries(yearFestivals)) {
      if (festivalDate === currentDate) {
        switch(festivalKey) {
          case 'holi': return 'Festival of Colors';
          case 'diwali': return 'Festival of Lights';
          case 'ganeshChaturthi': return 'Elephant God Festival';
          case 'dussehra': return 'Dussehra';
          case 'janmashtami': return 'Lord Krishna Festival';
          case 'rakshabandhan': return 'Raksha Bandhan';
          case 'eidAlFitr': return 'Eid al-Fitr';
          case 'eidAlAdha': return 'Eid al-Adha';
          case 'dhanteras': return 'Dhanteras';
          case 'bhaiDooj': return 'Bhai Dooj';
          case 'karavChauth': return 'Karva Chauth';
          case 'gurnanakJayanti': return 'Guru Nanak Jayanti';
          case 'ramNavami': return 'Ram Navami';
          case 'buddhaPurnima': return 'Buddha Purnima';
          case 'guruPurnima': return 'Guru Purnima';
          case 'vasantPanchami': return 'Vasant Panchami';
          case 'navratriStart': return 'Sharad Navratri';
          case 'muharram': return 'Muharram';
          case 'miladUnNabi': return 'Milad un-Nabi';
        }
      }
    }
    
    // Check nearby dates (±3 days) for festival seasons
    for (const [festivalKey, festivalDate] of Object.entries(yearFestivals)) {
      const [fMonth, fDay] = festivalDate.split('-').map(Number);
      const dayDiff = Math.abs((monthNum * 31 + day) - (fMonth * 31 + fDay));
      
      if (dayDiff <= 3 && dayDiff > 0) {
        switch(festivalKey) {
          case 'holi': return 'Festival of Colors';
          case 'diwali': return 'Festival of Lights';
          case 'ganeshChaturthi': return 'Elephant God Festival';
          case 'navratriStart': return 'Sharad Navratri';
          case 'eidAlFitr': return 'Eid Celebration';
          case 'eidAlAdha': return 'Eid Celebration';
        }
      }
    }
  }
  
  // FIXED DATE FESTIVALS - These don't change by year
  const festivalDatabase = {
    // ========== JANUARY ==========
    '1-1': 'New Year Celebration',
    '1-14': 'Makar Sankranti', // Harvest festival (North India)
    '1-15': 'Pongal', // Tamil New Year & Harvest festival
    '1-16': 'Uzhavar Thirunal', // Tamil farmers' day
    '1-26': 'Republic Day',
    '1-5': 'Guru Gobind Singh Jayanti',
    '1-12': 'Swami Vivekananda Jayanti',
    '1-13': 'Lohri',
    '1-23': 'Netaji Subhas Chandra Bose Jayanti',
    
    // ========== FEBRUARY ==========
    '2-14': 'Valentine\'s Day',
    '2-19': 'Shivaji Jayanti', // Maharashtra
    '2-20': 'Shivaji Jayanti',
    
    // ========== MARCH ==========
    '3-8': 'International Women\'s Day',
    '3-14': 'Hola Mohalla', // Sikh festival
    '3-15': 'Gudi Padwa', // Marathi New Year
    '3-17': 'St. Patrick\'s Day',
    '3-20': 'International Day of Happiness',
    '3-21': 'Navroz', // Parsi New Year
    '3-22': 'Navroz',
    
    // ========== APRIL ==========
    '4-1': 'April Fool\'s Day',
    '4-13': 'Baisakhi', // Punjabi New Year & Harvest
    '4-14': 'Baisakhi',
    '4-15': 'Bengali New Year', // Poila Boishakh
    '4-16': 'Vishu', // Malayalam New Year
    '4-22': 'Earth Day',
    '4-23': 'World Book Day',
    
    // ========== MAY ==========
    '5-1': 'Labour Day',
    '5-4': 'Star Wars Day',
    '5-5': 'Cinco de Mayo',
    '5-8': 'Mother\'s Day',
    '5-15': 'International Day of Families',
    
    // ========== JUNE ==========
    '6-19': 'Father\'s Day',
    '6-21': 'International Day of Yoga',
    '6-23': 'International Olympic Day',
    '6-26': 'Rath Yatra', // Jagannath Festival
    '6-27': 'Rath Yatra',
    '6-28': 'Rath Yatra',
    '6-29': 'Rath Yatra',
    
    // ========== JULY ==========
    '7-1': 'Rath Yatra',
    '7-2': 'Rath Yatra',
    '7-4': 'Independence Day (USA)',
    '7-26': 'Kargil Vijay Diwas',
    '7-30': 'International Day of Friendship',
    
    // ========== AUGUST ==========
    '8-9': 'Quit India Day',
    '8-12': 'International Youth Day',
    '8-15': 'Independence Day',
    '8-20': 'Onam', // Kerala harvest festival
    '8-21': 'Onam',
    '8-22': 'Onam',
    '8-23': 'Onam',
    '8-24': 'Onam',
    '8-25': 'Onam',
    '8-26': 'Onam',
    '8-27': 'Onam',
    '8-28': 'Onam',
    '8-29': 'Onam',
    '8-30': 'Thiruvonam', // Main Onam day
    '8-31': 'Gowri Ganesha',
    
    // ========== SEPTEMBER ==========
    '9-5': 'Teachers Day',
    '9-8': 'International Literacy Day',
    '9-21': 'International Day of Peace',
    '9-27': 'World Tourism Day',
    
    // ========== OCTOBER ==========
    '10-2': 'Gandhi Jayanti',
    '10-5': 'World Teachers Day',
    '10-31': 'Halloween',
    
    // ========== NOVEMBER ==========
    '11-11': 'Singles Day',
    '11-14': 'Children\'s Day',
    '11-26': 'Constitution Day',
    '11-27': 'Black Friday Sale',
    '11-28': 'Thanksgiving',
    '11-29': 'Cyber Monday',
    
    // ========== DECEMBER ==========
    '12-20': 'Christmas Joy',
    '12-21': 'Christmas Joy',
    '12-22': 'Christmas Joy',
    '12-23': 'Christmas Joy',
    '12-24': 'Christmas Eve',
    '12-25': 'Christmas Joy',
    '12-26': 'Boxing Day',
    '12-27': 'Christmas Joy',
    '12-28': 'Christmas Joy',
    '12-29': 'Christmas Joy',
    '12-30': 'New Year\'s Eve',
    '12-31': 'New Year\'s Eve',
    
    // ========== REGIONAL FESTIVALS ==========
    // Tamil Nadu specific
    '4-14': 'Tamil New Year',
    '4-15': 'Tamil New Year',
    '10-17': 'Ayudha Puja', // Tamil weapon worship
    '11-6': 'Karthigai Deepam', // Tamil festival of lights
    
    // Punjabi specific
    '1-14': 'Lohri',
    '4-14': 'Vaisakhi',
    '11-4': 'Guru Tegh Bahadur Martyrdom Day',
    
    // Gujarati specific
    '3-13': 'Dhuleti', // Gujarati Holi
    '10-30': 'Gujarati New Year',
    '11-1': 'Gujarati New Year',
    '11-2': 'Gujarati New Year',
    
    // Marathi specific
    '7-11': 'Guru Purnima',
    '8-15': 'Nag Panchami',
    
    // Kannada specific (Karnataka)
    '4-14': 'Ugadi', // Kannada New Year
    '4-15': 'Ugadi',
    '10-15': 'Mysore Dasara',
    '10-16': 'Mysore Dasara',
    '11-1': 'Rajyotsava Day', // Karnataka Formation Day
    
    // Telugu specific (Andhra Pradesh/Telangana)
    '4-13': 'Ugadi', // Telugu New Year
    '8-22': 'Varalakshmi Vratam',
    '10-13': 'Bathukamma',
    '10-14': 'Bathukamma',
    
    // Assamese specific
    '4-14': 'Bihu', // Assamese New Year
    '4-15': 'Bihu',
    '4-16': 'Bihu',
    '10-15': 'Kati Bihu',
    
    // Odia specific (Odisha)
    '4-14': 'Pana Sankranti', // Odia New Year
    '10-15': 'Kumar Purnima',
    
    // ========== JAIN FESTIVALS ==========
    '4-6': 'Mahavir Jayanti',
    '4-7': 'Mahavir Jayanti',
    '8-24': 'Paryushan Parva',
    '8-25': 'Paryushan Parva',
    '8-26': 'Paryushan Parva',
    '8-27': 'Paryushan Parva',
    '8-28': 'Paryushan Parva',
    '8-29': 'Paryushan Parva',
    '8-30': 'Paryushan Parva',
    '8-31': 'Paryushan Parva',
    '9-1': 'Samvatsari',
    
    // ========== CHRISTIAN FESTIVALS ==========
    '3-30': 'Palm Sunday',
    '4-4': 'Good Friday',
    '4-6': 'Easter Sunday',
    '5-15': 'Ascension Day',
    '5-25': 'Pentecost',
    '8-15': 'Assumption of Mary',
    '11-1': 'All Saints Day',
    '12-8': 'Immaculate Conception',
    
    // ========== TRIBAL FESTIVALS ==========
    '1-15': 'Tusu Parab', // Jharkhand tribal festival
    '4-13': 'Poila Boishakh',
    '4-14': 'Sohrai', // Jharkhand tribal harvest
    '10-15': 'Karam Festival', // Tribal festival
    '11-15': 'Sohrai Festival',
    
    // ========== NORTH-EAST INDIAN FESTIVALS ==========
    '1-15': 'Magh Bihu', // Assam
    '2-12': 'Lui-ngai-ni', // Manipur
    '4-13': 'Cheiraoba', // Manipuri New Year
    '4-13': 'Chapchar Kut', // Mizoram
    '11-1': 'Ningol Chakkouba', // Manipur
    '11-1': 'Pawl Kut', // Mizoram
    '12-1': 'Sekrenyi', // Nagaland
    
    // ========== SEASONAL & HARVEST FESTIVALS ==========
    '1-13': 'Bhogali Bihu', // Assam harvest
    '1-15': 'Makaravilakku', // Kerala
    '6-21': 'Summer Solstice',
    '9-22': 'Autumnal Equinox',
    '12-21': 'Winter Solstice',
    '3-20': 'Vernal Equinox',
    
    // ========== MODERN CELEBRATIONS ==========
    '2-29': 'Leap Day', // Only in leap years
    '9-11': 'Patriot Day',
    '11-11': 'Veterans Day',
    '12-26': 'Boxing Day'
  };
  
  const dateKey = `${monthNum}-${day}`;
  
  // Check for exact festival match in name database first
  for (const [festivalName, festivalData] of Object.entries(festivalNameDatabase)) {
    const [startMonth, startDay] = festivalData.dates.start.split('-').map(Number);
    const [endMonth, endDay] = festivalData.dates.end.split('-').map(Number);
    
    if (monthNum === startMonth && day >= startDay && day <= endDay) {
      return festivalName;
    }
    if (monthNum === endMonth && day >= startDay && day <= endDay) {
      return festivalName;
    }
  }
  
  // Check for exact festival match in fixed dates
  if (festivalDatabase[dateKey]) {
    return festivalDatabase[dateKey];
  }
  
  // Check nearby dates (±3 days) for festivals - reduced range to be more precise
  for (let offset = -3; offset <= 3; offset++) {
    const checkDate = moment(date).add(offset, 'days');
    const checkKey = `${checkDate.month() + 1}-${checkDate.date()}`;
    if (festivalDatabase[checkKey]) {
      return festivalDatabase[checkKey];
    }
  }
  
  // Monsoon specific logic (June-September in India)
  if (monthNum >= 6 && monthNum <= 9) {
    const monsoonNames = [
      'Monsoon Magic',
      'Rainy Day Celebration',
      'Petrichor Festival',
      'Monsoon Melody',
      'Rain Dance Festival',
      'Cloudy Skies Festival',
      'Monsoon Vibes',
      'Seasonal Celebration'
    ];
    return monsoonNames[Math.floor(Math.random() * monsoonNames.length)];
  }
  
  // Enhanced season-based festival names with cultural context
  const seasonalFestivals = {
    'Spring': [
      'Spring Bloom Festival', 'Blossom Celebration', 'Fresh Start Festival', 
      'Spring Awakening', 'Garden Festival', 'Flower Power Festival',
      'Spring Harvest', 'Nature Revival Festival'
    ],
    'Summer': [
      'Summer Sunshine Festival', 'Beach Vibes Celebration', 'Tropical Festival', 
      'Summer Solstice', 'Heat Wave Sale', 'Sunny Days Festival',
      'Summer Carnival', 'Vacation Festival'
    ],
    'Autumn': [
      'Autumn Harvest Festival', 'Golden Leaves Celebration', 'Cozy Fall Festival', 
      'Autumn Breeze', 'Harvest Moon Festival', 'Apple Festival',
      'Fall Colors Festival', 'Thanksgiving Season'
    ],
    'Winter': [
      'Winter Wonderland', 'Cozy Winter Festival', 'Frost Festival', 
      'Winter Magic', 'Snow Day Celebration', 'Winter Solstice Festival',
      'Holiday Season', 'Winter Carnival'
    ]
  };
  
  const seasonFestivals = seasonalFestivals[season] || seasonalFestivals['Summer'];
  return seasonFestivals[Math.floor(Math.random() * seasonFestivals.length)];
}

// Extract colors from HTML using Cheerio
function extractColorsFromHTML($) {
  const colors = [];
  
  // Look for CSS color properties
  $('*').each(function() {
    const element = $(this);
    const style = element.attr('style');
    
    if (style) {
      const colorMatches = style.match(/(background-color|color|border-color):\s*([^;]+)/g);
      if (colorMatches) {
        colorMatches.forEach(match => {
          const color = match.split(':')[1].trim();
          if (color.match(/^#[0-9A-Fa-f]{6}$/)) {
            colors.push(color);
          }
        });
      }
    }
  });
  
  // Look for common Shopify theme colors
  const commonSelectors = [
    '.header', '.site-header', '.main-header',
    '.btn', '.button', '.btn-primary',
    '.nav', '.navigation', '.menu',
    '.footer', '.site-footer'
  ];
  
  commonSelectors.forEach(selector => {
    const elements = $(selector);
    if (elements.length > 0) {
      // This is a simplified color extraction
      // In a real implementation, you'd parse computed styles
      const defaultColors = ['#1a73e8', '#007cba', '#4285f4', '#34a853', '#ea4335'];
      colors.push(defaultColors[Math.floor(Math.random() * defaultColors.length)]);
    }
  });
  
  return [...new Set(colors)]; // Remove duplicates
}

// Generate colors based on domain name (fallback)
function generateDomainBasedColors(domain) {
  const hash = domain.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  
  const hue = Math.abs(hash) % 360;
  const saturation = 70;
  const lightness = 50;
  
  const primary = hslToHex(hue, saturation, lightness);
  const header = hslToHex(hue, saturation, lightness - 15);
  
  return { primary, header };
}

// Convert HSL to HEX
function hslToHex(h, s, l) {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// Adjust color brightness
function adjustColorBrightness(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  
  return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
    (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
}

// Helper function to get current active festival from database
async function getCurrentFestival(shopDomain = 'your-shop.myshopify.com') {
  try {
    console.log(`🔍 getCurrentFestival called with shopDomain: ${shopDomain}`);
    const settings = await PopupSettings.findOne({ shopDomain });
    
    if (!settings) {
      console.log('❌ No settings found for shop domain');
      return null;
    }
    
    if (!settings.festivals || settings.festivals.length === 0) {
      console.log('❌ No festivals found in settings');
      return null;
    }
    
    console.log(`📅 Found ${settings.festivals.length} festivals in database`);
    const today = new Date().toISOString().split('T')[0]; // Use ISO date instead of moment
    console.log(`📅 Today is: ${today}`);
    
    for (const festival of settings.festivals) {
      // Extract date part from ISO strings - handle both string and Date objects
      let startDateStr, endDateStr;
      
      if (typeof festival.startDate === 'string') {
        startDateStr = festival.startDate.split('T')[0];
      } else {
        startDateStr = festival.startDate.toISOString().split('T')[0];
      }
      
      if (typeof festival.endDate === 'string') {
        endDateStr = festival.endDate.split('T')[0];
      } else {
        endDateStr = festival.endDate.toISOString().split('T')[0];
      }
      
      console.log(`🎪 Checking festival "${festival.name}": ${startDateStr} to ${endDateStr}`);
      console.log(`🔢 String comparison: "${today}" >= "${startDateStr}" = ${today >= startDateStr}`);
      console.log(`🔢 String comparison: "${today}" <= "${endDateStr}" = ${today <= endDateStr}`);
      
      // Simple string comparison (YYYY-MM-DD format)
      if (today >= startDateStr && today <= endDateStr) {
        console.log(`✅ Festival "${festival.name}" is ACTIVE!`);
        return festival;
      } else {
        console.log(`❌ Festival "${festival.name}" is INACTIVE`);
      }
    }
    
    console.log('🚫 No active festivals found');
    return null;
  } catch (error) {
    console.error('💥 Error getting current festival:', error);
    return null;
  }
}

// Synchronous version for backward compatibility - DEPRECATED
// This function should NOT be used for new festivals - it only returns festival names
// All new festivals should use the AI-generated system with dynamic colors and user-provided offers
function getCurrentFestivalSync() {
  console.warn('⚠️ getCurrentFestivalSync() is deprecated. Use AI-generated festivals instead.');
  
  const today = moment();
  const currentYear = today.year();
  
  // Search the festival name database for current date
  for (const [festivalName, festivalData] of Object.entries(festivalNameDatabase)) {
    const [startMonth, startDay] = festivalData.dates.start.split('-').map(Number);
    const [endMonth, endDay] = festivalData.dates.end.split('-').map(Number);
    
    let startDate = moment(`${currentYear}-${startMonth.toString().padStart(2, '0')}-${startDay.toString().padStart(2, '0')}`);
    let endDate = moment(`${currentYear}-${endMonth.toString().padStart(2, '0')}-${endDay.toString().padStart(2, '0')}`);
    
    // Handle year transition (like New Year)
    if (endMonth < startMonth) {
      if (today.month() + 1 >= startMonth) {
        endDate = moment(`${currentYear + 1}-${endMonth.toString().padStart(2, '0')}-${endDay.toString().padStart(2, '0')}`);
      } else {
        startDate = moment(`${currentYear - 1}-${startMonth.toString().padStart(2, '0')}-${startDay.toString().padStart(2, '0')}`);
      }
    }
    
    if (today.isBetween(startDate, endDate, 'day', '[]')) {
      // Return ONLY name - no hardcoded colors or offers
      return {
        name: festivalName,
        dates: festivalData.dates,
        // Colors and offers should come from AI system, not hardcoded values
        isLegacyFestival: true
      };
    }
  }
  
  return null;
}

// Dynamic title generation using NLP
async function generateDynamicTitle(content, shopDomain = 'your-shop.myshopify.com') {
  try {
    // Create tokenizer instances
    const sentenceTokenizer = new natural.SentenceTokenizer();
    const wordTokenizer = new natural.WordTokenizer();
    
    const sentences = sentenceTokenizer.tokenize(content);
    const words = wordTokenizer.tokenize(content.toLowerCase());
    
    // Remove stop words and short words
    const stopWords = natural.stopwords || ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'are', 'this', 'that', 'they', 'them', 'their', 'over', 'while', 'from'];
    const filteredWords = words.filter(word => 
      !stopWords.includes(word) && 
      word.length > 3 && 
      /^[a-zA-Z]+$/.test(word) // Only alphabetic words
    );
    
    console.log('Debug - Filtered words:', filteredWords.slice(0, 10));
    
    // Get word frequency
    const wordFreq = {};
    filteredWords.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });
    
    // Get top keywords
    const topKeywords = Object.entries(wordFreq)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([word]) => word);
    
    console.log('Debug - Word frequencies:', Object.entries(wordFreq).sort(([,a], [,b]) => b - a).slice(0, 5));
    console.log('Debug - Top keywords:', topKeywords);
    
    // Generate title based on keywords and content
    if (topKeywords.length > 0) {
      const mainKeyword = topKeywords[0].charAt(0).toUpperCase() + topKeywords[0].slice(1);
      const festival = await getCurrentFestival(shopDomain);
      
      if (festival) {
        return `${festival.name} Special: ${mainKeyword} Insights & More!`;
      }
      
      return `Latest Update: ${mainKeyword} & Essential Tips`;
    }
    
    return 'Weekly Newsletter: Fresh Content & Special Offers';
  } catch (error) {
    console.error('Error generating dynamic title:', error);
    // Fallback to simple title generation
    const words = content.toLowerCase().split(/\s+/);
    const commonWords = words.filter(word => word.length > 4);
    
    if (commonWords.length > 0) {
      const mainWord = commonWords[0].charAt(0).toUpperCase() + commonWords[0].slice(1);
      return `Weekly Update: ${mainWord} & More!`;
    }
    
    return 'Weekly Newsletter: Fresh Content & Special Offers';
  }
}

// ==================== HELPER FUNCTIONS ====================
// Essential helper functions for the application

// Remove duplicate festivals based on multiple criteria
function removeDuplicateFestivals(festivals) {
  const uniqueFestivals = [];
  const seen = new Set();
  
  for (const festival of festivals) {
    // Create a unique key based on multiple criteria
    const key = `${festival.offer}_${festival.startDate}_${festival.endDate}_${festival.name}`;
    
    if (!seen.has(key)) {
      seen.add(key);
      uniqueFestivals.push(festival);
    } else {
      console.log('🗑️ Removing duplicate festival:', festival.name, festival.offer);
    }
  }
  
  console.log(`🧹 Cleaned festivals: ${festivals.length} → ${uniqueFestivals.length}`);
  return uniqueFestivals;
}

// Function to generate discount code based on festival name and offer (max 6 characters)
function generateDiscountCode(festivalName, offer) {
  try {
    // Extract key elements from festival name
    const festivalWords = festivalName.replace(/[^a-zA-Z\s]/g, '').split(' ')
      .filter(word => word.length > 2)
      .map(word => word.toUpperCase());
    
    // Extract percentage or discount amount from offer
    const percentMatch = offer.match(/(\d+)%/);
    const amountMatch = offer.match(/\$(\d+)/);
    
    let discountCode = '';
    let numberPart = '';
    
    // Get the number part first (1-2 digits max)
    if (percentMatch) {
      numberPart = percentMatch[1].slice(0, 2); // Max 2 digits
    } else if (amountMatch) {
      numberPart = amountMatch[1].slice(0, 2); // Max 2 digits
    } else {
      // Extract any number from offer
      const numberMatch = offer.match(/(\d+)/);
      if (numberMatch) {
        numberPart = numberMatch[1].slice(0, 2); // Max 2 digits
      } else {
        numberPart = '25'; // Default value
      }
    }
    
    // Calculate remaining characters for text part
    const remainingChars = 6 - numberPart.length;
    
    // Generate text part with remaining characters
    if (festivalWords.length >= 2) {
      // Use parts of first two words
      const firstWord = festivalWords[0].slice(0, Math.ceil(remainingChars / 2));
      const secondWord = festivalWords[1].slice(0, remainingChars - firstWord.length);
      discountCode = firstWord + secondWord;
    } else if (festivalWords.length === 1) {
      discountCode = festivalWords[0].slice(0, remainingChars);
    } else {
      // Fallback to season-based naming
      const month = moment().month() + 1;
      const season = getSeason(month);
      discountCode = season.toUpperCase().slice(0, remainingChars);
    }
    
    // Combine text and number parts
    discountCode = (discountCode + numberPart).replace(/[^A-Z0-9]/g, '');
    
    // Ensure exactly 6 characters
    if (discountCode.length > 6) {
      discountCode = discountCode.slice(0, 6);
    } else if (discountCode.length < 6) {
      // Pad with random characters if needed
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      while (discountCode.length < 6) {
        discountCode += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    }
    
    console.log('🎫 Generated 6-char discount code:', discountCode, 'from festival:', festivalName, 'and offer:', offer);
    return discountCode;
    
  } catch (error) {
    console.error('Error generating discount code:', error);
    // Fallback to simple 6-character random code
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let fallbackCode = '';
    for (let i = 0; i < 6; i++) {
      fallbackCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return fallbackCode;
  }
}

// Routes

// Health check endpoint with database status
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    database: 'Shopify Metafields (FREE)',
    timestamp: new Date().toISOString(),
    message: 'Festival Popup API running with Shopify built-in database'
  });
});

// Migration status endpoint
app.get('/api/migration-status', (req, res) => {
  res.json({
    status: 'completed',
    database: {
      previous: 'MongoDB (External)',
      current: 'Shopify Metafields (Built-in, FREE)',
      migrated: true
    },
    features: {
      popupSettings: 'migrated',
      newsletterSubscribers: 'migrated',
      blogPosts: 'migrated',
      shopSettings: 'migrated',
      allFunctionality: 'preserved'
    },
    benefits: [
      'Zero database costs',
      'No external dependencies',
      'Built-in Shopify reliability',
      'Automatic backups',
      'Same functionality'
    ]
  });
});

// ==================== APP EMBEDS API ENDPOINTS ====================
// These endpoints handle the 3-field festival creation from App Embeds

// Sync App Embeds settings with backend
app.post('/api/app-embeds/sync/:shopDomain', async (req, res) => {
  try {
    const { shopDomain } = req.params;
    const embedsSettings = req.body;
    
    console.log(`🔄 App Embeds sync request for: ${shopDomain}`);
    console.log('📋 Embeds settings received:', embedsSettings);
    
    // Get existing popup settings
    let popupSettings = await PopupSettings.findOne({ shopDomain });
    
    if (!popupSettings) {
      popupSettings = new PopupSettings({ shopDomain });
    }
    
    // Check if we need to create a new festival
    if (embedsSettings.create_festival_trigger === true && 
        embedsSettings.festival_offer && 
        embedsSettings.festival_start_date && 
        embedsSettings.festival_end_date) {
      
      console.log('🎯 Creating new festival from App Embeds...');
      
      // Check for duplicates using multiple criteria
      const isDuplicate = popupSettings.festivals.some(f => {
        const sameOffer = f.offer === embedsSettings.festival_offer;
        const sameStartDate = new Date(f.startDate).toDateString() === new Date(embedsSettings.festival_start_date).toDateString();
        const sameEndDate = new Date(f.endDate).toDateString() === new Date(embedsSettings.festival_end_date).toDateString();
        const recentCreation = f.createdAt && (new Date() - new Date(f.createdAt)) < (10 * 60 * 1000);
        
        return sameOffer || (sameStartDate && sameEndDate) || recentCreation;
      });
      
      if (isDuplicate) {
        console.log('🚫 Duplicate festival detected, skipping creation');
        return res.json({
          success: true,
          message: 'Festival already exists',
          duplicate: true
        });
      }
      
      // Generate festival using AI
      try {
        const aiResponse = await axios.post(`http://localhost:${PORT}/api/create-smart-festival`, {
          shopDomain,
          offer: embedsSettings.festival_offer,
          startDate: embedsSettings.festival_start_date,
          endDate: embedsSettings.festival_end_date
        });
        
        if (aiResponse.data.success) {
          console.log('✅ Festival created successfully via App Embeds');
          return res.json({
            success: true,
            message: 'Festival created successfully',
            festival: aiResponse.data.festival
          });
        }
      } catch (aiError) {
        console.error('❌ AI festival creation failed:', aiError.message);
        
        // Fallback: Create basic festival
        const fallbackFestival = {
          name: embedsSettings.generated_festival_name || 'Special Festival',
          offer: embedsSettings.festival_offer,
          startDate: embedsSettings.festival_start_date,
          endDate: embedsSettings.festival_end_date,
          discountCode: generateDiscountCode('Special Festival', embedsSettings.festival_offer),
          backgroundColor: '#667eea',
          textColor: '#ffffff',
          headerColor: '#764ba2',
          createdAt: new Date().toISOString(),
          createdViaAppEmbeds: true
        };
        
        popupSettings.festivals.push(fallbackFestival);
        await popupSettings.save();
        
        console.log('✅ Fallback festival created via App Embeds');
        
        // 🚀 AUTO-EMAIL: Send newsletter to subscribers when new fallback festival is created
        try {
          console.log(`🚀 Auto-generating newsletter for newly created fallback festival: ${fallbackFestival.name}`);
          const newsletterResult = await generateAndSendFestivalNewsletter(shopDomain, fallbackFestival);
          
          if (newsletterResult.success) {
            console.log(`✅ Auto-newsletter sent successfully: ${newsletterResult.emailsSent} emails sent`);
          } else {
            console.log(`⚠️ Auto-newsletter failed: ${newsletterResult.error}`);
          }
        } catch (emailError) {
          console.error('❌ Auto-newsletter error:', emailError.message);
          // Don't fail the festival creation if email fails
        }
        return res.json({
          success: true,
          message: 'Festival created with fallback method',
          festival: fallbackFestival
        });
      }
    }
    
    // Update other settings
    if (embedsSettings.popup_enabled !== undefined) {
      popupSettings.isActive = embedsSettings.popup_enabled;
    }
    
    if (embedsSettings.popup_delay) {
      popupSettings.displaySettings.showDelay = embedsSettings.popup_delay * 1000;
    }
    
    if (embedsSettings.popup_frequency) {
      popupSettings.displaySettings.displayFrequency = embedsSettings.popup_frequency;
    }
    
    await popupSettings.save();
    
    res.json({
      success: true,
      message: 'Settings synced successfully',
      settings: popupSettings.toObject()
    });
    
  } catch (error) {
    console.error('❌ App Embeds sync error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get App Embeds settings
app.get('/api/app-embeds/settings/:shopDomain', async (req, res) => {
  try {
    const { shopDomain } = req.params;
    const settings = await PopupSettings.findOne({ shopDomain });
    
    if (!settings) {
      return res.json({
        success: true,
        settings: {
          popup_enabled: true,
          popup_delay: 3,
          popup_frequency: 'once_per_session',
          festivals: []
        }
      });
    }
    
    res.json({
      success: true,
      settings: {
        popup_enabled: settings.isActive,
        popup_delay: Math.floor(settings.displaySettings.showDelay / 1000),
        popup_frequency: settings.displaySettings.displayFrequency,
        festivals: settings.festivals
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting App Embeds settings:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Cleanup duplicate festivals
app.post('/api/app-embeds/cleanup/:shopDomain', async (req, res) => {
  try {
    const { shopDomain } = req.params;
    console.log(`🧹 Cleaning up duplicates for: ${shopDomain}`);
    
    const settings = await PopupSettings.findOne({ shopDomain });
    if (!settings || !settings.festivals) {
      return res.json({
        success: true,
        message: 'No festivals to clean up'
      });
    }
    
    const originalCount = settings.festivals.length;
    settings.festivals = removeDuplicateFestivals(settings.festivals);
    await settings.save();
    
    const cleanedCount = settings.festivals.length;
    const removedCount = originalCount - cleanedCount;
    
    res.json({
      success: true,
      message: `Cleanup completed: ${removedCount} duplicates removed`,
      originalCount,
      cleanedCount,
      removedCount
    });
    
  } catch (error) {
    console.error('❌ Cleanup error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Serve admin panel
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

// ==================== NEWSLETTER ANALYTICS API ENDPOINT ====================
// Initialize sample data for new deployments
async function initializeSampleDataIfNeeded(shopDomain) {
  try {
    // Check if any subscribers exist
    const existingSubscribers = await NewsletterSubscriber.find({ shopDomain });
    
    if (existingSubscribers.length === 0) {
      console.log(`🔧 No subscribers found for ${shopDomain}, creating sample data...`);
      
      // Create sample subscribers
      const sampleSubscribers = [
        {
          email: 'festival-lover@example.com',
          shopDomain: shopDomain,
          subscribedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
          isActive: true,
          subscriptionType: 'festival',
          preferences: { festivals: true, offers: true, blogUpdates: false }
        },
        {
          email: 'blog-reader@example.com',
          shopDomain: shopDomain,
          subscribedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
          isActive: true,
          subscriptionType: 'blog',
          preferences: { festivals: false, offers: false, blogUpdates: true }
        },
        {
          email: 'all-updates@example.com',
          shopDomain: shopDomain,
          subscribedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
          isActive: true,
          subscriptionType: 'festival',
          preferences: { festivals: true, offers: true, blogUpdates: true }
        }
      ];
      
      // Save sample subscribers
      for (const subData of sampleSubscribers) {
        const subscriber = new NewsletterSubscriber(subData);
        await subscriber.save();
      }
      
      console.log(`✅ Created ${sampleSubscribers.length} sample subscribers for ${shopDomain}`);
    }
    
    // Only create sample festival if NO popup settings exist at all (first time setup)
    const popupSettings = await PopupSettings.findOne({ shopDomain });
    if (!popupSettings) {
      console.log(`🔧 No popup settings found for ${shopDomain}, creating initial sample festival...`);
      
      // Create a sample active festival ONLY for first-time setup
      const today = new Date();
      const endDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
      
      const sampleFestival = {
        name: 'Independence Day',
        startDate: today,
        endDate: endDate,
        offer: '25% OFF',
        discountCode: 'INDA25',
        backgroundColor: '#cb1d11',
        textColor: '#ffffff',
        backgroundImageUrl: 'https://image.pollinations.ai/prompt/beautiful%20festive%20independence%20day%20celebration%20background%20with%20decorative%20elements%2C%20vibrant%20colors%2C%20celebration%2C%20festive%20atmosphere%2C%20high%20quality%2C%20professional%20photography%2C%20detailed?width=815&height=593&seed=648458&model=flux&enhance=true&nologo=true',
        isInfinite: true,
        createdAt: new Date(),
        createdViaQuickSetup: true
      };
      
      await PopupSettings.findOneAndUpdate(
        { shopDomain },
        {
          shopDomain,
          isActive: true,
          festivals: [sampleFestival],
          displaySettings: {
            showDelay: 3000,
            displayFrequency: 'always', // Changed to always for testing
            position: 'center'
          }
        },
        { upsert: true, new: true }
      );
      
      console.log(`✅ Created initial sample festival for ${shopDomain}`);
    } else {
      console.log(`ℹ️ Popup settings already exist for ${shopDomain}, skipping sample festival creation`);
    }
  } catch (error) {
    console.error('❌ Error initializing sample data:', error);
  }
}

// Analytics endpoint for admin dashboard using Shopify Metafields

app.get('/api/newsletter/analytics/:shopDomain', async (req, res) => {
  try {
    // Add CORS headers for Shopify embedded app
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, ngrok-skip-browser-warning, Accept, Cache-Control, Pragma, Expires, X-Requested-With',
      'Access-Control-Allow-Credentials': 'true',
      'ETag': `"${Date.now()}-${Math.random()}"`,
      'Last-Modified': new Date().toUTCString(),
      'Vary': 'Accept-Encoding'
    });
    
    const { shopDomain } = req.params;
    console.log(`📊 Getting newsletter analytics for: ${shopDomain}`);
    
    // Initialize sample data if no subscribers exist (for new deployments)
    await initializeSampleDataIfNeeded(shopDomain);
    
    // Get all subscribers
    const allSubscribers = await NewsletterSubscriber.find({ shopDomain });
    const activeSubscribers = await NewsletterSubscriber.find({ shopDomain, isActive: true });
    const festivalSubscribers = await NewsletterSubscriber.find({ 
      shopDomain, 
      isActive: true, 
      subscriptionType: 'festival' 
    });
    const blogSubscribers = await NewsletterSubscriber.find({ 
      shopDomain, 
      isActive: true, 
      subscriptionType: 'blog',
      'preferences.blogUpdates': true 
    });
    
    // Get blog posts
    const blogPosts = await BlogPost.find({ shopDomain });
    const sentNewsletters = blogPosts.filter(post => post.sentNewsletter);
    
    // Calculate recent subscribers (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentSubscribers = activeSubscribers.filter(sub => 
      new Date(sub.subscribedAt) >= thirtyDaysAgo
    );
    
    // Get current active festivals
    const popupSettings = await PopupSettings.findOne({ shopDomain });
    const activeFestivals = [];
    
    if (popupSettings && popupSettings.festivals) {
      const today = new Date().toISOString().split('T')[0];
      
      for (const festival of popupSettings.festivals) {
        let startDateStr, endDateStr;
        
        if (typeof festival.startDate === 'string') {
          startDateStr = festival.startDate.split('T')[0];
        } else {
          startDateStr = festival.startDate.toISOString().split('T')[0];
        }
        
        if (typeof festival.endDate === 'string') {
          endDateStr = festival.endDate.split('T')[0];
        } else {
          endDateStr = festival.endDate.toISOString().split('T')[0];
        }
        
        if (today >= startDateStr && today <= endDateStr) {
          activeFestivals.push(festival);
        }
      }
    }
    
    const analytics = {
      totalSubscribers: allSubscribers.length,
      activeSubscribers: activeSubscribers.length,
      festivalSubscribers: festivalSubscribers.length,
      blogSubscribers: blogSubscribers.length,
      blogPostsTotal: blogPosts.length,
      blogPostsSent: sentNewsletters.length,
      recentSubscribers: recentSubscribers.length,
      activeFestivals: activeFestivals,
      currentFestival: activeFestivals.length > 0 ? activeFestivals[0] : null,
      localTime: new Date().toISOString(),
      shopDomain: shopDomain
    };
    
    console.log(`✅ Analytics generated for ${shopDomain}:`, {
      total: analytics.totalSubscribers,
      active: analytics.activeSubscribers,
      festivals: analytics.activeFestivals.length
    });
    
    res.json(analytics);
  } catch (error) {
    console.error('❌ Error getting newsletter analytics:', error);
    res.status(500).json({ 
      error: error.message,
      totalSubscribers: 0,
      activeSubscribers: 0,
      festivalSubscribers: 0,
      blogSubscribers: 0,
      blogPostsTotal: 0,
      blogPostsSent: 0,
      recentSubscribers: 0,
      activeFestivals: [],
      currentFestival: null
    });
  }
});

// ==================== SHOPIFY SHOP SETTINGS API ENDPOINTS ====================
// These endpoints handle shop-specific email configuration using Shopify Metafields

// Get shop settings
app.get('/api/shop-settings/:shopDomain', async (req, res) => {
  try {
    const { shopDomain } = req.params;
    console.log(`📋 Getting shop settings for: ${shopDomain}`);
    
    const settings = await ShopSettings.getShopSettings(shopDomain);
    
    res.json({
      success: true,
      settings: settings.toObject ? settings.toObject() : settings
    });
  } catch (error) {
    console.error('❌ Error getting shop settings:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update shop email settings
app.post('/api/shop-settings/:shopDomain/email', async (req, res) => {
  try {
    const { shopDomain } = req.params;
    const emailData = req.body;
    
    console.log(`📧 Updating email settings for: ${shopDomain}`);
    
    const settings = await ShopSettings.updateEmailSettings(shopDomain, emailData);
    
    res.json({
      success: true,
      settings: settings.toObject ? settings.toObject() : settings,
      message: 'Email settings updated successfully'
    });
  } catch (error) {
    console.error('❌ Error updating email settings:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update festival template settings
app.post('/api/shop-settings/:shopDomain/festival-template', async (req, res) => {
  try {
    const { shopDomain } = req.params;
    const { subject, message, autoGenerate } = req.body;
    
    console.log(`🎪 Updating festival template for: ${shopDomain}`);
    
    const settings = await ShopSettings.findOneAndUpdate(
      { shop: shopDomain },
      {
        festivalSettings: {
          autoGenerate: autoGenerate !== undefined ? autoGenerate : true,
          emailTemplate: {
            subject: subject || '🎉 Special Festival Offer from {{storeName}}!',
            message: message || 'Celebrate {{festivalName}} with exclusive deals!'
          }
        }
      },
      { upsert: true, new: true }
    );
    
    res.json({
      success: true,
      settings: settings.toObject ? settings.toObject() : settings,
      message: 'Festival template updated successfully'
    });
  } catch (error) {
    console.error('❌ Error updating festival template:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Send test email
app.post('/api/shop-settings/:shopDomain/email/test', async (req, res) => {
  try {
    const { shopDomain } = req.params;
    const { testEmail } = req.body;
    
    console.log(`📧 Sending test email for: ${shopDomain} to: ${testEmail}`);
    
    if (!testEmail) {
      return res.status(400).json({
        success: false,
        error: 'Test email address is required'
      });
    }
    
    // Create email transporter for this shop
    const shopTransporter = await createShopEmailTransporter(shopDomain);
    if (!shopTransporter) {
      return res.status(500).json({
        success: false,
        error: 'Email not configured for this shop'
      });
    }
    
    // Get shop settings for email details
    const shopSettings = await ShopSettings.getShopSettings(shopDomain);
    
    // Send test email
    const result = await shopTransporter.sendMail({
      from: `"${shopSettings.emailSettings.fromName}" <${shopSettings.emailSettings.fromEmail}>`,
      to: testEmail,
      subject: '🧪 Test Email from Festival Popup App',
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">🧪 Test Email</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Festival Popup App Email Configuration Test</p>
          </div>
          
          <div style="background: #ffffff; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e1e5e9;">
            <h2 style="color: #333; margin: 0 0 20px 0;">✅ Email Configuration Successful!</h2>
            <p style="color: #666; line-height: 1.6; margin: 0 0 20px 0;">
              This test email confirms that your email settings are working correctly. Your customers will now receive:
            </p>
            <ul style="color: #666; line-height: 1.8; margin: 0 0 20px 20px;">
              <li>Festival newsletter updates</li>
              <li>Special offer notifications</li>
              <li>Blog post updates (if enabled)</li>
            </ul>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #333; margin: 0 0 10px 0;">📧 Email Settings</h3>
              <p style="color: #666; margin: 0; font-size: 14px;">
                <strong>From:</strong> ${shopSettings.emailSettings.fromName} &lt;${shopSettings.emailSettings.fromEmail}&gt;<br>
                <strong>Provider:</strong> ${shopSettings.emailSettings.provider}<br>
                <strong>Shop:</strong> ${shopDomain}
              </p>
            </div>
            <p style="color: #999; font-size: 12px; margin: 20px 0 0 0; text-align: center;">
              This is an automated test email from Festival Popup App
            </p>
          </div>
        </div>
      `
    });
    
    res.json({
      success: true,
      message: 'Test email sent successfully',
      messageId: result.messageId
    });
  } catch (error) {
    console.error('❌ Error sending test email:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Disable email settings
app.post('/api/shop-settings/:shopDomain/email/disable', async (req, res) => {
  try {
    const { shopDomain } = req.params;
    
    console.log(`📧 Disabling email for: ${shopDomain}`);
    
    const settings = await ShopSettings.findOneAndUpdate(
      { shop: shopDomain },
      {
        emailSettings: {
          enabled: false,
          provider: 'gmail',
          fromEmail: '',
          fromName: '',
          smtpHost: '',
          smtpPort: 587,
          secure: true,
          encryptedPassword: ''
        }
      },
      { upsert: true, new: true }
    );
    
    res.json({
      success: true,
      settings: settings.toObject ? settings.toObject() : settings,
      message: 'Email functionality disabled'
    });
  } catch (error) {
    console.error('❌ Error disabling email:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get current popup settings
app.get('/api/popup/:shopDomain', async (req, res) => {
  try {
    // Add cache-busting and CORS headers with stronger cache prevention
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, ngrok-skip-browser-warning, Accept, Cache-Control, Pragma, Expires, X-Requested-With',
      'Access-Control-Allow-Credentials': 'true',
      'ETag': `"${Date.now()}-${Math.random()}"`,
      'Last-Modified': new Date().toUTCString(),
      'Vary': 'Accept-Encoding'
    });
    
    const { shopDomain } = req.params;
    console.log(`🔄 Fetching fresh popup settings for: ${shopDomain}`);
    
    let settings = await PopupSettings.findOne({ shopDomain });
    
    if (!settings) {
      // Only create default settings if no custom settings exist
      settings = new PopupSettings({
        shopDomain,
        festivals: [],
        isActive: false
      });
      await settings.save();
      console.log(`✅ Created default settings for: ${shopDomain}`);
    } else {
      console.log(`✅ Found existing settings for: ${shopDomain}`, {
        isActive: settings.isActive,
        festivalsCount: settings.festivals?.length || 0,
        festivals: settings.festivals?.map(f => ({ name: f.name, code: f.discountCode })) || []
      });
    }
    
    res.json(settings);
  } catch (error) {
    console.error('❌ Error fetching popup settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update popup settings
app.post('/api/popup/:shopDomain', async (req, res) => {
  try {
    const { shopDomain } = req.params;
    console.log(`🔄 Admin panel updating settings for: ${shopDomain}`);
    console.log('📝 New settings:', {
      isActive: req.body.isActive,
      festivalsCount: req.body.festivals?.length || 0,
      festivals: req.body.festivals?.map(f => ({ name: f.name, code: f.discountCode })) || []
    });
    
    // Get the current settings to check for new festivals
    const existingSettings = await PopupSettings.findOne({ shopDomain });
    const existingFestivalIds = existingSettings?.festivals?.map(f => f._id?.toString()) || [];
    
    const settings = await PopupSettings.findOneAndUpdate(
      { shopDomain },
      req.body,
      { new: true, upsert: true }
    );
    
    // Check for festivals that became active and need auto-newsletter
    if (settings.festivals && settings.festivals.length > 0) {
      const now = new Date();
      
      // Only check festivals for auto-newsletter if they are:
      // 1. Currently active AND
      // 2. Haven't had auto-newsletter sent yet
      const festivalsNeedingNewsletter = settings.festivals.filter(festival => {
        if (!festival.name || !festival.offer || !festival.discountCode) {
          return false; // Skip incomplete festivals
        }
        
        if (festival.autoNewsletterSent) {
          return false; // Newsletter already sent
        }
        
        const startDate = new Date(festival.startDate);
        const endDate = new Date(festival.endDate);
        const isActive = now >= startDate && now <= endDate;
        
        return isActive; // Only active festivals that haven't had newsletter sent
      });
      
      if (festivalsNeedingNewsletter.length > 0) {
        console.log(`🎪 Found ${festivalsNeedingNewsletter.length} festival(s) needing auto-newsletter...`);
        
        // Process each festival for auto-newsletter (async in background)
        festivalsNeedingNewsletter.forEach(async (festival) => {
          try {
            console.log(`📅 Festival "${festival.name}" is active and needs newsletter:`, {
              now: now.toISOString(),
              start: new Date(festival.startDate).toISOString(),
              end: new Date(festival.endDate).toISOString(),
              autoNewsletterSent: festival.autoNewsletterSent
            });
            
            console.log(`🚀 Auto-generating newsletter for active festival: ${festival.name}`);
            const newsletterResult = await generateAndSendFestivalNewsletter(shopDomain, festival);
            
            if (newsletterResult.success) {
              console.log(`✅ Auto-newsletter sent successfully for ${festival.name}:`, newsletterResult.message);
              
              // Mark festival as having newsletter sent - Compatible with file-based storage
              const updatedSettings = await PopupSettings.findOne({ shopDomain });
              if (updatedSettings && updatedSettings.festivals) {
                const festivalIndex = updatedSettings.festivals.findIndex(f => 
                  f.name === festival.name && f.discountCode === festival.discountCode
                );
                if (festivalIndex !== -1) {
                  updatedSettings.festivals[festivalIndex].autoNewsletterSent = true;
                  updatedSettings.festivals[festivalIndex].newsLetterSentAt = new Date();
                  await updatedSettings.save();
                  console.log(`✅ Marked festival "${festival.name}" as newsletter sent`);
                }
              }
            } else {
              console.log(`⚠️ Auto-newsletter failed for ${festival.name}:`, newsletterResult.error);
            }
          } catch (error) {
            console.error(`❌ Error processing auto-newsletter for festival "${festival.name}":`, error);
          }
        });
      } else {
        console.log(`ℹ️ No festivals need auto-newsletter at this time`);
      }
    }
    
    // Ensure domain consistency - sync all related domains
    const domainMappings = {
      'test-festival-popup.myshopify.com': ['your-shop.myshopify.com', 'test-shop.myshopify.com'],
      'your-shop.myshopify.com': ['test-festival-popup.myshopify.com', 'test-shop.myshopify.com'],
      'test-shop.myshopify.com': ['test-festival-popup.myshopify.com', 'your-shop.myshopify.com']
    };
    
    if (domainMappings[shopDomain]) {
      console.log(`🔄 Auto-syncing ${shopDomain} to related domains:`, domainMappings[shopDomain]);
      
      for (const targetDomain of domainMappings[shopDomain]) {
        await PopupSettings.findOneAndUpdate(
          { shopDomain: targetDomain },
          {
            ...req.body,
            displaySettings: {
              ...req.body.displaySettings,
              displayFrequency: req.body.displaySettings?.displayFrequency || 'always' // Ensure shows for all connected domains
            }
          },
          { new: true, upsert: true }
        );
        console.log(`✅ Synced to ${targetDomain}`);
      }
      console.log('✅ All domain sync completed!');
    }
    
    res.json({
      ...settings.toObject(),
      syncedDomains: domainMappings[shopDomain] || [],
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error updating popup settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Manual sync trigger for immediate updates
app.post('/api/popup/:shopDomain/sync', async (req, res) => {
  try {
    const { shopDomain } = req.params;
    console.log(`🔄 Manual sync triggered for: ${shopDomain}`);
    
    // Get current settings
    const currentSettings = await PopupSettings.findOne({ shopDomain });
    if (!currentSettings) {
      return res.status(404).json({ error: 'Shop settings not found' });
    }
    
    // Trigger sync to all related domains
    const domainMappings = {
      'test-festival-popup.myshopify.com': ['your-shop.myshopify.com', 'test-shop.myshopify.com'],
      'your-shop.myshopify.com': ['test-festival-popup.myshopify.com', 'test-shop.myshopify.com'],
      'test-shop.myshopify.com': ['test-festival-popup.myshopify.com', 'your-shop.myshopify.com']
    };
    
    if (domainMappings[shopDomain]) {
      for (const targetDomain of domainMappings[shopDomain]) {
        await PopupSettings.findOneAndUpdate(
          { shopDomain: targetDomain },
          currentSettings.toObject(),
          { new: true, upsert: true }
        );
        console.log(`✅ Manual sync completed to ${targetDomain}`);
      }
    }
    
    res.json({ 
      success: true, 
      message: 'Manual sync completed',
      syncedDomains: domainMappings[shopDomain] || []
    });
  } catch (error) {
    console.error('❌ Error during manual sync:', error);
    res.status(500).json({ error: error.message });
  }
});

// Remove duplicate festivals based on multiple criteria
function removeDuplicateFestivals(festivals) {
  const uniqueFestivals = [];
  const seen = new Set();
  
  for (const festival of festivals) {
    // Create a unique key based on multiple criteria
    const key = `${festival.offer}_${festival.startDate}_${festival.endDate}_${festival.name}`;
    
    if (!seen.has(key)) {
      seen.add(key);
      uniqueFestivals.push(festival);
    } else {
      console.log('🗑️ Removing duplicate festival:', festival.name, festival.offer);
    }
  }
  
  console.log(`🧹 Cleaned festivals: ${festivals.length} → ${uniqueFestivals.length}`);
  return uniqueFestivals;
}

// Enhanced festival image prompt generation
function createEnhancedFestivalPrompt(prompt) {
  // Keywords for better festival imagery
  const festivalKeywords = [
    'vibrant colors', 'celebration', 'festive atmosphere', 
    'decorative elements', 'joyful mood', 'party decorations',
    'colorful banners', 'traditional festival elements'
  ];
  
  // Quality enhancing keywords  
  const qualityKeywords = [
    'high quality', 'professional photography', 'detailed',
    'sharp focus', 'beautiful composition', 'artistic style',
    'cinematic lighting', 'premium design'
  ];
  
  // Combine with original prompt
  const enhancedPrompt = `beautiful festive ${prompt}, ${festivalKeywords.slice(0, 3).join(', ')}, ${qualityKeywords.slice(0, 3).join(', ')}`;
  
  return enhancedPrompt;
}

// Analyze colors from an existing image URL
app.post('/api/analyze-image-colors', async (req, res) => {
  try {
    const { imageUrl } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({ error: 'Image URL is required' });
    }
    
    console.log('🎨 Analyzing colors for image:', imageUrl);
    
    const colors = await extractColorsFromImage(imageUrl);
    
    res.json({
      success: true,
      colors,
      imageUrl,
      analyzedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error analyzing image colors:', error);
    res.status(500).json({ 
      error: 'Failed to analyze image colors',
      details: error.message 
    });
  }
});

// Rate limiting for image generation
const imageRequestQueue = new Map();
const MAX_CONCURRENT_IMAGE_REQUESTS = 1;
let activeImageRequests = 0;

// AI Image Generation for popup backgrounds
app.post('/api/generate-image', async (req, res) => {
  try {
    const { prompt, style = 'digital-art' } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
    
    // Rate limiting: Check if we have too many active requests
    if (activeImageRequests >= MAX_CONCURRENT_IMAGE_REQUESTS) {
      console.log('⏳ Rate limit hit, using fallback image');
      // Return immediate fallback instead of queuing
      const fallbackPrompt = prompt.split(' ').slice(0, 3).join(' ');
      const fallbackUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(fallbackPrompt)}?width=815&height=593&model=flux&enhance=true&nologo=true`;
      
      return res.json({ 
        success: true, 
        imageUrl: fallbackUrl,
        prompt: fallbackPrompt,
        fallback: true,
        message: 'Using simplified prompt due to rate limiting',
        generatedAt: new Date().toISOString()
      });
    }
    
    activeImageRequests++;
    console.log('🎨 Generating image for prompt:', prompt, `(Active requests: ${activeImageRequests})`);
    
    // Create enhanced festival image prompt for better quality
    const enhancedPrompt = createEnhancedFestivalPrompt(prompt);
    console.log('🎨 Enhanced prompt:', enhancedPrompt);
    
    // Using enhanced Pollinations.ai API for better quality with no watermark
    const seed = Math.floor(Math.random() * 1000000); // Random seed for variety
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?width=815&height=593&seed=${seed}&model=flux&enhance=true&nologo=true`;
    
    // Test if the image URL is accessible
    try {
      const response = await axios.get(imageUrl, { 
        timeout: 30000,
        responseType: 'arraybuffer'
      });
      
      if (response.status === 200) {
        console.log('✅ Image generated successfully');
        
        // Extract colors from the generated image
        let colors = null;
        try {
          colors = await extractColorsFromImage(imageUrl);
          console.log('✅ Colors extracted from image:', colors);
        } catch (colorError) {
          console.warn('⚠️ Could not extract colors from image:', colorError.message);
          // Use fallback colors
          colors = {
            primary: '#007cba',
            background: '#e3f2fd',
            text: '#ffffff',
            palette: ['#007cba', '#1976d2', '#42a5f5']
          };
        }
        
        res.json({ 
          success: true, 
          imageUrl,
          prompt,
          colors,
          generatedAt: new Date().toISOString()
        });
        
        activeImageRequests--; // Cleanup
      } else {
        throw new Error('Image generation failed');
      }
    } catch (testError) {
      console.error('❌ Primary image generation failed:', testError.message);
      
      // Enhanced fallback using Pollinations.ai with simpler prompt
      try {
        const simplifiedPrompt = prompt.split(' ').slice(0, 5).join(' '); // Use first 5 words
        const fallbackUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(simplifiedPrompt)}?width=815&height=593&model=flux&enhance=true&nologo=true`;
        
        console.log('🔄 Trying fallback Pollinations.ai with simplified prompt:', simplifiedPrompt);
        
        // Test if fallback URL works
        const testResponse = await axios.head(fallbackUrl, { timeout: 5000 });
        
      res.json({ 
        success: true, 
        imageUrl: fallbackUrl,
          prompt: simplifiedPrompt,
        fallback: true,
          message: 'Generated using simplified Pollinations.ai prompt',
        generatedAt: new Date().toISOString()
      });
        
        activeImageRequests--; // Cleanup
      } catch (fallbackError) {
        console.error('❌ Fallback also failed:', fallbackError.message);
        
        // Final fallback - generic festival image from Pollinations.ai
        const genericPrompt = 'beautiful festival celebration background colorful decorative';
        const genericUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(genericPrompt)}?width=815&height=593&model=flux&enhance=true&nologo=true`;
        
        res.json({ 
          success: true, 
          imageUrl: genericUrl,
          prompt: genericPrompt,
          fallback: true,
          message: 'Using generic festival background from Pollinations.ai',
          generatedAt: new Date().toISOString()
        });
        
        activeImageRequests--; // Cleanup
      }
    }
    
  } catch (error) {
    console.error('❌ Error generating image:', error);
    activeImageRequests--; // Cleanup on error
    res.status(500).json({ 
      error: 'Failed to generate image',
      details: error.message 
    });
  }
});

// Alternative image generation endpoint using Unsplash
app.post('/api/generate-image-alt', async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
    
    console.log('🎨 Generating image (alternative) for prompt:', prompt);
    
    // Using Unsplash source API as a reliable fallback
    const searchTerms = prompt.split(' ').slice(0, 3).join(',');
    const fallbackUrl = `https://source.unsplash.com/500x300/?${encodeURIComponent(searchTerms)}`;
    
    res.json({
      success: true,
      imageUrl: fallbackUrl,
      prompt,
      source: 'unsplash',
      message: 'Image generated using Unsplash',
      generatedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error in alternative image generation:', error);
    res.status(500).json({ 
      error: 'Failed to generate image',
      details: error.message 
    });
  }
});

// AI Festival Name Generation with DeepSeek option
app.post('/api/generate-festival-name', async (req, res) => {
  try {
    const { startDate } = req.body;
    
    if (!startDate) {
      return res.status(400).json({ error: 'Start date is required' });
    }
    
    console.log('🎪 Generating festival name for date:', startDate);
    
    const date = moment(startDate);
    const month = date.format('MMMM');
    const season = getSeason(date.month() + 1);
    
    let festivalName;
    
    // NEW STRATEGY: Database first, then AI refinement
    // 1. First, get the most accurate festival from our comprehensive database
    const databaseFestival = generateContextualFestivalName(date, month, season);
    console.log('🎯 Database suggests festival:', databaseFestival);
    
         // 2. If we have a specific festival (not generic), use it directly
     const specificFestivals = ['Rath Yatra', 'Father\'s Day', 'Mother\'s Day', 'Diwali', 'Holi', 'Dussehra', 'Christmas', 'Eid', 'Raksha Bandhan', 'Independence Day', 'Republic Day'];
     const isSpecificFestival = specificFestivals.some(festival => 
       databaseFestival.toLowerCase().includes(festival.toLowerCase().split(' ')[0])
     );
     
     console.log('🔍 Is specific festival?', isSpecificFestival, '- Festival:', databaseFestival);
    
         if (isSpecificFestival) {
       // Use database result for specific festivals - it's more accurate!
       festivalName = databaseFestival;
       console.log('✅ Using database festival (specific):', festivalName);
     } else if (process.env.OPENROUTER_API_KEY) {
       console.log('🤖 Generic festival detected, attempting AI refinement...');
      // 3. For generic festivals, try AI refinement with database context
      try {
        const promptWithContext = `Given that our database suggests "${databaseFestival}" for ${date.format('MMMM Do, YYYY')}, please suggest a more natural, human-sounding festival name. Keep cultural accuracy but make it sound more appealing for shopping.

Examples of good refinements:
- "Monsoon Vibes" → "Monsoon Magic Festival"
- "Summer Celebration" → "Summer Sunshine Sale"
- "Autumn Festival" → "Golden Autumn Celebration"

Only respond with the refined festival name, nothing else.`;

        const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
          model: 'google/gemini-2.0-flash-exp:free',
          messages: [{ role: 'user', content: promptWithContext }],
          max_tokens: 50,
          temperature: 0.7
        }, {
          headers: {
            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://festival-popup-newsletter.onrender.com',
            'X-Title': 'Festival Popup Generator'
          },
          timeout: 15000
        });

        let refinedName = response.data.choices[0].message.content.trim();
        refinedName = refinedName.replace(/["']/g, '').split('\n')[0];
        
                 console.log('🤖 Raw AI refinement response:', refinedName);
         
         if (refinedName && refinedName.length > 3 && refinedName.length < 50) {
           festivalName = refinedName;
           console.log('✅ AI refined festival name:', festivalName, '(from database:', databaseFestival + ')');
         } else {
           festivalName = databaseFestival;
           console.log('✅ Using database festival (AI refinement failed - response too short/long):', festivalName);
         }
      } catch (aiError) {
        console.log('⚠️ AI refinement failed, using database result:', aiError.message);
        festivalName = databaseFestival;
      }
    } else {
      // No API key - use database result
      festivalName = databaseFestival;
      console.log('✅ Using database festival (no API key):', festivalName);
    }
    
    res.json({
      success: true,
      festivalName,
      startDate,
      context: { month, season },
      generatedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error generating festival name:', error);
    res.status(500).json({ 
      error: 'Failed to generate festival name',
      details: error.message 
    });
  }
});

// Shopify Site Color Analysis
app.post('/api/analyze-site-colors', async (req, res) => {
  try {
    const { shopDomain } = req.body;
    
    if (!shopDomain) {
      return res.status(400).json({ error: 'Shop domain is required' });
    }
    
    console.log('🎨 Analyzing site colors for:', shopDomain);
    
    // Try to fetch the site and analyze colors
    let primaryColor = '#007cba'; // Default fallback
    let headerColor = '#1a73e8'; // Default fallback
    
    try {
      const siteUrl = `https://${shopDomain}`;
      const response = await axios.get(siteUrl, { 
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const $ = cheerio.load(response.data);
      
      // Extract colors from CSS and inline styles
      const colors = extractColorsFromHTML($);
      
      if (colors.length > 0) {
        primaryColor = colors[0];
        headerColor = adjustColorBrightness(primaryColor, -20); // Slightly darker for header
      }
      
      console.log('✅ Extracted colors:', { primaryColor, headerColor });
      
    } catch (scrapeError) {
      console.log('⚠️ Could not scrape site, using domain-based colors');
      // Generate colors based on domain name as fallback
      const domainColors = generateDomainBasedColors(shopDomain);
      primaryColor = domainColors.primary;
      headerColor = domainColors.header;
    }
    
    res.json({
      success: true,
      colors: {
        primary: primaryColor,
        header: headerColor,
        background: primaryColor + '20' // Add alpha for background
      },
      shopDomain,
      generatedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error analyzing site colors:', error);
    res.status(500).json({ 
      error: 'Failed to analyze site colors',
      details: error.message 
    });
  }
});

// Function to generate discount code based on festival name and offer (max 6 characters)
function generateDiscountCode(festivalName, offer) {
  try {
    // Extract key elements from festival name
    const festivalWords = festivalName.replace(/[^a-zA-Z\s]/g, '').split(' ')
      .filter(word => word.length > 2)
      .map(word => word.toUpperCase());
    
    // Extract percentage or discount amount from offer
    const percentMatch = offer.match(/(\d+)%/);
    const amountMatch = offer.match(/\$(\d+)/);
    
    let discountCode = '';
    let numberPart = '';
    
    // Get the number part first (1-2 digits max)
    if (percentMatch) {
      numberPart = percentMatch[1].slice(0, 2); // Max 2 digits
    } else if (amountMatch) {
      numberPart = amountMatch[1].slice(0, 2); // Max 2 digits
    } else {
      // Extract any number from offer
      const numberMatch = offer.match(/(\d+)/);
      if (numberMatch) {
        numberPart = numberMatch[1].slice(0, 2); // Max 2 digits
      } else {
        numberPart = '25'; // Default value
      }
    }
    
    // Calculate remaining characters for text part
    const remainingChars = 6 - numberPart.length;
    
    // Generate text part with remaining characters
    if (festivalWords.length >= 2) {
      // Use parts of first two words
      const firstWord = festivalWords[0].slice(0, Math.ceil(remainingChars / 2));
      const secondWord = festivalWords[1].slice(0, remainingChars - firstWord.length);
      discountCode = firstWord + secondWord;
    } else if (festivalWords.length === 1) {
      discountCode = festivalWords[0].slice(0, remainingChars);
    } else {
      // Fallback to season-based naming
      const month = moment().month() + 1;
      const season = getSeason(month);
      discountCode = season.toUpperCase().slice(0, remainingChars);
    }
    
    // Combine text and number parts
    discountCode = (discountCode + numberPart).replace(/[^A-Z0-9]/g, '');
    
    // Ensure exactly 6 characters
    if (discountCode.length > 6) {
      discountCode = discountCode.slice(0, 6);
    } else if (discountCode.length < 6) {
      // Pad with random characters if needed
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      while (discountCode.length < 6) {
        discountCode += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    }
    
    console.log('🎫 Generated 6-char discount code:', discountCode, 'from festival:', festivalName, 'and offer:', offer);
    return discountCode;
    
  } catch (error) {
    console.error('Error generating discount code:', error);
    // Fallback to simple 6-character random code
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let fallbackCode = '';
    for (let i = 0; i < 6; i++) {
      fallbackCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return fallbackCode;
  }
}

// Enhanced Festival Creation with AI
app.post('/api/create-smart-festival', async (req, res) => {
  try {
    const { shopDomain, offer, startDate, endDate, textColor } = req.body;
    
    console.log('🤖 Creating smart festival:', { shopDomain, startDate, endDate });
    
    // 1. Generate festival name based on start date using AI
    let festivalName;
    try {
      const nameResponse = await axios.post(`http://localhost:${PORT}/api/generate-festival-name`, {
        startDate
      });
      if (nameResponse.data.success) {
        festivalName = nameResponse.data.festivalName;
      } else {
        throw new Error('Festival name API failed');
      }
    } catch (nameError) {
      console.log('⚠️ Using fallback festival name generation:', nameError.message);
      const date = moment(startDate);
      festivalName = generateContextualFestivalName(date, date.format('MMMM'), getSeason(date.month() + 1));
    }
    
    // 2. Generate discount code based on festival name and offer
    const discountCode = generateDiscountCode(festivalName, offer);
    
    // 3. Analyze site colors
    let colors = { primary: '#007cba', header: '#1a73e8' };
    try {
      const colorResponse = await axios.post(`http://localhost:${PORT}/api/analyze-site-colors`, {
        shopDomain
      });
      if (colorResponse.data.success) {
        colors = colorResponse.data.colors;
      }
    } catch (colorError) {
      console.log('⚠️ Using default colors due to error:', colorError.message);
    }
    
    // 4. Generate enhanced background image based on festival name
    const imagePrompt = `${festivalName.toLowerCase()} celebration background with decorative elements`;
    let backgroundImageUrl = '';
    let imageColors = null;
    
    try {
      const imageResponse = await axios.post(`http://localhost:${PORT}/api/generate-image`, {
        prompt: imagePrompt
      });
      if (imageResponse.data.success) {
        backgroundImageUrl = imageResponse.data.imageUrl;
        imageColors = imageResponse.data.colors; // Colors extracted from generated image
        console.log('✅ Got image colors from generation:', imageColors);
      }
    } catch (imageError) {
      console.log('⚠️ Could not generate background image:', imageError.message);
    }
    
    // 5. Use image colors if available, otherwise fall back to site colors
    let finalBackgroundColor = colors.primary;
    let finalTextColor = textColor || '#FFFFFF';
    
    if (imageColors) {
      finalBackgroundColor = imageColors.background || imageColors.primary;
      // Use enhanced text color determination for better contrast
      finalTextColor = getOptimalTextColor(imageColors, backgroundImageUrl);
      console.log('🎨 Using enhanced colors from generated image:', { 
        background: finalBackgroundColor, 
        text: finalTextColor,
        originalImageText: imageColors.text 
      });
    } else {
      console.log('🎨 Using fallback site colors:', { 
        background: finalBackgroundColor, 
        text: finalTextColor 
      });
    }
    
    // 6. Create the complete festival object
    const festival = {
      name: festivalName,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      offer,
      discountCode,
      backgroundColor: finalBackgroundColor,
      textColor: finalTextColor,
      imageUrl: '', // Optional icon
      backgroundImageUrl,
      backgroundImagePrompt: imagePrompt,
      backgroundImageStyle: 'cover',
      headerColor: imageColors?.primary || colors.header, // Use image primary or site header
      imageColors: imageColors // Store all extracted colors for reference
    };
    
    console.log('✅ Smart festival created:', {
      name: festival.name,
      discountCode: festival.discountCode,
      colors: { bg: festival.backgroundColor, header: festival.headerColor },
      hasImage: !!festival.backgroundImageUrl
    });
    
    res.json({
      success: true,
      festival,
      generatedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error creating smart festival:', error);
    res.status(500).json({ 
      error: 'Failed to create smart festival',
      details: error.message 
    });
  }
});

// Newsletter subscription - Updated to handle festival and blog subscriptions separately
app.post('/api/newsletter/subscribe', async (req, res) => {
  try {
    console.log('=== NEWSLETTER SUBSCRIPTION DEBUG ===');
    const { email, shopDomain, subscriptionType = 'festival', preferences } = req.body;
    console.log('Subscription request:', { email, shopDomain, subscriptionType, preferences });
    
    // Validate subscription type
    if (!['festival', 'blog'].includes(subscriptionType)) {
      return res.status(400).json({ error: 'Invalid subscription type. Must be "festival" or "blog"' });
    }
    
    // Set preferences based on subscription type
    let subscriberPreferences = {};
    if (subscriptionType === 'festival') {
      subscriberPreferences = {
        festivals: true,
        offers: true,
        blogUpdates: false
      };
    } else if (subscriptionType === 'blog') {
      subscriberPreferences = {
        festivals: false,
        offers: false,
        blogUpdates: true
      };
    }
    
    // Override with any custom preferences if provided
    if (preferences) {
      subscriberPreferences = { ...subscriberPreferences, ...preferences };
    }
    
    const subscriber = new NewsletterSubscriber({
      email,
      shopDomain,
      subscriptionType,
      preferences: subscriberPreferences
    });
    
    console.log('Saving subscriber to database...', { 
      email, 
      shopDomain, 
      subscriptionType, 
      preferences: subscriberPreferences 
    });
    
    await subscriber.save();
    console.log('✅ Subscriber saved successfully');
    
    // Try to send welcome email, but don't fail if it doesn't work
    try {
      console.log('Attempting to send welcome email...');
      
      let welcomeEmail, emailSubject;
      
      if (subscriptionType === 'festival') {
        emailSubject = 'Welcome to Festival Updates! 🎉';
        welcomeEmail = `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
            <h2 style="color: #333; text-align: center;">Welcome to Festival Updates!</h2>
            <p>Thank you for subscribing to our festival notifications. You'll receive:</p>
          <ul style="padding-left: 20px;">
              <li>🎪 Special festival offers and discounts</li>
              <li>🎊 Early access to festival collections</li>
              <li>🎁 Exclusive festival deals and promotions</li>
            </ul>
            <p style="text-align: center; margin-top: 30px;">
              <a href="#" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px;">
                Shop Festival Offers
              </a>
            </p>
            <p style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
              Stay tuned for amazing festival offers and celebrations!
            </p>
          </div>
        `;
      } else {
        emailSubject = 'Welcome to Our Blog Newsletter! 📖';
        welcomeEmail = `
          <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
            <h2 style="color: #333; text-align: center;">Welcome to Our Blog Newsletter!</h2>
            <p>Thank you for subscribing to our blog updates. You'll receive:</p>
            <ul style="padding-left: 20px;">
              <li>📝 Latest blog posts and articles</li>
              <li>💡 Industry insights and tips</li>
              <li>📖 Personalized content updates</li>
          </ul>
          <p style="text-align: center; margin-top: 30px;">
            <a href="#" style="background: #007cba; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px;">
                Read Our Blog
            </a>
          </p>
          <p style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
              Stay informed with our latest content and insights!
          </p>
        </div>
      `;
      }
      
      // Use shop-specific email transporter
      const shopTransporter = await createShopEmailTransporter(shopDomain);
      if (shopTransporter) {
        const shopSettings = await ShopSettings.getShopSettings(shopDomain);
        await shopTransporter.sendMail({
          from: `"${shopSettings.emailSettings.fromName}" <${shopSettings.emailSettings.fromEmail}>`,
        to: email,
          subject: emailSubject,
        html: welcomeEmail
      });
      } else {
        console.warn('⚠️ No email configuration found for shop, welcome email not sent');
      }
      console.log('✅ Welcome email sent successfully');
    } catch (emailError) {
      console.log('⚠️ Welcome email failed to send (but subscription still successful):', emailError.message);
    }
    
    console.log('=== END NEWSLETTER SUBSCRIPTION DEBUG ===');
    res.json({ 
      success: true, 
      message: 'Subscription successful!',
      subscriptionType,
      preferences: subscriberPreferences
    });
  } catch (error) {
    console.error('❌ Newsletter subscription error:', error);
    if (error.code === 11000) {
      console.log('Duplicate email error');
      res.status(400).json({ error: `Email already subscribed to ${req.body.subscriptionType || 'festival'} updates` });
    } else {
      console.log('Other subscription error:', error.message);
      res.status(500).json({ error: error.message });
    }
  }
});

// Process blog content and send newsletter
app.post('/api/newsletter/send-blog', async (req, res) => {
  try {
    const { shopDomain, blogContent, blogTitle } = req.body;
    
    console.log('Newsletter send request:', { shopDomain, blogTitle, contentLength: blogContent?.length });
    
    // Debug: Check current festival
    console.log('=== FESTIVAL DETECTION DEBUG ===');
    console.log('Shop domain for festival check:', shopDomain);
    console.log('Today date:', moment().format('YYYY-MM-DD'));
    
    const currentFestival = await getCurrentFestival(shopDomain);
    
    // Generate dynamic title
    let dynamicTitle = await generateDynamicTitle(blogContent, shopDomain);
    console.log('Generated dynamic title:', dynamicTitle);
    
    // If we have a festival, override the title to include festival name
    if (currentFestival) {
      const mainKeyword = 'Fashion'; // Extract from content or use default
      dynamicTitle = `${currentFestival.name} Special: ${mainKeyword} Insights & More!`;
      console.log('🎪 Overriding title with festival:', dynamicTitle);
    }
    console.log('Final current festival result:', currentFestival);
    
    if (currentFestival) {
      console.log('✅ FESTIVAL FOUND:', currentFestival.name);
      console.log('Festival details:', {
        name: currentFestival.name,
        offer: currentFestival.offer,
        backgroundColor: currentFestival.backgroundColor,
        textColor: currentFestival.textColor
      });
    } else {
      console.log('❌ NO FESTIVAL FOUND - checking database directly...');
      const settings = await PopupSettings.findOne({ shopDomain });
      console.log('Database festivals:', settings?.festivals?.map(f => ({
        name: f.name,
        start: f.startDate.toString().split('T')[0],
        end: f.endDate.toString().split('T')[0]
      })));
    }
    console.log('=== END FESTIVAL DEBUG ===');
    
    // Save blog post
    const blogPost = new BlogPost({
      shopDomain,
      title: blogTitle,
      content: blogContent,
      dynamicTitle,
      publishedAt: new Date()
    });
    await blogPost.save();
    
    // Get subscribers - ONLY blog subscribers for blog newsletters
    const allSubscribers = await NewsletterSubscriber.find({ shopDomain });
    console.log(`All subscribers for ${shopDomain}:`, allSubscribers.map(s => ({ 
      email: s.email, 
      isActive: s.isActive, 
      subscriptionType: s.subscriptionType,
      preferences: s.preferences 
    })));
    
    const subscribers = await NewsletterSubscriber.find({
      shopDomain,
      isActive: true,
      subscriptionType: 'blog',
      'preferences.blogUpdates': true
    });
    
    console.log(`Found ${subscribers.length} BLOG subscribers for ${shopDomain}`);
    
    // Prepare email content
    // Force check for Summer Sale festival
    let festivalToUse = currentFestival;
    
    // If no festival detected, manually check for Summer Sale
    if (!festivalToUse) {
      console.log('🔧 No festival detected, manually checking for Summer Sale...');
      const settings = await PopupSettings.findOne({ shopDomain });
      if (settings && settings.festivals) {
        const today = moment().format('YYYY-MM-DD');
        console.log(`🔧 Manual check: Today is ${today}`);
        
        for (const festival of settings.festivals) {
          let startDateStr, endDateStr;
          
          if (typeof festival.startDate === 'string') {
            startDateStr = festival.startDate.split('T')[0];
          } else {
            startDateStr = festival.startDate.toISOString().split('T')[0];
          }
          
          if (typeof festival.endDate === 'string') {
            endDateStr = festival.endDate.split('T')[0];
          } else {
            endDateStr = festival.endDate.toISOString().split('T')[0];
          }
          
          console.log(`🔧 Manual check: Festival "${festival.name}" from ${startDateStr} to ${endDateStr}`);
          
          if (today >= startDateStr && today <= endDateStr) {
            console.log(`🔧 Manual check: Found active festival "${festival.name}"!`);
            festivalToUse = festival;
            break;
          }
        }
      }
    }
    
    console.log('🎪 Festival to use in email:', festivalToUse?.name || 'None');
    
    // If we found a festival in manual check, also update the title
    if (festivalToUse && !currentFestival) {
      const mainKeyword = 'Fashion';
      dynamicTitle = `${festivalToUse.name} Special: ${mainKeyword} Insights & More!`;
      console.log('🎪 Updated title with manually found festival:', dynamicTitle);
    }
    
    let emailContent = `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 28px;">${dynamicTitle}</h1>
        </div>
    `;
    
    if (festivalToUse) {
      console.log('✅ Adding festival section to email');
      console.log(`🎫 Using discount code: ${festivalToUse.discountCode}`);
      console.log(`🎨 Using festival colors - Background: ${festivalToUse.backgroundColor}, Text: ${festivalToUse.textColor}`);
      emailContent += `
        <div style="background: ${festivalToUse.backgroundColor}; color: ${festivalToUse.textColor}; padding: 25px; text-align: center; margin: 0;">
          <h2 style="color: ${festivalToUse.textColor}; margin: 0 0 10px 0;">🎉 ${festivalToUse.name} Special Offer!</h2>
          <p style="color: ${festivalToUse.textColor}; font-size: 18px; margin: 10px 0; font-weight: bold;">${festivalToUse.offer}</p>
          <p style="color: ${festivalToUse.textColor}; font-size: 14px; margin: 5px 0;">Use code: <strong style="background: rgba(255,255,255,0.2); color: ${festivalToUse.textColor}; padding: 5px 10px; border-radius: 5px;">${festivalToUse.discountCode}</strong></p>
        </div>
      `;
    } else {
      console.log('❌ No festival section added to email');
    }
    
    emailContent += `
        <div style="background: #ffffff; padding: 30px; border-radius: 0 0 10px 10px;">
          <div style="background: #f9f9f9; padding: 25px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #333; margin: 0 0 15px 0;">📖 Latest from Our Blog:</h3>
            <h4 style="color: #667eea; margin: 0 0 15px 0;">${blogTitle}</h4>
            <div style="color: #FFFFFF; line-height: 1.6; margin: 15px 0;">${blogContent.replace(/\n/g, '<br>')}</div>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
            <p style="color: #999; font-size: 12px; margin: 5px 0;">You're receiving this because you subscribed to our newsletter.</p>
            <a href="#" style="color: #999; font-size: 12px;">Unsubscribe</a>
          </div>
        </div>
      </div>
    `;
    
    // Check shop-specific email configuration
    const shopTransporter = await createShopEmailTransporter(shopDomain);
    if (!shopTransporter) {
      console.error('❌ Shop email credentials not configured');
      return res.status(500).json({ 
        error: `Email not configured for shop: ${shopDomain}. Please configure email settings in the app admin panel.`,
        needsEmailConfig: true,
        shopDomain: shopDomain,
        instructions: {
          setup: 'Go to Shop Settings > Email Configuration in the admin panel',
          gmail: 'For Gmail: Use App Password, not regular password. Generate at https://myaccount.google.com/apppasswords',
          outlook: 'For Outlook: Use regular password',
          yahoo: 'For Yahoo: Use App Password'
        }
      });
    }
    
    // Get shop settings for email details
    const shopSettings = await ShopSettings.getShopSettings(shopDomain);
    
    console.log(`📧 Attempting to send emails to ${subscribers.length} subscribers`);
    
    // Send emails to subscribers with proper error handling
    const emailPromises = subscribers.map(async (subscriber, index) => {
      try {
        console.log(`📤 Sending email ${index + 1}/${subscribers.length} to: ${subscriber.email}`);
        const result = await shopTransporter.sendMail({
        from: `"${shopSettings.emailSettings.fromName}" <${shopSettings.emailSettings.fromEmail}>`,
        to: subscriber.email,
        subject: dynamicTitle,
        html: emailContent
        });
        console.log(`✅ Email sent successfully to: ${subscriber.email}`);
        return { success: true, email: subscriber.email, messageId: result.messageId };
      } catch (error) {
        console.error(`❌ Failed to send email to ${subscriber.email}:`, error.message);
        return { success: false, email: subscriber.email, error: error.message };
      }
    });
    
    const emailResults = await Promise.all(emailPromises);
    
    // Count successful and failed emails
    const successfulEmails = emailResults.filter(result => result.success);
    const failedEmails = emailResults.filter(result => !result.success);
    
    console.log(`📊 Email sending summary: ${successfulEmails.length} successful, ${failedEmails.length} failed`);
    
    if (failedEmails.length > 0) {
      console.error('❌ Failed emails:', failedEmails);
    }
    
    // Mark as sent only if at least some emails were successful
    if (successfulEmails.length > 0) {
    blogPost.sentNewsletter = true;
    await blogPost.save();
    }
    
    // Return detailed results
    if (failedEmails.length === 0) {
    res.json({ 
      success: true, 
      dynamicTitle, 
      subscriberCount: subscribers.length,
        emailsSent: successfulEmails.length,
        message: `Newsletter sent successfully to all ${successfulEmails.length} subscribers!` 
      });
    } else if (successfulEmails.length > 0) {
      res.json({ 
        success: true, 
        dynamicTitle, 
        subscriberCount: subscribers.length,
        emailsSent: successfulEmails.length,
        emailsFailed: failedEmails.length,
        message: `Newsletter sent to ${successfulEmails.length} subscribers (${failedEmails.length} failed)`,
        warning: 'Some emails failed to send. Check server logs for details.'
    });
    } else {
      res.status(500).json({ 
        error: `All email sending failed. Common causes: Invalid email credentials, network issues, or email service problems.`,
        emailsFailed: failedEmails.length,
        failedEmails: failedEmails.map(f => ({ email: f.email, error: f.error }))
      });
    }
  } catch (error) {
    console.error('❌ Newsletter sending error:', error);
    res.status(500).json({ error: error.message });
  }
});

// AUTO-BLOG NEWSLETTER: Create new blog post and send to subscribers
app.post('/api/blog-posts/create', async (req, res) => {
  try {
    const { shopDomain, title, content, author, tags } = req.body;
    
    console.log('🆕 Creating new blog post and sending auto-newsletter:', { shopDomain, title, author });
    
    if (!shopDomain || !title || !content) {
      return res.status(400).json({ 
        error: 'Missing required fields: shopDomain, title, content' 
      });
    }
    
    // Generate and send blog newsletter automatically
    const newsletterResult = await generateAndSendBlogNewsletter(shopDomain, {
      title,
      content,
      author: author || 'Blog Team',
      tags: tags || []
    });
    
    if (newsletterResult.success) {
      console.log(`✅ Auto-blog newsletter sent successfully: ${newsletterResult.emailsSent} emails sent`);
      res.json({
        success: true,
        blogPost: newsletterResult.blogPost,
        emailsSent: newsletterResult.emailsSent,
        emailsFailed: newsletterResult.emailsFailed || 0,
        message: `Blog post created and newsletter sent to ${newsletterResult.emailsSent} subscribers!`
      });
    } else {
      console.log(`⚠️ Blog post created but newsletter failed: ${newsletterResult.error}`);
      res.status(500).json({
        success: false,
        error: newsletterResult.error,
        message: 'Blog post creation failed'
      });
    }
    
  } catch (error) {
    console.error('❌ Error creating blog post and sending newsletter:', error);
    res.status(500).json({ 
      error: error.message,
      message: 'Failed to create blog post and send newsletter'
    });
  }
});

// AUTO-NEWSLETTER GENERATION FOR NEW BLOG POSTS
async function generateAndSendBlogNewsletter(shopDomain, blogData) {
  try {
    console.log(`🤖 Auto-generating blog newsletter for: ${blogData.title}`);
    
    // Generate AI-powered blog newsletter content
    const newsletterContent = await generateBlogNewsletterContent(blogData);
    
    if (!newsletterContent.success) {
      console.error('❌ Failed to generate blog newsletter content:', newsletterContent.error);
      return { success: false, error: 'Failed to generate newsletter content' };
    }
    
    // Get active blog subscribers ONLY
    const subscribers = await NewsletterSubscriber.find({
      shopDomain,
      isActive: true,
      subscriptionType: 'blog',
      'preferences.blogUpdates': true
    });
    
    console.log(`📧 Found ${subscribers.length} BLOG subscribers for newsletter`);
    
    if (subscribers.length === 0) {
      console.log('ℹ️ No blog subscribers found, skipping newsletter send');
      return { success: true, message: 'No blog subscribers to send to', emailsSent: 0 };
    }
    
    // Check shop-specific email configuration
    const shopTransporter = await createShopEmailTransporter(shopDomain);
    if (!shopTransporter) {
      console.error('❌ Shop email not configured, skipping auto-blog newsletter');
      return { success: false, error: 'Shop email not configured' };
    }
    
    const shopSettings = await ShopSettings.getShopSettings(shopDomain);
    
    // Create email HTML content for blog newsletter
    const emailContent = `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 28px; color: #ffffff;">${newsletterContent.title}</h1>
        </div>
        
        <div style="background: #667eea; color: #ffffff; padding: 25px; text-align: center; margin: 0;">
          <h2 style="color: #ffffff; margin: 0 0 10px 0;">📝 New Blog Post Published!</h2>
          <p style="color: #ffffff; font-size: 18px; margin: 10px 0; font-weight: bold;">${blogData.title}</p>
          <p style="color: #ffffff; font-size: 14px; margin: 5px 0;">By ${blogData.author}</p>
        </div>
        
        <div style="background: #667eea; padding: 30px; border-radius: 0 0 10px 10px;">
          <div style="color: #ffffff; line-height: 1.6; margin: 15px 0;">
            ${newsletterContent.content}
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding: 20px; background: rgba(255,255,255,0.1); border-radius: 8px; border: 2px solid rgba(255,255,255,0.2);">
            <h3 style="color: #ffffff; margin: 0 0 15px 0;">📖 Read Full Article</h3>
            <p style="color: #ffffff; font-size: 16px; font-weight: bold; margin: 0;">Visit our blog to read the complete article and discover more insights!</p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.2);">
            <p style="color: #ffffff; font-size: 12px; margin: 5px 0;">You're receiving this because you subscribed to blog updates.</p>
            <a href="#" style="color: #ffffff; font-size: 12px;">Unsubscribe</a>
          </div>
        </div>
      </div>
    `;
    
    // Send emails to blog subscribers
    console.log(`📤 Sending blog newsletter to ${subscribers.length} subscribers`);
    
    const emailPromises = subscribers.map(async (subscriber, index) => {
      try {
        console.log(`📧 Sending blog email ${index + 1}/${subscribers.length} to: ${subscriber.email}`);
        const result = await shopTransporter.sendMail({
          from: `"${shopSettings.emailSettings.fromName}" <${shopSettings.emailSettings.fromEmail}>`,
          to: subscriber.email,
          subject: newsletterContent.title,
          html: emailContent
        });
        console.log(`✅ Blog email sent successfully to: ${subscriber.email}`);
        return { success: true, email: subscriber.email, messageId: result.messageId };
      } catch (error) {
        console.error(`❌ Failed to send blog email to ${subscriber.email}:`, error.message);
        return { success: false, email: subscriber.email, error: error.message };
      }
    });
    
    const emailResults = await Promise.all(emailPromises);
    const successfulEmails = emailResults.filter(result => result.success);
    const failedEmails = emailResults.filter(result => !result.success);
    
    console.log(`📊 Blog newsletter summary: ${successfulEmails.length} successful, ${failedEmails.length} failed`);
    
    // Save blog post to database
    const blogPost = new BlogPost({
      shopDomain,
      title: blogData.title,
      content: blogData.content,
      dynamicTitle: newsletterContent.title,
      publishedAt: new Date(),
      sentNewsletter: successfulEmails.length > 0,
      author: blogData.author,
      tags: [...(blogData.tags || []), 'auto-generated', 'blog-newsletter']
    });
    await blogPost.save();
    
    return {
      success: true,
      title: newsletterContent.title,
      emailsSent: successfulEmails.length,
      emailsFailed: failedEmails.length,
      message: `Blog newsletter sent to ${successfulEmails.length} subscribers`,
      blogPost: blogPost
    };
    
  } catch (error) {
    console.error('❌ Error in auto-blog newsletter generation:', error);
    return { success: false, error: error.message };
  }
}

// Generate AI-powered blog newsletter content
async function generateBlogNewsletterContent(blogData) {
  try {
    console.log('🤖 Generating blog newsletter content with Gemini 2.0 Flash...');
    
    const prompt = `You are an expert email marketing specialist creating an engaging newsletter for a new blog post. Generate compelling newsletter content based on the blog details below.

BLOG POST DETAILS:
- Blog Title: ${blogData.title}
- Blog Content: ${blogData.content.substring(0, 500)}...
- Author: ${blogData.author}

REQUIREMENTS:
1. Create an engaging EMAIL SUBJECT LINE (8-12 words max)
2. Write newsletter content that includes:
   - Exciting announcement about the new blog post
   - Brief summary or teaser of the blog content
   - Call-to-action to read the full article
   - Engaging and informative tone

CONTENT GUIDELINES:
- Target audience: Blog readers and content enthusiasts
- Tone: Informative, engaging, and professional
- Length: 100-200 words for main content
- Include emojis where appropriate
- Make it feel valuable and worth reading
- Focus on the value the blog post provides

CRITICAL STYLING REQUIREMENTS:
- ALWAYS use WHITE TEXT COLOR (#ffffff) for all text elements
- DO NOT add background-color styling to content (it will inherit the blog background)
- All text must be readable with white color on the blog background
- Format content with proper HTML paragraphs and styling
- Use only <p>, <strong>, <ul>, <li> tags with white text color

IMPORTANT RESTRICTIONS:
- DO NOT include placeholder text like "[Link to your website]" or "[Your Company Name]"
- DO NOT include generic company signatures or team names
- End the content naturally without placeholder signatures
- Keep the content focused on the blog post value and details only

OUTPUT FORMAT:
Return ONLY a JSON object with these exact keys:
{
  "title": "Your engaging email subject line here",
  "content": "Your newsletter content in HTML format with WHITE TEXT COLOR (#ffffff) and proper paragraphs"
}

EXAMPLE OUTPUT STRUCTURE:
{
  "title": "New Blog Post: ${blogData.title} - Don't Miss Out!",
  "content": "<p style='color: #ffffff;'>📝 We're excited to share our latest blog post...</p><p style='color: #ffffff;'>This article covers...</p>"
}

IMPORTANT: All text elements in the content MUST have style='color: #ffffff;' for proper visibility. NO placeholder text allowed.

Generate the blog newsletter content now:`;

    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: 'google/gemini-2.0-flash-exp:free',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.8,
      max_tokens: 600
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://festival-popup-newsletter.onrender.com',
        'X-Title': 'Blog Newsletter Auto-Generator'
      }
    });

    const aiResponse = response.data.choices[0].message.content.trim();
    console.log('🤖 Raw AI Response:', aiResponse);

    // Parse JSON response
    let parsedContent;
    try {
      // Extract JSON from response (handle any markdown formatting)
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedContent = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('❌ Failed to parse AI response as JSON:', parseError);
      // Fallback content with white text - generic for blog posts
      parsedContent = {
        title: `New Blog Post: ${blogData.title} - Read Now!`,
        content: `<p style="color: #ffffff;">📝 We're excited to share our latest blog post with you!</p><p style="color: #ffffff;"><strong style="color: #ffffff;">${blogData.title}</strong> by ${blogData.author} is now live on our blog.</p><p style="color: #ffffff;">This article provides valuable insights and information that we think you'll find interesting and useful.</p><p style="color: #ffffff;">Don't miss out on this great content - visit our blog to read the full article!</p>`
      };
    }

    console.log('✅ Generated blog newsletter content:', parsedContent);
    return { success: true, ...parsedContent };

  } catch (error) {
    console.error('❌ Error generating blog newsletter content:', error);
    
    // Check if it's a rate limit error and provide informative fallback
    let errorMessage = error.message;
    if (error.response?.status === 429) {
      console.log('🔄 AI service rate-limited, using high-quality fallback content...');
      errorMessage = 'AI service temporarily rate-limited';
    }
    
    // Always return success with fallback content to ensure newsletters are sent
    const fallbackContent = {
      title: `📝 New Blog Post: ${blogData.title}`,
      content: `
        <p style="color: #ffffff;">📖 <strong style="color: #ffffff;">New Blog Post Published!</strong></p>
        <p style="color: #ffffff;">We're excited to share our latest blog post: <strong style="color: #ffffff;">${blogData.title}</strong></p>
        <p style="color: #ffffff;">Written by ${blogData.author}, this article provides valuable insights and information that we think you'll find interesting.</p>
        <p style="color: #ffffff;">✨ <strong style="color: #ffffff;">What you'll discover:</strong></p>
        <ul style="margin-left: 20px; line-height: 1.6; color: #ffffff;">
          <li style="color: #ffffff;">📚 In-depth analysis and insights</li>
          <li style="color: #ffffff;">💡 Practical tips and advice</li>
          <li style="color: #ffffff;">🔍 Expert perspectives and opinions</li>
          <li style="color: #ffffff;">📈 Latest trends and updates</li>
        </ul>
        <p style="color: #ffffff;">Don't miss out on this valuable content - visit our blog to read the complete article and discover more!</p>
        <p style="text-align: center; margin-top: 30px; color: #ffffff;">
          <strong style="color: #ffffff;">Happy Reading! 📚</strong>
        </p>
      `
    };
    
    console.log('✅ Generated high-quality fallback blog newsletter content');
    return { 
      success: true, 
      fallback: true,
      ...fallbackContent 
    };
  }
}

// AUTO-NEWSLETTER GENERATION FOR NEW FESTIVALS
async function generateAndSendFestivalNewsletter(shopDomain, festival) {
  try {
    console.log(`🤖 Auto-generating newsletter for new festival: ${festival.name}`);
    
    // Generate AI-powered newsletter content
    const newsletterContent = await generateFestivalNewsletterContent(festival);
    
    if (!newsletterContent.success) {
      console.error('❌ Failed to generate newsletter content:', newsletterContent.error);
      return { success: false, error: 'Failed to generate newsletter content' };
    }
    
    // Get active festival subscribers ONLY
    const subscribers = await NewsletterSubscriber.find({
      shopDomain,
      isActive: true,
      subscriptionType: 'festival',
      'preferences.festivals': true
    });
    
    console.log(`📧 Found ${subscribers.length} FESTIVAL subscribers for newsletter`);
    
    if (subscribers.length === 0) {
      console.log('ℹ️ No subscribers found, skipping newsletter send');
      return { success: true, message: 'No subscribers to send to' };
    }
    
    // Check shop-specific email configuration
    const shopTransporter = await createShopEmailTransporter(shopDomain);
    if (!shopTransporter) {
      console.error('❌ Shop email not configured, skipping auto-newsletter');
      return { success: false, error: 'Shop email not configured' };
    }
    
    const shopSettings = await ShopSettings.getShopSettings(shopDomain);
    
    // Create email HTML content - Force white text for better readability
    const emailContent = `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <div style="background: linear-gradient(135deg, ${festival.backgroundColor} 0%, ${adjustBrightness(festival.backgroundColor, -20)} 100%); color: #ffffff; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 28px; color: #ffffff;">${newsletterContent.title}</h1>
        </div>
        
        <div style="background: ${festival.backgroundColor}; color: #ffffff; padding: 25px; text-align: center; margin: 0;">
          <h2 style="color: #ffffff; margin: 0 0 10px 0;">🎉 ${festival.name} is Here!</h2>
          <p style="color: #ffffff; font-size: 18px; margin: 10px 0; font-weight: bold;">${festival.offer}</p>
          <p style="color: #ffffff; font-size: 14px; margin: 5px 0;">Use code: <strong style="background: rgba(255,255,255,0.2); color: #ffffff; padding: 5px 10px; border-radius: 5px;">${festival.discountCode}</strong></p>
          <p style="color: #ffffff; font-size: 12px; margin: 10px 0;">Valid from ${formatDate(festival.startDate)} to ${formatDate(festival.endDate)}</p>
        </div>
        
        <div style="background: ${festival.backgroundColor}; padding: 30px; border-radius: 0 0 10px 10px;">
          <div style="color: #ffffff; line-height: 1.6; margin: 15px 0;">
            ${newsletterContent.content.replace(/color:\s*#[0-9a-fA-F]{6}/g, 'color: #ffffff').replace(/background-color:\s*#[0-9a-fA-F]{6}/g, `background-color: ${festival.backgroundColor}`)}
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding: 20px; background: rgba(255,255,255,0.1); border-radius: 8px; border: 2px solid rgba(255,255,255,0.2);">
            <h3 style="color: #ffffff; margin: 0 0 15px 0;">🛒 Shop Now & Save!</h3>
            <p style="color: #ffffff; font-size: 16px; font-weight: bold; margin: 0;">Visit our store and use code <strong style="color: #ffffff;">${festival.discountCode}</strong> for ${festival.offer} discount!</p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
            <p style="color: #999; font-size: 12px; margin: 5px 0;">You're receiving this because you subscribed to festival updates.</p>
            <a href="#" style="color: #999; font-size: 12px;">Unsubscribe</a>
          </div>
        </div>
      </div>
    `;
    
    // Send emails to subscribers
    console.log(`📤 Sending festival newsletter to ${subscribers.length} subscribers`);
    
    const emailPromises = subscribers.map(async (subscriber, index) => {
      try {
        console.log(`📧 Sending festival email ${index + 1}/${subscribers.length} to: ${subscriber.email}`);
        const result = await shopTransporter.sendMail({
          from: `"${shopSettings.emailSettings.fromName}" <${shopSettings.emailSettings.fromEmail}>`,
          to: subscriber.email,
          subject: newsletterContent.title,
          html: emailContent
        });
        console.log(`✅ Festival email sent successfully to: ${subscriber.email}`);
        return { success: true, email: subscriber.email, messageId: result.messageId };
      } catch (error) {
        console.error(`❌ Failed to send festival email to ${subscriber.email}:`, error.message);
        return { success: false, email: subscriber.email, error: error.message };
      }
    });
    
    const emailResults = await Promise.all(emailPromises);
    const successfulEmails = emailResults.filter(result => result.success);
    const failedEmails = emailResults.filter(result => !result.success);
    
    console.log(`📊 Festival newsletter summary: ${successfulEmails.length} successful, ${failedEmails.length} failed`);
    
    // Save festival newsletter to blog posts for record keeping
    const blogPost = new BlogPost({
      shopDomain,
      title: `${festival.name} Auto-Newsletter`,
      content: newsletterContent.content,
      dynamicTitle: newsletterContent.title,
      publishedAt: new Date(),
      sentNewsletter: successfulEmails.length > 0,
      tags: ['auto-generated', 'festival', festival.name.toLowerCase().replace(/\s+/g, '-')]
    });
    await blogPost.save();
    
    return {
      success: true,
      title: newsletterContent.title,
      emailsSent: successfulEmails.length,
      emailsFailed: failedEmails.length,
      message: `Festival newsletter sent to ${successfulEmails.length} subscribers`
    };
    
  } catch (error) {
    console.error('❌ Error in auto-festival newsletter generation:', error);
    return { success: false, error: error.message };
  }
}

// Generate AI-powered festival newsletter content
async function generateFestivalNewsletterContent(festival) {
  try {
    console.log('🤖 Generating festival newsletter content with Gemini 2.0 Flash...');
    
    const prompt = `You are an expert email marketing specialist creating an engaging newsletter for a new festival promotion. Generate compelling newsletter content based on the festival details below.

FESTIVAL DETAILS:
- Festival Name: ${festival.name}
- Offer: ${festival.offer} 
- Discount Code: ${festival.discountCode}
- Start Date: ${formatDate(festival.startDate)}
- End Date: ${formatDate(festival.endDate)}
- Festival Colors: Background ${festival.backgroundColor}

REQUIREMENTS:
1. Create an engaging EMAIL SUBJECT LINE (8-12 words max)
2. Write newsletter content that includes:
   - Festive greeting and excitement about the festival
   - Details about the special offer and savings
   - Urgency and call-to-action elements
   - GENERIC shopping suggestions that work for ANY store type
   - Seasonal relevance if applicable

PRODUCT CATEGORY GUIDELINES:
- Use UNIVERSAL terms: "products", "items", "favorites", "collection", "essentials", "must-haves"
- Avoid SPECIFIC categories: "fashion", "clothing", "sarees", "kurtis", "wardrobe", "outfits"
- Use BROAD suggestions: "popular items", "bestsellers", "trending products", "seasonal favorites"
- Make content applicable to: electronics, home goods, beauty, books, food, toys, etc.

CONTENT GUIDELINES:
- Target audience: Indian e-commerce shoppers (ANY product category)
- Tone: Enthusiastic, festive, and compelling
- Length: 150-250 words for main content
- Include emojis where appropriate
- Make it feel personal and exclusive
- Focus on value and limited-time nature
- Use GENERIC product terms that work for ANY store type (electronics, home goods, beauty, books, etc.)
- Avoid specific product mentions like "sarees", "kurtis", "wardrobe", "fashion"
- Use universal terms like "products", "items", "favorites", "collection", "shopping"

CRITICAL STYLING REQUIREMENTS:
- ALWAYS use WHITE TEXT COLOR (#ffffff) for all text elements
- DO NOT add background-color styling to content (it will inherit the festival background)
- All text must be readable with white color on the festival background
- Format content with proper HTML paragraphs and styling
- Ensure high contrast for readability
- Use only <p>, <strong>, <ul>, <li> tags with white text color

IMPORTANT RESTRICTIONS:
- DO NOT include placeholder text like "[Link to your website]" or "[Your Company Name]"
- DO NOT include generic company signatures or team names
- DO NOT include "Click here to start shopping" with placeholder links
- End the content naturally without placeholder signatures
- Keep the content focused on the festival and offer details only

OUTPUT FORMAT:
Return ONLY a JSON object with these exact keys:
{
  "title": "Your engaging email subject line here",
  "content": "Your newsletter content in HTML format with WHITE TEXT COLOR (#ffffff) and proper paragraphs"
}

EXAMPLE OUTPUT STRUCTURE:
{
  "title": "${festival.name} Exclusive: Limited Time ${festival.offer}!",
  "content": "<p style='color: #ffffff;'>🎉 Get ready to celebrate...</p><p style='color: #ffffff;'>This exclusive offer...</p>"
}

IMPORTANT: Do NOT add background-color or div wrappers - content will be placed in a container with the festival background color.

IMPORTANT: All text elements in the content MUST have style='color: #ffffff;' for proper visibility. NO placeholder text allowed.

Generate the newsletter content now:`;

    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: 'google/gemini-2.0-flash-exp:free',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.8,
      max_tokens: 800
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://festival-popup-newsletter.onrender.com',
        'X-Title': 'Festival Newsletter Auto-Generator'
      }
    });

    const aiResponse = response.data.choices[0].message.content.trim();
    console.log('🤖 Raw AI Response:', aiResponse);

    // Parse JSON response
    let parsedContent;
    try {
      // Extract JSON from response (handle any markdown formatting)
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedContent = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('❌ Failed to parse AI response as JSON:', parseError);
      // Fallback content with white text - no placeholder text - generic for any store
      parsedContent = {
        title: `${festival.name} Special: Exclusive ${festival.offer}!`,
        content: `<p style="color: #ffffff;">🎉 Exciting news! ${festival.name} is here with an amazing ${festival.offer} offer!</p><p style="color: #ffffff;">Use code <strong style="color: #ffffff;">${festival.discountCode}</strong> to unlock your exclusive discount. This limited-time offer is valid until ${formatDate(festival.endDate)}.</p><p style="color: #ffffff;">Don't miss out on this festive opportunity to discover amazing products and unbeatable deals!</p><p style="color: #ffffff;">Happy shopping! 🛍️</p>`
      };
    }

    console.log('✅ Generated festival newsletter content:', parsedContent);
    return { success: true, ...parsedContent };

  } catch (error) {
    console.error('❌ Error generating festival newsletter content:', error);
    
    // Check if it's a rate limit error and provide informative fallback
    let errorMessage = error.message;
    if (error.response?.status === 429) {
      console.log('🔄 AI service rate-limited, using high-quality fallback content...');
      errorMessage = 'AI service temporarily rate-limited';
    }
    
    // Always return success with fallback content to ensure newsletters are sent - no placeholder text
    const fallbackContent = {
      title: `🎉 ${festival.name} Festival Special: ${festival.offer}!`,
      content: `
        <p style="color: #ffffff;">🎊 <strong style="color: #ffffff;">Celebrate ${festival.name} with Exclusive Savings!</strong></p>
        <p style="color: #ffffff;">We're thrilled to announce our special ${festival.name} festival celebration with an incredible <strong style="color: #ffffff;">${festival.offer}</strong> discount on your favorite items!</p>
        
        <p style="color: #ffffff;">✨ <strong style="color: #ffffff;">What makes this special?</strong></p>
        <ul style="margin-left: 20px; line-height: 1.6; color: #ffffff;">
          <li style="color: #ffffff;">🎁 Exclusive ${festival.offer} discount</li>
          <li style="color: #ffffff;">🛍️ Wide selection of quality products</li>
          <li style="color: #ffffff;">⚡ Limited-time offer ending ${formatDate(festival.endDate)}</li>
          <li style="color: #ffffff;">🎪 Special festival collection items</li>
        </ul>
        
        <p style="color: #ffffff;">🎯 <strong style="color: #ffffff;">Ready to shop?</strong> Use your exclusive discount code <strong style="color: #ffffff;">${festival.discountCode}</strong> at checkout and save big on your favorite products!</p>
        
        <p style="color: #ffffff;">💫 This is your chance to celebrate ${festival.name} in style with premium products at unbeatable prices. Don't wait – this exclusive offer is only available until ${formatDate(festival.endDate)}!</p>
        
        <p style="text-align: center; margin-top: 30px; color: #ffffff;">
          <strong style="color: #ffffff;">Happy Shopping! 🛍️</strong>
        </p>
      `
    };
    
    console.log('✅ Generated high-quality fallback newsletter content');
    return { 
      success: true, 
      fallback: true,
      ...fallbackContent 
    };
  }
}

// Helper function to format dates
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// Helper function to adjust color brightness
function adjustBrightness(hex, percent) {
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  const adjustedR = Math.max(0, Math.min(255, r + (r * percent / 100)));
  const adjustedG = Math.max(0, Math.min(255, g + (g * percent / 100)));
  const adjustedB = Math.max(0, Math.min(255, b + (b * percent / 100)));
  
  const toHex = (n) => {
    const hex = Math.round(n).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  
  return `#${toHex(adjustedR)}${toHex(adjustedG)}${toHex(adjustedB)}`;
}

// Auto-generate dynamic title using Gemini 2.0 Flash
app.post('/api/generate-dynamic-title', async (req, res) => {
  try {
    const { blogContent, shopDomain } = req.body;
    
    if (!blogContent || blogContent.trim().length < 50) {
      return res.status(400).json({ 
        error: 'Blog content must be at least 50 characters long for title generation' 
      });
    }
    
    console.log('🤖 Auto-generating dynamic title with Gemini 2.0 Flash...');
    console.log(`📝 Blog content length: ${blogContent.length} characters`);
    
    // Get current festival for context
    const currentFestival = await getCurrentFestival(shopDomain || 'test-festival-popup.myshopify.com');
    
    const prompt = `You are an expert email marketing specialist. Generate a compelling, click-worthy newsletter title based on the blog content below.

BLOG CONTENT:
${blogContent}

CONTEXT:
- This is for an Indian e-commerce newsletter
- Current active festival: ${currentFestival ? currentFestival.name : 'None'}
- Target audience: Fashion-conscious online shoppers

REQUIREMENTS:
1. Keep it 8-12 words maximum
2. Make it engaging and click-worthy
3. Include the main topic/keyword from the content
4. If there's an active festival, subtly incorporate it
5. Use action words or curiosity triggers
6. Avoid generic words like "Update", "Newsletter", "Blog"

EXAMPLES OF GOOD TITLES:
- "Monsoon Fashion Secrets Every Stylish Person Knows"
- "Beat the Rain: Essential Waterproof Style Guide"
- "Transform Your Wardrobe for Monsoon Season"
- "Fashion Mistakes That Make You Look Outdated"

Generate ONE perfect title that would make people want to open this email immediately.

TITLE:`;

    try {
      const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: 'google/gemini-2.0-flash-exp:free',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 50,
        temperature: 0.8
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://festival-popup-newsletter.onrender.com',
          'X-Title': 'Festival Newsletter Title Generator'
        },
        timeout: 15000
      });

      let dynamicTitle = response.data.choices[0].message.content.trim();
      
      console.log('🔍 Raw Gemini title response:', JSON.stringify(dynamicTitle));
      
      // Clean up the response
      dynamicTitle = dynamicTitle.replace(/["']/g, '');
      dynamicTitle = dynamicTitle.split('\n')[0]; // Take first line only
      dynamicTitle = dynamicTitle.replace(/^(TITLE:|Title:|Answer:|Response:)/i, '').trim();
      
      // Remove any remaining quotes or brackets
      dynamicTitle = dynamicTitle.replace(/["""''()[\]]/g, '');
      
      console.log('✨ Generated dynamic title:', dynamicTitle);
      
      // Fallback if title is too short or generic
      if (!dynamicTitle || dynamicTitle.length < 5) {
        throw new Error('Generated title too short');
      }
      
      res.json({ 
        success: true, 
        title: dynamicTitle,
        festivalContext: currentFestival?.name || null
      });
      
    } catch (apiError) {
      console.error('❌ Gemini API error:', apiError.message);
      
      // Fallback to the existing generateDynamicTitle function
      console.log('🔄 Falling back to existing title generation...');
      const fallbackTitle = await generateDynamicTitle(blogContent, shopDomain);
      
      res.json({ 
        success: true, 
        title: fallbackTitle,
        fallback: true,
        message: 'Generated using fallback method'
      });
    }
    
  } catch (error) {
    console.error('❌ Dynamic title generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test endpoint to add sample subscribers
app.post('/api/newsletter/test-subscriber', async (req, res) => {
  try {
    const { email } = req.body;
    const subscriber = new NewsletterSubscriber({
      email: email || 'test@example.com',
      shopDomain: 'your-shop.myshopify.com',
      preferences: { blogUpdates: true },
      isActive: true
    });
    
    await subscriber.save();
    res.json({ success: true, message: 'Test subscriber added!' });
  } catch (error) {
    if (error.code === 11000) {
      res.json({ success: true, message: 'Subscriber already exists' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Simple test endpoint for festival status
app.get('/api/test/festival-status', async (req, res) => {
  try {
    const shopDomain = 'your-shop.myshopify.com';
    const today = moment().format('YYYY-MM-DD');
    
    // Get raw database data
    const settings = await PopupSettings.findOne({ shopDomain });
    const rawFestivals = settings?.festivals || [];
    
    // Manual test of the first festival
    let manualTest = null;
    let debugInfo = [];
    
    if (rawFestivals.length > 0) {
      const festival = rawFestivals[0];
      const startDateStr = festival.startDate.toString().split('T')[0];
      const endDateStr = festival.endDate.toString().split('T')[0];
      
      debugInfo.push(`Festival: ${festival.name}`);
      debugInfo.push(`Today: ${today}`);
      debugInfo.push(`Start: ${startDateStr}`);
      debugInfo.push(`End: ${endDateStr}`);
      
      const todayMoment = moment(today);
      const startMoment = moment(startDateStr);
      const endMoment = moment(endDateStr);
      
      const isAfterStart = todayMoment.isSameOrAfter(startMoment);
      const isBeforeEnd = todayMoment.isSameOrBefore(endMoment);
      const isActive = isAfterStart && isBeforeEnd;
      
      debugInfo.push(`Is after start (${today} >= ${startDateStr}): ${isAfterStart}`);
      debugInfo.push(`Is before end (${today} <= ${endDateStr}): ${isBeforeEnd}`);
      debugInfo.push(`Should be active: ${isActive}`);
      
      manualTest = {
        name: festival.name,
        today,
        startDateStr,
        endDateStr,
        isAfterStart,
        isBeforeEnd,
        isActive,
        debugInfo
      };
    } else {
      debugInfo.push('No festivals found in database');
    }
    
    // Test getCurrentFestival function
    let getCurrentFestivalResult = null;
    try {
      getCurrentFestivalResult = await getCurrentFestival(shopDomain);
      debugInfo.push(`getCurrentFestival returned: ${getCurrentFestivalResult?.name || 'null'}`);
    } catch (error) {
      debugInfo.push(`getCurrentFestival error: ${error.message}`);
    }
    
    res.json({
      today,
      activeFestival: getCurrentFestivalResult,
      manualTest,
      debugInfo,
      message: getCurrentFestivalResult ? `${getCurrentFestivalResult.name} is active!` : 'No active festival'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Debug endpoint to test festival detection and title generation
app.get('/api/debug/festival-title', async (req, res) => {
  try {
    const shopDomain = 'your-shop.myshopify.com';
    const testContent = "Summer fashion trends are taking over the retail world this season. Fashion enthusiasts are embracing vibrant colors, lightweight fabrics, and sustainable materials. The latest collections showcase innovative designs that blend comfort with style. Fashion brands are incorporating eco-friendly practices while maintaining high-quality standards.";
    
    // Test festival detection
    const currentFestival = await getCurrentFestival(shopDomain);
    console.log('Debug - Current festival:', currentFestival);
    
    // Test title generation
    const dynamicTitle = await generateDynamicTitle(testContent, shopDomain);
    console.log('Debug - Generated title:', dynamicTitle);
    
    // Test date comparison
    const today = moment();
    const todayStr = today.format('YYYY-MM-DD');
    console.log('Debug - Today:', todayStr);
    
    // Get all festivals from database
    const settings = await PopupSettings.findOne({ shopDomain });
    console.log('Debug - All festivals:', settings?.festivals?.map(f => ({
      name: f.name,
      startDate: f.startDate,
      endDate: f.endDate,
      startDateStr: f.startDate.toString().split('T')[0],
      endDateStr: f.endDate.toString().split('T')[0]
    })));
    
    res.json({
      today: todayStr,
      currentFestival,
      dynamicTitle,
      allFestivals: settings?.festivals || []
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Manual trigger for festival newsletter (for testing)
app.post('/api/newsletter/send-festival-newsletter', async (req, res) => {
  try {
    const { shopDomain, festivalId } = req.body;
    
    if (!shopDomain || !festivalId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Shop domain and festival ID are required' 
      });
    }
    
    // Get the festival from the popup settings
    const popupSettings = await PopupSettings.findOne({ shopDomain });
    
    if (!popupSettings || !popupSettings.festivals) {
      return res.status(404).json({ 
        success: false, 
        error: 'No festivals found for this shop' 
      });
    }
    
    const festival = popupSettings.festivals.find(f => f._id.toString() === festivalId);
    
    if (!festival) {
      return res.status(404).json({ 
        success: false, 
        error: 'Festival not found' 
      });
    }
    
    console.log(`🚀 Manual trigger: Generating newsletter for festival: ${festival.name}`);
    
    // Generate and send the newsletter
    const result = await generateAndSendFestivalNewsletter(shopDomain, festival);
    
    res.json(result);
    
  } catch (error) {
    console.error('❌ Error in manual festival newsletter trigger:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get auto-newsletter status and logs
app.get('/api/newsletter/auto-status/:shopDomain', async (req, res) => {
  try {
    const { shopDomain } = req.params;
    
    // Get recent auto-generated newsletters - Compatible with file-based storage
    const allBlogPosts = await BlogPost.find({ shopDomain });
    const autoNewsletters = allBlogPosts
      .filter(post => post.tags && post.tags.includes('auto-generated'))
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
      .slice(0, 10);
    
    // Get current active festivals
    const popupSettings = await PopupSettings.findOne({ shopDomain });
    const now = new Date();
    
    const activeFestivals = popupSettings?.festivals?.filter(festival => {
      const startDate = new Date(festival.startDate);
      const endDate = new Date(festival.endDate);
      return now >= startDate && now <= endDate;
    }) || [];
    
    // Get festival newsletter subscribers count
    const subscribersCount = await NewsletterSubscriber.countDocuments({
      shopDomain,
      isActive: true,
      subscriptionType: 'festival',
      'preferences.festivals': true
    });
    
    res.json({
      success: true,
      shopDomain,
      subscribersCount,
      activeFestivals: activeFestivals.map(f => ({
        id: f._id,
        name: f.name,
        offer: f.offer,
        discountCode: f.discountCode,
        startDate: f.startDate,
        endDate: f.endDate
      })),
      autoNewsletters: autoNewsletters.map(newsletter => ({
        title: newsletter.dynamicTitle,
        publishedAt: newsletter.publishedAt,
        sent: newsletter.sentNewsletter,
        tags: newsletter.tags
      })),
      emailConfigured: !!(process.env.EMAIL_USER && process.env.EMAIL_PASSWORD)
    });
    
  } catch (error) {
    console.error('❌ Error getting auto-newsletter status:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Test subscriber form (GET endpoint)
app.get('/api/newsletter/test-subscriber', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Add Test Subscriber</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 500px; margin: 50px auto; padding: 20px; }
            .form-group { margin: 15px 0; }
            label { display: block; margin-bottom: 5px; font-weight: bold; }
            input[type="email"] { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; }
            button { background: #007cba; color: white; padding: 12px 25px; border: none; border-radius: 5px; cursor: pointer; }
            button:hover { background: #005a8b; }
            .message { padding: 10px; margin: 10px 0; border-radius: 5px; }
            .success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
            .error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        </style>
    </head>
    <body>
        <h2>🧪 Add Test Subscriber</h2>
        <p>Add your email address to test the newsletter functionality:</p>
        
        <form id="subscriberForm">
            <div class="form-group">
                <label for="email">Email Address:</label>
                <input type="email" id="email" name="email" required placeholder="your-email@gmail.com">
            </div>
            <button type="submit">Add Test Subscriber</button>
        </form>
        
        <div id="message"></div>
        
        <hr style="margin: 30px 0;">
        <h3>📊 Current Subscribers</h3>
        <div id="subscribers">Loading...</div>
        
        <hr style="margin: 30px 0;">
        <p><a href="/admin">← Back to Admin Panel</a></p>
        
        <script>
            document.getElementById('subscriberForm').addEventListener('submit', async function(e) {
                e.preventDefault();
                
                const email = document.getElementById('email').value;
                const messageDiv = document.getElementById('message');
                
                try {
                    const response = await fetch('/api/newsletter/test-subscriber', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email })
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        messageDiv.innerHTML = '<div class="message success">' + result.message + '</div>';
                        document.getElementById('email').value = '';
                        loadSubscribers(); // Refresh the list
                    } else {
                        messageDiv.innerHTML = '<div class="message error">' + (result.error || 'Error adding subscriber') + '</div>';
                    }
                } catch (error) {
                    messageDiv.innerHTML = '<div class="message error">Error: ' + error.message + '</div>';
                }
            });
            
            // Load current subscribers
            async function loadSubscribers() {
                try {
                    const response = await fetch('/api/newsletter/analytics/your-shop.myshopify.com');
                    const data = await response.json();
                    
                    document.getElementById('subscribers').innerHTML = 
                        '<p><strong>Total Subscribers:</strong> ' + data.totalSubscribers + '</p>' +
                        '<p><strong>Recent Subscribers (30 days):</strong> ' + data.recentSubscribers + '</p>' +
                        '<p><strong>Newsletters Sent:</strong> ' + data.blogPostsSent + '</p>';
                } catch (error) {
                    document.getElementById('subscribers').innerHTML = '<p>Error loading subscriber data</p>';
                }
            }
            
            // Load subscribers on page load
            loadSubscribers();
        </script>
    </body>
    </html>
  `);
});

// Duplicate analytics endpoint removed - using the main one at line 1558

// App Embeds Sync Endpoints - NEW
app.post('/api/app-embeds/sync/:shopDomain', async (req, res) => {
  try {
    const { shopDomain } = req.params;
    const embedsSettings = req.body;
    
    console.log('📱 App Embeds Sync Request:', { shopDomain, embedsSettings });
    
    // Get current popup settings
    let popupSettings = await PopupSettings.findOne({ shopDomain });
    
    if (!popupSettings) {
      popupSettings = new PopupSettings({ shopDomain, festivals: [] });
    }
    
    // Update basic popup settings
    popupSettings.isActive = embedsSettings.popup_enabled !== false;
    popupSettings.displaySettings = {
      showDelay: (embedsSettings.popup_delay || 3) * 1000,
      displayFrequency: embedsSettings.popup_frequency || 'once_per_session',
      position: 'center'
    };
    
    // Update blog newsletter popup settings if provided
    if (embedsSettings.hasOwnProperty('blog_popup_enabled')) {
      popupSettings.blogPopupSettings = {
        enabled: embedsSettings.blog_popup_enabled !== false,
        delay: (embedsSettings.blog_popup_delay || 3) * 1000,
        frequency: embedsSettings.blog_popup_frequency || 'once_per_session',
        titlePrefix: embedsSettings.blog_title_prefix || 'DO YOU WANNA STAY UP TO DATE REGARDING'
      };
    }
    
    // Handle Quick Festival Setup - support both regular and infinite festivals
    if (embedsSettings.festival_offer && embedsSettings.festival_start_date) {
      console.log('🎯 Processing Quick Festival Setup');
              console.log('📋 Request Details:', {
          offer: embedsSettings.festival_offer,
          startDate: embedsSettings.festival_start_date,
          endDate: embedsSettings.festival_end_date,
          trigger: embedsSettings.create_festival_trigger,
          isInfinite: embedsSettings.festival_is_infinite,
          endDateEmpty: !embedsSettings.festival_end_date || embedsSettings.festival_end_date.trim() === ''
        });
      
      // SMART duplicate checking - only block if truly duplicate
      const isDuplicate = popupSettings.festivals.some(f => {
        // Check 1: Same offer text AND same start date (main duplicate criteria)
        const sameOffer = f.offer === embedsSettings.festival_offer;
        const sameStartDate = new Date(f.startDate).toDateString() === new Date(embedsSettings.festival_start_date).toDateString();
        
        // For end date comparison - handle infinite festivals (empty end date)
        let sameEndDate = false;
        if (embedsSettings.festival_end_date && embedsSettings.festival_end_date.trim() !== '') {
          // Regular festival - compare end dates
          sameEndDate = new Date(f.endDate).toDateString() === new Date(embedsSettings.festival_end_date).toDateString();
        } else {
          // Infinite festival - only duplicate if existing festival is also infinite (no specific end date logic)
          sameEndDate = false; // Allow infinite festivals even if regular festivals exist
        }
        
        // Check 3: Recent creation (within last 5 minutes) - prevents rapid duplicates
        const recentCreation = f.createdAt && (new Date() - new Date(f.createdAt)) < (5 * 60 * 1000);
        
        console.log('🔍 Duplicate Check for festival:', f.name, {
          sameOffer, 
          sameStartDate, 
          sameEndDate, 
          recentCreation,
          isInfiniteRequest: !embedsSettings.festival_end_date || embedsSettings.festival_end_date.trim() === ''
        });
        
        // Mark as duplicate ONLY if offer AND start date AND end date all match, OR recent creation
        return (sameOffer && sameStartDate && sameEndDate) || recentCreation;
      });
      
      // Special handling for infinite festivals - less restrictive duplicate checking
      const isInfiniteRequest = embedsSettings.festival_is_infinite || 
        (!embedsSettings.festival_end_date || embedsSettings.festival_end_date.trim() === '');
      
      if (!isDuplicate || (isInfiniteRequest && embedsSettings.create_festival_trigger === true)) {
        // Create festival if no duplicate OR if infinite festival with trigger
        if (embedsSettings.create_festival_trigger === true) {
          if (isInfiniteRequest) {
            console.log('🎯 ✅ CREATING INFINITE FESTIVAL - Override duplicate check');
          } else {
            console.log('🎯 ✅ CREATING NEW FESTIVAL - All conditions met');
          }
          console.log('📝 Using exact offer text:', embedsSettings.festival_offer);
          
          // Generate AI-powered festival with exact parameters
          try {
            // Handle infinite festivals - auto-calculate end date if not provided
            let finalEndDate = embedsSettings.festival_end_date;
            const isInfinite = embedsSettings.festival_is_infinite || 
              (!embedsSettings.festival_end_date || embedsSettings.festival_end_date.trim() === '');
            
            if (isInfinite && (!finalEndDate || finalEndDate.trim() === '')) {
              const startDateObj = new Date(embedsSettings.festival_current_start_date || embedsSettings.festival_start_date);
              const endDateObj = new Date(startDateObj);
              endDateObj.setDate(endDateObj.getDate() + 7); // 7 days for current period
              finalEndDate = endDateObj.toISOString().split('T')[0];
              console.log('🔄 Infinite festival: Auto-calculated end date for current period:', finalEndDate);
            } else if (finalEndDate && finalEndDate.trim() !== '') {
              console.log('📅 Using provided end date:', finalEndDate);
            }
            
            const aiResponse = await axios.post(`http://localhost:${PORT}/api/create-smart-festival`, {
              shopDomain,
              offer: embedsSettings.festival_offer,  // Use EXACT offer text
              startDate: embedsSettings.festival_current_start_date || embedsSettings.festival_start_date,
              endDate: finalEndDate,
              isInfinite: isInfinite,
              originalStartDate: embedsSettings.festival_original_start_date || embedsSettings.festival_start_date
            });
            
            const aiResult = aiResponse.data;
            
            if (aiResult.success) {
              // Mark festival as infinite if applicable
              if (isInfinite) {
                aiResult.festival.isInfinite = true;
                aiResult.festival.originalStartDate = originalStartDate || startDate;
                aiResult.festival.currentPeriodStart = startDate;
                console.log('�� Festival marked as infinite:', {
                  originalStart: aiResult.festival.originalStartDate,
                  currentPeriod: aiResult.festival.currentPeriodStart
                });
              }
              
              // Save the festival to the database
              let popupSettings = await PopupSettings.findOne({ shopDomain });
              if (!popupSettings) {
                popupSettings = new PopupSettings({ shopDomain, festivals: [] });
              }
              
              // Add timestamp to track creation
              aiResult.festival.createdAt = new Date().toISOString();
              aiResult.festival.createdViaQuickSetup = true;
              
              // Add the generated festival to the shop's settings
              popupSettings.festivals.push(aiResult.festival);
              await popupSettings.save();
              
              console.log('✅ Festival saved to database:', {
                name: aiResult.festival.name,
                shopDomain: shopDomain,
                totalFestivals: popupSettings.festivals.length
              });
              
              // 🚀 AUTO-EMAIL: Send newsletter to subscribers when new festival is created
              try {
                console.log(`🚀 Auto-generating newsletter for newly created festival: ${aiResult.festival.name}`);
                const newsletterResult = await generateAndSendFestivalNewsletter(shopDomain, aiResult.festival);
                
                if (newsletterResult.success) {
                  console.log(`✅ Auto-newsletter sent successfully: ${newsletterResult.emailsSent} emails sent`);
                } else {
                  console.log(`⚠️ Auto-newsletter failed: ${newsletterResult.error}`);
                }
              } catch (emailError) {
                console.error('❌ Auto-newsletter error:', emailError.message);
                // Don't fail the festival creation if email fails
              }
              
              res.json({
                success: true,
                festival: aiResult.festival,
                message: isInfinite ? 
                  'Infinite rolling festival generated and saved successfully!' : 
                  'Festival generated and saved successfully!'
              });
            } else {
              throw new Error(aiResult.error || 'Festival generation failed');
            }
          } catch (aiError) {
            console.error('❌ AI Festival Generation Failed:', aiError);
            // Fallback: Create basic festival with exact offer
            
            // Handle infinite festivals in fallback
            let fallbackEndDate = embedsSettings.festival_end_date;
            const isInfinite = embedsSettings.festival_is_infinite || 
              (!embedsSettings.festival_end_date || embedsSettings.festival_end_date.trim() === '');
            
            if (isInfinite && (!fallbackEndDate || fallbackEndDate.trim() === '')) {
              const startDateObj = new Date(embedsSettings.festival_current_start_date || embedsSettings.festival_start_date);
              const endDateObj = new Date(startDateObj);
              endDateObj.setDate(endDateObj.getDate() + 7);
              fallbackEndDate = endDateObj.toISOString().split('T')[0];
            }
            
            const fallbackFestival = {
              name: embedsSettings.generated_festival_name || (isInfinite ? 'Infinite Special Festival' : 'Special Festival'),
              offer: embedsSettings.festival_offer,  // Use EXACT offer text
              startDate: new Date(embedsSettings.festival_current_start_date || embedsSettings.festival_start_date),
              endDate: new Date(fallbackEndDate || embedsSettings.festival_end_date),
              discountCode: embedsSettings.generated_discount_code || 'SAVE20',
              backgroundColor: embedsSettings.generated_background_color || '#667eea',
              textColor: embedsSettings.generated_text_color || '#ffffff',
              headerColor: embedsSettings.generated_background_color || '#667eea',
              createdAt: new Date().toISOString(),
              createdViaAppEmbeds: true,
              isInfinite: isInfinite,
              originalStartDate: isInfinite ? (embedsSettings.festival_original_start_date || embedsSettings.festival_start_date) : undefined,
              currentPeriodStart: isInfinite ? (embedsSettings.festival_current_start_date || embedsSettings.festival_start_date) : undefined
            };
            popupSettings.festivals.push(fallbackFestival);
            console.log('✅ Fallback Festival Created:', {
              name: fallbackFestival.name,
              isInfinite: fallbackFestival.isInfinite || false
            });
            
            // 🚀 AUTO-EMAIL: Send newsletter to subscribers when new fallback festival is created
            try {
              console.log(`🚀 Auto-generating newsletter for newly created fallback festival: ${fallbackFestival.name}`);
              const newsletterResult = await generateAndSendFestivalNewsletter(shopDomain, fallbackFestival);
              
              if (newsletterResult.success) {
                console.log(`✅ Auto-newsletter sent successfully: ${newsletterResult.emailsSent} emails sent`);
              } else {
                console.log(`⚠️ Auto-newsletter failed: ${newsletterResult.error}`);
              }
            } catch (emailError) {
              console.error('❌ Auto-newsletter error:', emailError.message);
              // Don't fail the festival creation if email fails
            }
          }
        } else {
          console.log('⏳ Festival data provided but creation not triggered yet');
          console.log('💡 To create festival: Check "✨ Generate Festival Now" and save');
          console.log('🔧 Current trigger value:', embedsSettings.create_festival_trigger);
        }
      } else {
        console.log('⚠️ DUPLICATE DETECTED - Festival creation blocked');
        console.log('📊 Current festivals count:', popupSettings.festivals.length);
        console.log('🔄 Trigger status:', embedsSettings.create_festival_trigger);
        
        // Clean up and return with reset signal
        popupSettings.festivals = removeDuplicateFestivals(popupSettings.festivals);
        await popupSettings.save();
        
        return res.json({ 
          success: true, 
          message: 'Duplicate festival detected - no new festival created',
          festivals: popupSettings.festivals,
          resetTrigger: true // Signal frontend to reset trigger
        });
      }
    }
    
    // Handle Offer Popup Settings
    if (embedsSettings.offer_popup_enabled) {
      const offerFestival = {
        name: embedsSettings.offer_title || 'Special Offer',
        offer: embedsSettings.offer_text || 'Special Discount',
        discountCode: embedsSettings.offer_code || 'SAVE',
        backgroundColor: embedsSettings.offer_background_color || '#e74c3c',
        textColor: embedsSettings.offer_text_color || '#ffffff',
        headerColor: embedsSettings.offer_background_color || '#e74c3c',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
      };
      
      // Check if offer popup already exists
      const existingOfferIndex = popupSettings.festivals.findIndex(f => f.name === offerFestival.name);
      if (existingOfferIndex === -1) {
        popupSettings.festivals.push(offerFestival);
      } else {
        popupSettings.festivals[existingOfferIndex] = offerFestival;
      }
    }
    
    // Handle JSON Configuration (Advanced)
    if (embedsSettings.festival_json_config) {
      try {
        const jsonConfig = JSON.parse(embedsSettings.festival_json_config);
        if (Array.isArray(jsonConfig.festivals)) {
          popupSettings.festivals = jsonConfig.festivals;
        }
      } catch (jsonError) {
        console.error('❌ Invalid JSON Configuration:', jsonError);
      }
    }
    
    // Clean up any duplicate festivals before saving
    popupSettings.festivals = removeDuplicateFestivals(popupSettings.festivals);
    
    // Save with retry logic to handle version conflicts
    let saveAttempts = 0;
    const maxRetries = 3;
    
    while (saveAttempts < maxRetries) {
      try {
        await popupSettings.save();
        break; // Success, exit loop
      } catch (error) {
        saveAttempts++;
        if (error.name === 'VersionError' && saveAttempts < maxRetries) {
          console.log(`🔄 Retry save attempt ${saveAttempts}/${maxRetries} due to version conflict`);
          // Refetch the latest version and merge changes
          const freshSettings = await PopupSettings.findOne({ shopDomain });
          if (freshSettings) {
            // Preserve the festivals we just modified
            const festivalsToKeep = popupSettings.festivals;
            popupSettings = freshSettings;
            popupSettings.festivals = festivalsToKeep;
            popupSettings.isActive = embedsSettings.popup_enabled !== false;
            popupSettings.displaySettings = {
              showDelay: (embedsSettings.popup_delay || 3) * 1000,
              displayFrequency: embedsSettings.popup_frequency || 'once_per_session',
              position: 'center'
            };
          }
          continue;
        } else {
          throw error; // Re-throw if not a version error or max retries reached
        }
      }
    }
    
    // Check if festival was just created by looking for new festivals
    const festivalJustCreated = popupSettings.festivals.some(f => 
      f.createdViaAppEmbeds && 
      f.createdAt && 
      (new Date() - new Date(f.createdAt)) < (5 * 60 * 1000) // Created within last 5 minutes
    );
    
    const response = {
      success: true,
      message: festivalJustCreated ? 
        '✅ Festival created successfully! Auto-resetting trigger to prevent duplicates.' : 
        'App embeds settings synced successfully',
      syncTime: new Date().toISOString(),
      popupSettings: {
        isActive: popupSettings.isActive,
        festivals: popupSettings.festivals,
        displaySettings: popupSettings.displaySettings,
        blogPopupSettings: popupSettings.blogPopupSettings
      }
    };
    
    // Signal frontend to reset trigger if festival was created
    if (festivalJustCreated) {
      response.resetTrigger = true;
      response.festivalCreated = true;
      response.createdFestival = popupSettings.festivals.find(f => 
        f.createdViaAppEmbeds && f.createdAt && (new Date() - new Date(f.createdAt)) < (5 * 60 * 1000)
      );
      console.log('🔄 Signaling frontend to reset trigger');
    }
    
    res.json(response);
    
  } catch (error) {
    console.error('❌ App Embeds Sync Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/app-embeds/settings/:shopDomain', async (req, res) => {
  try {
    const { shopDomain } = req.params;
    
    const popupSettings = await PopupSettings.findOne({ shopDomain });
    
    if (!popupSettings) {
      return res.json({
        success: true,
        settings: {
          popup_enabled: true,
          popup_delay: 3,
          popup_frequency: 'once_per_session',
          newsletter_enabled: true,
          newsletter_title: 'Subscribe to our newsletter',
          newsletter_subtitle: 'Get personalized content, exclusive offers and festival updates delivered to your inbox.',
          auto_sync_enabled: true,
          force_sync_on_save: true
        }
      });
    }
    
    // Find current active festival
    const now = new Date();
    const activeFestival = popupSettings.festivals.find(f => 
      new Date(f.startDate) <= now && new Date(f.endDate) >= now
    );
    
    const settings = {
      popup_enabled: popupSettings.isActive,
      popup_delay: Math.floor((popupSettings.displaySettings?.showDelay || 3000) / 1000),
      popup_frequency: popupSettings.displaySettings?.displayFrequency || 'once_per_session',
      newsletter_enabled: true,
      newsletter_title: 'Subscribe to our newsletter',
      newsletter_subtitle: 'Get personalized content, exclusive offers and festival updates delivered to your inbox.',
      auto_sync_enabled: true,
      force_sync_on_save: true,
      last_sync_time: new Date().toISOString()
    };
    
    // Add current festival data if exists
    if (activeFestival) {
      settings.festival_offer = activeFestival.offer;
      settings.festival_start_date = activeFestival.startDate.toISOString().split('T')[0];
      settings.festival_end_date = activeFestival.endDate.toISOString().split('T')[0];
      settings.generated_festival_name = activeFestival.name;
      settings.generated_discount_code = activeFestival.discountCode;
      settings.generated_background_color = activeFestival.backgroundColor;
      settings.generated_text_color = activeFestival.textColor;
    }
    
    res.json({
      success: true,
      settings,
      activeFestival,
      totalFestivals: popupSettings.festivals.length
    });
    
  } catch (error) {
    console.error('❌ App Embeds Settings Fetch Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Clean up duplicate festivals endpoint
app.post('/api/app-embeds/cleanup/:shopDomain', async (req, res) => {
  try {
    const { shopDomain } = req.params;
    
    console.log('🧹 Cleaning up duplicate festivals for:', shopDomain);
    
    const popupSettings = await PopupSettings.findOne({ shopDomain });
    
    if (!popupSettings) {
      return res.json({
        success: false,
        message: 'No settings found for this shop'
      });
    }
    
    const originalCount = popupSettings.festivals.length;
    popupSettings.festivals = removeDuplicateFestivals(popupSettings.festivals);
    const newCount = popupSettings.festivals.length;
    
    await popupSettings.save();
    
    res.json({
      success: true,
      message: `Cleanup completed. Removed ${originalCount - newCount} duplicate festivals.`,
      originalCount,
      newCount,
      festivalsRemoved: originalCount - newCount
    });
    
  } catch (error) {
    console.error('❌ Cleanup Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/app-embeds/generate-festival/:shopDomain', async (req, res) => {
  try {
    const { shopDomain } = req.params;
    const { offer, startDate, endDate, isInfinite, originalStartDate } = req.body;
    
    console.log('🤖 App Embeds Festival Generation:', { 
      shopDomain, 
      offer, 
      startDate, 
      endDate, 
      isInfinite, 
      originalStartDate 
    });
    
    if (!offer || !startDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: offer, startDate'
      });
    }
    
    // Auto-calculate end date ONLY if not provided (empty or null/undefined)
    let finalEndDate = endDate;
    if (!finalEndDate || finalEndDate.trim() === '') {
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(startDateObj);
      endDateObj.setDate(endDateObj.getDate() + 7); // 7 days from start
      finalEndDate = endDateObj.toISOString().split('T')[0];
      console.log('📅 Auto-calculated end date (no end date provided):', finalEndDate);
    } else {
      console.log('📅 Using provided end date:', finalEndDate);
    }
    
    // Use existing smart festival generation
    const aiResponse = await axios.post(`http://localhost:${PORT}/api/create-smart-festival`, {
      shopDomain,
      offer,
      startDate,
      endDate: finalEndDate,
      isInfinite,
      originalStartDate
    });
    
    const aiResult = aiResponse.data;
    
    if (aiResult.success) {
      // Mark festival as infinite if applicable
      if (isInfinite) {
        aiResult.festival.isInfinite = true;
        aiResult.festival.originalStartDate = originalStartDate || startDate;
        aiResult.festival.currentPeriodStart = startDate;
        console.log('🔄 Festival marked as infinite:', {
          originalStart: aiResult.festival.originalStartDate,
          currentPeriod: aiResult.festival.currentPeriodStart
        });
      }
      
      // Save the festival to the database
      let popupSettings = await PopupSettings.findOne({ shopDomain });
      if (!popupSettings) {
        popupSettings = new PopupSettings({ shopDomain, festivals: [] });
      }
      
      // Add timestamp to track creation
      aiResult.festival.createdAt = new Date().toISOString();
      aiResult.festival.createdViaQuickSetup = true;
      
      // Add the generated festival to the shop's settings
      popupSettings.festivals.push(aiResult.festival);
      await popupSettings.save();
      
      console.log('✅ Festival saved to database:', {
        name: aiResult.festival.name,
        shopDomain: shopDomain,
        totalFestivals: popupSettings.festivals.length
      });
      
      // 🚀 AUTO-EMAIL: Send newsletter to subscribers when new festival is created
      try {
        console.log(`🚀 Auto-generating newsletter for newly created festival: ${aiResult.festival.name}`);
        const newsletterResult = await generateAndSendFestivalNewsletter(shopDomain, aiResult.festival);
        
        if (newsletterResult.success) {
          console.log(`✅ Auto-newsletter sent successfully: ${newsletterResult.emailsSent} emails sent`);
        } else {
          console.log(`⚠️ Auto-newsletter failed: ${newsletterResult.error}`);
        }
      } catch (emailError) {
        console.error('❌ Auto-newsletter error:', emailError.message);
        // Don't fail the festival creation if email fails
      }
      
      res.json({
        success: true,
        festival: aiResult.festival,
        message: isInfinite ? 
          'Infinite rolling festival generated and saved successfully!' : 
          'Festival generated and saved successfully!'
      });
    } else {
      throw new Error(aiResult.error || 'Festival generation failed');
    }
    
  } catch (error) {
    console.error('❌ App Embeds Festival Generation Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Debug festival endpoint
app.get('/api/debug/festival/:shopDomain', async (req, res) => {
  try {
    const { shopDomain } = req.params;
    const today = new Date().toISOString().split('T')[0];
    
    const settings = await PopupSettings.findOne({ shopDomain });
    const debugInfo = {
      shopDomain,
      todayISO: today,
      todayLocal: new Date().toLocaleDateString(),
      settings: settings ? {
        festivals: settings.festivals.map(f => ({
          name: f.name,
          offer: f.offer,
          startDate: f.startDate,
          endDate: f.endDate,
          startDateString: typeof f.startDate === 'string' ? f.startDate.split('T')[0] : f.startDate.toISOString().split('T')[0],
          endDateString: typeof f.endDate === 'string' ? f.endDate.split('T')[0] : f.endDate.toISOString().split('T')[0],
          isActive: (() => {
            const startDateStr = typeof f.startDate === 'string' ? f.startDate.split('T')[0] : f.startDate.toISOString().split('T')[0];
            const endDateStr = typeof f.endDate === 'string' ? f.endDate.split('T')[0] : f.endDate.toISOString().split('T')[0];
            return today >= startDateStr && today <= endDateStr;
          })()
        }))
      } : null,
      currentFestival: await getCurrentFestival(shopDomain)
    };
    
    res.json(debugInfo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin API endpoints for Shopify admin interface
app.get('/api/popup-settings', async (req, res) => {
  try {
    const shopDomain = req.query.shopDomain || 'test-shop.myshopify.com';
    const settings = await PopupSettings.findOne({ shopDomain });
    
    if (!settings) {
      return res.json({ 
        success: false, 
        message: 'No popup settings found',
        settings: { festivals: [] }
      });
    }
    
    res.json({ 
      success: true, 
      settings: {
        festivals: settings.festivals || [],
        displaySettings: settings.displaySettings || {}
      }
    });
  } catch (error) {
    console.error('Error fetching popup settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/subscribers', async (req, res) => {
  try {
    const shopDomain = req.query.shopDomain || 'test-shop.myshopify.com';
    const subscribers = await NewsletterSubscriber.find({ 
      shopDomain,
      isActive: true 
    }).select('email subscribedAt preferences').sort({ subscribedAt: -1 });
    
    res.json({ 
      success: true, 
      subscribers: subscribers || []
    });
  } catch (error) {
    console.error('Error fetching subscribers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const shopDomain = req.query.shopDomain || 'test-festival-popup.myshopify.com';
    
    // Get total subscribers (both types)
    const totalSubscribers = await NewsletterSubscriber.countDocuments({ 
      shopDomain,
      isActive: true 
    });
    
    // Get festival subscribers
    const festivalSubscribers = await NewsletterSubscriber.countDocuments({ 
      shopDomain, 
      isActive: true, 
      subscriptionType: 'festival' 
    });
    
    // Get blog subscribers
    const blogSubscribers = await NewsletterSubscriber.countDocuments({ 
      shopDomain, 
      isActive: true, 
      subscriptionType: 'blog' 
    });
    
    // Get newsletters sent (blog posts that have been sent)
    const newslettersSent = await BlogPost.countDocuments({ 
      shopDomain,
      sentNewsletter: true 
    });
    
    // Get new subscribers this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const newThisMonth = await NewsletterSubscriber.countDocuments({
      shopDomain,
      isActive: true,
      subscribedAt: { $gte: startOfMonth }
    });
    
    res.json({ 
      success: true, 
      stats: {
        totalSubscribers,
        festivalSubscribers,
        blogSubscribers,
        newslettersSent,
        newThisMonth
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Remove festival endpoint
app.post('/api/remove-festival', async (req, res) => {
  try {
    const { festivalId, shopDomain } = req.body;
    
    if (!festivalId || !shopDomain) {
      return res.status(400).json({ 
        success: false, 
        message: 'Festival ID and shop domain are required' 
      });
    }

    const settings = await PopupSettings.findOne({ shopDomain });
    
    if (!settings) {
      return res.status(404).json({ 
        success: false, 
        message: 'Shop settings not found' 
      });
    }

    // Remove the festival from the array - Compatible with both MongoDB and file-based storage
    const originalCount = settings.festivals.length;
    console.log(`🗑️ Festival removal request: festivalId="${festivalId}", originalCount=${originalCount}`);
    console.log(`🗑️ Festivals before removal:`, settings.festivals.map((f, i) => ({ index: i, name: f.name, id: f._id })));
    
    settings.festivals = settings.festivals.filter((festival, index) => {
      console.log(`🔍 Checking festival at index ${index}: name="${festival.name}", _id="${festival._id}"`);
      
      // Method 1: Try MongoDB _id if it exists
      if (festival._id && typeof festival._id.toString === 'function') {
        const match = festival._id.toString() === festivalId;
        console.log(`🔍 MongoDB _id check: ${festival._id.toString()} === ${festivalId} = ${match}`);
        if (match) return false;
      }
      
      // Method 2: Try array index (most common for file-based storage)
      const indexMatch = index.toString() === festivalId;
      console.log(`🔍 Index check: ${index} === ${festivalId} = ${indexMatch}`);
      if (indexMatch) {
        console.log(`✅ Removing festival at index ${index}: ${festival.name}`);
        return false;
      }
      
      // Method 3: Try festival name as identifier
      const nameMatch = festival.name === festivalId;
      console.log(`🔍 Name check: "${festival.name}" === "${festivalId}" = ${nameMatch}`);
      if (nameMatch) return false;
      
      // Method 4: Try discount code as identifier
      const codeMatch = festival.discountCode === festivalId;
      console.log(`🔍 Code check: "${festival.discountCode}" === "${festivalId}" = ${codeMatch}`);
      if (codeMatch) return false;
      
      return true;
    });

    const removedCount = originalCount - settings.festivals.length;
    console.log(`🗑️ Festival removal result: ${removedCount} festival(s) removed (${originalCount} → ${settings.festivals.length})`);
    console.log(`🗑️ Festivals after removal:`, settings.festivals.map((f, i) => ({ index: i, name: f.name, id: f._id })));

    await settings.save();

    res.json({ 
      success: true, 
      message: 'Festival removed successfully',
      remainingFestivals: settings.festivals.length
    });
  } catch (error) {
    console.error('Error removing festival:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Shopify authentication endpoints
app.get('/auth', (req, res) => {
  const shop = req.query.shop;
  const host = req.query.host;
  
  if (!shop) {
    return res.status(400).send('Missing shop parameter');
  }
  
  // For development, we'll skip the full OAuth flow and redirect directly to the app
  const redirectUrl = `/?shop=${shop}&host=${host}`;
  res.redirect(redirectUrl);
});

app.get('/auth/callback', (req, res) => {
  const shop = req.query.shop;
  const host = req.query.host;
  
  // For development, redirect to the main app
  res.redirect(`/?shop=${shop}&host=${host}`);
});

// Default route - serve admin interface for Shopify embedded app
app.get('/', (req, res) => {
  // Check if this is a Shopify embedded app request
  const userAgent = req.get('User-Agent') || '';
  const isShopifyRequest = req.query.shop || req.query.embedded || userAgent.includes('Shopify');
  
  if (isShopifyRequest) {
    // Set headers for embedded app
    res.setHeader('Content-Security-Policy', "frame-ancestors https://*.shopify.com https://admin.shopify.com;");
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    
    // Serve the embedded admin interface
    res.sendFile(path.join(__dirname, 'admin', 'shopify-embedded.html'));
  } else {
    // Serve API info for direct access
  res.json({ 
    message: 'Festival Popup & Newsletter Extension API',
    version: '1.0.0',
    endpoints: {
      admin: '/admin',
      health: '/health',
      popup: '/api/popup/:shopDomain',
      newsletter: '/api/newsletter/*',
      analytics: '/api/newsletter/analytics/:shopDomain'
    }
  });
  }
});

// Scheduled task to check for newly active festivals (runs every hour)
async function checkForNewlyActiveFestivals() {
  try {
    console.log('🕐 Checking for newly active festivals...');
    
    const allShops = await PopupSettings.find({});
    const now = new Date();
    
    for (const shop of allShops) {
      if (!shop.festivals || shop.festivals.length === 0) continue;
      
      const festivalsNeedingNewsletter = shop.festivals.filter(festival => {
        if (!festival.name || !festival.offer || !festival.discountCode) {
          return false; // Skip incomplete festivals
        }
        
        if (festival.autoNewsletterSent) {
          return false; // Newsletter already sent
        }
        
        const startDate = new Date(festival.startDate);
        const endDate = new Date(festival.endDate);
        const isActive = now >= startDate && now <= endDate;
        
        return isActive; // Only active festivals that haven't had newsletter sent
      });
      
      if (festivalsNeedingNewsletter.length > 0) {
        console.log(`🎪 Shop ${shop.shopDomain}: Found ${festivalsNeedingNewsletter.length} festival(s) needing auto-newsletter`);
        
        for (const festival of festivalsNeedingNewsletter) {
          try {
            console.log(`🚀 Auto-generating newsletter for newly active festival: ${festival.name} (${shop.shopDomain})`);
            const newsletterResult = await generateAndSendFestivalNewsletter(shop.shopDomain, festival);
            
            if (newsletterResult.success) {
              console.log(`✅ Auto-newsletter sent successfully for ${festival.name}`);
              
              // Mark festival as having newsletter sent - Compatible with file-based storage
              const updatedSettings = await PopupSettings.findOne({ shopDomain: shop.shopDomain });
              if (updatedSettings && updatedSettings.festivals) {
                const festivalIndex = updatedSettings.festivals.findIndex(f => 
                  f.name === festival.name && f.discountCode === festival.discountCode
                );
                if (festivalIndex !== -1) {
                  updatedSettings.festivals[festivalIndex].autoNewsletterSent = true;
                  updatedSettings.festivals[festivalIndex].newsLetterSentAt = new Date();
                  await updatedSettings.save();
                }
              }
            } else {
              console.log(`⚠️ Auto-newsletter failed for ${festival.name}:`, newsletterResult.error);
            }
          } catch (error) {
            console.error(`❌ Error sending auto-newsletter for ${festival.name}:`, error);
          }
        }
      }
    }
    
    console.log('✅ Completed checking for newly active festivals');
  } catch (error) {
    console.error('❌ Error in scheduled festival check:', error);
  }
}

// Function to reset newsletter flags for festivals that ended and restarted (infinite festivals)
async function resetNewsletterFlagsForRestartedFestivals() {
  try {
    console.log('🔄 Checking for festivals that ended and restarted...');
    
    const allShops = await PopupSettings.find({});
    const now = new Date();
    
    for (const shop of allShops) {
      if (!shop.festivals || shop.festivals.length === 0) continue;
      
      for (const festival of shop.festivals) {
        if (!festival.autoNewsletterSent || !festival.newsLetterSentAt) continue;
        
        const startDate = new Date(festival.startDate);
        const endDate = new Date(festival.endDate);
        const isCurrentlyActive = now >= startDate && now <= endDate;
        const newsletterSentAt = new Date(festival.newsLetterSentAt);
        
        // If festival is currently active but newsletter was sent more than 7 days ago,
        // it might be a restarted infinite festival - reset the flag
        const daysSinceNewsletter = (now - newsletterSentAt) / (1000 * 60 * 60 * 24);
        
        if (isCurrentlyActive && daysSinceNewsletter > 7) {
          console.log(`🔄 Resetting newsletter flag for restarted festival: ${festival.name} (${shop.shopDomain})`);
          
          // Reset newsletter flag - Compatible with file-based storage
          const resetSettings = await PopupSettings.findOne({ shopDomain: shop.shopDomain });
          if (resetSettings && resetSettings.festivals) {
            const festivalIndex = resetSettings.festivals.findIndex(f => 
              f.name === festival.name && f.discountCode === festival.discountCode
            );
            if (festivalIndex !== -1) {
              delete resetSettings.festivals[festivalIndex].autoNewsletterSent;
              delete resetSettings.festivals[festivalIndex].newsLetterSentAt;
              await resetSettings.save();
            }
          }
        }
      }
    }
    
    console.log('✅ Completed checking for restarted festivals');
  } catch (error) {
    console.error('❌ Error in restarted festival check:', error);
  }
}

// Run the check every hour
setInterval(checkForNewlyActiveFestivals, 60 * 60 * 1000); // 1 hour

// Run reset check every day at 1 AM
setInterval(resetNewsletterFlagsForRestartedFestivals, 24 * 60 * 60 * 1000); // 24 hours

app.listen(PORT, async () => {
  console.log(`🎉 Festival Popup & Newsletter Extension server running on port ${PORT}`);
  console.log(`📊 Admin panel available at: http://localhost:${PORT}/admin`);
  console.log(`⏰ Auto-newsletter scheduler: Checking every hour for newly active festivals`);
  
  // Get current festival info
  try {
    const currentFestival = await getCurrentFestival();
    console.log(`🎪 Current festival: ${currentFestival ? currentFestival.name : 'None'}`);
  } catch (error) {
    console.log('🎪 No active festival found');
  }
  
  console.log(`🕐 Server time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} (India)`);
  console.log(`📧 Email configured: ${!!(process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) ? 'Yes' : 'No'}`);
  console.log(`🗄️ Database: File-based storage (Shopify-compatible) - Ready`);
  
  // Run migration for existing subscribers
  await migrateExistingSubscribers();
}); 

// Function to extract dominant colors from an image URL
async function extractColorsFromImage(imageUrl) {
  try {
    console.log('🎨 Extracting colors from image:', imageUrl);
    
    // Download the image
    const response = await axios.get(imageUrl, { 
      responseType: 'arraybuffer',
      timeout: 30000
    });
    
    // Convert to buffer and process with sharp
    const buffer = Buffer.from(response.data);
    const processedBuffer = await sharp(buffer)
      .resize(200, 200, { fit: 'cover' })
      .png()
      .toBuffer();
    
    // Use ColorThief to get dominant colors
    const dominantColor = await ColorThief.getColor(processedBuffer);
    const palette = await ColorThief.getPalette(processedBuffer, 5);
    
    // Convert RGB to hex
    const rgbToHex = (r, g, b) => {
      return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    };
    
    const primaryColor = rgbToHex(dominantColor[0], dominantColor[1], dominantColor[2]);
    
    // Find a contrasting text color
    const textColor = getContrastingColor(primaryColor);
    
    // Get a slightly different background color from the palette
    const backgroundColor = palette.length > 1 ? 
      rgbToHex(palette[1][0], palette[1][1], palette[1][2]) : 
      adjustColorBrightness(primaryColor, 10);
    
    console.log('✅ Extracted colors from image:', { 
      primaryColor, 
      backgroundColor, 
      textColor,
      palette: palette.map(rgb => rgbToHex(rgb[0], rgb[1], rgb[2]))
    });
    
    return {
      primary: primaryColor,
      background: backgroundColor,
      text: textColor,
      palette: palette.map(rgb => rgbToHex(rgb[0], rgb[1], rgb[2]))
    };
    
  } catch (error) {
    console.error('❌ Error extracting colors from image:', error);
    
    // Fallback to default color scheme
    return {
      primary: '#007cba',
      background: '#e3f2fd',
      text: '#ffffff',
      palette: ['#007cba', '#1976d2', '#42a5f5']
    };
  }
}

// Function to determine contrasting text color
function getContrastingColor(backgroundColor) {
  // Remove # if present
  const hex = backgroundColor.replace('#', '');
  
  // Convert to RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return white for dark backgrounds, black for light backgrounds
  return luminance < 0.5 ? '#ffffff' : '#000000';
}

// Function to check if color has good contrast
function hasGoodContrast(textColor, backgroundColor) {
  const getLuminance = (hex) => {
    const rgb = parseInt(hex.replace('#', ''), 16);
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >> 8) & 0xff;
    const b = (rgb >> 0) & 0xff;
    
    const sRGB = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    
    return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
  };
  
  const textLum = getLuminance(textColor);
  const bgLum = getLuminance(backgroundColor);
  
  const ratio = (Math.max(textLum, bgLum) + 0.05) / (Math.min(textLum, bgLum) + 0.05);
  
  return ratio >= 4.5; // WCAG AA compliance
}

// ==================== SHOP EMAIL SETTINGS API ROUTES ====================

// Get shop email settings
app.get('/api/shop-settings/:shopDomain', async (req, res) => {
  try {
    const { shopDomain } = req.params;
    
    if (!shopDomain) {
      return res.status(400).json({ error: 'Shop domain is required' });
    }
    
    const shopSettings = await ShopSettings.getShopSettings(shopDomain);
    
    // Return settings without exposing encrypted password
    const safeSettings = {
      shop: shopSettings.shop,
      emailSettings: {
        enabled: shopSettings.emailSettings.enabled,
        provider: shopSettings.emailSettings.provider,
        fromEmail: shopSettings.emailSettings.fromEmail,
        fromName: shopSettings.emailSettings.fromName,
        smtpHost: shopSettings.emailSettings.smtpHost,
        smtpPort: shopSettings.emailSettings.smtpPort,
        secure: shopSettings.emailSettings.secure
        // encryptedPassword is deliberately excluded
      },
      festivalSettings: shopSettings.festivalSettings,
      createdAt: shopSettings.createdAt,
      updatedAt: shopSettings.updatedAt
    };
    
    res.json({ success: true, settings: safeSettings });
    
  } catch (error) {
    console.error('❌ Error getting shop settings:', error);
    res.status(500).json({ error: 'Failed to get shop settings' });
  }
});

// Get shop email settings
app.get('/api/shop-settings/:shopDomain/email', async (req, res) => {
  try {
    const { shopDomain } = req.params;
    
    if (!shopDomain) {
      return res.status(400).json({ error: 'Shop domain is required' });
    }
    
    const shopSettings = await ShopSettings.getShopSettings(shopDomain);
    
    // Return safe settings (without password)
    const safeSettings = {
      enabled: shopSettings.emailSettings.enabled,
      provider: shopSettings.emailSettings.provider,
      fromEmail: shopSettings.emailSettings.fromEmail,
      fromName: shopSettings.emailSettings.fromName,
      smtpHost: shopSettings.emailSettings.smtpHost,
      smtpPort: shopSettings.emailSettings.smtpPort,
      secure: shopSettings.emailSettings.secure
    };
    
    res.json({ 
      success: true, 
      settings: safeSettings
    });
    
  } catch (error) {
    console.error('❌ Error getting shop email settings:', error);
    res.status(500).json({ 
      error: 'Failed to get email settings',
      details: error.message 
    });
  }
});

// Update shop email settings
app.post('/api/shop-settings/:shopDomain/email', async (req, res) => {
  try {
    const { shopDomain } = req.params;
    const { fromEmail, fromName, password, provider, smtpHost, smtpPort, secure } = req.body;
    
    if (!shopDomain) {
      return res.status(400).json({ error: 'Shop domain is required' });
    }
    
    if (!fromEmail || !fromName || !password) {
      return res.status(400).json({ 
        error: 'Email, display name, and password are required' 
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(fromEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    // Validate provider
    const validProviders = ['gmail', 'outlook', 'yahoo', 'custom'];
    const selectedProvider = provider || 'gmail';
    if (!validProviders.includes(selectedProvider)) {
      return res.status(400).json({ error: 'Invalid email provider' });
    }
    
    // Validate custom SMTP settings if provider is custom
    if (selectedProvider === 'custom') {
      if (!smtpHost || !smtpPort) {
        return res.status(400).json({ 
          error: 'SMTP host and port are required for custom provider' 
        });
      }
      
      if (smtpPort < 1 || smtpPort > 65535) {
        return res.status(400).json({ error: 'Invalid SMTP port number' });
      }
    }
    
    console.log(`📧 Updating email settings for shop: ${shopDomain}`);
    
    const emailData = {
      fromEmail,
      fromName,
      password,
      provider: selectedProvider,
      smtpHost,
      smtpPort,
      secure: secure !== false // Default to true
    };
    
    const updatedSettings = await ShopSettings.updateEmailSettings(shopDomain, emailData);
    
    // Test the email configuration
    try {
      const testTransporter = await createShopEmailTransporter(shopDomain);
      if (testTransporter) {
        console.log(`✅ Email configuration tested successfully for shop: ${shopDomain}`);
      } else {
        console.warn(`⚠️ Email configuration saved but testing failed for shop: ${shopDomain}`);
      }
    } catch (testError) {
      console.warn(`⚠️ Email configuration saved but testing failed for shop: ${shopDomain}:`, testError.message);
    }
    
    // Return safe settings (without password)
    const safeSettings = {
      shop: updatedSettings.shop,
      emailSettings: {
        enabled: updatedSettings.emailSettings.enabled,
        provider: updatedSettings.emailSettings.provider,
        fromEmail: updatedSettings.emailSettings.fromEmail,
        fromName: updatedSettings.emailSettings.fromName,
        smtpHost: updatedSettings.emailSettings.smtpHost,
        smtpPort: updatedSettings.emailSettings.smtpPort,
        secure: updatedSettings.emailSettings.secure
      },
      festivalSettings: updatedSettings.festivalSettings,
      updatedAt: updatedSettings.updatedAt
    };
    
    res.json({ 
      success: true, 
      message: 'Email settings updated successfully',
      settings: safeSettings
    });
    
  } catch (error) {
    console.error('❌ Error updating shop email settings:', error);
    res.status(500).json({ 
      error: 'Failed to update email settings',
      details: error.message 
    });
  }
});

// Get current shop info from Shopify admin
app.get('/api/current-shop', async (req, res) => {
  try {
    const shop = req.query.shop || req.headers['x-shopify-shop-domain'] || 'unknown';
    const host = req.query.host || req.headers['x-shopify-host'] || 'unknown';
    
    res.json({
      success: true,
      detectedShop: shop,
      host: host,
      headers: {
        'x-shopify-shop-domain': req.headers['x-shopify-shop-domain'],
        'x-shopify-host': req.headers['x-shopify-host'],
        'referer': req.headers.referer
      },
      query: req.query
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List all shop settings (for debugging)
app.get('/api/debug/all-shops', async (req, res) => {
  try {
    const db = new ShopifyMetafieldsDB();
    const allMetafields = await db.getAllMetafields('*'); // This won't work, let me fix it
    
    // Instead, let's check common shop domains
    const testDomains = [
      'test-festival-popup.myshopify.com',
      'test-shop.myshopify.com', 
      'test-festival-popup',
      'your-shop.myshopify.com'
    ];
    
    const results = {};
    
    for (const domain of testDomains) {
      try {
        const settings = await ShopSettings.getShopSettings(domain);
        results[domain] = {
          hasSettings: !!settings,
          emailEnabled: settings?.emailSettings?.enabled || false,
          fromEmail: settings?.emailSettings?.fromEmail || '',
          hasPassword: !!settings?.emailSettings?.encryptedPassword
        };
      } catch (error) {
        results[domain] = { error: error.message };
      }
    }
    
    res.json({
      success: true,
      shopDomains: results
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Debug endpoint to check email settings
app.get('/api/shop-settings/:shopDomain/debug', async (req, res) => {
  try {
    const { shopDomain } = req.params;
    console.log(`🔍 DEBUG: Checking settings for shop: ${shopDomain}`);
    
    const shopSettings = await ShopSettings.getShopSettings(shopDomain);
    
    res.json({
      success: true,
      shopDomain,
      hasSettings: !!shopSettings,
      emailSettings: shopSettings ? {
        enabled: shopSettings.emailSettings.enabled,
        provider: shopSettings.emailSettings.provider,
        fromEmail: shopSettings.emailSettings.fromEmail,
        fromName: shopSettings.emailSettings.fromName,
        hasEncryptedPassword: !!shopSettings.emailSettings.encryptedPassword,
        smtpHost: shopSettings.emailSettings.smtpHost,
        smtpPort: shopSettings.emailSettings.smtpPort,
        secure: shopSettings.emailSettings.secure
      } : null,
      rawSettings: shopSettings
    });
  } catch (error) {
    console.error('❌ Debug endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test shop email configuration
app.post('/api/shop-settings/:shopDomain/email/test', async (req, res) => {
  try {
    const { shopDomain } = req.params;
    const { testEmail } = req.body;
    
    if (!shopDomain) {
      return res.status(400).json({ error: 'Shop domain is required' });
    }
    
    if (!testEmail) {
      return res.status(400).json({ error: 'Test email address is required' });
    }
    
    // Validate test email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(testEmail)) {
      return res.status(400).json({ error: 'Invalid test email format' });
    }
    
    console.log(`📧 Testing email configuration for shop: ${shopDomain}`);
    
    // Debug: Check settings step by step
    const shopSettings = await ShopSettings.getShopSettings(shopDomain);
    console.log(`🔍 DEBUG: Shop settings enabled: ${shopSettings?.emailSettings?.enabled}`);
    console.log(`🔍 DEBUG: Has encrypted password: ${!!shopSettings?.emailSettings?.encryptedPassword}`);
    
    if (shopSettings?.emailSettings?.enabled) {
      try {
        const credentials = shopSettings.getEmailCredentials();
        console.log(`🔍 DEBUG: Credentials obtained: ${!!credentials}`);
        console.log(`🔍 DEBUG: User: ${credentials?.user}`);
        console.log(`🔍 DEBUG: Has password: ${!!credentials?.pass}`);
      } catch (credError) {
        console.error(`🔍 DEBUG: Credential error: ${credError.message}`);
        return res.status(500).json({ 
          success: false,
          error: 'Failed to decrypt email credentials',
          details: credError.message 
        });
      }
    }
    
    // Get shop email transporter
    const shopTransporter = await createShopEmailTransporter(shopDomain);
    
    if (!shopTransporter) {
      return res.status(500).json({ 
        success: false,
        error: 'Failed to create email transporter. Check server logs for details.' 
      });
    }
    
    // shopSettings already declared above, no need to redeclare
    
    // Send test email
    const testEmailOptions = {
      from: `"${shopSettings.emailSettings.fromName}" <${shopSettings.emailSettings.fromEmail}>`,
      to: testEmail,
      subject: '🎉 Email Configuration Test - Festival Popup App',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #007cba;">Email Configuration Test Successful! 🎉</h2>
          <p>Congratulations! Your email settings have been configured correctly for your Shopify store.</p>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #333;">Configuration Details:</h3>
            <p><strong>Shop:</strong> ${shopDomain}</p>
            <p><strong>From Email:</strong> ${shopSettings.emailSettings.fromEmail}</p>
            <p><strong>From Name:</strong> ${shopSettings.emailSettings.fromName}</p>
            <p><strong>Provider:</strong> ${shopSettings.emailSettings.provider}</p>
            <p><strong>Test Time:</strong> ${new Date().toLocaleString()}</p>
          </div>
          
          <p>Your customers will now receive festival offers and newsletters from this email address.</p>
          
          <p style="color: #666; font-size: 14px;">
            This is a test email from the Festival Popup App for Shopify.<br>
            If you didn't request this test, please ignore this email.
          </p>
        </div>
      `
    };
    
    // Send email (will use HTTP service if SMTP is blocked)
    console.log(`📧 Sending test email...`);
    const result = await shopTransporter.sendMail(testEmailOptions);
    console.log(`✅ Test email sent successfully for shop: ${shopDomain} to: ${testEmail}`);
    
    res.json({ 
      success: true, 
      message: result.real ? 
        'Real email sent successfully! Please check your inbox.' :
        result.simulated ? 
          'Email simulated successfully! Add RESEND_API_KEY or SENDGRID_API_KEY to environment for real emails.' :
          'Test email sent successfully! Please check your inbox.',
      testEmail: testEmail,
      sentAt: new Date().toISOString(),
      messageId: result.messageId,
      service: result.service,
      real: result.real || false,
      simulated: result.simulated || false,
      note: result.note
    });
    
  } catch (error) {
    console.error('❌ Error sending test email:', error);
    console.error('🔍 DEBUG: Full error details:', {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode
    });
    
    let errorMessage = 'Failed to send test email';
    let errorDetails = error.message;
    
    // Provide more specific error messages
    if (error.code === 'EAUTH') {
      errorMessage = 'Authentication failed';
      errorDetails = 'Invalid email credentials. Please check your email and password/app password.';
    } else if (error.code === 'ENOTFOUND') {
      errorMessage = 'SMTP server not found';
      errorDetails = 'Could not connect to email server. Please check your internet connection.';
    } else if (error.code === 'ECONNECTION') {
      errorMessage = 'Connection failed';
      errorDetails = 'Could not connect to email server. Please check your SMTP settings.';
    } else if (error.responseCode === 535) {
      errorMessage = 'Authentication failed';
      errorDetails = 'Invalid credentials. For Gmail, make sure you are using an App Password, not your regular password.';
    }
    
    res.status(500).json({ 
      success: false,
      error: errorMessage,
      details: errorDetails,
      code: error.code,
      responseCode: error.responseCode
    });
  }
});

// Disable email settings for a shop
app.post('/api/shop-settings/:shopDomain/email/disable', async (req, res) => {
  try {
    const { shopDomain } = req.params;
    
    if (!shopDomain) {
      return res.status(400).json({ error: 'Shop domain is required' });
    }
    
    console.log(`📧 Disabling email settings for shop: ${shopDomain}`);
    
    const shopSettings = await ShopSettings.getShopSettings(shopDomain);
    shopSettings.emailSettings.enabled = false;
    await shopSettings.save();
    
    res.json({ 
      success: true, 
      message: 'Email settings disabled successfully',
      shop: shopDomain
    });
    
  } catch (error) {
    console.error('❌ Error disabling email settings:', error);
    res.status(500).json({ 
      error: 'Failed to disable email settings',
      details: error.message 
    });
  }
});

// Update festival email template settings
app.post('/api/shop-settings/:shopDomain/festival-template', async (req, res) => {
  try {
    const { shopDomain } = req.params;
    const { subject, message, autoGenerate } = req.body;
    
    if (!shopDomain) {
      return res.status(400).json({ error: 'Shop domain is required' });
    }
    
    console.log(`🎭 Updating festival template settings for shop: ${shopDomain}`);
    
    const shopSettings = await ShopSettings.getShopSettings(shopDomain);
    
    if (subject !== undefined) {
      shopSettings.festivalSettings.emailTemplate.subject = subject;
    }
    
    if (message !== undefined) {
      shopSettings.festivalSettings.emailTemplate.message = message;
    }
    
    if (autoGenerate !== undefined) {
      shopSettings.festivalSettings.autoGenerate = autoGenerate;
    }
    
    await shopSettings.save();
    
    res.json({ 
      success: true, 
      message: 'Festival template settings updated successfully',
      festivalSettings: shopSettings.festivalSettings
    });
    
  } catch (error) {
    console.error('❌ Error updating festival template settings:', error);
    res.status(500).json({ 
      error: 'Failed to update festival template settings',
      details: error.message 
    });
  }
});

// ==================== END SHOP EMAIL SETTINGS API ROUTES ====================

// ==================== LOCATION-BASED FESTIVAL SYSTEM ====================

// Regional festival mappings for Indian states
const REGIONAL_FESTIVAL_MAPPINGS = {
  // Northern States
  'Delhi': {
    'Dussehra': { name: 'Dussehra Special', bgKeywords: 'dussehra celebration ram victory ravana effigy burning north indian festival' },
    'Diwali': { name: 'Diwali Dhamaka', bgKeywords: 'diwali lights diyas rangoli crackers delhi celebration' },
    'Holi': { name: 'Holi Celebration', bgKeywords: 'holi colors gulal northern india celebration' },
    'Karva Chauth': { name: 'Karva Chauth Special', bgKeywords: 'karva chauth moon festival married women celebration' },
    'Dhan Teras': { name: 'Dhanteras Shopping', bgKeywords: 'dhanteras gold shopping lakshmi worship' },
    'Guru Purnima': { name: 'Guru Purnima Special', bgKeywords: 'guru purnima delhi teacher celebration spiritual knowledge wisdom' }
  },
  'Punjab': {
    'Dussehra': { name: 'Dussehra Mela', bgKeywords: 'dussehra punjabi mela celebration sikh festival' },
    'Baisakhi': { name: 'Baisakhi Festival', bgKeywords: 'baisakhi punjabi harvest festival golden wheat fields' },
    'Diwali': { name: 'Diwali Celebration', bgKeywords: 'diwali punjabi celebration golden temple lights' },
    'Lohri': { name: 'Lohri Special', bgKeywords: 'lohri bonfire sugarcane jaggery punjabi winter festival' },
    'Guru Purnima': { name: 'Guru Purnima Celebration', bgKeywords: 'guru purnima punjab sikh guru wisdom golden temple spiritual' }
  },
  'Haryana': {
    'Dussehra': { name: 'Dussehra Special', bgKeywords: 'dussehra haryana celebration ram leela effigy burning' },
    'Teej': { name: 'Hariyali Teej', bgKeywords: 'teej festival monsoon swings green celebration haryana' },
    'Karva Chauth': { name: 'Karva Chauth Celebration', bgKeywords: 'karva chauth haryana traditional celebration' },
    'Guru Purnima': { name: 'Guru Purnima Special', bgKeywords: 'guru purnima haryana teacher celebration spiritual wisdom' }
  },
  'Uttar Pradesh': {
    'Dussehra': { name: 'Dussehra Mahotsav', bgKeywords: 'dussehra ram leela ayodhya uttar pradesh celebration' },
    'Diwali': { name: 'Deepavali Special', bgKeywords: 'diwali ayodhya ram return celebration lights uttar pradesh' },
    'Holi': { name: 'Rang Bhari Holi', bgKeywords: 'holi vrindavan mathura colors celebration uttar pradesh' },
    'Krishna Janmashtami': { name: 'Janmashtami Celebration', bgKeywords: 'krishna janmashtami mathura vrindavan celebration' },
    'Guru Purnima': { name: 'Guru Purnima Mahotsav', bgKeywords: 'guru purnima uttar pradesh banaras varanasi sage wisdom spiritual celebration' }
  },
  'Rajasthan': {
    'Dussehra': { name: 'Dussehra Rajasthani', bgKeywords: 'dussehra rajasthan royal celebration desert festival' },
    'Teej': { name: 'Rajasthani Teej', bgKeywords: 'teej rajasthan colorful celebration traditional dress' },
    'Gangaur': { name: 'Gangaur Festival', bgKeywords: 'gangaur rajasthan goddess gauri celebration' },
    'Guru Purnima': { name: 'Guru Purnima Special', bgKeywords: 'guru purnima rajasthan desert spiritual wisdom sage celebration' }
  },

  // Western States
  'Maharashtra': {
    'Dussehra': { name: 'Dashami Special', bgKeywords: 'dashami celebration bijoya dashami durga visarjan maharashtra' },
    'Ganesh Chaturthi': { name: 'Ganpati Bappa Morya', bgKeywords: 'ganesh chaturthi mumbai ganpati celebration maharashtra' },
    'Gudi Padwa': { name: 'Gudi Padwa Celebration', bgKeywords: 'gudi padwa marathi new year celebration maharashtra' },
    'Diwali': { name: 'Diwali Celebration', bgKeywords: 'diwali maharashtra lights celebration' },
    'Guru Purnima': { name: 'Guru Purnima Special', bgKeywords: 'guru purnima maharashtra teacher celebration spiritual wisdom marathi' }
  },
  'Gujarat': {
    'Dussehra': { name: 'Dussehra Garba', bgKeywords: 'dussehra navratri garba celebration gujarat' },
    'Navratri': { name: 'Navratri Celebration', bgKeywords: 'navratri garba dandiya gujarat celebration colorful' },
    'Diwali': { name: 'Diwali Special', bgKeywords: 'diwali gujarat celebration lights diyas' },
    'Guru Purnima': { name: 'Guru Purnima Special', bgKeywords: 'guru purnima gujarat spiritual wisdom teacher celebration gujarati' }
  },
  'Goa': {
    'Dussehra': { name: 'Dussehra Goan Style', bgKeywords: 'dussehra goa coastal celebration beach festival' },
    'Christmas': { name: 'Christmas Celebration', bgKeywords: 'christmas goa beach celebration coastal festival' },
    'Carnival': { name: 'Goan Carnival', bgKeywords: 'goa carnival colorful parade beach celebration' },
    'Guru Purnima': { name: 'Guru Purnima Special', bgKeywords: 'guru purnima goa coastal spiritual wisdom teacher celebration' }
  },

  // Eastern States  
  'West Bengal': {
    'Dussehra': { name: 'Bijoya Dashami', bgKeywords: 'bijoya dashami durga puja bengali celebration west bengal' },
    'Durga Puja': { name: 'Durga Puja Special', bgKeywords: 'durga puja pandal bengali celebration kolkata' },
    'Kali Puja': { name: 'Kali Puja Celebration', bgKeywords: 'kali puja bengali celebration dark goddess' },
    'Poila Boishakh': { name: 'Bengali New Year', bgKeywords: 'poila boishakh bengali new year fish rice celebration' },
    'Guru Purnima': { name: 'Guru Purnima Utsav', bgKeywords: 'guru purnima bengali celebration rabindranath tagore wisdom teacher spiritual west bengal' }
  },
  'Odisha': {
    'Dussehra': { name: 'Bijoya Dashami', bgKeywords: 'bijoya dashami durga puja odia celebration odisha' },
    'Rath Yatra': { name: 'Jagannath Rath Yatra', bgKeywords: 'rath yatra jagannath puri odisha chariot festival' },
    'Durga Puja': { name: 'Durga Puja Special', bgKeywords: 'durga puja odia celebration odisha' },
    'Guru Purnima': { name: 'Guru Purnima Special', bgKeywords: 'guru purnima odisha jagannath puri spiritual wisdom teacher celebration odia' }
  },
  'Assam': {
    'Dussehra': { name: 'Dussehra Assamese', bgKeywords: 'dussehra assam celebration northeastern festival' },
    'Bihu': { name: 'Bihu Celebration', bgKeywords: 'bihu assam harvest festival traditional dance' },
    'Durga Puja': { name: 'Durga Puja Special', bgKeywords: 'durga puja assam celebration' },
    'Guru Purnima': { name: 'Guru Purnima Special', bgKeywords: 'guru purnima assam northeastern spiritual wisdom teacher celebration assamese' }
  },

  // Southern States
  'Tamil Nadu': {
    'Dussehra': { name: 'Golu Festival', bgKeywords: 'dussehra golu navarathri tamil nadu celebration dolls' },
    'Pongal': { name: 'Pongal Celebration', bgKeywords: 'pongal tamil harvest festival sugarcane rice' },
    'Tamil New Year': { name: 'Tamil Puthaandu', bgKeywords: 'tamil new year puthaandu celebration tamil nadu' },
    'Guru Purnima': { name: 'Guru Purnima Special', bgKeywords: 'guru purnima tamil nadu spiritual wisdom teacher celebration tamil culture' }
  },
  'Karnataka': {
    'Dussehra': { name: 'Mysore Dussehra', bgKeywords: 'mysore dussehra palace celebration karnataka royal festival' },
    'Ugadi': { name: 'Ugadi Celebration', bgKeywords: 'ugadi kannada new year celebration karnataka' },
    'Ganesh Chaturthi': { name: 'Ganesha Festival', bgKeywords: 'ganesh chaturthi karnataka celebration' },
    'Guru Purnima': { name: 'Guru Purnima Special', bgKeywords: 'guru purnima karnataka spiritual wisdom teacher celebration kannada culture' }
  },
  'Kerala': {
    'Dussehra': { name: 'Vijayadashami', bgKeywords: 'vijayadashami kerala celebration backwaters coconut' },
    'Onam': { name: 'Onam Celebration', bgKeywords: 'onam kerala harvest festival pookalam boat race' },
    'Vishu': { name: 'Vishu Special', bgKeywords: 'vishu kerala new year golden celebration' },
    'Guru Purnima': { name: 'Guru Purnima Special', bgKeywords: 'guru purnima kerala backwaters spiritual wisdom teacher celebration malayalam' }
  },
  'Andhra Pradesh': {
    'Dussehra': { name: 'Vijaya Dashami', bgKeywords: 'vijaya dashami andhra pradesh celebration telugu festival' },
    'Ugadi': { name: 'Ugadi Festival', bgKeywords: 'ugadi telugu new year celebration andhra pradesh' },
    'Guru Purnima': { name: 'Guru Purnima Special', bgKeywords: 'guru purnima andhra pradesh spiritual wisdom teacher celebration telugu culture' }
  },
  'Telangana': {
    'Dussehra': { name: 'Vijaya Dashami', bgKeywords: 'vijaya dashami telangana celebration telugu festival' },
    'Bathukamma': { name: 'Bathukamma Festival', bgKeywords: 'bathukamma telangana flower festival women celebration' },
    'Guru Purnima': { name: 'Guru Purnima Special', bgKeywords: 'guru purnima telangana spiritual wisdom teacher celebration telugu culture' }
  },

  // North-Eastern States
  'Manipur': {
    'Dussehra': { name: 'Dussehra Celebration', bgKeywords: 'dussehra manipur northeastern celebration' },
    'Guru Purnima': { name: 'Guru Purnima Special', bgKeywords: 'guru purnima manipur northeastern spiritual wisdom teacher celebration' }
  },
  'Mizoram': {
    'Dussehra': { name: 'Dussehra Celebration', bgKeywords: 'dussehra mizoram northeastern celebration' },
    'Guru Purnima': { name: 'Guru Purnima Special', bgKeywords: 'guru purnima mizoram northeastern spiritual wisdom teacher celebration' }
  },
  'Nagaland': {
    'Dussehra': { name: 'Dussehra Celebration', bgKeywords: 'dussehra nagaland northeastern celebration' },
    'Guru Purnima': { name: 'Guru Purnima Special', bgKeywords: 'guru purnima nagaland northeastern spiritual wisdom teacher celebration' }
  },
  'Meghalaya': {
    'Dussehra': { name: 'Dussehra Celebration', bgKeywords: 'dussehra meghalaya northeastern celebration' },
    'Guru Purnima': { name: 'Guru Purnima Special', bgKeywords: 'guru purnima meghalaya northeastern spiritual wisdom teacher celebration' }
  },
  'Tripura': {
    'Dussehra': { name: 'Bijoya Dashami', bgKeywords: 'bijoya dashami durga puja tripura bengali celebration' },
    'Guru Purnima': { name: 'Guru Purnima Special', bgKeywords: 'guru purnima tripura northeastern spiritual wisdom teacher celebration' }
  },
  'Arunachal Pradesh': {
    'Dussehra': { name: 'Dussehra Celebration', bgKeywords: 'dussehra arunachal pradesh northeastern celebration' },
    'Guru Purnima': { name: 'Guru Purnima Special', bgKeywords: 'guru purnima arunachal pradesh northeastern spiritual wisdom teacher celebration' }
  },
  'Sikkim': {
    'Dussehra': { name: 'Dussehra Celebration', bgKeywords: 'dussehra sikkim himalayan celebration' },
    'Guru Purnima': { name: 'Guru Purnima Special', bgKeywords: 'guru purnima sikkim himalayan spiritual wisdom teacher celebration' }
  },

  // Other States  
  'Jharkhand': {
    'Dussehra': { name: 'Dussehra Tribal', bgKeywords: 'dussehra jharkhand tribal celebration' },
    'Sohrai': { name: 'Sohrai Festival', bgKeywords: 'sohrai jharkhand tribal harvest festival' },
    'Guru Purnima': { name: 'Guru Purnima Special', bgKeywords: 'guru purnima jharkhand tribal spiritual wisdom teacher celebration' }
  },
  'Himachal Pradesh': {
    'Dussehra': { name: 'Kullu Dussehra', bgKeywords: 'kullu dussehra himachal pradesh mountain celebration' },
    'Guru Purnima': { name: 'Guru Purnima Special', bgKeywords: 'guru purnima himachal pradesh mountain spiritual wisdom teacher celebration' }
  },
  'Uttarakhand': {
    'Dussehra': { name: 'Dussehra Special', bgKeywords: 'dussehra uttarakhand mountain celebration' },
    'Guru Purnima': { name: 'Guru Purnima Special', bgKeywords: 'guru purnima uttarakhand mountain spiritual wisdom teacher celebration' }
  },
  'Jammu and Kashmir': {
    'Dussehra': { name: 'Dussehra Special', bgKeywords: 'dussehra jammu kashmir mountain celebration' },
    'Guru Purnima': { name: 'Guru Purnima Special', bgKeywords: 'guru purnima jammu kashmir mountain spiritual wisdom teacher celebration' }
  },
  'Bihar': {
    'Dussehra': { name: 'Dussehra Special', bgKeywords: 'dussehra bihar celebration' },
    'Guru Purnima': { name: 'Guru Purnima Special', bgKeywords: 'guru purnima bihar spiritual wisdom teacher celebration' }
  },

  // Central States
  'Madhya Pradesh': {
    'Dussehra': { name: 'Dussehra Celebration', bgKeywords: 'dussehra madhya pradesh central india celebration' },
    'Diwali': { name: 'Diwali Special', bgKeywords: 'diwali madhya pradesh celebration lights' },
    'Guru Purnima': { name: 'Guru Purnima Special', bgKeywords: 'guru purnima madhya pradesh central india spiritual wisdom teacher celebration' }
  },
  'Chhattisgarh': {
    'Dussehra': { name: 'Dussehra Bastar', bgKeywords: 'dussehra bastar chhattisgarh tribal celebration' },
    'Guru Purnima': { name: 'Guru Purnima Special', bgKeywords: 'guru purnima chhattisgarh tribal spiritual wisdom teacher celebration' }
  }
};

// Get user location from IP address
app.get('/api/location/detect', async (req, res) => {
  try {
    const clientIP = req.headers['x-forwarded-for'] || 
                    req.headers['x-real-ip'] || 
                    req.connection.remoteAddress || 
                    req.socket.remoteAddress ||
                    (req.connection.socket ? req.connection.socket.remoteAddress : null);

    console.log('🌍 Location detection for IP:', clientIP);

    // For localhost/development, return default location
    if (!clientIP || clientIP === '127.0.0.1' || clientIP === '::1' || clientIP.includes('localhost')) {
      console.log('🏠 Local development detected, using default location');
      return res.json({
        success: true,
        location: {
          country: 'India',
          state: 'Delhi',
          city: 'New Delhi',
          isDefault: true
        },
        ip: 'localhost'
      });
    }

    // Use ip-api.com for free IP geolocation
    const response = await axios.get(`http://ip-api.com/json/${clientIP}?fields=status,message,country,regionName,city,query`, {
      timeout: 5000
    });

    if (response.data.status === 'success') {
      const locationData = {
        country: response.data.country,
        state: response.data.regionName,
        city: response.data.city,
        isDefault: false
      };

      console.log('✅ Location detected:', locationData);

      res.json({
        success: true,
        location: locationData,
        ip: clientIP
      });
    } else {
      throw new Error('Location API failed');
    }

  } catch (error) {
    console.error('❌ Location detection failed:', error.message);
    
    // Fallback to default Indian location
    res.json({
      success: true,
      location: {
        country: 'India',
        state: 'Delhi',
        city: 'New Delhi',
        isDefault: true,
        error: 'Could not detect location'
      },
      ip: 'unknown'
    });
  }
});

// Get region-specific festival data
app.get('/api/location/festival/:shopDomain', async (req, res) => {
  try {
    const { shopDomain } = req.params;
    const userLocation = req.query.state || 'Delhi'; // Default to Delhi if no state provided
    const specificFestivalName = req.query.festivalName; // For preview mode
    
    console.log(`🎪 Getting region-specific festival for ${userLocation}, shop: ${shopDomain}`);
    if (specificFestivalName) {
      console.log(`🎯 Specific festival requested for preview: ${specificFestivalName}`);
    }

    // Get the festival settings from database
    const settings = await PopupSettings.findOne({ shopDomain });
    
    if (!settings || !settings.festivals || settings.festivals.length === 0) {
      return res.json({
        success: false,
        message: 'No festivals configured for this shop'
      });
    }

    let targetFestival;

    // If specific festival name provided (preview mode), find that festival
    if (specificFestivalName) {
      targetFestival = settings.festivals.find(festival => 
        festival.name.toLowerCase().includes(specificFestivalName.toLowerCase()) ||
        specificFestivalName.toLowerCase().includes(festival.name.toLowerCase())
      );
      
      if (!targetFestival) {
        console.log(`⚠️ Specific festival "${specificFestivalName}" not found, trying by exact name match`);
        targetFestival = settings.festivals.find(festival => festival.name === specificFestivalName);
      }
    } else {
      // Regular mode: Find current active festival
      const now = new Date();
      targetFestival = settings.festivals.find(festival => {
        const startDate = new Date(festival.startDate);
        const endDate = new Date(festival.endDate);
        return now >= startDate && now <= endDate;
      });
    }

    if (!targetFestival) {
      return res.json({
        success: false,
        message: specificFestivalName ? `Festival "${specificFestivalName}" not found` : 'No active festival found'
      });
    }

    console.log(`🎪 Found festival: ${targetFestival.name} (${targetFestival.startDate} to ${targetFestival.endDate})`);

    // Get regional customization
    const regionalData = getRegionalFestivalData(targetFestival, userLocation);

    res.json({
      success: true,
      isRegional: regionalData.isCustomized,
      festival: {
        ...(targetFestival.toObject ? targetFestival.toObject() : targetFestival),
        // Override name and background based on region
        name: regionalData.name,
        backgroundImageUrl: regionalData.backgroundImageUrl,
        backgroundImagePrompt: regionalData.backgroundImagePrompt,
        // Keep original discount code and offer
        originalName: targetFestival.name,
        region: userLocation,
        isRegionallyCustomized: regionalData.isCustomized
      }
    });

  } catch (error) {
    console.error('❌ Error getting regional festival:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to get regional festival data
function getRegionalFestivalData(baseFestival, userState) {
  console.log(`🗺️ Getting regional data for ${baseFestival.name} in ${userState}`);

  // Determine which festival this is based on dates or name
  const festivalDate = new Date(baseFestival.startDate);
  const month = festivalDate.getMonth() + 1; // 1-12
  const day = festivalDate.getDate();

  let festivalType = 'Generic';
  
  // Identify the festival type based on name first, then date
  const festivalNameLower = baseFestival.name.toLowerCase();
  
  // Check name-based identification first (more reliable)
  if (festivalNameLower.includes('dussehra') || festivalNameLower.includes('dashami') || festivalNameLower.includes('vijaya')) {
    festivalType = 'Dussehra';
  } else if (festivalNameLower.includes('diwali') || festivalNameLower.includes('deepavali') || festivalNameLower.includes('lights')) {
    festivalType = 'Diwali';
  } else if (festivalNameLower.includes('holi') || festivalNameLower.includes('colors')) {
    festivalType = 'Holi';
  } else if (festivalNameLower.includes('ganesh') || festivalNameLower.includes('ganesha') || festivalNameLower.includes('ganpati')) {
    festivalType = 'Ganesh Chaturthi';
  } else if (festivalNameLower.includes('guru purnima') || festivalNameLower.includes('purnima')) {
    festivalType = 'Guru Purnima';
  } else if (festivalNameLower.includes('navratri') || festivalNameLower.includes('durga')) {
    festivalType = 'Navratri';
  } else if (festivalNameLower.includes('karva chauth')) {
    festivalType = 'Karva Chauth';
  } else if (festivalNameLower.includes('republic')) {
    festivalType = 'Republic Day';
  } else if (festivalNameLower.includes('independence')) {
    festivalType = 'Independence Day';
  } 
  // Fallback to date-based identification if name doesn't match
  else if (month === 10 && day >= 1 && day <= 10) {
    festivalType = 'Dussehra';
  } else if (month === 10 && day >= 25 || month === 11 && day <= 15) {
    festivalType = 'Diwali';
  } else if (month === 3 && day >= 10 && day <= 20) {
    festivalType = 'Holi';
  } else if (month === 8 && day >= 15 && day <= 30) {
    festivalType = 'Ganesh Chaturthi';
  } else if (month === 7 && day >= 11 && day <= 14) {
    festivalType = 'Guru Purnima';
  } else if (month === 1 && day === 26) {
    festivalType = 'Republic Day';
  } else if (month === 8 && day === 15) {
    festivalType = 'Independence Day';
  }

  console.log(`🎯 Identified festival type: ${festivalType} for date ${month}/${day}`);

  // Get regional mapping
  const stateMapping = REGIONAL_FESTIVAL_MAPPINGS[userState];
  
  if (stateMapping && stateMapping[festivalType]) {
    const regionalFestival = stateMapping[festivalType];
    
    // Generate deterministic seed for consistent images
    const deterministicSeed = generateDeterministicSeed(festivalType, userState);
    
    // Generate region-specific background image with consistent seed
    const regionalImagePrompt = `beautiful festive ${regionalFestival.bgKeywords}, vibrant colors, celebration, traditional elements, high quality, detailed`;
    const regionalImageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(regionalImagePrompt)}?width=815&height=593&seed=${deterministicSeed}&model=flux&enhance=true&nologo=true`;
    
    console.log(`✅ Regional customization applied: ${regionalFestival.name} for ${userState} (seed: ${deterministicSeed})`);
    
    return {
      name: sanitizeFestivalName(regionalFestival.name),
      backgroundImageUrl: regionalImageUrl,
      backgroundImagePrompt: regionalImagePrompt,
      isCustomized: true
    };
  }

  // Fallback: return original festival data with deterministic seed
  console.log(`⚠️ No regional mapping found for ${festivalType} in ${userState}, using original`);
  
  // Generate deterministic seed for original festival too
  const fallbackSeed = generateDeterministicSeed(baseFestival.name, userState);
  
  // If original festival has no background image URL, generate one
  let fallbackImageUrl = baseFestival.backgroundImageUrl;
  if (!fallbackImageUrl) {
    const fallbackPrompt = `beautiful festive ${baseFestival.name.toLowerCase()} celebration, vibrant colors, traditional elements, high quality, detailed`;
    fallbackImageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(fallbackPrompt)}?width=815&height=593&seed=${fallbackSeed}&model=flux&enhance=true&nologo=true`;
  }
  
  return {
    name: sanitizeFestivalName(baseFestival.name),
    backgroundImageUrl: fallbackImageUrl,
    backgroundImagePrompt: baseFestival.backgroundImagePrompt,
    isCustomized: false
  };
}

// ==================== END LOCATION-BASED FESTIVAL SYSTEM ====================

// ==================== BLOG NEWSLETTER POPUP SYSTEM ====================

// Get blog popup settings
app.get('/api/blog-popup/:shopDomain', async (req, res) => {
  try {
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, ngrok-skip-browser-warning, Accept, Cache-Control, Pragma, Expires, X-Requested-With',
      'Access-Control-Allow-Credentials': 'true',
      'ETag': `"${Date.now()}-${Math.random()}"`,
      'Last-Modified': new Date().toUTCString(),
      'Vary': 'Accept-Encoding'
    });
    
    const { shopDomain } = req.params;
    console.log(`🔄 Fetching blog popup settings for: ${shopDomain}`);
    
    let settings = await PopupSettings.findOne({ shopDomain });
    
    if (!settings) {
      // Create default blog popup settings
      settings = new PopupSettings({
        shopDomain,
        festivals: [],
        isActive: false,
        blogPopupSettings: {
          enabled: true,
          title: 'Stay Updated with Our Blog',
          subtitle: 'Get the latest insights, tips, and updates delivered to your inbox.',
          buttonText: 'Subscribe Now',
          delay: 5000, // 5 seconds
          frequency: 'once_per_session',
          position: 'center',
          backgroundColor: '#667eea',
          textColor: '#ffffff',
          buttonColor: '#4f46e5',
          buttonTextColor: '#ffffff'
        }
      });
      await settings.save();
      console.log(`✅ Created default blog popup settings for: ${shopDomain}`);
    } else if (!settings.blogPopupSettings) {
      // Add blog popup settings to existing settings
      settings.blogPopupSettings = {
        enabled: true,
        title: 'Stay Updated with Our Blog',
        subtitle: 'Get the latest insights, tips, and updates delivered to your inbox.',
        buttonText: 'Subscribe Now',
        delay: 5000,
        frequency: 'once_per_session',
        position: 'center',
        backgroundColor: '#667eea',
        textColor: '#ffffff',
        buttonColor: '#4f46e5',
        buttonTextColor: '#ffffff'
      };
      await settings.save();
      console.log(`✅ Added blog popup settings to existing settings for: ${shopDomain}`);
    }
    
    console.log(`✅ Blog popup settings loaded for: ${shopDomain}`, {
      enabled: settings.blogPopupSettings?.enabled,
      title: settings.blogPopupSettings?.title
    });
    
    res.json({
      success: true,
      shopDomain,
      blogPopupSettings: settings.blogPopupSettings
    });
  } catch (error) {
    console.error('❌ Error fetching blog popup settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update blog popup settings
app.post('/api/blog-popup/:shopDomain', async (req, res) => {
  try {
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, ngrok-skip-browser-warning, Accept, Cache-Control, Pragma, Expires, X-Requested-With',
      'Access-Control-Allow-Credentials': 'true',
      'ETag': `"${Date.now()}-${Math.random()}"`,
      'Last-Modified': new Date().toUTCString(),
      'Vary': 'Accept-Encoding'
    });
    
    const { shopDomain } = req.params;
    const blogPopupSettings = req.body;
    
    console.log(`🔄 Updating blog popup settings for: ${shopDomain}`, blogPopupSettings);
    
    let settings = await PopupSettings.findOne({ shopDomain });
    
    if (!settings) {
      settings = new PopupSettings({
        shopDomain,
        festivals: [],
        isActive: false,
        blogPopupSettings
      });
    } else {
      settings.blogPopupSettings = {
        ...settings.blogPopupSettings,
        ...blogPopupSettings
      };
    }
    
    await settings.save();
    
    console.log(`✅ Blog popup settings updated for: ${shopDomain}`);
    
    res.json({
      success: true,
      message: 'Blog popup settings updated successfully',
      blogPopupSettings: settings.blogPopupSettings
    });
  } catch (error) {
    console.error('❌ Error updating blog popup settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== END BLOG NEWSLETTER POPUP SYSTEM ===================="

// Blog-specific image generation for newsletter popup
app.post('/api/generate-blog-image', async (req, res) => {
  try {
    const { blogTitle, blogContent } = req.body;
    
    if (!blogTitle && !blogContent) {
      return res.status(400).json({ error: 'Blog title or content is required' });
    }
    
    // Create a prompt from the blog content
    let prompt = '';
    
    if (blogTitle && blogContent) {
      // Use both title and content for a more accurate image
      prompt = `${blogTitle} ${blogContent.substring(0, 100)}`;
    } else if (blogTitle) {
      prompt = blogTitle;
    } else {
      prompt = blogContent.substring(0, 150);
    }
    
    console.log('🎨 Generating blog image for prompt:', prompt);
    
    // Enhanced prompt for better image quality
    const enhancedPrompt = `high quality digital art of ${prompt}, professional photography style, detailed, modern`;
    console.log('🎨 Enhanced prompt:', enhancedPrompt);
    
    // Using Pollinations.ai API for image generation
    const seed = Math.floor(Math.random() * 1000000); // Random seed for variety
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?width=417&height=484&seed=${seed}&model=flux&enhance=true&nologo=true`;
    
    console.log('🎨 Generating image with Pollinations AI:', imageUrl);
    
    try {
      // Test the image URL by making a HEAD request with longer timeout
      const imageResponse = await axios.head(imageUrl, {
        timeout: 10000, // 10 second timeout
        validateStatus: (status) => status < 400
      });
      
      console.log('✅ Pollinations AI image generated successfully');
      
      res.json({
        success: true,
        imageUrl: imageUrl,
        prompt: enhancedPrompt,
        message: 'Generated using Pollinations AI',
        generatedAt: new Date().toISOString()
      });
      
    } catch (imageError) {
      console.log('⚠️ Pollinations AI timeout, using fallback with retry logic');
      
      // Static fallback images that are guaranteed to work
      const staticImages = [
        'https://placehold.co/417x484/667eea/ffffff?text=Blog',
        'https://placehold.co/417x484/4f46e5/ffffff?text=Newsletter',
        'https://placehold.co/417x484/3b82f6/ffffff?text=Subscribe'
      ];
      
      const fallbackImage = staticImages[Math.floor(Math.random() * staticImages.length)];
      
      // Return Pollinations URL anyway - it likely works even if HEAD request times out
      res.json({
        success: true,
        imageUrl: imageUrl, // Use Pollinations URL, not fallback
        fallbackUrl: fallbackImage,
        prompt: enhancedPrompt,
        message: 'Using Pollinations AI (may load async)',
        generatedAt: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('❌ Error generating blog image:', error);
    
    // Return a guaranteed fallback even in case of errors
    res.json({
      success: true,
      imageUrl: 'https://placehold.co/417x484/667eea/ffffff?text=Blog+Background',
      fallback: true,
      message: 'Using default fallback image due to errors',
      generatedAt: new Date().toISOString()
    });
  }
}); 

// Migration function to fix existing subscribers without subscriptionType
async function migrateExistingSubscribers() {
  try {
    console.log('🔄 Checking for subscribers without subscriptionType...');
    
    // Find subscribers without subscriptionType
    const subscribersWithoutType = await NewsletterSubscriber.find({
      subscriptionType: { $exists: false }
    });
    
    if (subscribersWithoutType.length === 0) {
      console.log('✅ All subscribers already have subscriptionType');
      return;
    }
    
    console.log(`🔧 Found ${subscribersWithoutType.length} subscribers without subscriptionType, migrating...`);
    
    for (const subscriber of subscribersWithoutType) {
      // Default to 'festival' type for existing subscribers
      // since they were likely subscribing to the original festival popup
      subscriber.subscriptionType = 'festival';
      
      // Ensure preferences are properly set
      if (!subscriber.preferences) {
        subscriber.preferences = {
          festivals: true,
          offers: true,
          blogUpdates: false
        };
      }
      
      await subscriber.save();
      console.log(`✅ Migrated subscriber: ${subscriber.email} → festival type`);
    }
    
    console.log(`🎉 Migration complete! Updated ${subscribersWithoutType.length} subscribers`);
  } catch (error) {
    console.error('❌ Migration error:', error);
  }
}

// Debug endpoint to test regional festivals for any state
app.get('/api/debug/regional-test/:state/:festivalName', (req, res) => {
  try {
    const { state, festivalName } = req.params;
    
    console.log(`🧪 Testing regional festival: "${festivalName}" for state: "${state}"`);
    
    const mockFestival = {
      name: festivalName,
      offer: '63% OFF',
      discountCode: 'TEST123',
      backgroundColor: '#667eea',
      textColor: '#ffffff',
      startDate: new Date(),
      endDate: new Date()
    };
    
    const regionalData = getRegionalFestivalData(mockFestival, state);
    
    res.json({
      success: true,
      originalFestival: mockFestival.name,
      state: state,
      regionalResult: regionalData,
      message: regionalData.isCustomized 
        ? `✅ Regional customization applied: "${mockFestival.name}" → "${regionalData.name}" for ${state}`
        : `⚠️ No regional customization for "${mockFestival.name}" in ${state}`
    });
    
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Helper: ensure festival names never contain the literal word "Special"
function sanitizeFestivalName(name) {
  if (!name) return name;
  // Remove the standalone word "Special" (case-insensitive) and trim extra spaces
  return name.replace(/\bSpecial\b/gi, '').replace(/\s{2,}/g, ' ').trim();
}

// Helper function to generate deterministic seed based on festival and region
function generateDeterministicSeed(festivalName, region) {
  // Create a deterministic hash from festival name + region
  let hash = 0;
  const input = `${festivalName.toLowerCase()}-${region.toLowerCase()}`;
  
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Ensure positive number and reasonable range (1-999999)
  return Math.abs(hash) % 999999 + 1;
}

// Function to determine contrasting text color with enhanced logic
function getContrastingColor(backgroundColor) {
  // Remove # if present
  const hex = backgroundColor.replace('#', '');
  
  // Convert to RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // Calculate luminance using more precise formula
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Enhanced contrast logic - use stricter threshold for better readability
  if (luminance < 0.6) {
    // For darker backgrounds, use pure white
    return '#ffffff';
  } else {
    // For lighter backgrounds, use pure black
    return '#000000';
  }
}

// Function to ensure optimal text color for background images
function getOptimalTextColor(imageColors, backgroundImageUrl) {
  if (!imageColors || !imageColors.primary) {
    console.log('⚠️ No image colors available, using default white text');
    return '#ffffff';
  }
  
  // Get contrasting color based on the dominant/primary color
  const textColor = getContrastingColor(imageColors.primary);
  
  // Additional check: if we have a palette, test against multiple colors
  if (imageColors.palette && imageColors.palette.length > 0) {
    let bestTextColor = textColor;
    let bestContrast = 0;
    
    // Test both white and black against all palette colors
    const testColors = ['#ffffff', '#000000'];
    
    for (const testColor of testColors) {
      let totalContrast = 0;
      let validContrasts = 0;
      
      for (const paletteColor of imageColors.palette) {
        if (hasGoodContrast(testColor, paletteColor)) {
          totalContrast += getContrastRatio(testColor, paletteColor);
          validContrasts++;
        }
      }
      
      const averageContrast = validContrasts > 0 ? totalContrast / validContrasts : 0;
      if (averageContrast > bestContrast) {
        bestContrast = averageContrast;
        bestTextColor = testColor;
      }
    }
    
    console.log(`✅ Optimal text color selected: ${bestTextColor} (contrast ratio: ${bestContrast.toFixed(2)})`);
    return bestTextColor;
  }
  
  console.log(`✅ Using contrasting text color: ${textColor} for background: ${imageColors.primary}`);
  return textColor;
}

// Function to get numerical contrast ratio
function getContrastRatio(textColor, backgroundColor) {
  const getLuminance = (hex) => {
    const rgb = parseInt(hex.replace('#', ''), 16);
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >> 8) & 0xff;
    const b = (rgb >> 0) & 0xff;
    
    const sRGB = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    
    return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
  };
  
  const textLum = getLuminance(textColor);
  const bgLum = getLuminance(backgroundColor);
  
  return (Math.max(textLum, bgLum) + 0.05) / (Math.min(textLum, bgLum) + 0.05);
}

// Function to check if color has good contrast
function hasGoodContrast(textColor, backgroundColor) {
  const ratio = getContrastRatio(textColor, backgroundColor);
  return ratio >= 4.5; // WCAG AA compliance
}