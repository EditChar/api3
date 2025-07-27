const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  password: '123',
  host: 'localhost',
  port: 5432,
  database: 'localdb'
});

const MEDIA_ID = 'dff80bdc-1f48-4fee-9e4a-d9f9b90c06ba';

async function checkMediaS3Key() {
  try {
    console.log('🔍 Checking media s3_key field...');
    
    const result = await pool.query(`
      SELECT 
        media_id,
        s3_key,
        urls,
        status,
        CASE 
          WHEN s3_key IS NULL THEN 'NULL'
          WHEN s3_key = '' THEN 'EMPTY'
          ELSE 'HAS_VALUE'
        END as s3_key_status
      FROM chat_media 
      WHERE media_id = $1
    `, [MEDIA_ID]);
    
    if (result.rows.length === 0) {
      console.log('❌ Media not found');
      return;
    }
    
    const media = result.rows[0];
    console.log('\n📋 S3 Key Analysis:');
    console.log('   MediaId:', media.media_id);
    console.log('   S3 Key:', media.s3_key);
    console.log('   S3 Key Status:', media.s3_key_status);
    console.log('   Status:', media.status);
    
    if (media.s3_key_status === 'NULL') {
      console.log('❌ S3 key is NULL - this will cause delete to fail');
    } else if (media.s3_key_status === 'EMPTY') {
      console.log('❌ S3 key is empty - this will cause delete to fail');
    } else {
      console.log('✅ S3 key has value');
    }
    
    // Parse URLs to see encrypted versions
    let urls = {};
    try {
      if (typeof media.urls === 'string') {
        urls = JSON.parse(media.urls);
      } else {
        urls = media.urls;
      }
      
      console.log('\n🔗 Encrypted URLs:');
      Object.entries(urls).forEach(([size, key]) => {
        console.log(`   ${size}: ${key}`);
      });
      
    } catch (e) {
      console.log('❌ Failed to parse URLs:', e.message);
    }
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
  } finally {
    await pool.end();
  }
}

checkMediaS3Key(); 