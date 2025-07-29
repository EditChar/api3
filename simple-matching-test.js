const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  password: '123',
  host: 'localhost',
  port: 5432,
  database: 'localdb'
});

async function testMatchingLogic() {
  try {
    console.log('🧪 Testing matching logic directly in database...\n');
    
    // Test the exact queries that matching algorithm uses
    
    // 1. Count visible tests (what algorithm should use now)
    const visibleTestsResult = await pool.query(`
      SELECT COUNT(*) as total_count 
      FROM tests 
      WHERE deleted_at IS NULL AND is_visible = true
    `);
    
    const visibleTestsCount = parseInt(visibleTestsResult.rows[0].total_count);
    console.log(`✅ Visible tests count: ${visibleTestsCount}`);
    
    // 2. Test user 28's eligibility
    const testUserId = 28;
    
    const userResult = await pool.query(`
      SELECT 
        u.id, u.gender,
        COALESCE(us.total_score, 0) as total_score,
        COALESCE(us.completed_tests_count, 0) as completed_tests_count
      FROM users u
      LEFT JOIN user_scores us ON u.id = us.user_id
      WHERE u.id = $1
    `, [testUserId]);
    
    if (userResult.rows.length === 0) {
      console.log('❌ Test user not found');
      return;
    }
    
    const currentUser = userResult.rows[0];
    console.log(`👤 User ${testUserId} stats:`, {
      completed_tests: currentUser.completed_tests_count,
      total_score: currentUser.total_score,
      gender: currentUser.gender
    });
    
    // 3. Check eligibility
    const isEligible = currentUser.completed_tests_count >= visibleTestsCount;
    console.log(`\n🎯 ELIGIBILITY CHECK:`);
    console.log(`   Completed tests: ${currentUser.completed_tests_count}`);
    console.log(`   Required tests: ${visibleTestsCount}`);
    console.log(`   Is eligible: ${isEligible ? '✅ YES' : '❌ NO'}`);
    
    if (isEligible) {
      console.log('\n🎉 SUCCESS! User should be able to access matching now!');
      console.log('✅ Hidden tests are properly excluded from algorithm');
    } else {
      console.log('\n❌ ISSUE: User should be eligible but algorithm says no');
      
      // Debug: Check what tests this user completed
      const userTests = await pool.query(`
        SELECT 
          t.id,
          t.title,
          t.is_visible,
          utr.test_score,
          utr.response_date
        FROM user_test_responses utr
        JOIN tests t ON utr.test_id = t.id
        WHERE utr.user_id = $1
        ORDER BY utr.response_date DESC
      `, [testUserId]);
      
      console.log('\n🔍 User test history:');
      userTests.rows.forEach(test => {
        const visibility = test.is_visible ? '👁️ Visible' : '🙈 Hidden';
        console.log(`   ${visibility} - "${test.title}" (Score: ${test.test_score})`);
      });
      
      const visibleCompleted = userTests.rows.filter(t => t.is_visible).length;
      const hiddenCompleted = userTests.rows.filter(t => !t.is_visible).length;
      
      console.log(`\n📊 Summary:`);
      console.log(`   Visible tests completed: ${visibleCompleted}`);
      console.log(`   Hidden tests completed: ${hiddenCompleted}`);
      console.log(`   Total in user_scores: ${currentUser.completed_tests_count}`);
    }
    
    // 4. Check if there are any visible tests user hasn't completed
    const availableVisibleTests = await pool.query(`
      SELECT t.id, t.title
      FROM tests t
      LEFT JOIN user_test_responses utr ON t.id = utr.test_id AND utr.user_id = $1
      WHERE t.deleted_at IS NULL 
        AND t.is_visible = true 
        AND utr.test_id IS NULL
      ORDER BY t.created_at DESC
    `, [testUserId]);
    
    if (availableVisibleTests.rows.length > 0) {
      console.log(`\n📝 Available visible tests to complete (${availableVisibleTests.rows.length}):`);
      availableVisibleTests.rows.forEach(test => {
        console.log(`   📋 ID: ${test.id} - "${test.title}"`);
      });
    } else {
      console.log('\n✅ User has completed all available visible tests');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await pool.end();
  }
}

testMatchingLogic(); 