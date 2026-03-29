class SqliteSchemas {
  const SqliteSchemas._();

  static const contentDatabase = <String>[
    '''
CREATE TABLE IF NOT EXISTS content_bundle (
  bundle_version TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  min_app_version TEXT,
  db_sha256 TEXT
)
''',
    '''
CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  author TEXT,
  category TEXT,
  summary TEXT,
  cover_url TEXT,
  created_at TEXT,
  updated_at TEXT
)
''',
    '''
CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  article_type TEXT NOT NULL,
  summary TEXT,
  source_basis TEXT,
  evidence_status TEXT,
  created_at TEXT,
  updated_at TEXT
)
''',
    'CREATE INDEX IF NOT EXISTS idx_articles_book_id ON articles(book_id)',
    '''
CREATE TABLE IF NOT EXISTS article_versions (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL,
  version TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  body_markdown TEXT NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 1,
  created_at TEXT,
  updated_at TEXT,
  UNIQUE(article_id, version)
)
''',
    'CREATE INDEX IF NOT EXISTS idx_article_versions_article_id ON article_versions(article_id)',
    'CREATE INDEX IF NOT EXISTS idx_article_versions_current ON article_versions(article_id, is_current)',
    '''
CREATE TABLE IF NOT EXISTS article_blocks (
  id TEXT PRIMARY KEY,
  article_version_id TEXT NOT NULL,
  block_key TEXT NOT NULL,
  block_type TEXT NOT NULL,
  title TEXT,
  body_markdown TEXT NOT NULL,
  plain_text TEXT NOT NULL,
  html TEXT NOT NULL,
  anchor TEXT,
  sort_order INTEGER NOT NULL,
  UNIQUE(article_version_id, block_key)
)
''',
    'CREATE INDEX IF NOT EXISTS idx_article_blocks_version_id ON article_blocks(article_version_id)',
    'CREATE INDEX IF NOT EXISTS idx_article_blocks_sort ON article_blocks(article_version_id, sort_order)',
    '''
CREATE TABLE IF NOT EXISTS quotes (
  id TEXT PRIMARY KEY,
  article_version_id TEXT NOT NULL,
  block_id TEXT NOT NULL,
  text TEXT NOT NULL,
  category TEXT,
  weight REAL DEFAULT 1.0,
  is_active INTEGER NOT NULL DEFAULT 1
)
''',
    'CREATE INDEX IF NOT EXISTS idx_quotes_version_id ON quotes(article_version_id)',
    'CREATE INDEX IF NOT EXISTS idx_quotes_active_weight ON quotes(is_active, weight)',
  ];

  static const userDatabase = <String>[
    '''
CREATE TABLE IF NOT EXISTS local_bundles (
  bundle_version TEXT PRIMARY KEY,
  bundle_id TEXT NOT NULL,
  manifest_path TEXT NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
)
''',
    '''
CREATE TABLE IF NOT EXISTS local_objects (
  object_hash TEXT PRIMARY KEY,
  object_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  size_bytes INTEGER,
  created_at TEXT NOT NULL,
  last_seen_bundle_version TEXT NOT NULL
)
''',
    '''
CREATE TABLE IF NOT EXISTS saved_quotes (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL,
  bundle_version TEXT NOT NULL,
  quote_text_snapshot TEXT NOT NULL,
  created_at TEXT NOT NULL
)
''',
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_quotes_quote_bundle ON saved_quotes(quote_id, bundle_version)',
    '''
CREATE TABLE IF NOT EXISTS muted_quotes (
  quote_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
)
''',
    '''
CREATE TABLE IF NOT EXISTS annotations (
  id TEXT PRIMARY KEY,
  bundle_version TEXT NOT NULL,
  article_id TEXT NOT NULL,
  article_version_id TEXT NOT NULL,
  block_id TEXT,
  annotation_type TEXT NOT NULL,
  highlight_color TEXT,
  selected_text TEXT NOT NULL,
  text_prefix TEXT,
  text_suffix TEXT,
  start_offset INTEGER,
  end_offset INTEGER,
  comment TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)
''',
    'CREATE INDEX IF NOT EXISTS idx_annotations_article_version ON annotations(article_version_id)',
    'CREATE INDEX IF NOT EXISTS idx_annotations_status ON annotations(status)',
    '''
CREATE TABLE IF NOT EXISTS article_comments (
  id TEXT PRIMARY KEY,
  bundle_version TEXT NOT NULL,
  article_id TEXT NOT NULL,
  article_version_id TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)
''',
    'CREATE INDEX IF NOT EXISTS idx_article_comments_version ON article_comments(article_version_id)',
    '''
CREATE TABLE IF NOT EXISTS reading_state (
  article_id TEXT NOT NULL,
  article_version_id TEXT NOT NULL,
  bundle_version TEXT NOT NULL,
  last_block_id TEXT,
  last_scroll_offset REAL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (article_version_id)
)
''',
  ];
}
