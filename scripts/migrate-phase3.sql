-- Phase 3 schema migrations
-- Idempotent: safe to run multiple times

-- comments: editing support
ALTER TABLE comments ADD COLUMN IF NOT EXISTS is_edited BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- reference_videos: tag support
ALTER TABLE reference_videos ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS reference_videos_tags_idx ON reference_videos USING gin(tags);

-- sessions: closed/archived state
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
