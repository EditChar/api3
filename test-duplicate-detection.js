const axios = require('axios');
const jwt = require('jsonwebtoken');

// Test configuration
const BASE_URL = 'http://localhost:3001';
const JWT_SECRET = 'your_super_secret_jwt_key_change_this_in_production';
const testUser = { userId: 28, email: "test@example.com", username: "testuser", id: 28 };
const TOKEN = jwt.sign(testUser, JWT_SECRET, { expiresIn: '24h' });

// Same file parameters for duplicate test
const TEST_FILE = {
  chatRoomId: 'test-room-1',
  contentType: 'image/png',
  fileSize: 1024, // 1KB
  originalFilename: 'test-duplicate.png'
};

async function testDuplicateDetection() {
  console.log('🧪 Testing Duplicate Detection System...\n');

  try {
    // First upload attempt
    console.log('1️⃣ First upload attempt...');
    const firstResponse = await axios.post(`${BASE_URL}/api/media/presign`, TEST_FILE, {
      headers: { 
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ First upload response:', {
      success: firstResponse.data.success,
      mediaId: firstResponse.data.mediaId,
      method: firstResponse.data.method,
      isDuplicate: firstResponse.data.isDuplicate,
      hasUploadUrl: !!firstResponse.data.uploadUrl
    });

    if (!firstResponse.data.success) {
      console.error('❌ First upload failed:', firstResponse.data.error);
      return;
    }

    // Wait a moment
    console.log('\n⏳ Waiting 2 seconds...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Second upload attempt (should detect duplicate)
    console.log('\n2️⃣ Second upload attempt (same file)...');
    const secondResponse = await axios.post(`${BASE_URL}/api/media/presign`, TEST_FILE, {
      headers: { 
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Second upload response:', {
      success: secondResponse.data.success,
      mediaId: secondResponse.data.mediaId,
      method: secondResponse.data.method,
      isDuplicate: secondResponse.data.isDuplicate,
      originalMediaId: secondResponse.data.originalMediaId,
      hasUploadUrl: !!secondResponse.data.uploadUrl
    });

    // Analysis
    console.log('\n📊 Duplicate Detection Analysis:');
    
    if (secondResponse.data.isDuplicate) {
      console.log('✅ DUPLICATE DETECTED! System working correctly:');
      console.log('   - No S3 upload needed');
      console.log('   - No processing required');
      console.log('   - Bandwidth saved:', TEST_FILE.fileSize, 'bytes');
      console.log('   - Method:', secondResponse.data.method);
      console.log('   - Original media:', secondResponse.data.originalMediaId);
      console.log('   - New media ID:', secondResponse.data.mediaId);
    } else {
      console.log('❌ DUPLICATE NOT DETECTED - System needs improvement');
      console.log('   - This would cause unnecessary S3 uploads');
      console.log('   - Processing overhead would occur');
    }

    // Third attempt with different file size (should NOT be duplicate)
    console.log('\n3️⃣ Third upload attempt (different file size)...');
    const differentFile = { ...TEST_FILE, fileSize: 2048 };
    const thirdResponse = await axios.post(`${BASE_URL}/api/media/presign`, differentFile, {
      headers: { 
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Third upload response (different file):', {
      success: thirdResponse.data.success,
      mediaId: thirdResponse.data.mediaId,
      method: thirdResponse.data.method,
      isDuplicate: thirdResponse.data.isDuplicate,
      hasUploadUrl: !!thirdResponse.data.uploadUrl
    });

    if (!thirdResponse.data.isDuplicate) {
      console.log('✅ Different file correctly NOT detected as duplicate');
    } else {
      console.log('❌ Different file incorrectly detected as duplicate');
    }

  } catch (error) {
    console.error('❌ Test failed:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
  }
}

testDuplicateDetection(); 