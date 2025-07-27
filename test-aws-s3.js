const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({
  accessKeyId: 'AKIAU5ZNYPFAACUFZNW7',
  secretAccessKey: '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',
  region: 'eu-north-1'
});

const s3 = new AWS.S3();
const BUCKET_NAME = 'easy-to-image-production';

async function testS3Access() {
  console.log('🧪 Testing S3 Access...');
  
  try {
    // Test 1: List bucket
    console.log('1️⃣ Testing bucket access...');
    const listResult = await s3.listObjectsV2({
      Bucket: BUCKET_NAME,
      MaxKeys: 5
    }).promise();
    console.log('✅ Bucket access successful, objects found:', listResult.Contents?.length || 0);
    
    // Test 2: Head bucket
    console.log('2️⃣ Testing head bucket...');
    await s3.headBucket({ Bucket: BUCKET_NAME }).promise();
    console.log('✅ Head bucket successful');
    
    // Test 3: Try to head an object (if any exists)
    if (listResult.Contents && listResult.Contents.length > 0) {
      const testKey = listResult.Contents[0].Key;
      console.log('3️⃣ Testing head object:', testKey);
      
      const headResult = await s3.headObject({
        Bucket: BUCKET_NAME,
        Key: testKey
      }).promise();
      
      console.log('✅ Head object successful:', {
        size: headResult.ContentLength,
        etag: headResult.ETag,
        contentType: headResult.ContentType
      });
    }
    
  } catch (error) {
    console.error('❌ S3 Access Error:', {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      region: error.region
    });
  }
}

testS3Access(); 