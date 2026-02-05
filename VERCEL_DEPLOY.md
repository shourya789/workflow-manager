Deployment notes for Vercel

Quick steps ✅

1. Set environment variable in your Vercel project settings:
   - Name: GEMINI_API_KEY
   - Value: <your Google Generative Language API key>
   - Add to Production and Preview as needed

2. Ensure `build` script in `package.json` is `vite build` (already configured).

3. Deploy the project to Vercel (connect the Git repo or import the project).

4. The client makes requests to `/api/parse` which is a serverless function implemented in `api/parse.ts`. The function runs the GenAI SDK server-side and returns sanitized JSON. This keeps your API key secure.

Local testing 🧪

- Locally you can set the environment variable and run the dev server:
  - On Windows PowerShell: $Env:GEMINI_API_KEY = "your_key_here"; npm run dev
- **Important:** Standard `npm run dev` will NOT serve the API functions. You must use Vercel CLI.

- You can also run Vercel locally to emulate the serverless function:
- Run Vercel locally to emulate the serverless function:
  - Install Vercel CLI: npm i -g vercel
  - Set `GEMINI_API_KEY` in your `.env.local` file.
  - Run: vercel dev

Deploying with Vercel CLI (optional):

- To deploy directly from your machine with a token, set an environment variable named VERCEL_TOKEN and run:
  - npx vercel --prod
  - or: npm run vercel:deploy

- When using CLI, ensure GENAI_API_KEY is configured in your Vercel project or passed via the deployment environment.

Notes & Troubleshooting ⚠️
- Do NOT expose the API key to the browser (don't use VITE_ prefixed keys for this). Use `GENAI_API_KEY` server-side instead.
- If you get a 400 response, check that the key is valid and that the model is accessible to your account.
- Check Vercel Function logs for server errors and adjust the model or quota as needed.

If you'd like, I can also:
- Add a clearer UI banner that alerts you if parse requests repeatedly fail, or
- Add retries / backoff on the server for transient errors.
