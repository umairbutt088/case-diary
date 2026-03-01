-- =============================================================================
-- Legal Diary: Add court tier to saved judges for tier-based filtering
-- =============================================================================

alter table if exists public.judges
  add column if not exists court_tier text;

create index if not exists judges_user_court_tier_idx
  on public.judges (user_id, court_tier);

