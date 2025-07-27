const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({
  accessKeyId: 'AKIAU5ZNYPFAACUFZNW7',
  secretAccessKey: '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',
  region: 'eu-north-1'
});

const s3 = new AWS.S3();
const BUCKET_NAME = 'easy-to-image-production';

async function testSpecificOperations() {
  console.log('🧪 Testing Specific S3 Operations...');
  
  // Test 1: HeadBucket (bucket-level)
  try {
    console.log('1️⃣ Testing HeadBucket...');
    await s3.headBucket({ Bucket: BUCKET_NAME }).promise();
    console.log('✅ HeadBucket successful');
  } catch (error) {
    console.error('❌ HeadBucket failed:', error.message);
  }

  // Test 2: ListBucket (bucket-level) 
  try {
    console.log('2️⃣ Testing ListBucket...');
    const result = await s3.listObjectsV2({
      Bucket: BUCKET_NAME,
      Prefix: 'chat-media/',
      MaxKeys: 1
    }).promise();
    console.log('✅ ListBucket successful, found:', result.Contents?.length || 0, 'objects');
  } catch (error) {
    console.error('❌ ListBucket failed:', error.message);
  }

  // Test 3: PutObject (object-level)
  try {
    console.log('3️⃣ Testing PutObject...');
    const testKey = 'chat-media/test-folder/test-object.txt';
    await s3.putObject({
      Bucket: BUCKET_NAME,
      Key: testKey,
      Body: 'test content',
      ContentType: 'text/plain'
    }).promise();
    console.log('✅ PutObject successful');
    
    // Test 4: HeadObject (object-level)
    console.log('4️⃣ Testing HeadObject...');
    const headResult = await s3.headObject({
      Bucket: BUCKET_NAME,
      Key: testKey
    }).promise();
    console.log('✅ HeadObject successful:', {
      size: headResult.ContentLength,
      etag: headResult.ETag
    });

    // Test 5: GetObject (object-level)
    console.log('5️⃣ Testing GetObject...');
    const getResult = await s3.getObject({
      Bucket: BUCKET_NAME,
      Key: testKey
    }).promise();
    console.log('✅ GetObject successful, size:', getResult.Body?.length);

    // Cleanup
    console.log('🧹 Cleaning up test object...');
    await s3.deleteObject({
      Bucket: BUCKET_NAME,
      Key: testKey
    }).promise();
    console.log('✅ Cleanup successful');

  } catch (error) {
    console.error('❌ Object operations failed:', {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode
    });
  }
}

testSpecificOperations(); 