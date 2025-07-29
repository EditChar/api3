const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  password: '123',
  host: 'localhost',
  port: 5432,
  database: 'localdb'
});

async function checkCurrentTestStatus() {
  try {
    console.log('🔍 Checking current test status after admin changes...\n');
    
    // 1. Check all tests visibility
    const allTests = await pool.query(`
      SELECT id, title, is_visible, created_at 
      FROM tests 
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC
    `);
    
    console.log('📊 All tests status:');
    allTests.rows.forEach(test => {
      const status = test.is_visible ? '✅ Visible' : '🙈 Hidden';
      console.log(`   ${status} - ID: ${test.id} - "${test.title}"`);
    });
    
    // 2. Count visible tests (what algorithm uses now)
    const visibleCount = allTests.rows.filter(t => t.is_visible).length;
    const hiddenCount = allTests.rows.filter(t => !t.is_visible).length;
    
    console.log(`\n📈 Summary:`);
    console.log(`   Visible tests: ${visibleCount}`);
    console.log(`   Hidden tests: ${hiddenCount}`);
    console.log(`   Total tests: ${allTests.rows.length}`);
    
    // 3. Find "10 SORULUK TEST"
    const tenQuestionTest = allTests.rows.find(t => 
      t.title.toLowerCase().includes('10 soruluk') || 
      t.title.toLowerCase().includes('10') ||
      t.title.toLowerCase().includes('soruluk')
    );
    
    if (tenQuestionTest) {
      const status = tenQuestionTest.is_visible ? '✅ Visible' : '🙈 Hidden';
      console.log(`\n🎯 "10 SORULUK TEST" found:`);
      console.log(`   Status: ${status}`);
      console.log(`   ID: ${tenQuestionTest.id}`);
      console.log(`   Title: "${tenQuestionTest.title}"`);
      
      // Check who completed this test
      const completions = await pool.query(`
        SELECT 
          utr.user_id,
          utr.test_score,
          utr.response_date,
          u.username
        FROM user_test_responses utr
        JOIN users u ON utr.user_id = u.id
        WHERE utr.test_id = $1
        ORDER BY utr.response_date DESC
      `, [tenQuestionTest.id]);
      
      console.log(`\n👥 Users who completed "10 SORULUK TEST" (${completions.rows.length}):`);
      completions.rows.forEach(comp => {
        console.log(`   👤 User ${comp.user_id} (${comp.username || 'N/A'}) - Score: ${comp.test_score}`);
      });
    } else {
      console.log(`\n❌ "10 SORULUK TEST" not found! Looking for any test with "10":`);
      const possibleTests = allTests.rows.filter(t => 
        t.title.toLowerCase().includes('10') || 
        t.title.toLowerCase().includes('test')
      );
      possibleTests.forEach(test => {
        const status = test.is_visible ? '✅ Visible' : '🙈 Hidden';
        console.log(`   ${status} - ID: ${test.id} - "${test.title}"`);
      });
    }
    
    // 4. Check what the algorithm will require now
    const visibleTestsQuery = await pool.query(`
      SELECT COUNT(*) as total_count 
      FROM tests 
      WHERE deleted_at IS NULL AND is_visible = true
    `);
    
    const requiredTests = parseInt(visibleTestsQuery.rows[0].total_count);
    console.log(`\n🎯 MATCHING ALGORITHM REQUIREMENTS:`);
    console.log(`   Required visible tests to complete: ${requiredTests}`);
    
    if (requiredTests === 1) {
      console.log('   ✅ Perfect! Users need to complete only 1 test for matching');
    } else if (requiredTests === 0) {
      console.log('   ⚠️ WARNING: No visible tests! All users will be eligible immediately');
    } else {
      console.log(`   📝 Users need to complete ${requiredTests} tests for matching`);
    }
    
    // 5. Check sample user eligibility
    const sampleUsers = await pool.query(`
      SELECT 
        u.id,
        u.username,
        COALESCE(us.completed_tests_count, 0) as completed_tests,
        COALESCE(us.total_score, 0) as total_score
      FROM users u
      LEFT JOIN user_scores us ON u.id = us.user_id
      WHERE u.id IN (28, 24, 25, 26, 27)
      ORDER BY u.id
    `);
    
    console.log(`\n👥 Sample user eligibility check:`);
    sampleUsers.rows.forEach(user => {
      const isEligible = user.completed_tests >= requiredTests;
      const status = isEligible ? '✅ Eligible' : '❌ Not Eligible';
      console.log(`   ${status} - User ${user.id} (${user.username || 'N/A'}): ${user.completed_tests}/${requiredTests} tests, Score: ${user.total_score}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkCurrentTestStatus(); 