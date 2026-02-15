import { createClient } from "@libsql/client";
const client = createClient({
  url: process.env.TURSO_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

// Check invites table
const invites = await client.execute("SELECT id, team_id, token FROM invites WHERE token LIKE 'ADM-%' ORDER BY token");
console.log("\n=== INVITES TABLE ===");
console.log(JSON.stringify(invites.rows, null, 2));

// Check how many teams exist
const teams = await client.execute("SELECT id, name FROM teams");
console.log("\n=== TEAMS TABLE ===");
console.log(JSON.stringify(teams.rows, null, 2));

client.close();
