# Database Connection Fix Plan

## Tasks
- [x] Replace all `pool.query` with `client.execute` in api/storage.ts
- [x] Change PostgreSQL placeholders ($1, $2) to Turso placeholders (?)
- [x] Adjust transaction handling in migrateLocal action for Turso
- [x] Update rowCount checks to rows.length for Turso
- [x] Test the API after changes

## Details
- The api/storage.ts file has mixed database syntax causing "Database connection failed" errors
- Need to ensure all data is saved in Turso only
- Test script works because it uses correct Turso syntax
