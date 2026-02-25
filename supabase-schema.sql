-- Run this in your Supabase SQL editor (fresh setup)

CREATE TABLE sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  label TEXT NOT NULL,
  videos JSONB DEFAULT '[]',   -- [{id, name, note?}]
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL,
  video_title TEXT NOT NULL,
  author_name TEXT NOT NULL,
  timestamp_seconds INTEGER,
  comment_text TEXT NOT NULL,
  send_to_captain BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX comments_session_id_idx ON comments(session_id);
CREATE INDEX comments_video_id_idx ON comments(video_id);

-- ─── Migration (if you already ran the old schema) ───
-- ALTER TABLE sessions DROP COLUMN IF EXISTS folder_id;
-- ALTER TABLE sessions ADD COLUMN IF NOT EXISTS videos JSONB DEFAULT '[]';
-- CREATE TABLE IF NOT EXISTS comments ( ... ); -- run the block above
-- DROP TABLE IF EXISTS submissions;
