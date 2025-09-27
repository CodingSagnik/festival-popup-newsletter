const mongoose = require('mongoose');
const { encrypt, decrypt } = require('../utils/encryption');

const shopSettingsSchema = new mongoose.Schema({
    shop: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    emailSettings: {
        enabled: {
            type: Boolean,
            default: false
        },
        provider: {
            type: String,
            enum: ['gmail', 'outlook', 'yahoo', 'custom'],
            default: 'gmail'
        },
        fromEmail: {
            type: String,
            required: function() { return this.emailSettings.enabled; }
        },
        fromName: {
            type: String,
            required: function() { return this.emailSettings.enabled; }
        },
        smtpHost: {
            type: String,
            required: function() { return this.emailSettings.provider === 'custom'; }
        },
        smtpPort: {
            type: Number,
            required: function() { return this.emailSettings.provider === 'custom'; }
        },
        secure: {
            type: Boolean,
            default: true
        },
        // Encrypted email password/app password
        encryptedPassword: {
            type: String,
            required: function() { return this.emailSettings.enabled; }
        }
    },
    festivalSettings: {
        autoGenerate: {
            type: Boolean,
            default: true
        },
        emailTemplate: {
            subject: {
                type: String,
                default: '🎉 Special Festival Offer from {{storeName}}!'
            },
            message: {
                type: String,
                default: 'Celebrate {{festivalName}} with exclusive deals!'
            }
        }
    },
    analytics: {
        emailsSent: {
            type: Number,
            default: 0
        }
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update the updatedAt field before saving
shopSettingsSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Helper method to get SMTP configuration for a provider
shopSettingsSchema.methods.getSmtpConfig = function() {
    const configs = {
        gmail: {
            host: 'smtp.gmail.com',
            port: 587,
            secure: false
        },
        outlook: {
            host: 'smtp-mail.outlook.com',
            port: 587,
            secure: false
        },
        yahoo: {
            host: 'smtp.mail.yahoo.com',
            port: 587,
            secure: false
        },
        custom: {
            host: this.emailSettings.smtpHost,
            port: this.emailSettings.smtpPort,
            secure: this.emailSettings.secure
        }
    };
    
    return configs[this.emailSettings.provider] || configs.gmail;
};

// Helper method to get decrypted email credentials
shopSettingsSchema.methods.getEmailCredentials = function() {
    if (!this.emailSettings.enabled || !this.emailSettings.encryptedPassword) {
        return null;
    }
    
    try {
        const decryptedPassword = decrypt(this.emailSettings.encryptedPassword);
        return {
            user: this.emailSettings.fromEmail,
            pass: decryptedPassword
        };
    } catch (error) {
        console.error('Failed to decrypt email credentials for shop:', this.shop);
        return null;
    }
};

// Static method to create or update shop email settings
shopSettingsSchema.statics.updateEmailSettings = async function(shop, emailData) {
    const { fromEmail, fromName, password, provider = 'gmail', smtpHost, smtpPort, secure = true } = emailData;
    
    if (!fromEmail || !fromName || !password) {
        throw new Error('Email, name, and password are required');
    }
    
    try {
        // Encrypt the password
        const encryptedPassword = encrypt(password);
        
        const updateData = {
            shop,
            emailSettings: {
                enabled: true,
                provider,
                fromEmail,
                fromName,
                encryptedPassword,
                secure
            }
        };
        
        // Add SMTP settings for custom provider
        if (provider === 'custom') {
            if (!smtpHost || !smtpPort) {
                throw new Error('SMTP host and port are required for custom provider');
            }
            updateData.emailSettings.smtpHost = smtpHost;
            updateData.emailSettings.smtpPort = smtpPort;
        }
        
        const result = await this.findOneAndUpdate(
            { shop },
            updateData,
            { upsert: true, new: true }
        );
        
        return result;
    } catch (error) {
        console.error('Failed to update email settings:', error);
        throw error;
    }
};

// Static method to get shop settings
shopSettingsSchema.statics.getShopSettings = async function(shop) {
    try {
        let settings = await this.findOne({ shop });
        
        if (!settings) {
            // Create default settings for new shop
            settings = new this({ shop });
            await settings.save();
        }
        
        return settings;
    } catch (error) {
        console.error('Failed to get shop settings:', error);
        throw error;
    }
};

module.exports = mongoose.model('ShopSettings', shopSettingsSchema); 