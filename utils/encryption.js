const crypto = require('crypto');

// Use the encryption key from environment variables
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-this-in-production-32bytes';
const ALGORITHM = 'aes-256-gcm';

// Ensure the key is exactly 32 bytes for AES-256
const KEY = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);

/**
 * Encrypt sensitive data (like email passwords)
 * @param {string} text - The text to encrypt
 * @returns {string} - Encrypted data as a string
 */
function encrypt(text) {
    if (!text) return '';
    
    try {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
        
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = cipher.getAuthTag();
        
        // Combine iv, authTag, and encrypted data
        return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    } catch (error) {
        console.error('Encryption error:', error);
        throw new Error('Failed to encrypt data');
    }
}

/**
 * Decrypt sensitive data
 * @param {string} encryptedData - The encrypted data string
 * @returns {string} - Decrypted text
 */
function decrypt(encryptedData) {
    if (!encryptedData) return '';
    
    try {
        const parts = encryptedData.split(':');
        if (parts.length !== 3) {
            throw new Error('Invalid encrypted data format');
        }
        
        const iv = Buffer.from(parts[0], 'hex');
        const authTag = Buffer.from(parts[1], 'hex');
        const encrypted = parts[2];
        
        const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (error) {
        console.error('Decryption error:', error);
        throw new Error('Failed to decrypt data');
    }
}

/**
 * Test encryption/decryption functionality
 */
function testEncryption() {
    const testData = 'test-password-123';
    const encrypted = encrypt(testData);
    const decrypted = decrypt(encrypted);
    
    console.log('Encryption test:', {
        original: testData,
        encrypted: encrypted,
        decrypted: decrypted,
        success: testData === decrypted
    });
    
    return testData === decrypted;
}

module.exports = {
    encrypt,
    decrypt,
    testEncryption
}; 