import { createClient } from '@libsql/client';

const DATABASE_URL = process.env.DATABASE_URL || 'libsql://work-flow-shourya789.aws-ap-northeast-1.turso.io';
const authToken = process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzAyMzMzOTQsImlkIjoiMjIyM2YyMDktOTA4NS00YWExLThhNWUtMDdhYmVjNWQ0NzhiIiwicmlkIjoiZjY0YzViNzItZGFlMS00MzM3LWJhMTUtODM0ODI2M2I0ZTNlIn0.jnETJzXP7pC9CS3U_X3E7sd56cwH8qSXX1C02-fKD5thm9sykHzWEkaZfhc9fkswa_nzD-pRVMQJViS6Ng-tDg';

async function testConnection() {
  console.log('Testing Turso database connection...');

  try {
    const client = createClient({ url: DATABASE_URL, authToken });

    // Test basic connection
    const result = await client.execute('SELECT 1 as test');
    console.log('✅ Connection successful:', result.rows);

    // Test schema creation
    await client.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        emp_id TEXT UNIQUE NOT NULL,
        name TEXT,
        password TEXT,
        role TEXT
      )
    `);
    await client.execute(`
      CREATE TABLE IF NOT EXISTS entries (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        date TEXT,
        payload TEXT,
        status TEXT
      )
    `);
    await client.execute(`
      CREATE TABLE IF NOT EXISTS migrations (
        id TEXT PRIMARY KEY,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        migrated_users INTEGER,
        migrated_entries INTEGER,
        mapping TEXT
      )
    `);
    console.log('✅ Schema creation successful');

    // Test basic operations
    const testUserId = 'test-user-' + Date.now();
    await client.execute('INSERT INTO users(id, emp_id, name, password, role) VALUES(?,?,?,?,?)',
      [testUserId, 'TEST001', 'Test User', 'password', 'user']);
    console.log('✅ Insert user successful');

    const users = await client.execute('SELECT id, emp_id, name, role FROM users WHERE id = ?', [testUserId]);
    console.log('✅ Select user successful:', users.rows);

    await client.execute('DELETE FROM users WHERE id = ?', [testUserId]);
    console.log('✅ Delete user successful');

    console.log('🎉 All database tests passed!');

  } catch (error) {
    console.error('❌ Database test failed:', error.message);
    process.exit(1);
  }
}

testConnection();
