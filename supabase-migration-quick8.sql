-- Quick Task 8: Expand search_all to include reference videos and chapters
-- Also fix comment url_hint to include both session_id and video_id

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

  -- Reference videos (top-level, not chapters)
  SELECT
    rv.id,
    'reference'::text AS type,
    rv.title,
    LEFT(COALESCE(rv.note, rv.title), 300) AS snippet,
    rv.id::text AS url_hint,
    ts_rank(to_tsvector('english', rv.title || ' ' || COALESCE(rv.note, '')), q.tsq) AS rank,
    rv.created_at
  FROM reference_videos rv
  CROSS JOIN q
  WHERE
    rv.parent_video_id IS NULL
    AND to_tsvector('english', rv.title || ' ' || COALESCE(rv.note, '')) @@ q.tsq

  UNION ALL

  -- Chapters (child reference videos)
  SELECT
    rv.id,
    'chapter'::text AS type,
    rv.title,
    parent.title || ' > ' || rv.title AS snippet,
    rv.parent_video_id::text AS url_hint,
    ts_rank(to_tsvector('english', rv.title || ' ' || COALESCE(rv.note, '')), q.tsq) AS rank,
    rv.created_at
  FROM reference_videos rv
  CROSS JOIN q
  JOIN reference_videos parent ON parent.id = rv.parent_video_id
  WHERE
    rv.parent_video_id IS NOT NULL
    AND to_tsvector('english', rv.title || ' ' || COALESCE(rv.note, '')) @@ q.tsq

  UNION ALL

  -- Comments (video comments, top-level only) — fixed url_hint with session_id|video_id
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
    c.session_id::text || '|' || COALESCE(c.video_id::text, '') AS url_hint,
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
