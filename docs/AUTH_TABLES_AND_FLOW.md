# Auth tables and flow (login / signup)

This document describes the database tables used for authentication and how signup/login work in Legal Diary.

---

## 1. Tables overview

Supabase provides **Auth** out of the box. The app uses two logical “tables” for auth:

| Where             | Table / concept         | Purpose                                                                                                                 |
| ----------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Supabase Auth** | `auth.users` (built-in) | Stores identities: email, encrypted password hash, metadata. Managed by Supabase; you don’t create this table.          |
| **Your project**  | `public.profiles`       | One row per user: app-specific data (email, first_name, last_name, full_name, role). Created by a DB trigger on signup. |

There are no separate “login” or “signup” tables. **Signup** inserts a row into `auth.users` (and our trigger then creates a row in `public.profiles`). **Login** only reads from `auth.users` (via Supabase Auth API); no extra tables are required.

---

## 2. `auth.users` (Supabase Auth)

- **Managed by Supabase.** You do not create or migrate this table.
- Stores:
  - `id` (uuid) – primary key
  - `email`, `encrypted_password`
  - `email_confirmed_at`, `confirmed_at`
  - `raw_user_meta_data` (jsonb) – e.g. `first_name`, `last_name`, `full_name`, `role` passed from the app on signup
  - `created_at`, `updated_at`, etc.
- Signup in the app calls `supabase.auth.signUp({ email, password, options: { data: { first_name, last_name, full_name, role: 'user' } } })`. That creates a row in `auth.users` and stores those fields in `raw_user_meta_data`.
- Login calls `supabase.auth.signInWithPassword({ email, password })`; Supabase checks credentials against `auth.users` and returns a session (no extra tables).

---

## 3. `public.profiles` (your table)

Used for app-level profile data and optional role-based logic.

### 3.1 Schema

| Column       | Type        | Description                                                             |
| ------------ | ----------- | ----------------------------------------------------------------------- |
| `id`         | uuid (PK)   | Same as `auth.users.id`; one-to-one with the auth user.                 |
| `email`      | text        | Copy of user’s email (optional; can also read from `auth.users`).       |
| `first_name` | text        | First name (from signup).                                               |
| `last_name`  | text        | Last name (from signup).                                                |
| `full_name`  | text        | Display name: from signup or `first_name` + `last_name`.                |
| `role`       | text        | `'user'`, `'partner'`, or `'admin'` (for future role-based routing/UI). |
| `created_at` | timestamptz | Set on insert.                                                          |
| `updated_at` | timestamptz | Updated on every update.                                                |

### 3.2 How rows are created (no manual “signup table”)

- You do **not** insert into `profiles` from the app on signup.
- A **database trigger** runs on `auth.users` after insert and creates the corresponding `profiles` row:
  - Reads `email`, `first_name`, `last_name`, `full_name`, `role` from `raw_user_meta_data` (default role `'user'` if not provided).
  - Inserts one row into `public.profiles` with that data.

So: **one signup** → one row in `auth.users` → trigger → one row in `public.profiles`.

### 3.3 Creating the table and trigger

Run the migration in your Supabase project:

1. Open **Supabase Dashboard** → your project → **SQL Editor**.
2. Copy the contents of **`supabase/migrations/001_create_profiles.sql`** from this repo.
3. Paste into the SQL Editor and click **Run**.

That file:

- Creates `public.profiles` with the columns above (including `first_name`, `last_name`).
- Creates the trigger `on_auth_user_created` on `auth.users` that inserts into `profiles`.
- Enables RLS and adds policies so users can only read/update their own profile (no direct insert from the app; only the trigger inserts).

---

## 4. Signup and login flow (no separate “login/signup tables”)

### Signup

1. User submits first name, last name, email, password, confirm password, and accepts terms in the app.
2. App validates (e.g. passwords match, email format, min length, terms accepted) then calls `supabase.auth.signUp({ email, password, options: { data: { first_name, last_name, full_name, role: 'user' } } })`.
3. Supabase inserts a row into `auth.users` and returns a session.
4. **Trigger** `on_auth_user_created` runs and inserts one row into `public.profiles` (id, email, full_name, role).
5. App does **not** navigate manually; **AuthNavigator** sees the new session and redirects to the main app (e.g. `/(tabs)`).

### Login

1. User submits email + password.
2. App calls `supabase.auth.signInWithPassword({ email, password })`.
3. Supabase checks credentials against `auth.users` and returns a session (no `profiles` read required for login).
4. AuthNavigator sees the session and redirects to the main app.
5. Elsewhere in the app you can load `public.profiles` by `auth.uid()` for role or display name.

### Session and redirects

- Session is stored in **AsyncStorage** (Supabase client is configured with `auth.storage`).
- **AuthNavigator** is the single place that reacts to auth state and routes:
  - Authenticated → main app (`/(tabs)`).
  - Not authenticated + onboarding not completed → onboarding screen.
  - Not authenticated + onboarding completed → login screen.

---

## 5. Signup form fields and metadata

The signup screen collects: **first name**, **last name**, **email**, **password**, **confirm password**, and **terms acceptance**. The app sends name and role in `options.data`:

```ts
await supabase.auth.signUp({
  email: trimmedEmail,
  password,
  options: {
    data: {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      full_name: `${firstName} ${lastName}`.trim(),
      role: "user", // or 'partner' / 'admin'
    },
  },
});
```

The trigger copies `first_name`, `last_name`, `full_name`, and `role` from `raw_user_meta_data` into `public.profiles`.

---

## 6. Summary

| Concept          | Table / storage                       | When it’s used                                                                                            |
| ---------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Signup**       | `auth.users` (+ trigger → `profiles`) | `signUp()` creates user; trigger creates profile.                                                         |
| **Login**        | `auth.users` only                     | `signInWithPassword()` checks credentials.                                                                |
| **Profile data** | `public.profiles`                     | After login, for role, name, etc. (e.g. `supabase.from('profiles').select().eq('id', user.id).single()`). |

There are no separate “signup” or “login” tables; signup and login are implemented with Supabase Auth (`auth.users`) and one app table (`public.profiles`) created and documented here.
