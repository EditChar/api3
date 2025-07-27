const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  password: '123',
  host: 'localhost',
  port: 5432,
  database: 'localdb'
});

const MEDIA_ID = 'dff80bdc-1f48-4fee-9e4a-d9f9b90c06ba';

async function checkMediaStatus() {
  try {
    console.log('🔍 Checking current media status...');
    
    const result = await pool.query(`
      SELECT 
        media_id,
        user_id,
        status,
        created_at,
        deleted_at,
        CASE 
          WHEN status = 'deleted' THEN '🗑️ DELETED'
          WHEN status = 'completed' THEN '✅ ACTIVE'
          WHEN status = 'uploading' THEN '⏳ UPLOADING'
          ELSE '❓ UNKNOWN'
        END as status_display
      FROM chat_media 
      WHERE media_id = $1
    `, [MEDIA_ID]);
    
    if (result.rows.length === 0) {
      console.log('❌ Media not found in database');
      return;
    }
    
    const media = result.rows[0];
    console.log('\n📋 Current Media Status:');
    console.log('   MediaId:', media.media_id);
    console.log('   UserId:', media.user_id);
    console.log('   Status:', media.status_display);
    console.log('   Created:', media.created_at);
    console.log('   Deleted:', media.deleted_at || 'Not deleted');
    
    if (media.status === 'deleted') {
      console.log('\n✅ Media was successfully deleted!');
      console.log('   This is why the second delete attempt failed.');
      console.log('   The delete function correctly prevents deleting already deleted media.');
    }
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
  } finally {
    await pool.end();
  }
}

checkMediaStatus(); 