# Beracah Cafe

## Lalamove delivery setup

API secrets must stay on the server. Set the following environment variables (e.g., in `.env`) before running:

```
VITE_LALAMOVE_API_KEY=pk_xxx
VITE_LALAMOVE_API_SECRET=sk_xxx
VITE_LALAMOVE_FUNCTION_URL=http://localhost:54321/functions/v1/lalamove
```

Deploy the `supabase/functions/lalamove` Edge Function or use the new Vercel API route at `src/api/lalamove.ts`. Both proxies sign requests with `LALAMOVE_API_KEY`/`LALAMOVE_API_SECRET` (stored as server secrets) and expose `/quote` and `/order`. Make sure your app and hosting env also trend `VITE_SUPABASE_ANON_KEY` for whichever functions you keep, and point `VITE_LALAMOVE_FUNCTION_URL` at the deployed proxy URL (e.g., `https://<your-app>.vercel.app/api/lalamove`). The remaining delivery metadata and store address remain editable via the Site Settings page.
