const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  password: '123',
  host: 'localhost',
  port: 5432,
  database: 'localdb'
});

async function checkExpiredMedia() {
  try {
    console.log('🕐 Checking media expiry status...\n');
    
    // All media count
    const totalResult = await pool.query('SELECT COUNT(*) FROM chat_media');
    console.log('📊 Total media count:', totalResult.rows[0].count);
    
    // Expired media count
    const expiredResult = await pool.query(`
      SELECT COUNT(*) FROM chat_media 
      WHERE expires_at < NOW() AND status != 'deleted'
    `);
    console.log('⏰ Expired media count:', expiredResult.rows[0].count);
    
    // Active media count
    const activeResult = await pool.query(`
      SELECT COUNT(*) FROM chat_media 
      WHERE expires_at > NOW() AND status = 'completed'
    `);
    console.log('✅ Active media count:', activeResult.rows[0].count);
    
    // Recent expired media details
    const recentExpired = await pool.query(`
      SELECT 
        media_id,
        user_id,
        created_at,
        expires_at,
        status,
        EXTRACT(DAYS FROM (NOW() - expires_at)) as days_expired
      FROM chat_media 
      WHERE expires_at < NOW() AND status != 'deleted'
      ORDER BY expires_at DESC 
      LIMIT 10
    `);
    
    if (recentExpired.rows.length > 0) {
      console.log('\n🔍 Recent expired media:');
      recentExpired.rows.forEach(media => {
        console.log(`   📷 ${media.media_id.substring(0, 8)}... - User ${media.user_id}`);
        console.log(`      Created: ${media.created_at.toISOString().split('T')[0]}`);
        console.log(`      Expired: ${media.expires_at.toISOString().split('T')[0]} (${Math.floor(media.days_expired)} days ago)`);
        console.log(`      Status: ${media.status}\n`);
      });
    }
    
    // Expiry settings
    console.log('⚙️ Current expiry settings:');
    console.log('   EXPIRY_DAYS: 30 days (hardcoded)');
    console.log('   Media created today will expire:', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
  } finally {
    await pool.end();
  }
}

checkExpiredMedia(); 