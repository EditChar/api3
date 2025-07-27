const crypto = require('crypto');

/**
 * Generate a secure 32-byte encryption key for media encryption
 */
function generateMediaEncryptionKey() {
  // Generate 32 random bytes (256 bits)
  const key = crypto.randomBytes(32);
  
  // Convert to hex string (64 characters)
  const hexKey = key.toString('hex');
  
  console.log('🔐 Generated Media Encryption Key:');
  console.log('');
  console.log('MEDIA_ENCRYPTION_KEY=' + hexKey);
  console.log('');
  console.log('📝 Add this to your .env file');
  console.log('⚠️  KEEP THIS KEY SECURE - Never commit to git!');
  console.log('');
  console.log('Key details:');
  console.log('- Length: 32 bytes (256 bits)');
  console.log('- Format: Hexadecimal');
  console.log('- Use: AES-256-GCM encryption');
  
  return hexKey;
}

// Run if executed directly
if (require.main === module) {
  generateMediaEncryptionKey();
}

module.exports = { generateMediaEncryptionKey }; 