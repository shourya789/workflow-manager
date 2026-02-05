import { createClient } from '@libsql/client';

const url = 'libsql://workflow-shourya789.aws-ap-northeast-1.turso.io';
const authToken = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzAyODc3NzgsImlkIjoiZWQ2NzFlMWYtOThhMS00ZTJlLWFiOWUtNDRhYzM3Y2ExYTc3IiwicmlkIjoiODllNGJlMWMtYzQ4NC00NWRkLWJiMGUtNTk4YmZiMTkwYzUxIn0.yMibeuvzGtb1YZMfu_KavtP5gDSWCxuI7jbgSoo74tz4zhKILkL8oyzhTGEM2YuD4mkwke6PyDwyY4o01bMKCg';

console.log('Testing Turso Connection...');
console.log('URL:', url);
console.log('Auth token present:', authToken ? 'YES' : 'NO');
console.log('Auth token length:', authToken.length);

try {
  console.log('\n1. Creating client...');
  const client = createClient({ url, authToken });
  console.log('✓ Client created successfully');

  console.log('\n2. Testing connection with a simple query...');
  const result = await client.execute('SELECT 1 as test');
  console.log('✓ Connection successful! Result:', result.rows);

  console.log('\n3. Creating tables...');
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
  console.log('✓ Tables created successfully');

  console.log('\n4. Checking existing users...');
  const users = await client.execute('SELECT * FROM users LIMIT 5');
  console.log('✓ Found', users.rows.length, 'users');
  if (users.rows.length > 0) {
    console.log('Sample user:', users.rows[0]);
  }

  console.log('\n✅ ALL TESTS PASSED! Database connection is working.');
  
} catch (error) {
  console.error('\n❌ ERROR:', error);
  console.error('Error message:', error.message);
  console.error('Error stack:', error.stack);
  process.exit(1);
}
