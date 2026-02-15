import { createClient } from '@libsql/client';
import archiver from 'archiver';
import crypto from 'crypto';

const DATABASE_URL = process.env.DATABASE_URL || 'libsql://workflow-shourya789.aws-ap-northeast-1.turso.io';

if (!process.env.DATABASE_URL) {
  console.warn('Warning: DATABASE_URL not set. Using fallback Turso database. Set DATABASE_URL in Vercel environment variables for production.');
}

// Lazy client initialization
let client: any;

const DEFAULT_TEAM_ID = 'team_default';
const DEFAULT_TEAM_NAME = 'Default Team';
const SESSION_COOKIE_NAME = 'session_token';
const SESSION_TTL_HOURS = 24 * 7;
const INVITE_TTL_HOURS = 48;

function getClient() {
  if (client) return client;
  if ((global as any).__libsqlClient) {
    client = (global as any).__libsqlClient;
    return client;
  }

  const url = process.env.DATABASE_URL || 'libsql://workflow-shourya789.aws-ap-northeast-1.turso.io';
  const authToken = process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzAyODc3NzgsImlkIjoiZWQ2NzFlMWYtOThhMS00ZTJlLWFiOWUtNDRhYzM3Y2ExYTc3IiwicmlkIjoiODllNGJlMWMtYzQ4NC00NWRkLWJiMGUtNTk4YmZiMTkwYzUxIn0.yMibeuvzGtb1YZMfu_KavtP5gDSWCxuI7jbgSoo74tz4zhKILkL8oyzhTGEM2YuD4mkwke6PyDwyY4o01bMKCg';

  console.log('Initializing Turso client...');
  console.log('Database URL:', url);
  console.log('Auth token present:', authToken ? 'YES' : 'NO');

  try {
    client = createClient({ url, authToken });
    (global as any).__libsqlClient = client;
    console.log('Turso client created successfully');
    return client;
  } catch (e) {
    console.error('Failed to initialize Turso client:', e);
    throw new Error(`Database initialization failed: ${e}`);
  }
}

function nowIso() {
  return new Date().toISOString();
}

