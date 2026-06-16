# Supabase sync — setup

This app can persist a single working board (and its image files) per user to your own
Supabase project. Provisioning is a one-time manual step.

1. **Create a Supabase project** at https://supabase.com (or point the CLI at a self-hosted
   instance). Note the **Project URL** and the **`anon` public API key** (Project Settings →
   API). Never use the `service_role` key in the app — it bypasses RLS.

2. **Run the migration** to create the `boards` table, RLS policies, and the Storage bucket.
   Either:
   - CLI: `supabase link --project-ref <ref>` then `supabase db push`, or
   - SQL editor: paste the full contents of
     [`migrations/0001_init_boards.sql`](./migrations/0001_init_boards.sql) and run it.

3. **Confirm the Storage bucket** named `scene-files` exists and is **private** (not public)
   under Storage → Buckets. The migration creates it idempotently.

4. **Enable Email auth** under Authentication → Providers → Email: turn on the Email provider
   and enable magic link / OTP sign-in (the app signs in via `signInWithOtp`).

5. **Configure the app env** (see [`../excalidraw-app/.env.example`](../excalidraw-app/.env.example)).
   Copy these into `.env.local` (or your env of choice):
   - `VITE_APP_SUPABASE_URL` = your Project URL
   - `VITE_APP_SUPABASE_ANON_KEY` = your **anon** public key
   - `VITE_APP_FEATURE_SUPABASE_SYNC=true`

6. **Isolation:** Row Level Security scopes every board row and every Storage object to the
   signed-in user via `auth.uid()` — one user can never read or write another user's boards or
   files.
