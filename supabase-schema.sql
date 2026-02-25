-- Run this in your Supabase SQL editor (fresh setup)

CREATE TABLE sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  label TEXT NOT NULL,
  videos JSONB DEFAULT '[]',   -- [{id, name, note?, noteTimestamp?}]
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
  video_ref TEXT NOT NULL,       -- Drive file ID or YouTube video ID
  note TEXT,
  note_timestamp INTEGER,        -- seconds
  folder_id UUID REFERENCES reference_folders(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reference library folder hierarchy (two levels: top-level + sub-folders)
CREATE TABLE reference_folders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES reference_folders(id) ON DELETE CASCADE,
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

-- Learning articles (Jupyter-style: markdown + embedded reference videos)
CREATE TABLE articles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  blocks JSONB NOT NULL DEFAULT '[]',
  -- Each block: {type:'text', content:string} | {type:'video', referenceVideoId:string, caption?:string}
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Migrations (if upgrading from a previous schema) ───────────────────────
-- Phase 1: Multi-user auth
-- CREATE TABLE IF NOT EXISTS users ( ... ); -- run the block above
-- CREATE INDEX IF NOT EXISTS users_username_idx ON users(username);

-- Phase 3: Reference folder organization
-- CREATE TABLE IF NOT EXISTS reference_folders ( ... ); -- run the block above
-- ALTER TABLE reference_videos
--   ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES reference_folders(id) ON DELETE SET NULL;

-- Phase 4: Learning articles
-- CREATE TABLE IF NOT EXISTS articles ( ... ); -- run the block above
