Deployment checklist for Vercel

1. Environment variables
   - DATABASE_URL (or NEON_DATABASE_URL): your Neon Postgres connection string
   - GENAI_API_KEY: (optional) Google GenAI key if using AI features

2. Prepare repository
   - Commit and push your branch (e.g., `add-server-logging`) to your remote (GitHub)

3. Deploy on Vercel
   - Import the repo in Vercel (if not already connected) and enable Preview/Production deployments
   - Add the environment variables in Project Settings → Environment Variables
   - Push to main (or merge your branch) to trigger a production deployment, or use `npx vercel --prod`

4. Troubleshooting
   - Check Project → Deployments → Functions Logs for server-side logs
   - Look for "Bad Request" console.warn entries from `api/storage.ts` for missing params (they will include helpful details)

Notes
- Passwords are stored in plaintext by design for the current release; consider migrating to hashed passwords for production.
- Ensure `pg` and `archiver` are present in `package.json` so Vercel installs them during build.