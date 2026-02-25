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

-- Reference videos — permanently available, not tied to a session
CREATE TABLE reference_videos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'drive' CHECK (type IN ('drive', 'youtube')),
  video_ref TEXT NOT NULL,   -- Drive file ID or YouTube video ID
  note TEXT,
  note_timestamp INTEGER,    -- seconds
  folder_id TEXT,            -- optional grouping
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contributor user accounts (for username/password auth)
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'contributor' CHECK (role IN ('captain', 'contributor')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX users_username_idx ON users(username);

-- ─── Migration (if you already ran the old schema) ───
-- ALTER TABLE sessions DROP COLUMN IF EXISTS folder_id;
-- ALTER TABLE sessions ADD COLUMN IF NOT EXISTS videos JSONB DEFAULT '[]';
-- CREATE TABLE IF NOT EXISTS comments ( ... ); -- run the block above
-- DROP TABLE IF EXISTS submissions;
-- -- For reference video support (new):
-- ALTER TABLE comments ALTER COLUMN session_id DROP NOT NULL;
-- CREATE TABLE IF NOT EXISTS reference_videos ( ... ); -- run the block above
