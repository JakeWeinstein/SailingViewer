-- TheoryForm v2 — Complete normalized schema
-- Run this in your Supabase SQL editor for a fresh setup.
-- For an existing database, run scripts/migrate.sql instead.

-- ─── Users ───────────────────────────────────────────────────────────────────

CREATE TABLE users (
  id                   UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  username             TEXT        NOT NULL UNIQUE,
  display_name         TEXT        NOT NULL,
  password_hash        TEXT        NOT NULL,
  role                 TEXT        NOT NULL DEFAULT 'viewer'
                                   CHECK (role IN ('captain', 'contributor', 'viewer')),
  is_active            BOOLEAN     NOT NULL DEFAULT true,
  is_seed              BOOLEAN     NOT NULL DEFAULT false,
  must_change_password BOOLEAN     NOT NULL DEFAULT false,
  last_login_at        TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX users_username_idx ON users(username);

-- ─── Sessions ────────────────────────────────────────────────────────────────

CREATE TABLE sessions (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  label      TEXT        NOT NULL,
  is_active  BOOLEAN     DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Session Videos ──────────────────────────────────────────────────────────

CREATE TABLE session_videos (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id       UUID        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  youtube_video_id TEXT        NOT NULL,
  title            TEXT        NOT NULL,
  position         INTEGER     NOT NULL DEFAULT 0,
  note             TEXT,
  note_timestamp   INTEGER,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX session_videos_session_id_idx ON session_videos(session_id);

-- ─── Comments ────────────────────────────────────────────────────────────────

CREATE TABLE comments (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id        UUID        REFERENCES sessions(id) ON DELETE CASCADE,
  video_id          UUID        REFERENCES session_videos(id) ON DELETE CASCADE,
  author_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  timestamp_seconds INTEGER,
  comment_text      TEXT        NOT NULL CHECK (char_length(comment_text) <= 2000),
  send_to_captain   BOOLEAN     DEFAULT false,
  parent_id         UUID        REFERENCES comments(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX comments_video_id_idx    ON comments(video_id);
CREATE INDEX comments_session_id_idx  ON comments(session_id);
CREATE INDEX comments_parent_id_idx   ON comments(parent_id);
CREATE INDEX comments_author_id_idx   ON comments(author_id);

-- ─── Reference Folders ───────────────────────────────────────────────────────

CREATE TABLE reference_folders (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT        NOT NULL,
  description TEXT,
  parent_id   UUID        REFERENCES reference_folders(id) ON DELETE CASCADE,
  sort_order  INTEGER     DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Reference Videos ────────────────────────────────────────────────────────

CREATE TABLE reference_videos (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  title           TEXT        NOT NULL,
  type            TEXT        NOT NULL DEFAULT 'youtube'
                              CHECK (type IN ('youtube')),
  video_ref       TEXT        NOT NULL,
  note            TEXT,
  note_timestamp  INTEGER,
  folder_id       UUID        REFERENCES reference_folders(id) ON DELETE SET NULL,
  parent_video_id UUID        REFERENCES reference_videos(id) ON DELETE CASCADE,
  start_seconds   INTEGER,
  sort_order      INTEGER     DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX reference_videos_parent_idx    ON reference_videos(parent_video_id);
CREATE INDEX reference_videos_folder_idx    ON reference_videos(folder_id);

-- ─── Articles ────────────────────────────────────────────────────────────────

CREATE TABLE articles (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  title        TEXT        NOT NULL,
  author_id    UUID        REFERENCES users(id) ON DELETE SET NULL,
  author_name  TEXT        NOT NULL,
  blocks       JSONB       NOT NULL DEFAULT '[]',
  is_published BOOLEAN     DEFAULT false,
  folder_id    UUID        REFERENCES reference_folders(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── App Config ──────────────────────────────────────────────────────────────

CREATE TABLE app_config (
  key        TEXT        PRIMARY KEY,
  value      TEXT        NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed a random invite code (captain can rotate this via UI later)
INSERT INTO app_config (key, value) VALUES ('invite_code', gen_random_uuid()::text);
