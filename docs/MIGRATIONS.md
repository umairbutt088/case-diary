# Supabase migrations – Legal Diary

This document describes the database migrations used by Legal Diary and how to run or add new ones.

---

## Overview

Migrations are SQL files in `supabase/migrations/`. They run in **numeric order** by filename prefix (`001`, `002`, …). Each file is idempotent where possible (`create table if not exists`, `drop … if exists`, etc.) so re-running individual statements is usually safe.

**Run migrations** after creating a Supabase project so the app has the required tables and Row Level Security (RLS) policies.

> **Do not renumber migrations that are already applied** on a remote database. Supabase tracks applied files by name in `supabase_migrations.schema_migrations`. Renaming `030_…` to `029_…` on a deployed project will cause drift.

---

## Migration list (in order)

| # | File | Purpose |
|---|------|---------|
| 001 | `001_create_profiles.sql` | Profiles table, signup trigger, `set_updated_at()`, profile RLS |
| 002 | `002_create_cases.sql` | Cases table and owner-scoped RLS |
| 003 | `003_create_judges.sql` | Saved judges per user |
| 004 | `004_create_clients.sql` | Clients table |
| 005 | `005_add_linked_client_name.sql` | `linked_client_name` on cases |
| 006 | `006_clients_add_detail_columns.sql` | Extra client detail columns |
| 007 | `007_profiles_add_contact_avatar.sql` | Profile phone, address, avatar |
| 008 | `008_add_court_room_address_to_judges.sql` | Judge court room address |
| 009 | `009_add_court_tier_to_judges.sql` | Judge court tier + index |
| 010 | `010_add_cause_list_notifications.sql` | Cause-list reminder columns on profiles |
| 011 | `011_set_pakistan_timezone_default.sql` | Default timezone for profiles |
| — | *(012, 013 unused)* | Numbers skipped in repo history |
| 014 | `014_create_court_tiers.sql` | Court tiers table |
| 015 | `015_create_case_hearings.sql` | Case hearing history |
| 016 | `016_add_update_policy_to_judges.sql` | Judges update RLS |
| 017 | `017_make_judges_unique_by_tier.sql` | Unique judge per user per tier |
| 018 | `018_create_case_documents.sql` | Case documents table + storage policies |
| — | *(019 unused)* | Number skipped in repo history |
| 020 | `020_add_soft_delete_to_cases.sql` | `deleted_at` soft delete on cases |
| 021 | `021_delete_own_account.sql` | Account deletion RPC |
| 022 | `022_subordinate_access.sql` | Subordinate role, `subordinate_links`, RLS helpers |
| 023 | `023_subordinate_link_rpc.sql` | `create_subordinate_link_by_email` RPC |
| 024 | `024_split_add_and_edit_case_permissions.sql` | `can_add_cases`; split add vs edit in RLS |
| 025 | `025_subordinate_cannot_delete_cases.sql` | Only owners may hard-delete cases |
| 026 | `026_subordinate_delete_cases_permission.sql` | `can_delete_cases` permission |
| 027 | `027_add_disposed_to_cases.sql` | Disposed case flag |
| 028 | `028_subordinate_dispose_cases_permission.sql` | `can_dispose_cases`; updates add-subordinate RPC |
| — | *(029 unused)* | Invite feature was never committed as a create migration |
| 030 | `030_drop_subordinate_invites.sql` | Drop invite-by-link table/RPCs (safe if never created) |
| 031 | `031_subordinate_link_delete.sql` | Trigger: reset profile role when link is deleted |
| 032 | `032_subordinate_single_supervisor.sql` | One subordinate per supervisor; no reassignment |

**Next migration:** use `033_<name>.sql`.

---

## Intentional numbering gaps

These numbers have **no file** in the repo. Supabase only requires unique, sortable names — not a contiguous sequence. Do **not** insert retroactive files for 012, 013, 019, or 029 on a database that already ran later migrations.

| Gap | Notes |
|-----|-------|
| 012, 013 | Early court-tier work shipped as `014` |
| 019 | Soft delete shipped as `020` |
| 029 | Invite-by-link was removed in `030` without a matching create migration |

---

## Subordinate migrations (022–032)

1. **022** – Core model: one supervisor per subordinate, permission flags, `can_access_owner_data()`.
2. **023** – Add subordinate by email RPC.
3. **024** – `can_add_cases` column; updates RLS and RPC.
4. **025** – Subordinates cannot trash/delete cases unless owner.
5. **026** – Optional `can_delete_cases` for subordinates.
6. **027** – `disposed` on cases.
7. **028** – Optional `can_dispose_cases`; updates `create_subordinate_link_by_email`.
8. **030** – Removes experimental invite flow (`subordinate_invites`).
9. **031** – On link delete, set `profiles.role` back to `'user'`.
10. **032** – One subordinate per supervisor; trigger blocks reassignment.

Later migrations **replace** `create_subordinate_link_by_email` — always run the full chain on fresh databases.

---

## How to run migrations

### Option A: Supabase Dashboard (SQL Editor)

1. Open your project at [supabase.com](https://supabase.com) → **SQL Editor**.
2. Run each file in **numeric order** (copy full file contents → Run).

### Option B: Supabase CLI

From the project root:

```bash
npx supabase link --project-ref YOUR_PROJECT_REF   # one-time
npx supabase db push
```

This applies only migrations not yet recorded in `supabase_migrations.schema_migrations`.

---

## Adding a new migration

1. Create `supabase/migrations/033_short_description.sql` (use the next free number).
2. Keep it idempotent where possible.
3. Add a row to the table above in this file.
4. Run via Dashboard or `supabase db push`.

---

## Quick reference: main tables

| Table | Purpose |
|-------|---------|
| `profiles` | One per user; role, contact, reminders |
| `cases` | Case records; `user_id` = owner |
| `clients` | Client directory per owner |
| `judges` | Saved judges per owner |
| `court_tiers` | Court tier list per owner |
| `case_hearings` | Hearing / proceeding history |
| `case_documents` | Document metadata per case |
| `subordinate_links` | Supervisor ↔ subordinate permissions (one link per subordinate) |

All user-owned tables use RLS so each account only accesses permitted rows. Subordinates access owner data through `subordinate_links` and `can_access_owner_data()`.
