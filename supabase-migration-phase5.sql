-- Phase 5 Migration: Presentation mode and search
-- Adds review lifecycle columns, reorder support, and full-text search RPC

-- ── 1. Add review lifecycle columns to comments ─────────────────────────────

ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS is_reviewed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER;

-- ── 2. Partial index for fast captain queue fetch ────────────────────────────

CREATE INDEX IF NOT EXISTS idx_comments_queue
  ON comments(session_id, is_reviewed, sort_order)
  WHERE send_to_captain = true AND parent_id IS NULL;

-- ── 3. Initialize sort_order for existing flagged items (per-session, chronological) ──

UPDATE comments
SET sort_order = sub.rn
FROM (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY created_at) - 1 AS rn
  FROM comments
  WHERE send_to_captain = true AND parent_id IS NULL
) sub
WHERE comments.id = sub.id;

-- ── 4. Full-text search RPC function ────────────────────────────────────────

CREATE OR REPLACE FUNCTION search_all(
  search_query text,
  result_limit int DEFAULT 20
)
RETURNS TABLE(
  id uuid,
  type text,
  title text,
  snippet text,
  url_hint text,
  rank real,
  created_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
  WITH q AS (
    SELECT websearch_to_tsquery('english', search_query) AS tsq
  )

  -- Session videos (stored as JSONB in sessions.videos)
  SELECT
    (v.value->>'id')::uuid AS id,
    'video'::text AS type,
    v.value->>'name' AS title,
    v.value->>'name' AS snippet,
    s.id::text AS url_hint,
    ts_rank(to_tsvector('english', COALESCE(v.value->>'name', '')), q.tsq) AS rank,
    s.created_at
  FROM sessions s
  CROSS JOIN LATERAL jsonb_array_elements(s.videos) AS v(value)
  CROSS JOIN q
  WHERE
    (v.value->>'name') IS NOT NULL
    AND to_tsvector('english', COALESCE(v.value->>'name', '')) @@ q.tsq

  UNION ALL

  -- Comments (video comments, top-level only)
  SELECT
    c.id,
    'comment'::text AS type,
    COALESCE(u.display_name, c.author_name, 'Unknown') AS title,
    CASE
      WHEN c.timestamp_seconds IS NOT NULL THEN
        '[' || LPAD((c.timestamp_seconds / 60)::text, 1, '0') || ':' ||
        LPAD((c.timestamp_seconds % 60)::text, 2, '0') || '] ' ||
        LEFT(c.comment_text, 200)
      ELSE LEFT(c.comment_text, 200)
    END AS snippet,
    COALESCE(c.video_id::text, c.session_id::text) AS url_hint,
    ts_rank(to_tsvector('english', c.comment_text), q.tsq) AS rank,
    c.created_at
  FROM comments c
  CROSS JOIN q
  LEFT JOIN users u ON u.id = c.author_id
  WHERE
    c.video_id IS NOT NULL
    AND c.parent_id IS NULL
    AND to_tsvector('english', c.comment_text) @@ q.tsq

  UNION ALL

  -- Articles (published only)
  SELECT
    a.id,
    'article'::text AS type,
    a.title,
    LEFT(
      COALESCE(
        (
          SELECT string_agg(elem->>'content', ' ')
          FROM jsonb_array_elements(a.blocks) AS elem
          WHERE elem->>'type' = 'text'
        ),
        a.title
      ),
      300
    ) AS snippet,
    a.id::text AS url_hint,
    ts_rank(
      to_tsvector('english',
        a.title || ' ' || COALESCE(
          (
            SELECT string_agg(elem->>'content', ' ')
            FROM jsonb_array_elements(a.blocks) AS elem
            WHERE elem->>'type' = 'text'
          ),
          ''
        )
      ),
      q.tsq
    ) AS rank,
    a.created_at
  FROM articles a
  CROSS JOIN q
  WHERE
    a.is_published = true
    AND to_tsvector('english',
      a.title || ' ' || COALESCE(
        (
          SELECT string_agg(elem->>'content', ' ')
          FROM jsonb_array_elements(a.blocks) AS elem
          WHERE elem->>'type' = 'text'
        ),
        ''
      )
    ) @@ q.tsq

  UNION ALL

  -- Q&A posts (no video_id, top-level only)
  SELECT
    c.id,
    'qa'::text AS type,
    COALESCE(u.display_name, c.author_name, 'Unknown') AS title,
    LEFT(c.comment_text, 200) AS snippet,
    c.id::text AS url_hint,
    ts_rank(to_tsvector('english', c.comment_text), q.tsq) AS rank,
    c.created_at
  FROM comments c
  CROSS JOIN q
  LEFT JOIN users u ON u.id = c.author_id
  WHERE
    c.video_id IS NULL
    AND c.parent_id IS NULL
    AND to_tsvector('english', c.comment_text) @@ q.tsq

  ORDER BY rank DESC
  LIMIT result_limit;
$$;
