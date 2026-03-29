import 'package:sqflite_common/sqlite_api.dart';

import '../content_models.dart';
import 'database_runtime.dart';

class ContentRepository {
  ContentRepository({DatabaseFactory? factory})
    : _factory = factory ?? createDatabaseFactory();

  final DatabaseFactory _factory;

  Future<ContentSnapshot> loadSnapshot({
    required String contentDbPath,
  }) async {
    final database = await _factory.openDatabase(
      contentDbPath,
      options: OpenDatabaseOptions(readOnly: true),
    );

    try {
      final books = await _loadBooks(database);
      final quotes = await _loadQuotes(database);
      return ContentSnapshot(books: books, quotes: quotes);
    } finally {
      await database.close();
    }
  }

  Future<List<BookEntry>> _loadBooks(Database database) async {
    final bookRows = await database.rawQuery('''
SELECT
  b.id,
  b.title,
  COALESCE(b.author, '') AS author,
  COALESCE(b.category, '未分类') AS category,
  COALESCE(a.summary, b.summary, '') AS summary,
  av.body_markdown
FROM books b
LEFT JOIN articles a
  ON a.book_id = b.id
 AND a.article_type = 'overview'
LEFT JOIN article_versions av
  ON av.article_id = a.id
 AND av.is_current = 1
ORDER BY COALESCE(b.updated_at, b.created_at) DESC, b.title COLLATE NOCASE ASC
''');

    final blockRows = await database.rawQuery('''
SELECT
  a.book_id,
  a.id AS article_id,
  av.id AS article_version_id,
  blk.id,
  blk.block_type,
  blk.title,
  blk.body_markdown,
  blk.plain_text,
  blk.sort_order
FROM article_blocks blk
JOIN article_versions av
  ON av.id = blk.article_version_id
 AND av.is_current = 1
JOIN articles a
  ON a.id = av.article_id
 AND a.article_type = 'overview'
ORDER BY a.book_id, blk.sort_order ASC
''');

    final blocksByBookId = <String, List<ContentBlock>>{};
    for (final row in blockRows) {
      final block = ContentBlock(
        id: row['id'] as String,
        articleId: row['article_id'] as String,
        articleVersionId: row['article_version_id'] as String,
        type: BlockType.fromStorage(row['block_type'] as String),
        title: row['title'] as String?,
        markdownBody: row['body_markdown'] as String?,
        body: row['plain_text'] as String,
      );

      final bookId = row['book_id'] as String;
      blocksByBookId.putIfAbsent(bookId, () => <ContentBlock>[]).add(block);
    }

    return bookRows
        .map((row) {
          final blocks =
              blocksByBookId[row['id'] as String] ?? const <ContentBlock>[];
          return BookEntry(
            blocks: blocks,
            id: row['id'] as String,
            title: row['title'] as String,
            author: row['author'] as String,
            category: row['category'] as String,
            summary: row['summary'] as String,
            articleMarkdown:
                (row['body_markdown'] as String?) ?? buildArticleMarkdown(blocks),
          );
        })
        .toList(growable: false);
  }

  Future<List<QuoteEntry>> _loadQuotes(Database database) async {
    final rows = await database.rawQuery('''
SELECT
  q.id,
  a.book_id,
  b.title AS book_title,
  COALESCE(q.category, b.category, '未分类') AS category,
  q.text,
  COALESCE(a.summary, b.summary, '') AS note
FROM quotes q
JOIN article_versions av
  ON av.id = q.article_version_id
JOIN articles a
  ON a.id = av.article_id
JOIN books b
  ON b.id = a.book_id
WHERE q.is_active = 1
ORDER BY q.weight DESC, q.id ASC
''');

    return rows
        .map(
          (row) => QuoteEntry(
            id: row['id'] as String,
            bookId: row['book_id'] as String,
            bookTitle: row['book_title'] as String,
            category: row['category'] as String,
            text: row['text'] as String,
            note: row['note'] as String,
          ),
        )
        .toList(growable: false);
  }

}

class ContentSnapshot {
  const ContentSnapshot({required this.books, required this.quotes});

  final List<BookEntry> books;
  final List<QuoteEntry> quotes;

  bool get isEmpty => books.isEmpty && quotes.isEmpty;
}
