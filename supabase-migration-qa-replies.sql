-- Migration: Add Q&A support and threaded replies to comments
-- Run this against your Supabase database

-- 1. Add parent_id for threaded replies
ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES comments(id) ON DELETE CASCADE;

-- 2. Make video fields nullable for Q&A posts (comments not tied to a video)
ALTER TABLE comments
  ALTER COLUMN video_id DROP NOT NULL,
  ALTER COLUMN video_title DROP NOT NULL,
  ALTER COLUMN session_id DROP NOT NULL;

-- 3. Index for fast reply lookups
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);

-- 4. Index for Q&A queries (top-level posts with no video)
CREATE INDEX IF NOT EXISTS idx_comments_qa ON comments(video_id, parent_id) WHERE video_id IS NULL AND parent_id IS NULL;

-- 5. RPC function to count replies per parent comment
CREATE OR REPLACE FUNCTION comment_reply_counts(parent_ids UUID[])
RETURNS TABLE(parent_id UUID, count BIGINT)
LANGUAGE sql STABLE
AS $$
  SELECT c.parent_id, COUNT(*)::BIGINT
  FROM comments c
  WHERE c.parent_id = ANY(parent_ids)
  GROUP BY c.parent_id;
$$;
