import { createClient } from '@libsql/client';
import archiver from 'archiver';

const DATABASE_URL = process.env.DATABASE_URL || 'libsql://work-flow-shourya789.aws-ap-northeast-1.turso.io';

if (!process.env.DATABASE_URL) {
  console.warn('Warning: DATABASE_URL not set. Using fallback connection string. Set DATABASE_URL in Vercel environment variables for production.');
}

// Lazy client initialization
let client: any;

function getClient() {
  if (client) return client;
  if ((global as any).__libsqlClient) {
    client = (global as any).__libsqlClient;
    return client;
  }

  const url = process.env.DATABASE_URL || 'libsql://your-turso-db.turso.io';
  const authToken = process.env.TURSO_AUTH_TOKEN || '';

  try {
    client = createClient({ url, authToken });
    (global as any).__libsqlClient = client;
    return client;
  } catch (e) {
    console.error('Failed to initialize client', e);
    throw e;
  }
}

async function ensureSchema(client: any) {
  if ((global as any).__schemaChecked) return;
  try {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        emp_id TEXT UNIQUE NOT NULL,
        name TEXT,
        password TEXT,
        role TEXT
      );
      CREATE TABLE IF NOT EXISTS entries (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        date TEXT,
        payload TEXT,
        status TEXT
      );
      CREATE TABLE IF NOT EXISTS migrations (
        id TEXT PRIMARY KEY,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        migrated_users INTEGER,
        migrated_entries INTEGER,
        mapping TEXT
      );
    `);
    (global as any).__schemaChecked = true;
  } catch (e) {
    console.error('Schema creation failed', e);
    throw e;
  }
}

function logBadRequest(res: any, message: string, ctx?: any) {
  try { console.warn('Bad Request:', message, ctx || {}); } catch (e) { /* ignore */ }
  return res.status(400).json({ error: message, details: ctx || {} });
}

function logServerError(res: any, message: string, ctx?: any) {
  try { console.error('Server Error:', message, ctx || {}); } catch (e) { /* ignore */ }
  return res.status(500).json({ error: message });
}



export default async function handler(req: any, res: any) {
  const method = req.method;
  const q = req.query || {};
  const action = q.action || (req.body && req.body.action);

  try {
    const db = getClient(); // Init DB here
    await ensureSchema(db); // Pass db instance
  } catch (e: any) {
    console.error('DB Init/Schema Failed:', e);
    return res.status(500).json({ error: 'Database connection failed', details: e.message });
  }

  const client = getClient(); // Usage for rest of function

  if (action === 'getUsers' && method === 'GET') {
    const r = await client.execute('SELECT id, emp_id, name, role, password FROM users ORDER BY name');
    const users = r.rows.map((row: any) => ({ ...row, empId: row.emp_id, emp_id: undefined }));
    return res.status(200).json({ users });
  }

  if (action === 'register' && method === 'POST') {
    const { empId = '', name = '', password = '', role = 'user' } = req.body || {};
    if (role === 'admin') {
      return logBadRequest(res, 'Admin accounts cannot be registered. Use default admin credentials.', { role });
    }
    const exists = await client.execute('SELECT id FROM users WHERE LOWER(emp_id) = LOWER(?)', [empId]);
    if (exists.rows.length > 0) return res.status(400).json({ error: 'Employee ID already exists' });
    const id = cryptoUUID();
    await client.execute('INSERT INTO users(id, emp_id, name, password, role) VALUES(?,?,?,?,?)', [id, empId, name, password, role]);
    const r = await client.execute('SELECT id, emp_id, name, role, password FROM users WHERE id = ?', [id]);
    const row = r.rows[0];
    const user = { ...row, empId: row.emp_id, emp_id: undefined };
    return res.status(201).json({ user });
  }

  if (action === 'auth' && method === 'POST') {
    const { empId = '', password = '', role = 'user' } = req.body || {};

    // allow default admin login (case insensitive)
    if (role === 'admin' && empId.toLowerCase() === 'team' && password.toLowerCase() === 'pooja852') {
      // ensure admin exists in DB
      const found = await client.execute('SELECT id, emp_id, name, role, password FROM users WHERE emp_id = ?', ['TEAM']);
      if (found.rows.length === 0) {
        const id = 'admin';
        await client.execute('INSERT INTO users(id, emp_id, name, password, role) VALUES(?,?,?,?,?)', [id, 'TEAM', 'TEAM', 'Pooja852', 'admin']);
        return res.status(200).json({ user: { id, empId: 'TEAM', name: 'TEAM', role: 'admin', password: 'Pooja852' } });
      }
      const row = found.rows[0];
      const user = { ...row, empId: row.emp_id, emp_id: undefined };
      return res.status(200).json({ user });
    }

    const found = await client.execute('SELECT id, emp_id, name, role, password FROM users WHERE LOWER(emp_id) = LOWER(?) AND password = ? AND role = ?', [empId, password, role]);
    if (found.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const row = found.rows[0];
    const user = { ...row, empId: row.emp_id, emp_id: undefined };
    return res.status(200).json({ user });
  }

  if (action === 'getEntries' && method === 'GET') {
    const userId = q.userId as string;
    if (!userId) return logBadRequest(res, 'userId required', { action, query: q });
    const r = await client.execute('SELECT id, payload, status, date FROM entries WHERE user_id = ? ORDER BY date DESC', [userId]);
    const entries = r.rows.map((row: any) => ({ id: row.id, date: row.date, ...JSON.parse(row.payload || '{}'), status: row.status }));
    return res.status(200).json({ entries });
  }

  if (action === 'addEntry' && method === 'POST') {
    const { userId, entry } = req.body || {};
    if (!userId || !entry) return logBadRequest(res, 'userId and entry required', { action, body: req.body });
    await client.execute('INSERT INTO entries(id, user_id, date, payload, status) VALUES(?,?,?,?,?)', [entry.id, userId, entry.date || new Date().toISOString(), JSON.stringify(entry), entry.status || 'N/A']);
    const r = await client.execute('SELECT id, payload, status, date FROM entries WHERE user_id = ? ORDER BY date DESC', [userId]);
    const entries = r.rows.map((row: any) => ({ id: row.id, date: row.date, ...JSON.parse(row.payload || '{}'), status: row.status }));
    return res.status(201).json({ entries });
  }

  if (action === 'updateEntry' && method === 'PUT') {
    const { userId, entryId, entry } = req.body || {};
    if (!userId || !entryId || !entry) return logBadRequest(res, 'userId, entryId and entry required', { action, body: req.body });
    await client.execute('UPDATE entries SET payload = ?, status = ? WHERE id = ? AND user_id = ?', [JSON.stringify(entry), entry.status || 'N/A', entryId, userId]);
    const r = await client.execute('SELECT id, payload, status, date FROM entries WHERE user_id = ? ORDER BY date DESC', [userId]);
    const entries = r.rows.map((row: any) => ({ id: row.id, date: row.date, ...JSON.parse(row.payload || '{}'), status: row.status }));
    return res.status(200).json({ entries });
  }

  if (action === 'deleteEntry' && method === 'DELETE') {
    const { userId, entryId } = req.body || {};
    if (!userId || !entryId) return logBadRequest(res, 'userId and entryId required', { action, body: req.body });
    await client.execute('DELETE FROM entries WHERE id = ? AND user_id = ?', [entryId, userId]);
    const r = await client.execute('SELECT id, payload, status, date FROM entries WHERE user_id = ? ORDER BY date DESC', [userId]);
    const entries = r.rows.map((row: any) => ({ id: row.id, date: row.date, ...JSON.parse(row.payload || '{}'), status: row.status }));
    return res.status(200).json({ entries });
  }

  if (action === 'deleteAllUserEntries' && method === 'DELETE') {
    const { userId } = req.body || {};
    if (!userId) return logBadRequest(res, 'userId required', { action, body: req.body });
    await client.execute('DELETE FROM entries WHERE user_id = ?', [userId]);
    return res.status(200).json({ entries: [] });
  }

  if (action === 'deleteUser' && method === 'DELETE') {
    const { userId } = req.body || {};
    if (!userId) return logBadRequest(res, 'userId required', { action, body: req.body });
    await client.execute('DELETE FROM users WHERE id = ?', [userId]);
    const r = await client.execute('SELECT id, emp_id, name, role, password FROM users ORDER BY name');
    const users = r.rows.map((row: any) => ({ ...row, empId: row.emp_id, emp_id: undefined }));
    return res.status(200).json({ users });
  }

  if (action === 'updateStatus' && method === 'PUT') {
    const { userId, entryId, newStatus, reason } = req.body || {};
    if (!userId || !entryId || !newStatus) return logBadRequest(res, 'userId, entryId and newStatus required', { action, body: req.body });
    // fetch current payload
    const r0 = await client.execute('SELECT payload FROM entries WHERE id = ? AND user_id = ?', [entryId, userId]);
    if (r0.rows.length === 0) return res.status(404).json({ error: 'Entry not found' });
    const payload = JSON.parse(r0.rows[0].payload || '{}');
    if (reason !== undefined) payload.reason = reason;
    await client.execute('UPDATE entries SET payload = ?, status = ? WHERE id = ? AND user_id = ?', [JSON.stringify(payload), newStatus, entryId, userId]);
    const r = await client.execute('SELECT id, payload, status, date FROM entries WHERE user_id = ? ORDER BY date DESC', [userId]);
    const entries = r.rows.map((row: any) => ({ id: row.id, date: row.date, ...JSON.parse(row.payload || '{}'), status: row.status }));
    return res.status(200).json({ entries });
  }

  if (action === 'getAllEntries' && method === 'GET') {
    const r = await client.execute(`SELECT e.id, e.payload, e.status, e.date, u.name as user_name, u.emp_id as user_emp FROM entries e JOIN users u ON u.id = e.user_id ORDER BY e.date DESC`);
    const result = r.rows.map((row: any) => ({ id: row.id, date: row.date, ...JSON.parse(row.payload || '{}'), status: row.status, userName: row.user_name, userId: row.user_emp }));
    return res.status(200).json({ entries: result });
  }

  if (action === 'migrateLocal' && method === 'POST') {
    const payload = req.body || {};
    const users = payload.users || [];
    const entriesMap = payload.entries || {};

    try {
      const userIdMap: Record<string, string> = {};

      // Upsert users by emp_id and record mapping from local id -> db id
      for (const u of users) {
        const localId = u.id || cryptoUUID();
        const empId = u.empId || u.emp_id || '';
        const name = u.name || '';
        const password = u.password || '';
        const role = u.role || 'user';

        // For Turso, use INSERT OR REPLACE since it doesn't support ON CONFLICT
        const upsert = await client.execute(
          `INSERT OR REPLACE INTO users(id, emp_id, name, password, role) VALUES(?,?,?,?,?)`,
          [localId, empId, name, password, role]
        );
        userIdMap[localId] = localId; // Since we're using the localId as dbId
      }

      // Insert entries for users where mapping exists, skip duplicates
      let entriesInserted = 0;
      for (const localId of Object.keys(entriesMap || {})) {
        const dbUserId = userIdMap[localId];
        if (!dbUserId) continue;
        const entries = entriesMap[localId] || [];
        for (const e of entries) {
          const exists = await client.execute('SELECT id FROM entries WHERE id = ?', [e.id]);
          if (exists.rows.length === 0) {
            await client.execute('INSERT INTO entries(id, user_id, date, payload, status) VALUES(?,?,?,?,?)', [e.id, dbUserId, e.date || new Date().toISOString(), JSON.stringify(e), e.status || 'N/A']);
            entriesInserted++;
          }
        }
      }

      const migrationId = cryptoUUID();
      const createdAt = new Date().toISOString();
      await client.execute('INSERT INTO migrations(id, created_at, migrated_users, migrated_entries, mapping) VALUES(?,?,?,?,?)', [migrationId, createdAt, Object.keys(userIdMap).length, entriesInserted, JSON.stringify(userIdMap)]);
      return res.status(200).json({ migrationId, createdAt, migratedUsers: Object.keys(userIdMap).length, migratedEntries: entriesInserted, mapping: userIdMap });
    } catch (err) {
      console.error('Migration failed', err);
      return res.status(500).json({ error: 'Migration failed', detail: String(err) });
    }
  }

  if (action === 'getMigrations' && method === 'GET') {
    const r = await client.execute('SELECT id, created_at, migrated_users, migrated_entries, mapping FROM migrations ORDER BY created_at DESC LIMIT 50');
    return res.status(200).json({ migrations: r.rows });
  }

  if (action === 'exportMigration' && method === 'GET') {
    const id = q.id as string;
    if (!id) return logBadRequest(res, 'Migration id required', { action, query: q });
    const r = await client.execute('SELECT mapping, created_at FROM migrations WHERE id = ?', [id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Migration not found' });
    const mapping = JSON.parse(r.rows[0].mapping || '{}');
    const filename = `migration_${id}_mapping.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(JSON.stringify(mapping, null, 2));
  }

  if (action === 'exportMigrationFlat' && method === 'GET') {
    const id = q.id as string;
    const format = (q.format as string) || 'csv';
    if (!id) return logBadRequest(res, 'Migration id required', { action, query: q });
    const r = await client.execute('SELECT mapping, created_at FROM migrations WHERE id = ?', [id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Migration not found' });

    const mapping = JSON.parse(r.rows[0].mapping || '{}');
    // Build CSV
    const rows = Object.keys(mapping).map(localId => `${JSON.stringify(localId)},${JSON.stringify(mapping[localId])}`);
    const csv = ['local_id,db_id', ...rows].join('\n');

    if (format === 'csv') {
      const filename = `migration_${id}_mapping.csv`;
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.status(200).send(csv);
    }

    if (format === 'zip') {
      const filename = `migration_${id}_mapping.zip`;
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.on('error', (err: any) => { throw err; });
      archive.append(csv, { name: `migration_${id}_mapping.csv` });
      archive.append(JSON.stringify(mapping, null, 2), { name: `migration_${id}_mapping.json` });
      archive.pipe(res);
      await archive.finalize();
      return; // response will be streamed
    }

    return res.status(400).json({ error: 'Unknown format' });
  }

  return logBadRequest(res, 'Unknown action or method', { action, method });
}

function cryptoUUID() {
  try { return (globalThis as any).crypto?.randomUUID?.() || require('crypto').randomUUID(); } catch (e) { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
}