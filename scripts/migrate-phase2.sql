-- TheoryForm Phase 2 Migration: Drive → YouTube-only
-- Run this against an existing v2 database (post migrate.sql).
-- Safe to run multiple times (idempotent where possible).

-- ─── session_videos: rename drive_file_id → youtube_video_id ─────────────────

ALTER TABLE session_videos RENAME COLUMN drive_file_id TO youtube_video_id;

-- ─── reference_videos: drop old type constraint, add YouTube-only constraint ──

ALTER TABLE reference_videos DROP CONSTRAINT IF EXISTS reference_videos_type_check;

ALTER TABLE reference_videos
  ADD CONSTRAINT reference_videos_type_check CHECK (type IN ('youtube'));

ALTER TABLE reference_videos ALTER COLUMN type SET DEFAULT 'youtube';

-- Migrate any existing drive-type rows to youtube
-- (video_ref already stores the YouTube video ID for rows imported via the old
--  YouTube tab; drive rows will need manual review but we set the type here
--  so the constraint is satisfied)
UPDATE reference_videos SET type = 'youtube' WHERE type = 'drive';
