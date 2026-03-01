-- =============================================================================
-- Legal Diary: Add optional court room address to saved judges
-- =============================================================================

alter table if exists public.judges
  add column if not exists court_room_address text;

