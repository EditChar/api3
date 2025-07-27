const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({
  accessKeyId: 'AKIAU5ZNYPFAACUFZNW7',
  secretAccessKey: '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',
  region: 'eu-north-1'
});

const s3 = new AWS.S3();
const BUCKET_NAME = 'easy-to-image-production';

// Test keys from database
const TEST_KEYS = [
  'chat-media/137c4b3a-d565-4bc2-b5d4-ea71945acbcc/dff80bdc-1f48-4fee-9e4a-d9f9b90c06ba/medium_encrypted.jpg',
  'chat-media/137c4b3a-d565-4bc2-b5d4-ea71945acbcc/dff80bdc-1f48-4fee-9e4a-d9f9b90c06ba/original_encrypted.jpg',
  'chat-media/137c4b3a-d565-4bc2-b5d4-ea71945acbcc/dff80bdc-1f48-4fee-9e4a-d9f9b90c06ba/thumbnail_encrypted.jpg'
];

async function testS3Delete() {
  console.log('🧪 Testing S3 Delete Operations...');
  
  for (const key of TEST_KEYS) {
    try {
      console.log(`\n🗑️ Testing delete: ${key.substring(0, 60)}...`);
      
      await s3.deleteObject({
        Bucket: BUCKET_NAME,
        Key: key
      }).promise();
      
      console.log('✅ Delete successful');
      
    } catch (error) {
      console.error('❌ Delete failed:', {
        key: key.substring(0, 60) + '...',
        message: error.message,
        code: error.code,
        statusCode: error.statusCode
      });
    }
  }
}

testS3Delete(); 