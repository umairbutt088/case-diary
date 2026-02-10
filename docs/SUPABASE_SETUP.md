# Supabase setup for Legal Diary

Follow these steps to connect the app to Supabase so login/signup work.

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in (or create an account).
2. Click **New project**.
3. Pick an organization, name (e.g. `legal-diary`), database password, and region. Create the project.

## 2. Enable Email auth (no confirmation link)

1. In the Supabase Dashboard, open **Authentication** → **Providers**.
2. Ensure **Email** is enabled (it usually is by default).
3. **Turn off "Confirm email"** under the **Email** provider.  
   Then login works as soon as email + password are correct: no link to click. Users can sign up and sign in immediately. If you leave "Confirm email" on, Supabase will block login until the user clicks the link in the signup email.
4. Optionally configure **Email templates** under **Authentication** → **Email Templates**.

## 3. Get your project URL and anon key

1. In the Dashboard, go to **Settings** (gear icon) → **API**.
2. Copy:
   - **Project URL** (e.g. `https://xxxxx.supabase.co`)
   - **anon public** key (under "Project API keys")

## 4. Add env vars to the app

1. In the **project root** (same folder as `package.json`), create a file named **`.env`** (no name before the dot).
2. Put this in it, using your real URL and key:

```env
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

3. Save the file.  
   `.env` is in `.gitignore` — do **not** commit it or share the anon key publicly.

## 5. Restart the dev server

Env vars are read when Metro starts. Restart with a clean cache:

```bash
npx expo start --clear
```

(or `yarn expo start --clear`)

After this, the app should start without the "Missing required env" error and login/signup will use your Supabase project.

## 6. Run database migrations (recommended)

To create the `profiles` table (and auto-create a profile on signup) and the `cases` table (for add-case form data):

1. In Supabase Dashboard go to **SQL Editor**.
2. Run the migrations **in order**: open **`supabase/migrations/001_create_profiles.sql`**, copy its contents, paste into the SQL Editor, and run it. Then do the same for **`supabase/migrations/002_create_cases.sql`**.

For full details (what each migration does, RLS, and how to add new migrations), see **[MIGRATIONS.md](MIGRATIONS.md)**.

See **[AUTH_TABLES_AND_FLOW.md](AUTH_TABLES_AND_FLOW.md)** for a description of auth tables (login/signup flow and the `profiles` table).

---

**Troubleshooting**

- **Still "Missing required env"**

  - Make sure `.env` is in the **project root** (next to `app.json`).
  - Make sure the variable names are exactly `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
  - Restart with `npx expo start --clear`.

- **"Invalid login credentials"**

  - In Supabase: **Authentication** → **Providers** → **Email** must be enabled.
  - For signup, **Confirm email** can be turned off in **Authentication** → **Providers** → **Email** if you don't want email confirmation during development.

- **"Email not confirmed" / "Please check your email..."** even after turning off Confirm email
  - **1.** Make sure **Confirm email** is really **OFF**: the toggle should be to the **left** (off). Save the page.
  - **2.** Accounts that were created **before** you turned it off are still unconfirmed. Confirm that user manually:
    - Go to **Authentication** → **Users**, find the user (e.g. umairbutt111@gmail.com).
    - Open the user → use the **⋮** menu or **Confirm user** (or similar) to mark the email as confirmed.
    - If you don't see that option, run this in **SQL Editor** (replace the email with the user's email):
      ```sql
      update auth.users
      set email_confirmed_at = now(), confirmed_at = now()
      where email = 'umairbutt111@gmail.com';
      ```
  - Then try signing in again.
