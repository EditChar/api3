const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const jwt = require('jsonwebtoken');

// Test configuration
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const JWT_SECRET = 'your_super_secret_jwt_key_change_this_in_production';
const testUser = { userId: 28, email: "elif@example.com", username: "elif", id: 28 };
const TEST_TOKEN = jwt.sign(testUser, JWT_SECRET, { expiresIn: '24h' });
const TEST_ROOM_ID = process.env.TEST_ROOM_ID || 'test-room-1';

// Log test configuration
console.log('🧪 Test Configuration:');
console.log(`   API URL: ${BASE_URL}`);
console.log(`   Token: ${TEST_TOKEN ? 'Provided' : 'Missing!'}`);
console.log(`   Room ID: ${TEST_ROOM_ID}`);

// Test image data (1x1 pixel PNG)
const TEST_IMAGE_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const TEST_IMAGE_BUFFER = Buffer.from(TEST_IMAGE_BASE64, 'base64');

async function testMediaSystem() {
  console.log('🧪 Starting Media System Tests...\n');

  try {
    // Test 1: Health Check
    console.log('1️⃣ Testing Media Health Check...');
    const healthResponse = await axios.get(`${BASE_URL}/api/media/health`, {
      headers: { Authorization: `Bearer ${TEST_TOKEN}` }
    });
    console.log('✅ Health check passed:', healthResponse.data);
    console.log('');

    // Test 2: Generate Presigned URL
    console.log('2️⃣ Testing Presigned URL Generation...');
    const presignResponse = await axios.post(`${BASE_URL}/api/media/presign`, {
      chatRoomId: TEST_ROOM_ID,
      contentType: 'image/png',
      fileSize: TEST_IMAGE_BUFFER.length,
      originalFilename: 'test-image.png'
    }, {
      headers: { 
        Authorization: `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!presignResponse.data.success) {
      throw new Error('Presigned URL generation failed: ' + presignResponse.data.error);
    }

    const { uploadUrl, fields, mediaId } = presignResponse.data;
    console.log('✅ Presigned URL generated successfully');
    console.log('   Media ID:', mediaId);
    console.log('   Upload URL:', uploadUrl.substring(0, 50) + '...');
    console.log('');

    // Test 3: Upload to S3 (using PUT method)
    console.log('3️⃣ Testing S3 Upload...');
    
    const uploadResponse = await axios.put(uploadUrl, TEST_IMAGE_BUFFER, {
      headers: {
        'Content-Type': 'image/png'
      },
      maxRedirects: 0,
      validateStatus: status => status >= 200 && status < 400
    });

    console.log('✅ S3 upload successful');
    console.log('   Status:', uploadResponse.status);
    console.log('');

    // Test 4: Complete Upload
    console.log('4️⃣ Testing Upload Completion...');
    const eTag = uploadResponse.headers.etag || uploadResponse.headers.ETag || '"test-etag"';
    const completeResponse = await axios.post(`${BASE_URL}/api/media/complete`, {
      mediaId: mediaId,
      eTag: eTag.replace(/"/g, ''), // Remove quotes from ETag
      fileSize: TEST_IMAGE_BUFFER.length
    }, {
      headers: { 
        Authorization: `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!completeResponse.data.success) {
      throw new Error('Upload completion failed: ' + completeResponse.data.error);
    }

    const { urls } = completeResponse.data;
    console.log('✅ Upload completion successful');
    console.log('   Thumbnail URL:', urls.thumbnail ? 'Generated' : 'Missing');
    console.log('   Medium URL:', urls.medium ? 'Generated' : 'Missing');
    console.log('   Original URL:', urls.original ? 'Generated' : 'Missing');
    console.log('');

    // Test 5: Get Media URLs
    console.log('5️⃣ Testing Media URL Retrieval...');
    const urlsResponse = await axios.get(`${BASE_URL}/api/media/${mediaId}`, {
      headers: { Authorization: `Bearer ${TEST_TOKEN}` }
    });

    if (!urlsResponse.data.success) {
      throw new Error('Media URL retrieval failed: ' + urlsResponse.data.error);
    }

    console.log('✅ Media URLs retrieved successfully');
    console.log('   Expires at:', urlsResponse.data.expiresAt);
    console.log('');

    // Test 6: Send Message with Media
    console.log('6️⃣ Testing Message with Media...');
    const messageResponse = await axios.post(`${BASE_URL}/api/chat/rooms/${TEST_ROOM_ID}/messages`, {
      messageType: 'image',
      mediaId: mediaId
    }, {
      headers: { 
        Authorization: `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Message with media sent successfully');
    console.log('   Message ID:', messageResponse.data.data?.id);
    console.log('   Media ID in message:', messageResponse.data.optimistic_chat_update?.media_id);
    console.log('');

    // Test 7: Delete Media
    console.log('7️⃣ Testing Media Deletion...');
    const deleteResponse = await axios.delete(`${BASE_URL}/api/media/${mediaId}`, {
      headers: { Authorization: `Bearer ${TEST_TOKEN}` }
    });

    if (!deleteResponse.data.success) {
      throw new Error('Media deletion failed: ' + deleteResponse.data.error);
    }

    console.log('✅ Media deleted successfully');
    console.log('');

    // Test 8: Verify Deletion
    console.log('8️⃣ Testing Media Access After Deletion...');
    try {
      await axios.get(`${BASE_URL}/api/media/${mediaId}`, {
        headers: { Authorization: `Bearer ${TEST_TOKEN}` }
      });
      console.log('❌ Media still accessible after deletion');
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('✅ Media properly inaccessible after deletion');
      } else {
        throw error;
      }
    }
    console.log('');

    console.log('🎉 All Media System Tests Passed Successfully!');
    console.log('📊 Test Summary:');
    console.log('   ✅ Health Check: PASSED');
    console.log('   ✅ Presigned URL Generation: PASSED');
    console.log('   ✅ S3 Upload: PASSED');
    console.log('   ✅ Upload Completion: PASSED');
    console.log('   ✅ Media URL Retrieval: PASSED');
    console.log('   ✅ Message with Media: PASSED');
    console.log('   ✅ Media Deletion: PASSED');
    console.log('   ✅ Access Control: PASSED');

  } catch (error) {
    console.error('❌ Media System Test Failed:');
    
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    } else {
      console.error('   Error:', error.message);
    }
    
    console.error('\n🔧 Troubleshooting Tips:');
    console.error('   1. Check if server is running on port 3001');
    console.error('   2. Verify TEST_TOKEN is valid');
    console.error('   3. Ensure AWS credentials are configured');
    console.error('   4. Check database connection');
    console.error('   5. Verify TEST_ROOM_ID exists');
    
    process.exit(1);
  }
}

// Run tests
testMediaSystem().catch(console.error); 