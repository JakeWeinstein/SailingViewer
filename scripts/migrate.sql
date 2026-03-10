-- TheoryForm — One-time migration from v1 to v2 schema
-- Run this in the Supabase SQL editor against an existing database.
-- After running this, also run: npx tsx scripts/migrate.ts to get the seed captain INSERT.
--
-- What this does:
--   1. Creates new tables (session_videos, app_config) if they do not exist
--   2. Alters users table to add new columns and update role CHECK constraint
--   3. Truncates sessions (CASCADE), comments, and users — fresh start
--   4. Drops the legacy sessions.videos JSONB column
--   5. Adds folder_id to articles if missing
--   6. Inserts the invite code into app_config
--
-- What is preserved: reference_folders, reference_videos, articles

-- ─── 1. Create new tables ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS session_videos (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id     UUID        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  drive_file_id  TEXT        NOT NULL,
  title          TEXT        NOT NULL,
  position       INTEGER     NOT NULL DEFAULT 0,
  note           TEXT,
  note_timestamp INTEGER,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS session_videos_session_id_idx ON session_videos(session_id);

CREATE TABLE IF NOT EXISTS app_config (
  key        TEXT        PRIMARY KEY,
  value      TEXT        NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 2. Alter users table ────────────────────────────────────────────────────

-- Drop old role constraint (two-role) and add the new three-role constraint
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users
  ADD CONSTRAINT users_role_check CHECK (role IN ('captain', 'contributor', 'viewer'));

-- Change default role to 'viewer'
ALTER TABLE users
  ALTER COLUMN role SET DEFAULT 'viewer';

-- Add new columns if they don't exist
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_active            BOOLEAN     NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_seed              BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_login_at        TIMESTAMPTZ;

-- ─── 3. Wipe sessions, comments, users ──────────────────────────────────────
-- CASCADE on sessions also truncates anything referencing sessions via FK.
-- We truncate comments separately first to avoid FK ordering issues.

TRUNCATE TABLE comments RESTART IDENTITY CASCADE;
TRUNCATE TABLE sessions RESTART IDENTITY CASCADE;
TRUNCATE TABLE users    RESTART IDENTITY CASCADE;

-- ─── 4. Drop legacy sessions.videos JSONB column ────────────────────────────

ALTER TABLE sessions
  DROP COLUMN IF EXISTS videos;

-- ─── 5. Add folder_id to articles if missing ────────────────────────────────

ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES reference_folders(id) ON DELETE SET NULL;

-- ─── 6. Seed invite code ─────────────────────────────────────────────────────

INSERT INTO app_config (key, value)
VALUES ('invite_code', gen_random_uuid()::text)
ON CONFLICT (key) DO NOTHING;
