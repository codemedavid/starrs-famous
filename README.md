# Beracah Cafe

## Lalamove delivery setup

API secrets must stay on the server. Set the following environment variables (e.g., in `.env`) before running:

```
VITE_LALAMOVE_API_KEY=pk_xxx
VITE_LALAMOVE_API_SECRET=sk_xxx
VITE_LALAMOVE_FUNCTION_URL=http://localhost:54321/functions/v1/lalamove
```

Deploy the `supabase/functions/lalamove` Edge Function so that the front-end can call `/quote` and `/order` without touching the private keys. The remaining delivery metadata and store address are still editable via the Site Settings page.
