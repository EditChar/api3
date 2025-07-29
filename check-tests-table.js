const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  password: '123',
  host: 'localhost',
  port: 5432,
  database: 'localdb'
});

async function checkTestsTable() {
  try {
    console.log('🔍 Checking tests table structure...\n');
    
    // Check table structure
    const tableStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'tests' 
      ORDER BY ordinal_position
    `);
    
    console.log('📊 Tests table structure:');
    tableStructure.rows.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    // Check if is_visible field exists
    const hasVisibleField = tableStructure.rows.some(col => col.column_name === 'is_visible');
    console.log(`\n🔍 is_visible field exists: ${hasVisibleField}`);
    
    if (hasVisibleField) {
      // Check hidden tests
      const hiddenTests = await pool.query(`
        SELECT id, title, is_visible, created_at 
        FROM tests 
        WHERE is_visible = false AND deleted_at IS NULL
        ORDER BY created_at DESC
      `);
      
      console.log(`\n🙈 Hidden tests count: ${hiddenTests.rows.length}`);
      if (hiddenTests.rows.length > 0) {
        console.log('Hidden tests:');
        hiddenTests.rows.forEach(test => {
          console.log(`   📝 ID: ${test.id} - "${test.title}" (created: ${test.created_at?.toISOString().split('T')[0]})`);
        });
      }
      
      // Check visible tests
      const visibleTests = await pool.query(`
        SELECT id, title, is_visible, created_at 
        FROM tests 
        WHERE is_visible = true AND deleted_at IS NULL
        ORDER BY created_at DESC
      `);
      
      console.log(`\n✅ Visible tests count: ${visibleTests.rows.length}`);
      if (visibleTests.rows.length > 0) {
        console.log('Visible tests:');
        visibleTests.rows.forEach(test => {
          console.log(`   📝 ID: ${test.id} - "${test.title}" (created: ${test.created_at?.toISOString().split('T')[0]})`);
        });
      }
      
      // Check user responses to hidden tests
      const hiddenTestResponses = await pool.query(`
        SELECT 
          utr.user_id,
          utr.test_id,
          utr.test_score,
          t.title as test_title,
          t.is_visible,
          utr.created_at
        FROM user_test_responses utr
        JOIN tests t ON utr.test_id = t.id
        WHERE t.is_visible = false AND t.deleted_at IS NULL
        ORDER BY utr.created_at DESC
        LIMIT 10
      `);
      
      console.log(`\n📊 Users who completed hidden tests: ${hiddenTestResponses.rows.length}`);
      if (hiddenTestResponses.rows.length > 0) {
        console.log('Recent completions of hidden tests:');
        hiddenTestResponses.rows.forEach(response => {
          console.log(`   👤 User ${response.user_id} - Test "${response.test_title}" (Score: ${response.test_score}) - ${response.created_at?.toISOString().split('T')[0]}`);
        });
      }
    } else {
      console.log('\n⚠️ is_visible field does not exist! Need to add it.');
    }
    
    // Total tests count (current matching algorithm uses this)
    const totalTests = await pool.query('SELECT COUNT(*) as total_count FROM tests WHERE deleted_at IS NULL');
    console.log(`\n📈 Total tests (current algorithm): ${totalTests.rows[0].total_count}`);
    
    if (hasVisibleField) {
      const visibleCount = await pool.query('SELECT COUNT(*) as total_count FROM tests WHERE deleted_at IS NULL AND is_visible = true');
      console.log(`📈 Visible tests (should be used): ${visibleCount.rows[0].total_count}`);
    }
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
  } finally {
    await pool.end();
  }
}

checkTestsTable(); 