async function tryAddColumn(client: any, table: string, columnDef: string) {
  try {
    await client.execute(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`);
  } catch (e) {
    // Ignore if column already exists.
  }
}

async function ensureSchema(client: any) {
  if ((global as any).__schemaChecked) return;
  try {
    console.log('Creating/verifying database schema...');
    
    // Execute each CREATE TABLE separately (Turso doesn't allow multiple statements)
    await client.execute(`
      CREATE TABLE IF NOT EXISTS teams (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT
      )
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        emp_id TEXT UNIQUE NOT NULL,
        name TEXT,
        email TEXT UNIQUE,
        password TEXT,
        password_hash TEXT,
        role TEXT,
        team_id TEXT REFERENCES teams(id),
        status TEXT,
        created_at TEXT
      )
    `);
    
    await client.execute(`
      CREATE TABLE IF NOT EXISTS entries (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        team_id TEXT REFERENCES teams(id),
        date TEXT,
        payload TEXT,
        status TEXT
      )
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS invites (
        id TEXT PRIMARY KEY,
        team_id TEXT REFERENCES teams(id),
        role TEXT,
        token TEXT UNIQUE NOT NULL,
        expires_at TEXT,
        used INTEGER DEFAULT 0,
        created_by TEXT,
        created_at TEXT
      )
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        token TEXT UNIQUE NOT NULL,
        created_at TEXT,
        expires_at TEXT
      )
    `);
    
    await client.execute(`
      CREATE TABLE IF NOT EXISTS migrations (
        id TEXT PRIMARY KEY,
        created_at TEXT,
        migrated_users INTEGER,
        migrated_entries INTEGER,
        mapping TEXT,
        team_id TEXT REFERENCES teams(id)
      )
    `);

    await tryAddColumn(client, 'users', 'email TEXT');
    await tryAddColumn(client, 'users', 'password_hash TEXT');
    await tryAddColumn(client, 'users', 'team_id TEXT REFERENCES teams(id)');
    await tryAddColumn(client, 'users', 'status TEXT');
    await tryAddColumn(client, 'users', 'created_at TEXT');
    await tryAddColumn(client, 'entries', 'team_id TEXT REFERENCES teams(id)');
    await tryAddColumn(client, 'migrations', 'team_id TEXT REFERENCES teams(id)');
    
    // Create indexes for performance (safe - IF NOT EXISTS prevents duplicates)
    try {
      await client.execute(`CREATE INDEX IF NOT EXISTS idx_entries_user_id ON entries(user_id)`);
      await client.execute(`CREATE INDEX IF NOT EXISTS idx_entries_team_id ON entries(team_id)`);
      await client.execute(`CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(date)`);
      await client.execute(`CREATE INDEX IF NOT EXISTS idx_entries_status ON entries(status)`);
      await client.execute(`CREATE INDEX IF NOT EXISTS idx_users_emp_id ON users(LOWER(emp_id))`);
      await client.execute(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(LOWER(email))`);
      await client.execute(`CREATE INDEX IF NOT EXISTS idx_users_team_id ON users(team_id)`);
      await client.execute(`CREATE INDEX IF NOT EXISTS idx_invites_token ON invites(token)`);
      await client.execute(`CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)`);
      await client.execute(`CREATE INDEX IF NOT EXISTS idx_migrations_team_id ON migrations(team_id)`);
      console.log('Database indexes verified');
    } catch (e) {
      console.warn('Index creation warning (non-fatal):', e);
    }

    const createdAt = nowIso();
    await client.execute(
      'INSERT OR IGNORE INTO teams(id, name, created_at) VALUES(?,?,?)',
      [DEFAULT_TEAM_ID, DEFAULT_TEAM_NAME, createdAt]
    );

    // Seed 4 teams with admin accounts and permanent join tokens
    const adminAccounts = [
      { id: 'team_aakash', name: 'Aakash Pandya Team', email: 'akash.pandya@petpooja.com', password: 'Ak@2026#AP', empId: 'AAKASH', token: 'ADM-AAK-0C3DA7EB' },
      { id: 'team_ashish', name: 'Ashish Upadhyay Team', email: 'ashish.upadhyay@petpooja.com', password: 'As@2026#AU', empId: 'ASHISH', token: 'ADM-ASH-80BEC2DF' },
      { id: 'team_farrin', name: 'Farhin Ansari Team', email: 'farhin.ansari@petpooja.com', password: 'Fa@2026#FA', empId: 'FARHIN', token: 'ADM-FAR-4218C5AE' },
      { id: 'team_arjun', name: 'Arjun Gohil Team', email: 'arjun.gohil@petpooja.com', password: 'Ar@2026#AG', empId: 'ARJUN', token: 'ADM-ARJ-A13B2366' }
    ];

    for (const account of adminAccounts) {
      // Create team
      await client.execute(
        'INSERT OR IGNORE INTO teams(id, name, created_at) VALUES(?,?,?)',
        [account.id, account.name, createdAt]
      );
      
      // Create admin user
      const adminExists = await client.execute('SELECT id FROM users WHERE email = ?', [account.email]);
      if (adminExists.rows.length === 0) {
        const userId = cryptoUUID();
        const passwordHash = hashPassword(account.password);
        await client.execute(
          'INSERT INTO users(id, emp_id, name, email, password, password_hash, role, team_id, status, created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
          [userId, account.empId, account.name.split(' ')[0] + ' ' + account.name.split(' ')[1], account.email, account.password, passwordHash, 'admin', account.id, 'active', createdAt]
        );
        console.log(`Created admin: ${account.email}`);
      }
      
      // Create or update permanent join token for this team (with fixed token and correct team_id)
      const tokenExists = await client.execute('SELECT id, team_id FROM invites WHERE token = ?', [account.token]);
      if (tokenExists.rows.length === 0) {
        // Create new invite with correct team_id
        const inviteId = cryptoUUID();
        await client.execute(
          'INSERT INTO invites(id, team_id, role, token, expires_at, used, created_by, created_at) VALUES(?,?,?,?,?,?,?,?)',
          [inviteId, account.id, 'user', account.token, null, 0, 'system', createdAt]
        );
        console.log(`Created permanent join token for team: ${account.id} with token: ${account.token}`);
      } else {
        // Update existing invite to ensure it has correct team_id
        const existingTeamId = tokenExists.rows[0].team_id;
        if (existingTeamId !== account.id) {
          await client.execute('UPDATE invites SET team_id = ? WHERE token = ?', [account.id, account.token]);
          console.log(`Updated join token team_id from ${existingTeamId} to ${account.id}`);
        }
      }
    }
    
    // Migrate old default team data to Aakash's team (only run once)
    const migrationCheck = await client.execute('SELECT id FROM migrations WHERE id = ?', ['migration_to_aakash_team']);
    if (migrationCheck.rows.length === 0) {
      console.log('Running one-time migration: moving default team data to Aakash team');
      const usersMigrated = await client.execute('UPDATE users SET team_id = ? WHERE team_id = ? OR team_id IS NULL OR team_id = ""', ['team_aakash', DEFAULT_TEAM_ID]);
      await client.execute('UPDATE users SET status = "active" WHERE status IS NULL OR status = ""');
      await client.execute('UPDATE users SET created_at = ? WHERE created_at IS NULL OR created_at = ""', [createdAt]);
      await client.execute('UPDATE entries SET team_id = (SELECT team_id FROM users WHERE users.id = entries.user_id) WHERE team_id IS NULL OR team_id = ""');
      const entriesMigrated = await client.execute('UPDATE entries SET team_id = ? WHERE team_id = ? OR team_id IS NULL OR team_id = ""', ['team_aakash', DEFAULT_TEAM_ID]);
      await client.execute('UPDATE migrations SET team_id = ? WHERE team_id = ? OR team_id IS NULL OR team_id = ""', ['team_aakash', DEFAULT_TEAM_ID]);
      
      // Record that this migration has been completed
      await client.execute('INSERT INTO migrations(id, created_at, migrated_users, migrated_entries, mapping, team_id) VALUES(?,?,?,?,?,?)',
        ['migration_to_aakash_team', createdAt, usersMigrated.rowsAffected || 0, entriesMigrated.rowsAffected || 0, JSON.stringify({}), 'team_aakash']);
      console.log('Migration completed');
    }
    
    // Migrate team_farrin to team_farhin (fix spelling)
    const farhinMigrationCheck = await client.execute('SELECT id FROM migrations WHERE id = ?', ['migration_farrin_to_farhin']);
    if (farhinMigrationCheck.rows.length === 0) {
      console.log('Running one-time migration: renaming team_farrin to team_farhin');
      // Can't update primary key, so just update the name
      await client.execute('UPDATE teams SET name = ? WHERE id = ?', ['Farhin Ansari Team', 'team_farrin']);
      // Update email for the admin user (only if farhin.ansari doesn't already exist)
      const farhinExists = await client.execute('SELECT id FROM users WHERE email = ?', ['farhin.ansari@petpooja.com']);
      if (farhinExists.rows.length === 0) {
        await client.execute('UPDATE users SET email = ?, emp_id = ?, name = ? WHERE email = ?', ['farhin.ansari@petpooja.com', 'FARHIN', 'Farhin Ansari', 'farrin.ansari@petpooja.com']);
      }
      await client.execute('INSERT INTO migrations(id, created_at, migrated_users, migrated_entries, mapping, team_id) VALUES(?,?,?,?,?,?)',
        ['migration_farrin_to_farhin', createdAt, 0, 0, JSON.stringify({}), 'team_farrin']);
      console.log('Farhin spelling migration completed');
    }
    
    (global as any).__schemaChecked = true;
    console.log('Database schema verified successfully');
  } catch (e) {
    console.error('Schema creation failed:', e);
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

function parseCookies(header?: string) {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  const parts = header.split(';');
  for (const part of parts) {
    const [key, ...rest] = part.trim().split('=');
    if (!key) continue;
    cookies[key] = decodeURIComponent(rest.join('='));
  }
  return cookies;
}

function getSessionToken(req: any) {
  const header = req?.headers?.cookie as string | undefined;
  const cookies = parseCookies(header);
  return cookies[SESSION_COOKIE_NAME] || (req?.headers?.['x-session-token'] as string | undefined) || '';
}

function setSessionCookie(res: any, token: string, expiresAt: string) {
  const isProd = process.env.NODE_ENV === 'production';
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Expires=${new Date(expiresAt).toUTCString()}`
  ];
  if (isProd) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function getBaseUrl(req: any) {
  const proto = (req?.headers?.['x-forwarded-proto'] as string) || 'https';
  const host = (req?.headers?.host as string) || '';
  return `${proto}://${host}`;
}

function clearSessionCookie(res: any) {
  const isProd = process.env.NODE_ENV === 'production';
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT'
  ];
  if (isProd) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function hashPassword(password: string) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

function verifyPassword(password: string, storedHash: string) {
  try {
    const [saltHex, hashHex] = (storedHash || '').split(':');
    if (!saltHex || !hashHex) return false;
    const salt = Buffer.from(saltHex, 'hex');
    const hash = Buffer.from(hashHex, 'hex');
    const test = crypto.scryptSync(password, salt, hash.length);
    return crypto.timingSafeEqual(hash, test);
  } catch (e) {
    return false;
  }
}

function mapUserRow(row: any) {
  return {
    ...row,
    empId: row.emp_id,
    emp_id: undefined,
    teamId: row.team_id,
    password_hash: undefined
  };
}

async function getSessionUser(req: any, client: any) {
  const token = getSessionToken(req);
  if (!token) return null;
  const session = await client.execute('SELECT user_id, expires_at FROM sessions WHERE token = ?', [token]);
  if (session.rows.length === 0) return null;
  const expiresAt = session.rows[0].expires_at as string;
  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
    await client.execute('DELETE FROM sessions WHERE token = ?', [token]);
    return null;
  }
  const userId = session.rows[0].user_id as string;
  const user = await client.execute('SELECT * FROM users WHERE id = ?', [userId]);
  if (user.rows.length === 0) return null;
  return user.rows[0];
}

