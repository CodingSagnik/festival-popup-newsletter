const axios = require('axios');

async function setupTestEmailSettings() {
  try {
    console.log('🔧 Setting up test email configuration...');
    
    const shopDomain = 'test-festival-popup.myshopify.com';
    const testEmailConfig = {
      enabled: true,
      provider: 'sendgrid', // This will use HTTP API
      fromEmail: 'raysagnik04@gmail.com', // Your merchant email
      fromName: 'Festival Popup Store',
      smtpHost: '', // Not needed for HTTP API
      smtpPort: 587,
      secure: true,
      password: '' // Not needed for HTTP API
    };
    
    console.log('📧 Configuring email settings:');
    console.log('- Shop:', shopDomain);
    console.log('- From Email:', testEmailConfig.fromEmail);
    console.log('- Provider:', testEmailConfig.provider);
    
    const response = await axios.post(
      `https://festival-popup-newsletter.onrender.com/api/shop-settings/${shopDomain}/email`,
      testEmailConfig,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (response.data.success) {
      console.log('✅ Email settings configured successfully!');
      console.log('Response:', response.data);
      
      // Now test sending an email
      console.log('\n📧 Testing email sending...');
      const testResponse = await axios.post(
        `https://festival-popup-newsletter.onrender.com/api/shop-settings/${shopDomain}/email/test`,
        {
          testEmail: 'sagnik.23bce8427@vitapstudent.ac.in'
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (testResponse.data.success) {
        console.log('🎉 Test email sent successfully!');
        console.log('📧 Service Used:', testResponse.data.service);
        console.log('🔧 Provider:', testResponse.data.provider);
        
        if (testResponse.data.service === 'sendgrid') {
          console.log('✅ SUCCESS: SendGrid preserved merchant email!');
          console.log('📧 From Email:', testResponse.data.fromEmail);
        } else if (testResponse.data.service === 'resend') {
          console.log('⚠️ FALLBACK: Resend used (merchant email in reply-to)');
        }
        
        console.log('Full Response:', JSON.stringify(testResponse.data, null, 2));
      } else {
        console.log('❌ Test email failed:', testResponse.data);
      }
      
    } else {
      console.log('❌ Email configuration failed:', response.data);
    }
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', error.response.data);
    }
  }
}

setupTestEmailSettings();