const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  password: '123',
  host: 'localhost',
  port: 5432,
  database: 'localdb'
});

const MEDIA_ID = 'dff80bdc-1f48-4fee-9e4a-d9f9b90c06ba';
const USER_ID = 54;

async function checkMediaOwnership() {
  try {
    console.log('🔍 Checking media ownership...');
    console.log('   MediaId:', MEDIA_ID);
    console.log('   Expected UserId:', USER_ID);
    
    // Check media details
    const result = await pool.query(`
      SELECT 
        media_id,
        user_id,
        chat_room_id,
        status,
        created_at,
        urls
      FROM chat_media 
      WHERE media_id = $1
    `, [MEDIA_ID]);
    
    if (result.rows.length === 0) {
      console.log('❌ Media not found in database');
      return;
    }
    
    const media = result.rows[0];
    console.log('\n📋 Media Details:');
    console.log('   MediaId:', media.media_id);
    console.log('   UserId:', media.user_id, media.user_id === USER_ID ? '✅' : '❌');
    console.log('   ChatRoomId:', media.chat_room_id);
    console.log('   Status:', media.status);
    console.log('   CreatedAt:', media.created_at);
    console.log('   URLs type:', typeof media.urls);
    console.log('   URLs value:', media.urls);
    
    // Check if status is not deleted
    if (media.status === 'deleted') {
      console.log('❌ Media is already marked as deleted');
    }
    
    // Check ownership match
    if (media.user_id !== USER_ID) {
      console.log(`❌ Ownership mismatch: Expected ${USER_ID}, got ${media.user_id}`);
      
      // Find who actually owns this media
      const userResult = await pool.query(`
        SELECT id, username, email FROM users WHERE id = $1
      `, [media.user_id]);
      
      if (userResult.rows.length > 0) {
        const owner = userResult.rows[0];
        console.log('   Actual owner:', owner.username, `(id: ${owner.id})`);
      }
    } else {
      console.log('✅ Ownership matches');
    }
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
  } finally {
    await pool.end();
  }
}

checkMediaOwnership(); 