async function createSessionForUser(res: any, client: any, userId: string) {
  const token = crypto.randomBytes(32).toString('hex');
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3600 * 1000).toISOString();
  const id = cryptoUUID();
  await client.execute('INSERT INTO sessions(id, user_id, token, created_at, expires_at) VALUES(?,?,?,?,?)', [id, userId, token, createdAt, expiresAt]);
  setSessionCookie(res, token, expiresAt);
  return token;
}

async function requireAdmin(res: any, sessionUser: any) {
  if (!sessionUser) return res.status(401).json({ error: 'Authentication required' });
  if (sessionUser.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  return null;
}

async function acceptInviteAndCreateUser(client: any, token: string, payload: any) {
  console.log('[acceptInvite] Token:', token, 'Payload:', payload);
  const invite = await client.execute('SELECT * FROM invites WHERE token = ?', [token]);
  if (invite.rows.length === 0) {
    console.log('[acceptInvite] ERROR: Invite not found for token:', token);
    return { error: 'Invite not found' };
  }
  const inviteRow = invite.rows[0];
  console.log('[acceptInvite] Found invite:', { id: inviteRow.id, team_id: inviteRow.team_id, role: inviteRow.role });
  const expiresAt = inviteRow.expires_at as string;
  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) return { error: 'Invite expired' };

  let teamId = inviteRow.team_id as string | null;
  console.log('[acceptInvite] Team ID from invite:', teamId);
  if (!teamId) {
    console.log('[acceptInvite] WARNING: Invite has no team_id, creating new team');
    const newTeamId = cryptoUUID();
    const teamName = (payload.teamName || payload.team_name || `Team ${String(token).slice(0, 6)}`) as string;
    await client.execute('INSERT INTO teams(id, name, created_at) VALUES(?,?,?)', [newTeamId, teamName, nowIso()]);
    teamId = newTeamId;
    console.log('[acceptInvite] Created new team:', teamId);
  }

  const teamCount = await client.execute('SELECT COUNT(*) as total FROM users WHERE team_id = ?', [teamId]);
  const total = Number(teamCount.rows[0]?.total || 0);
  if (total >= 35) return { error: 'Team user limit reached (35)' };

  const id = cryptoUUID();
  const empId = (payload.empId || payload.emp_id || '').trim() || (inviteRow.role === 'admin' ? `ADMIN_${id.slice(0, 6).toUpperCase()}` : id.slice(0, 8));
  const name = (payload.name || '').trim();
  const email = (payload.email || '').trim();
  const password = payload.password || '';
  const passwordHash = password ? hashPassword(password) : null;

  // Check uniqueness globally for empId and email
  const empExists = await client.execute('SELECT id FROM users WHERE LOWER(emp_id) = LOWER(?)', [empId]);
  if (empExists.rows.length > 0) return { error: 'Employee ID already exists' };
  if (email) {
    const emailExists = await client.execute('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [email]);
    if (emailExists.rows.length > 0) return { error: 'Email already exists' };
  }

  console.log('[acceptInvite] Creating user with team_id:', teamId);
  await client.execute(
    'INSERT INTO users(id, emp_id, name, email, password, password_hash, role, team_id, status, created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
    [id, empId, name, email || null, password || null, passwordHash, inviteRow.role, teamId, 'active', nowIso()]
  );
  // Only mark invite as used if it has an expiration (non-permanent invites)
  if (expiresAt) {
    await client.execute('UPDATE invites SET used = 1 WHERE id = ?', [inviteRow.id]);
  }
  const user = await client.execute('SELECT id, emp_id, name, role, password, team_id FROM users WHERE id = ?', [id]);
  console.log('[acceptInvite] User created successfully:', { id, empId, team_id: user.rows[0].team_id });
  return { user: user.rows[0], teamId };
}



export default async function handler(req: any, res: any) {
  const method = req.method;
  const q = req.query || {};
  const action = q.action || (req.body && req.body.action);

  console.log(`API Request: ${method} - Action: ${action || 'none'}`);

  try {
    const db = getClient(); // Init DB here
    await ensureSchema(db); // Pass db instance
  } catch (e: any) {
    console.error('DB Init/Schema Failed:', e);
    console.error('Error stack:', e.stack);
    return res.status(500).json({ 
      error: 'Database connection failed', 
      details: e.message,
      stack: process.env.NODE_ENV === 'development' ? e.stack : undefined
    });
  }

  const client = getClient(); // Usage for rest of function

  if (action === 'logout' && method === 'POST') {
    try {
      const token = getSessionToken(req);
      if (token) await client.execute('DELETE FROM sessions WHERE token = ?', [token]);
      clearSessionCookie(res);
      return res.status(200).json({ ok: true });
    } catch (e: any) {
      console.error('Logout error:', e);
      return res.status(500).json({ error: 'Logout failed', details: e.message });
    }
  }

  if (action === 'getUsers' && method === 'GET') {
    try {
      const sessionUser = await getSessionUser(req, client);
      const guard = await requireAdmin(res, sessionUser);
      if (guard) return guard;
      const teamId = sessionUser.team_id;
      const r = await client.execute('SELECT id, emp_id, name, role, password, team_id FROM users WHERE team_id = ? ORDER BY name', [teamId]);
      const users = r.rows.map((row: any) => mapUserRow(row));
      return res.status(200).json({ users });
    } catch (e: any) {
      console.error('Get users error:', e);
      return res.status(500).json({ error: 'Failed to fetch users', details: e.message });
    }
  }

  if (action === 'register' && method === 'POST') {
    try {
      const { empId = '', name = '', password = '', role = 'user', email = '', inviteToken } = req.body || {};
      console.log('Register attempt:', { empId, name, role });
      if (role === 'admin') {
        return logBadRequest(res, 'Admin accounts cannot be registered. Use default admin credentials.', { role });
      }
      if (inviteToken) {
        return logBadRequest(res, 'Use acceptInvite for invite-based registration.', { inviteToken: true });
      }
      const sessionUser = await getSessionUser(req, client);
      const teamId = sessionUser?.team_id || DEFAULT_TEAM_ID;
      const teamCount = await client.execute('SELECT COUNT(*) as total FROM users WHERE team_id = ?', [teamId]);
      const total = Number(teamCount.rows[0]?.total || 0);
      if (total >= 35) return res.status(400).json({ error: 'Team user limit reached (35)' });
      const exists = await client.execute('SELECT id FROM users WHERE LOWER(emp_id) = LOWER(?)', [empId]);
      if (exists.rows.length > 0) return res.status(400).json({ error: 'Employee ID already exists' });
      const id = cryptoUUID();
      const passwordHash = password ? hashPassword(password) : null;
      await client.execute(
        'INSERT INTO users(id, emp_id, name, email, password, password_hash, role, team_id, status, created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
        [id, empId, name, email || null, password || null, passwordHash, role, teamId, 'active', nowIso()]
      );
      const r = await client.execute('SELECT id, emp_id, name, role, password, team_id FROM users WHERE id = ?', [id]);
      const row = r.rows[0];
      const user = mapUserRow(row);
      console.log('User registered successfully:', id);
      return res.status(201).json({ user });
    } catch (e: any) {
      console.error('Register error:', e);
      return res.status(500).json({ error: 'Registration failed', details: e.message });
    }
  }

  if (action === 'auth' && method === 'POST') {
    try {
      const { email = '', empId = '', password = '', role = 'user' } = req.body || {};
      console.log('Auth attempt:', { email, empId, role });

      let found;
      if (role === 'admin') {
        // Admin login uses email
        if (!email) return res.status(400).json({ error: 'Email required for admin login' });
        found = await client.execute('SELECT * FROM users WHERE LOWER(email) = LOWER(?) AND role = ?', [email, 'admin']);
      } else {
        // User login uses empId
        if (!empId) return res.status(400).json({ error: 'Employee ID required for user login' });
        found = await client.execute('SELECT * FROM users WHERE LOWER(emp_id) = LOWER(?) AND role = ?', [empId, role]);
      }
      
      if (found.rows.length === 0) {
        console.log('Login failed: Invalid credentials');
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      const row = found.rows[0];
      const passwordHash = row.password_hash as string | undefined;
      const passwordOk = passwordHash ? verifyPassword(password, passwordHash) : row.password === password;
      if (!passwordOk) return res.status(401).json({ error: 'Invalid credentials' });
      
      await createSessionForUser(res, client, row.id as string);
      const user = mapUserRow(row);
      console.log('Login successful:', user.id);
      return res.status(200).json({ user });
    } catch (e: any) {
      console.error('Auth error:', e);
      return res.status(500).json({ error: 'Authentication failed', details: e.message });
    }
  }

  if (action === 'createInvite' && method === 'POST') {
    try {
      const sessionUser = await getSessionUser(req, client);
      const guard = await requireAdmin(res, sessionUser);
      if (guard) return guard;
      const { role = 'user', teamId, expiresInHours } = req.body || {};
      if (!['admin', 'user'].includes(role)) return logBadRequest(res, 'Invalid role', { role });
      let targetTeamId = teamId;
      if (targetTeamId === undefined) targetTeamId = sessionUser.team_id;
      if (targetTeamId === null) targetTeamId = null;
      if (targetTeamId === null && role !== 'admin') return logBadRequest(res, 'New team invites must be admin role', { role });
      const id = cryptoUUID();
      const token = crypto.randomBytes(32).toString('hex');
      const createdAt = nowIso();
      const ttl = Number(expiresInHours || INVITE_TTL_HOURS);
      const expiresAt = new Date(Date.now() + ttl * 3600 * 1000).toISOString();
      await client.execute(
        'INSERT INTO invites(id, team_id, role, token, expires_at, used, created_by, created_at) VALUES(?,?,?,?,?,?,?,?)',
        [id, targetTeamId, role, token, expiresAt, 0, sessionUser.id, createdAt]
      );
      const inviteUrl = `${getBaseUrl(req)}/invite?token=${encodeURIComponent(token)}`;
      return res.status(201).json({ invite: { id, teamId: targetTeamId, role, token, expiresAt, inviteUrl } });
    } catch (e: any) {
      console.error('Create invite error:', e);
      return res.status(500).json({ error: 'Failed to create invite', details: e.message });
    }
  }

  if (action === 'getInvites' && method === 'GET') {
    try {
      const sessionUser = await getSessionUser(req, client);
      const guard = await requireAdmin(res, sessionUser);
      if (guard) return guard;
      const r = await client.execute(
        'SELECT id, team_id, role, token, expires_at, used, created_by, created_at FROM invites WHERE (team_id = ? OR (team_id IS NULL AND created_by = ?)) ORDER BY created_at DESC',
        [sessionUser.team_id, sessionUser.id]
      );
      const baseUrl = getBaseUrl(req);
      const invites = r.rows.map((row: any) => ({
        ...row,
        invite_url: `${baseUrl}/invite?token=${encodeURIComponent(row.token)}`,
        expired: row.expires_at ? new Date(row.expires_at).getTime() <= Date.now() : false
      }));
      return res.status(200).json({ invites });
    } catch (e: any) {
      console.error('Get invites error:', e);
      return res.status(500).json({ error: 'Failed to fetch invites', details: e.message });
    }
  }

  if (action === 'acceptInvite' && method === 'POST') {
    try {
      const { token } = req.body || {};
      if (!token) return logBadRequest(res, 'Invite token required', { action });
      const result = await acceptInviteAndCreateUser(client, token, req.body || {});
      if ((result as any).error) return res.status(400).json({ error: (result as any).error });
      const userRow = (result as any).user;
      await createSessionForUser(res, client, userRow.id as string);
      return res.status(200).json({ user: mapUserRow(userRow) });
    } catch (e: any) {
      console.error('Accept invite error:', e);
      return res.status(500).json({ error: 'Failed to accept invite', details: e.message });
    }
  }

  if (action === 'getJoinTokens' && method === 'GET') {
    try {
      const sessionUser = await getSessionUser(req, client);
      const guard = await requireAdmin(res, sessionUser);
      if (guard) return guard;
      
      // Get permanent join tokens (expires_at IS NULL)
      const r = await client.execute(
        'SELECT i.id, i.team_id, i.role, i.token, t.name as team_name FROM invites i LEFT JOIN teams t ON i.team_id = t.id WHERE i.expires_at IS NULL ORDER BY t.name'
      );
      const baseUrl = getBaseUrl(req);
      const tokens = r.rows.map((row: any) => ({
        teamId: row.team_id,
        teamName: row.team_name,
        token: row.token,
        joinUrl: `${baseUrl}/invite?token=${encodeURIComponent(row.token)}`
      }));
      return res.status(200).json({ tokens });
    } catch (e: any) {
      console.error('Get join tokens error:', e);
      return res.status(500).json({ error: 'Failed to fetch join tokens', details: e.message });
    }
  }

  if (action === 'getEntries' && method === 'GET') {
    const userId = q.userId as string;
    if (!userId) return logBadRequest(res, 'userId required', { action, query: q });
    try {
      const sessionUser = await getSessionUser(req, client);
      if (!sessionUser) return res.status(401).json({ error: 'Authentication required' });
      if (sessionUser.role !== 'admin' && userId !== sessionUser.id) return res.status(403).json({ error: 'Access denied' });
      const teamId = sessionUser.team_id;
      const r = await client.execute('SELECT id, payload, status, date FROM entries WHERE user_id = ? AND team_id = ? ORDER BY date DESC', [userId, teamId]);
      const entries = r.rows.map((row: any) => {
        try {
          return { id: row.id, date: row.date, ...JSON.parse(row.payload || '{}'), status: row.status };
        } catch (e) {
          console.warn('Failed to parse entry payload:', row.id, e);
          return { id: row.id, date: row.date, status: row.status };
        }
      });
      return res.status(200).json({ entries });
    } catch (e) {
      console.error('getEntries error:', e);
      return res.status(500).json({ error: 'Failed to fetch entries', details: String(e) });
    }
  }

  if (action === 'addEntry' && method === 'POST') {
    const { userId, entry } = req.body || {};
    if (!userId || !entry) return logBadRequest(res, 'userId and entry required', { action, body: req.body });
    const sessionUser = await getSessionUser(req, client);
    if (!sessionUser) return res.status(401).json({ error: 'Authentication required' });
    if (sessionUser.role !== 'admin' && userId !== sessionUser.id) return res.status(403).json({ error: 'Access denied' });
    const teamId = sessionUser.team_id;
    await client.execute('INSERT INTO entries(id, user_id, team_id, date, payload, status) VALUES(?,?,?,?,?,?)', [entry.id, userId, teamId, entry.date || new Date().toISOString(), JSON.stringify(entry), entry.status || 'N/A']);
    const r = await client.execute('SELECT id, payload, status, date FROM entries WHERE user_id = ? AND team_id = ? ORDER BY date DESC', [userId, teamId]);
    const entries = r.rows.map((row: any) => ({ id: row.id, date: row.date, ...JSON.parse(row.payload || '{}'), status: row.status }));
    return res.status(201).json({ entries });
  }

  if (action === 'updateEntry' && method === 'PUT') {
    const { userId, entryId, entry } = req.body || {};
    if (!userId || !entryId || !entry) return logBadRequest(res, 'userId, entryId and entry required', { action, body: req.body });
    const sessionUser = await getSessionUser(req, client);
    if (!sessionUser) return res.status(401).json({ error: 'Authentication required' });
    if (sessionUser.role !== 'admin' && userId !== sessionUser.id) return res.status(403).json({ error: 'Access denied' });
    const teamId = sessionUser.team_id;
    await client.execute('UPDATE entries SET payload = ?, status = ? WHERE id = ? AND user_id = ? AND team_id = ?', [JSON.stringify(entry), entry.status || 'N/A', entryId, userId, teamId]);
    const r = await client.execute('SELECT id, payload, status, date FROM entries WHERE user_id = ? AND team_id = ? ORDER BY date DESC', [userId, teamId]);
    const entries = r.rows.map((row: any) => ({ id: row.id, date: row.date, ...JSON.parse(row.payload || '{}'), status: row.status }));
    return res.status(200).json({ entries });
  }

  if (action === 'deleteEntry' && method === 'DELETE') {
    const { userId, entryId } = req.body || {};
    if (!userId || !entryId) return logBadRequest(res, 'userId and entryId required', { action, body: req.body });
    const sessionUser = await getSessionUser(req, client);
    if (!sessionUser) return res.status(401).json({ error: 'Authentication required' });
    if (sessionUser.role !== 'admin' && userId !== sessionUser.id) return res.status(403).json({ error: 'Access denied' });
    const teamId = sessionUser.team_id;
    await client.execute('DELETE FROM entries WHERE id = ? AND user_id = ? AND team_id = ?', [entryId, userId, teamId]);
    const r = await client.execute('SELECT id, payload, status, date FROM entries WHERE user_id = ? AND team_id = ? ORDER BY date DESC', [userId, teamId]);
    const entries = r.rows.map((row: any) => ({ id: row.id, date: row.date, ...JSON.parse(row.payload || '{}'), status: row.status }));
    return res.status(200).json({ entries });
  }

  if (action === 'deleteAllUserEntries' && method === 'DELETE') {
    const { userId } = req.body || {};
    if (!userId) return logBadRequest(res, 'userId required', { action, body: req.body });
    const sessionUser = await getSessionUser(req, client);
    if (!sessionUser) return res.status(401).json({ error: 'Authentication required' });
    if (sessionUser.role !== 'admin' && userId !== sessionUser.id) return res.status(403).json({ error: 'Access denied' });
    const teamId = sessionUser.team_id;
    await client.execute('DELETE FROM entries WHERE user_id = ? AND team_id = ?', [userId, teamId]);
    return res.status(200).json({ entries: [] });
  }

  if (action === 'deleteUser' && method === 'DELETE') {
    const { userId } = req.body || {};
    if (!userId) return logBadRequest(res, 'userId required', { action, body: req.body });
    const sessionUser = await getSessionUser(req, client);
    const guard = await requireAdmin(res, sessionUser);
    if (guard) return guard;
    const teamId = sessionUser.team_id;
    await client.execute('DELETE FROM users WHERE id = ? AND team_id = ?', [userId, teamId]);
    const r = await client.execute('SELECT id, emp_id, name, role, password, team_id FROM users WHERE team_id = ? ORDER BY name', [teamId]);
    const users = r.rows.map((row: any) => mapUserRow(row));
    return res.status(200).json({ users });
  }

  if (action === 'updateStatus' && method === 'PUT') {
    const { userId, entryId, newStatus, reason } = req.body || {};
    if (!userId || !entryId || !newStatus) return logBadRequest(res, 'userId, entryId and newStatus required', { action, body: req.body });
    const sessionUser = await getSessionUser(req, client);
    if (!sessionUser) return res.status(401).json({ error: 'Authentication required' });
    if (sessionUser.role !== 'admin' && userId !== sessionUser.id) return res.status(403).json({ error: 'Access denied' });
    const teamId = sessionUser.team_id;
    // fetch current payload
    const r0 = await client.execute('SELECT payload FROM entries WHERE id = ? AND user_id = ? AND team_id = ?', [entryId, userId, teamId]);
    if (r0.rows.length === 0) return res.status(404).json({ error: 'Entry not found' });
    const payload = JSON.parse(r0.rows[0].payload || '{}');
    if (reason !== undefined) payload.reason = reason;
    await client.execute('UPDATE entries SET payload = ?, status = ? WHERE id = ? AND user_id = ? AND team_id = ?', [JSON.stringify(payload), newStatus, entryId, userId, teamId]);
    const r = await client.execute('SELECT id, payload, status, date FROM entries WHERE user_id = ? AND team_id = ? ORDER BY date DESC', [userId, teamId]);
    const entries = r.rows.map((row: any) => ({ id: row.id, date: row.date, ...JSON.parse(row.payload || '{}'), status: row.status }));
    return res.status(200).json({ entries });
  }

  if (action === 'getAllEntries' && method === 'GET') {
    try {
      const sessionUser = await getSessionUser(req, client);
      const guard = await requireAdmin(res, sessionUser);
      if (guard) return guard;
      const teamId = sessionUser.team_id;
      // Pagination support (backward compatible - defaults to all if not specified)
      const limit = q.limit ? parseInt(q.limit as string, 10) : 1000; // Default max 1000
      const offset = q.offset ? parseInt(q.offset as string, 10) : 0;
      
      // Get total count for pagination metadata
      const countResult = await client.execute('SELECT COUNT(*) as total FROM entries WHERE team_id = ?', [teamId]);
      const total = countResult.rows[0]?.total || 0;
      
      const r = await client.execute(
        'SELECT e.id, e.payload, e.status, e.date, u.name as user_name, u.emp_id as user_emp FROM entries e JOIN users u ON u.id = e.user_id WHERE e.team_id = ? AND u.team_id = ? ORDER BY e.date DESC LIMIT ? OFFSET ?',
        [teamId, teamId, limit, offset]
      );
      const result = r.rows.map((row: any) => {
        try {
          return { id: row.id, date: row.date, ...JSON.parse(row.payload || '{}'), status: row.status, userName: row.user_name, userId: row.user_emp };
        } catch (e) {
          console.warn('Failed to parse entry payload:', row.id, e);
          return { id: row.id, date: row.date, status: row.status, userName: row.user_name, userId: row.user_emp };
        }
      });
      return res.status(200).json({ entries: result, total, limit, offset, hasMore: (offset + limit) < total });
    } catch (e) {
      console.error('getAllEntries error:', e);
      return res.status(500).json({ error: 'Failed to fetch entries', details: String(e) });
    }
  }

  if (action === 'migrateLocal' && method === 'POST') {
    const payload = req.body || {};
    const users = payload.users || [];
    const entriesMap = payload.entries || {};

    try {
      const sessionUser = await getSessionUser(req, client);
      const teamId = sessionUser?.team_id || DEFAULT_TEAM_ID;
      const userIdMap: Record<string, string> = {};

      // Upsert users by emp_id and record mapping from local id -> db id
      for (const u of users) {
        const localId = u.id || cryptoUUID();
        const empId = u.empId || u.emp_id || '';
        const name = u.name || '';
        const password = u.password || '';
        const role = u.role || 'user';
        const email = u.email || '';
        const passwordHash = password ? hashPassword(password) : null;

        // For Turso, use INSERT OR REPLACE since it doesn't support ON CONFLICT
        const upsert = await client.execute(
          `INSERT OR REPLACE INTO users(id, emp_id, name, email, password, password_hash, role, team_id, status, created_at) VALUES(?,?,?,?,?,?,?,?,?,?)`,
          [localId, empId, name, email || null, password || null, passwordHash, role, teamId, 'active', nowIso()]
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
            await client.execute('INSERT INTO entries(id, user_id, team_id, date, payload, status) VALUES(?,?,?,?,?,?)', [e.id, dbUserId, teamId, e.date || new Date().toISOString(), JSON.stringify(e), e.status || 'N/A']);
            entriesInserted++;
          }
        }
      }

      const migrationId = cryptoUUID();
      const createdAt = new Date().toISOString();
      await client.execute('INSERT INTO migrations(id, created_at, migrated_users, migrated_entries, mapping, team_id) VALUES(?,?,?,?,?,?)', [migrationId, createdAt, Object.keys(userIdMap).length, entriesInserted, JSON.stringify(userIdMap), teamId]);
      return res.status(200).json({ migrationId, createdAt, migratedUsers: Object.keys(userIdMap).length, migratedEntries: entriesInserted, mapping: userIdMap });
    } catch (err) {
      console.error('Migration failed', err);
      return res.status(500).json({ error: 'Migration failed', detail: String(err) });
    }
  }

  if (action === 'getMigrations' && method === 'GET') {
    const sessionUser = await getSessionUser(req, client);
    const guard = await requireAdmin(res, sessionUser);
    if (guard) return guard;
    const teamId = sessionUser.team_id;
    const r = await client.execute('SELECT id, created_at, migrated_users, migrated_entries, mapping FROM migrations WHERE team_id = ? ORDER BY created_at DESC LIMIT 50', [teamId]);
    return res.status(200).json({ migrations: r.rows });
  }

  if (action === 'exportMigration' && method === 'GET') {
    const id = q.id as string;
    if (!id) return logBadRequest(res, 'Migration id required', { action, query: q });
    try {
      const sessionUser = await getSessionUser(req, client);
      const guard = await requireAdmin(res, sessionUser);
      if (guard) return guard;
      const teamId = sessionUser.team_id;
      const r = await client.execute('SELECT mapping, created_at FROM migrations WHERE id = ? AND team_id = ?', [id, teamId]);
      if (r.rows.length === 0) return res.status(404).json({ error: 'Migration not found' });
      const mapping = JSON.parse(r.rows[0].mapping || '{}');
      const filename = `migration_${id}_mapping.json`;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.status(200).send(JSON.stringify(mapping, null, 2));
    } catch (e) {
      console.error('exportMigration error:', e);
      return res.status(500).json({ error: 'Failed to export migration', details: String(e) });
    }
  }

  if (action === 'exportMigrationFlat' && method === 'GET') {
    const id = q.id as string;
    const format = (q.format as string) || 'csv';
    if (!id) return logBadRequest(res, 'Migration id required', { action, query: q });
    const sessionUser = await getSessionUser(req, client);
    const guard = await requireAdmin(res, sessionUser);
    if (guard) return guard;
    const teamId = sessionUser.team_id;
    const r = await client.execute('SELECT mapping, created_at FROM migrations WHERE id = ? AND team_id = ?', [id, teamId]);
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

  if (action === 'moveUserToMyTeam' && method === 'POST') {
    try {
      const sessionUser = await getSessionUser(req, client);
      const guard = await requireAdmin(res, sessionUser);
      if (guard) return guard;
      
      const { empId } = req.body || {};
      if (!empId) return res.status(400).json({ error: 'Employee ID required' });
      
      const adminTeamId = sessionUser.team_id;
      
      // Update user's team_id
      const result = await client.execute(
        'UPDATE users SET team_id = ? WHERE LOWER(emp_id) = LOWER(?)',
        [adminTeamId, empId]
      );
      
      // Also update their entries
      await client.execute(
        'UPDATE entries SET team_id = ? WHERE user_id IN (SELECT id FROM users WHERE LOWER(emp_id) = LOWER(?))',
        [adminTeamId, empId]
      );
      
      return res.status(200).json({ 
        success: true, 
        message: `User ${empId} moved to your team`,
        newTeamId: adminTeamId 
      });
    } catch (e: any) {
      console.error('Move user error:', e);
      return res.status(500).json({ error: 'Failed to move user', details: e.message });
    }
  }

  return logBadRequest(res, 'Unknown action or method', { action, method });
}

function cryptoUUID() {
  try { return (globalThis as any).crypto?.randomUUID?.() || crypto.randomUUID(); } catch (e) { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
}
