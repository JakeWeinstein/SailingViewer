-- Phase 4 Migration: Engagement features
-- notifications, bookmarks, and comments.youtube_attachment

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('mention', 'reply', 'captain_response')),
  source_id UUID NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id
  ON notifications(user_id, is_read, created_at DESC);

-- Bookmarks table
CREATE TABLE IF NOT EXISTS bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  timestamp_seconds INTEGER NOT NULL CHECK (timestamp_seconds >= 0),
  video_title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id
  ON bookmarks(user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookmarks_unique
  ON bookmarks(user_id, video_id, timestamp_seconds);

-- Add youtube_attachment to comments (nullable YouTube video ID)
ALTER TABLE comments ADD COLUMN IF NOT EXISTS youtube_attachment TEXT;
