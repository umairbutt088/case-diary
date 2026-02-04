# Why no row in `profiles` after signup (exploration, no code changes)

You signed up, were navigated to tabs (so a session was created and a row exists in `auth.users`), but no row appeared in `public.profiles`. Below is why that can happen and how it fits with “unable to login”.

---

## How it’s supposed to work

1. **App** calls `supabase.auth.signUp({ email, password, options: { data: { first_name, last_name, full_name, role } } })`.
2. **Supabase Auth** inserts one row into **`auth.users`** and returns a session.
3. A **database trigger** `on_auth_user_created` is defined to run **AFTER INSERT** on **`auth.users`** and call **`public.handle_new_user()`**.
4. **`handle_new_user()`** (in `supabase/migrations/001_create_profiles.sql`) does a single **`INSERT`** into **`public.profiles`** using `NEW.id`, `NEW.email`, and `NEW.raw_user_meta_data` (first_name, last_name, full_name, role).

So if the trigger exists and runs successfully, every new row in `auth.users` should get exactly one row in `public.profiles`.

---

## Why you might see no profile row

### 1. Migration not run (most likely)

If **`001_create_profiles.sql`** was never run in **this** Supabase project (or was run in a different project):

- The table **`public.profiles`** may not exist, or exists without the trigger.
- The trigger **`on_auth_user_created`** on **`auth.users`** does **not** exist.
- So when Auth inserts into `auth.users`, no trigger runs → **no insert into `profiles`**.

**Check:** In Supabase Dashboard → **Table Editor**, confirm that **`public.profiles`** exists and has the expected columns. In **SQL Editor**, run:

```sql
select tgname from pg_trigger where tgrelid = 'auth.users'::regclass;
```

If `on_auth_user_created` is not listed, the trigger was never created (or was dropped).

---

### 2. Migration run after this user was created

If you ran **`001_create_profiles.sql`** **after** this signup:

- At signup time the trigger did **not** exist.
- So that specific user’s insert into `auth.users` did **not** fire the trigger → **no profile row for that user**.
- Any **new** signups after the migration should get a profile row.

So “no profile for this user” can simply be timing: trigger didn’t exist when this user was created.

---

### 3. Trigger runs but insert fails (RLS / permissions)

The trigger function is defined with **`SECURITY DEFINER`** and **`set search_path = public`**, so it runs with the privileges of the **function owner** (whoever ran the migration, often `postgres` or the project owner), not the role that inserted into `auth.users`.

- **RLS on `public.profiles`:** There is a policy that forbids normal inserts: **`"No insert by users (trigger only)"`** with **`WITH CHECK (false)`**. So only the trigger is supposed to insert. For that to work, the trigger’s insert must run as a role that **bypasses RLS** (e.g. table owner or superuser). In typical Supabase setups, the migration runs as such a role, so the trigger’s insert **would** bypass RLS and succeed.
- If in your project the function owner is **not** a superuser and **not** the table owner, the trigger’s insert could be **blocked by RLS**. Then the trigger would **raise an error**. In PostgreSQL, a trigger that raises **rolls back the whole transaction**, including the insert into `auth.users`. So you would **not** get a user or a session; you would not be “navigated to tabs.”  
  Since you **were** navigated to tabs, the `auth.users` insert committed, so either:
  - The trigger didn’t run (no trigger / wrong timing), or
  - The trigger ran and the insert succeeded (then a profile row should exist, unless you’re looking at another DB/project).

So for “user exists but no profile,” RLS is only plausible if the trigger somehow ran in a context that both bypassed rollback and failed the insert (e.g. different Supabase internals), which is less common. The simpler explanation is still: **trigger not present (or not present at signup time)**.

---

### 4. Wrong project or database

If the app’s **`.env`** points at **Project A** but you’re inspecting **`public.profiles`** in **Project B** (or a different branch), you’ll see no row for that user even if the trigger ran in A.  
Worth confirming that the project and database you’re querying are the same as the one the app uses (same `EXPO_PUBLIC_SUPABASE_URL`).

---

### 5. “Unable to login” vs “no profile”

Login itself (**`signInWithPassword`**) uses only **`auth.users`** (and session). It does **not** read **`public.profiles`**. So:

- **No row in `profiles`** does **not** by itself prevent login.
- If you truly “cannot login,” the cause is usually something else (e.g. wrong password, “Email not confirmed,” or another auth error). The missing profile row is a separate issue.
- If by “unable to login” you mean something else (e.g. app expects a profile and blocks or errors when it’s missing), then the fix is either to ensure the profile exists (trigger run at signup) or to change the app so it doesn’t require a profile for login.

---

## Summary

| Likely cause                      | What to check / do                                                                                                                                                                  |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Migration never run**           | Confirm `public.profiles` exists and trigger `on_auth_user_created` exists on `auth.users`. If not, run `001_create_profiles.sql` in this project.                                  |
| **Migration run after this user** | That user will never get a profile from the trigger. Manually insert a row in `public.profiles` for their `auth.users.id`, or create a new account after the migration is in place. |
| **Wrong project**                 | Ensure you’re looking at the same Supabase project (and DB) the app uses.                                                                                                           |
| **Login failing**                 | Treat separately from “no profile”; check auth error message and Supabase Auth settings (e.g. confirm email).                                                                       |

No code changes were made; this is an exploration of why the profile row might be missing and how it relates to login.
