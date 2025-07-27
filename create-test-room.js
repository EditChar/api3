const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  password: '123',
  host: 'localhost',
  port: 5432,
  database: 'localdb'
});

async function createTestRoom() {
  try {
    // Check if test room already exists
    const existing = await pool.query('SELECT * FROM chats WHERE id = $1', ['test-room-1']);
    
    if (existing.rows.length > 0) {
      console.log('✅ Test room already exists:', existing.rows[0]);
      return;
    }

    // Create test room
    const result = await pool.query(`
      INSERT INTO chats (id, user1_id, user2_id, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING *
    `, ['test-room-1', 28, 29, 'active']);

    console.log('✅ Test room created:', result.rows[0]);
    
  } catch (error) {
    console.error('❌ Error creating test room:', error.message);
  } finally {
    await pool.end();
  }
}

createTestRoom(); 