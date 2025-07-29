const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  password: '123',
  host: 'localhost',
  port: 5432,
  database: 'localdb'
});

async function recalculateUserScores() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Recalculating user scores (excluding hidden tests)...\n');
    
    await client.query('BEGIN');
    
    // Get all users who have completed tests
    const usersWithTests = await client.query(`
      SELECT DISTINCT utr.user_id
      FROM user_test_responses utr
      JOIN tests t ON utr.test_id = t.id
      WHERE t.deleted_at IS NULL
    `);
    
    console.log(`👥 Found ${usersWithTests.rows.length} users with test responses`);
    
    let updatedCount = 0;
    let removedHiddenTestPoints = 0;
    
    for (const userRow of usersWithTests.rows) {
      const userId = userRow.user_id;
      
      // Get current scores (all tests including hidden)
      const currentScores = await client.query(`
        SELECT 
          COALESCE(total_score, 0) as current_total_score,
          COALESCE(completed_tests_count, 0) as current_completed_tests
        FROM user_scores 
        WHERE user_id = $1
      `, [userId]);
      
      // Calculate new scores (only visible tests)
      const newScores = await client.query(`
        SELECT 
          COUNT(*) as completed_tests, 
          COALESCE(SUM(utr.test_score), 0) as total_score 
        FROM user_test_responses utr
        JOIN tests t ON utr.test_id = t.id
        WHERE utr.user_id = $1 AND t.deleted_at IS NULL AND t.is_visible = true
      `, [userId]);
      
      // Calculate scores from HIDDEN tests (to track what we're removing)
      const hiddenScores = await client.query(`
        SELECT 
          COUNT(*) as hidden_completed_tests, 
          COALESCE(SUM(utr.test_score), 0) as hidden_total_score 
        FROM user_test_responses utr
        JOIN tests t ON utr.test_id = t.id
        WHERE utr.user_id = $1 AND t.deleted_at IS NULL AND t.is_visible = false
      `, [userId]);
      
      const currentData = currentScores.rows[0] || { current_total_score: 0, current_completed_tests: 0 };
      const newData = newScores.rows[0];
      const hiddenData = hiddenScores.rows[0];
      
      // Update user_scores table
      await client.query(`
        INSERT INTO user_scores (user_id, total_score, completed_tests_count, last_updated) 
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id) DO UPDATE SET 
        total_score = EXCLUDED.total_score,
        completed_tests_count = EXCLUDED.completed_tests_count,
        last_updated = CURRENT_TIMESTAMP
      `, [userId, newData.total_score, newData.completed_tests]);
      
      // Log the changes
      const scoreDifference = parseInt(currentData.current_total_score) - parseInt(newData.total_score);
      const testCountDifference = parseInt(currentData.current_completed_tests) - parseInt(newData.completed_tests);
      
      if (scoreDifference > 0 || testCountDifference > 0) {
        console.log(`👤 User ${userId}:`);
        console.log(`   📊 Score: ${currentData.current_total_score} → ${newData.total_score} (removed: ${scoreDifference})`);
        console.log(`   📝 Tests: ${currentData.current_completed_tests} → ${newData.completed_tests} (removed: ${testCountDifference})`);
        console.log(`   🙈 Hidden test score removed: ${hiddenData.hidden_total_score} (${hiddenData.hidden_completed_tests} tests)`);
        
        removedHiddenTestPoints += parseInt(hiddenData.hidden_total_score);
      }
      
      updatedCount++;
    }
    
    await client.query('COMMIT');
    
    console.log('\n✅ User score recalculation completed!');
    console.log(`📊 Updated ${updatedCount} users`);
    console.log(`🙈 Total hidden test points removed: ${removedHiddenTestPoints}`);
    
    // Show summary statistics
    const finalStats = await client.query(`
      SELECT 
        COUNT(*) as total_users,
        AVG(total_score) as avg_score,
        MAX(total_score) as max_score,
        MIN(total_score) as min_score,
        AVG(completed_tests_count) as avg_completed_tests
      FROM user_scores
    `);
    
    const stats = finalStats.rows[0];
    console.log('\n📈 Final statistics:');
    console.log(`   👥 Total users: ${stats.total_users}`);
    console.log(`   📊 Average score: ${Math.round(stats.avg_score)}`);
    console.log(`   🏆 Max score: ${stats.max_score}`);
    console.log(`   📝 Average completed tests: ${Math.round(stats.avg_completed_tests)}`);
    
    // Check visible tests count
    const visibleTestsCount = await client.query(`
      SELECT COUNT(*) as visible_count 
      FROM tests 
      WHERE deleted_at IS NULL AND is_visible = true
    `);
    
    console.log(`\n✅ Visible tests available: ${visibleTestsCount.rows[0].visible_count}`);
    console.log('🎯 Users now need to complete ONLY visible tests for matching!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error recalculating user scores:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

recalculateUserScores(); 