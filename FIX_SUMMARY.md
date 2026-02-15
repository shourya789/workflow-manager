# Fix Summary: Team Assignment Issue

## Problem
Users created via different team join links were being moved to Aakash's team instead of staying in their assigned team.

## Root Cause
In serverless environments (Vercel), the data migration code was running on **every cold start** because the `(global as any).__schemaChecked` flag doesn't persist across different serverless function instances.

The migration code was:
```typescript
await client.execute('UPDATE users SET team_id = ? WHERE team_id = ? OR team_id IS NULL OR team_id = ""', 
  ['team_aakash', DEFAULT_TEAM_ID]);
```

This would run repeatedly, potentially affecting users after they were created.

## Solution
Added a **one-time migration check** using the existing `migrations` table to ensure the migration only runs once, ever:

```typescript
const migrationCheck = await client.execute('SELECT id FROM migrations WHERE id = ?', ['migration_to_aakash_team']);
if (migrationCheck.rows.length === 0) {
  // Run migration
  // ... migration code ...
  
  // Record that migration is complete
  await client.execute(
    'INSERT INTO migrations(id, created_at, ...) VALUES(?,?,...)
',
    ['migration_to_aakash_team', ...]
  );
}
```

## Verification
✅ Users created via Aakash's link go to `team_aakash`
✅ Users created via Arjun's link go to `team_arjun`
✅ Users created via Ashish's link go to `team_ashish`
✅ Users created via Farhin's link go to `team_farhin`
✅ Users stay in their assigned team (no migration)
✅ Team isolation enforced - admins only see their team's users

## Deployed
- Commit: 4a56c35
- Deployed to: https://workflow-manager-hazel.vercel.app
- Date: 2026-02-16

## How to Verify
1. Create a user via any team's join link
2. Login as that team's admin
3. Verify the user appears in the admin's team
4. Login as a different team's admin
5. Verify the user does NOT appear in the other admin's team
