const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  password: '123',
  host: 'localhost',
  port: 5432,
  database: 'localdb'
});

async function checkUserTestResponses() {
  try {
    console.log('🔍 Checking user_test_responses table structure...\n');
    
    // Check table structure
    const tableStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'user_test_responses' 
      ORDER BY ordinal_position
    `);
    
    console.log('📊 user_test_responses table structure:');
    tableStructure.rows.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    // Check user 28's responses
    const userResponses = await pool.query(`
      SELECT 
        utr.*,
        t.title,
        t.is_visible
      FROM user_test_responses utr
      JOIN tests t ON utr.test_id = t.id
      WHERE utr.user_id = 28
      ORDER BY utr.id DESC
    `);
    
    console.log(`\n👤 User 28 test responses (${userResponses.rows.length} total):`);
    userResponses.rows.forEach(response => {
      const visibility = response.is_visible ? '👁️ Visible' : '🙈 Hidden';
      console.log(`   ${visibility} - "${response.title}" (Score: ${response.test_score})`);
    });
    
    const visibleCount = userResponses.rows.filter(r => r.is_visible).length;
    const hiddenCount = userResponses.rows.filter(r => !r.is_visible).length;
    
    console.log(`\n📊 Summary for User 28:`);
    console.log(`   Visible tests completed: ${visibleCount}`);
    console.log(`   Hidden tests completed: ${hiddenCount}`);
    console.log(`   Total tests completed: ${userResponses.rows.length}`);
    
    // Check user_scores table
    const userScores = await pool.query(`
      SELECT * FROM user_scores WHERE user_id = 28
    `);
    
    if (userScores.rows.length > 0) {
      const scores = userScores.rows[0];
      console.log(`\n📈 User 28 in user_scores table:`);
      console.log(`   Total score: ${scores.total_score}`);
      console.log(`   Completed tests count: ${scores.completed_tests_count}`);
      console.log(`   Last updated: ${scores.last_updated}`);
    } else {
      console.log(`\n❌ User 28 not found in user_scores table`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkUserTestResponses(); 