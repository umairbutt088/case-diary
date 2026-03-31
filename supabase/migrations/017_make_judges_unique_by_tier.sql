-- =============================================================================
-- Legal Diary: Make saved judges unique by (user, name, court tier)
-- =============================================================================
-- Previous uniqueness was only (user_id, lower(trim(name))), which conflicts
-- with tier-based judge flows in the app.

drop index if exists public.judges_user_name_unique;

create unique index if not exists judges_user_name_tier_unique
  on public.judges (
    user_id,
    lower(trim(name)),
    lower(trim(coalesce(court_tier, '')))
  );

-- Also enforce unique saved client names per user (case-insensitive, trimmed).
create unique index if not exists clients_user_name_unique
  on public.clients (user_id, lower(trim(name)));
