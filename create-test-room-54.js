const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  password: '123',
  host: 'localhost',
  port: 5432,
  database: 'localdb'
});

async function createTestRoomForUser54() {
  try {
    // Check if test room already exists for user 54
    const existing = await pool.query(`
      SELECT * FROM chats 
      WHERE (user1_id = 54 OR user2_id = 54) AND id = 'test-room-54'
    `);
    
    if (existing.rows.length > 0) {
      console.log('✅ Test room already exists for user 54:', existing.rows[0]);
      return;
    }

    // Create test room with user 54
    const result = await pool.query(`
      INSERT INTO chats (id, user1_id, user2_id, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING *
    `, ['test-room-54', 54, 55, 'active']);

    console.log('✅ Test room created for user 54:', result.rows[0]);
    
  } catch (error) {
    console.error('❌ Error creating test room:', error.message);
  } finally {
    await pool.end();
  }
}

createTestRoomForUser54(); 