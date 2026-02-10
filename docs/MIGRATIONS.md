# Supabase migrations – Legal Diary

This document describes the database migrations used by Legal Diary and how to run or add new ones.

---

## Overview

Migrations are SQL files in `supabase/migrations/`. They run in **numeric order** by filename. Each file is idempotent where possible (`create table if not exists`, `create index if not exists`, etc.) so re-running is safe.

**Run migrations** after creating a Supabase project so the app has the required tables and Row Level Security (RLS) policies.

---

## Migration list (in order)

| File                      | Purpose                                                                    |
| ------------------------- | -------------------------------------------------------------------------- |
| `001_create_profiles.sql` | Profiles table + trigger to create a profile on signup; RLS for profiles.  |
| `002_create_cases.sql`    | Cases table for add-case form data; RLS so users only see their own cases. |

---

## 001 – Profiles

**File:** `supabase/migrations/001_create_profiles.sql`

**Creates:**

- **Table `public.profiles`**
  - `id` (uuid, PK, references `auth.users.id`)
  - `email`, `first_name`, `last_name`, `full_name`, `role`
  - `created_at`, `updated_at`
  - One row per user; `role` in `('user','partner','admin')`.
- **Trigger `on_auth_user_created`**  
  After insert on `auth.users`, inserts a row into `profiles` using signup metadata (e.g. `first_name`, `last_name`, `full_name`, `role`).
- **Function `set_updated_at()`**  
  Used by `updated_at` trigger (and by later migrations).
- **RLS on `profiles`**
  - Users can **select** and **update** only their own row (`auth.uid() = id`).
  - **Insert** is disallowed for users (only the trigger inserts).

**Dependencies:** None (first migration).

---

## 002 – Cases

**File:** `supabase/migrations/002_create_cases.sql`

**Creates:**

- **Table `public.cases`**
  - `id` (uuid, PK, default `gen_random_uuid()`)
  - `user_id` (uuid, required, references `auth.users.id`) – case owner
  - **Step 1:** `case_title`, `case_number`, `case_type`, `case_sub_type`, `petitioner_name`, `respondent_name`
  - **Step 2:** `court_tier`, `court_name`, `court_room`, `judge_name`
  - **Step 3:** `my_client_is` (petitioner/respondent), `linked_client_id`
  - **Step 4:** `date_of_filing`, `next_hearing_date`, `current_status`, `next_status`, `notes`
  - `created_at`, `updated_at`
- **Indexes:** `user_id`, `next_hearing_date`, `created_at desc`
- **RLS on `cases`**
  - Users can **select**, **insert**, **update**, and **delete** only rows where `auth.uid() = user_id`.
- **Trigger**  
  `updated_at` set via `set_updated_at()` on update.

**Dependencies:** Requires `001_create_profiles.sql` (for `set_updated_at()`). If you run migrations in order, this is satisfied.

---

## How to run migrations

### Option A: Supabase Dashboard (SQL Editor)

1. Open your project at [supabase.com](https://supabase.com) → **SQL Editor**.
2. Run migrations **in order**:
   - Open `supabase/migrations/001_create_profiles.sql`, copy its full contents, paste into the editor, click **Run**.
   - Then open `supabase/migrations/002_create_cases.sql`, copy, paste, **Run**.

Re-running is safe because of `if not exists` and `drop trigger if exists` where used.

### Option B: Supabase CLI

From the **project root** (where `package.json` is):

```bash
npx supabase db push
```

Or, if Supabase CLI is installed globally:

```bash
supabase db push
```

This applies all migrations in `supabase/migrations/` that have not yet been applied to the linked remote database.

**Linking a project (one-time):**

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
```

`YOUR_PROJECT_REF` is in the project URL: `https://YOUR_PROJECT_REF.supabase.co`.

---

## Adding a new migration (future reference)

1. **Create a new file** in `supabase/migrations/` with the next number and a short name, e.g.  
   `003_add_clients_table.sql`
2. **Keep it idempotent** where possible:
   - `create table if not exists`
   - `create index if not exists`
   - `drop trigger if exists ... ; create trigger ...`
   - For "alter table add column", you can use `do $$ ... end $$` to check if the column exists before adding.
3. **Document it** in this file: add a row to the "Migration list" table and a section like "003 – …" describing tables, indexes, RLS, and dependencies.
4. **Run it** via Dashboard (paste and run) or `supabase db push`.

---

## Quick reference: tables

| Table      | Key columns / purpose                                      |
| ---------- | ---------------------------------------------------------- |
| `profiles` | One per user; `id` = `auth.users.id`; name, email, role.   |
| `cases`    | One per case; `user_id` = owner; all add-case form fields. |

Both tables use RLS so each user only accesses their own data.
