const axios = require('axios');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  user: 'postgres',
  password: '123',
  host: 'localhost',
  port: 5432,
  database: 'localdb'
});

// Test configuration
const BASE_URL = 'http://localhost:3001';
const JWT_SECRET = 'your_super_secret_jwt_key_change_this_in_production';
const testUser = { userId: 54, email: "test@example.com", username: "testuser", id: 54 };
const TOKEN = jwt.sign(testUser, JWT_SECRET, { expiresIn: '24h' });

async function testWithExistingMedia() {
  try {
    console.log('🔍 Finding existing completed media...');
    
    // Find a completed media from database
    const result = await pool.query(`
      SELECT 
        media_id,
        user_id,
        chat_room_id,
        content_type,
        file_size,
        created_at,
        status
      FROM chat_media 
      WHERE status = 'completed' 
        AND user_id = $1
        AND created_at > NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC 
      LIMIT 1
    `, [testUser.userId]);

    if (result.rows.length === 0) {
      console.log('❌ No completed media found for user in last 24h');
      console.log('   Need to upload and complete a media first');
      return;
    }

    const existingMedia = result.rows[0];
    console.log('✅ Found existing media:', {
      mediaId: existingMedia.media_id,
      contentType: existingMedia.content_type,
      fileSize: existingMedia.file_size,
      status: existingMedia.status,
      createdAt: existingMedia.created_at
    });

    // Test duplicate detection with same parameters
    console.log('\n🧪 Testing duplicate detection...');
    const duplicateTest = {
      chatRoomId: 'test-room-54', // Room for user 54
      contentType: existingMedia.content_type,
      fileSize: parseInt(existingMedia.file_size), // Convert to number
      originalFilename: 'duplicate-test.jpg'
    };

    const response = await axios.post(`${BASE_URL}/api/media/presign`, duplicateTest, {
      headers: { 
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Duplicate test response:', {
      success: response.data.success,
      mediaId: response.data.mediaId,
      method: response.data.method,
      isDuplicate: response.data.isDuplicate,
      originalMediaId: response.data.originalMediaId,
      hasUploadUrl: !!response.data.uploadUrl
    });

    if (response.data.isDuplicate) {
      console.log('\n🎉 DUPLICATE DETECTION WORKING!');
      console.log('   ✅ Saved bandwidth:', existingMedia.file_size, 'bytes');
      console.log('   ✅ Saved processing: resize + encrypt operations');
      console.log('   ✅ Method:', response.data.method);
      console.log('   ✅ Reused from:', response.data.originalMediaId);
    } else {
      console.log('\n❌ Duplicate detection failed');
      console.log('   This would cause unnecessary uploads');
    }

  } catch (error) {
    console.error('❌ Test failed:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
  } finally {
    await pool.end();
  }
}

testWithExistingMedia(); 