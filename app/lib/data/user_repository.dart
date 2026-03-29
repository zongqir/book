import 'package:sqflite_common/sqlite_api.dart';

import '../content_models.dart';
import 'database_runtime.dart';

class UserRepository {
  UserRepository({DatabaseFactory? factory})
    : _factory = factory ?? createDatabaseFactory();

  final DatabaseFactory _factory;

  Future<UserLibraryState> loadState(String userDbPath) async {
    final database = await _factory.openDatabase(
      userDbPath,
      options: OpenDatabaseOptions(readOnly: true),
    );

    try {
      final savedRows = await database.query(
        'saved_quotes',
        columns: ['quote_id'],
      );
      final mutedRows = await database.query(
        'muted_quotes',
        columns: ['quote_id'],
      );
      final annotationRows = await database.query(
        'annotations',
        columns: [
          'id',
          'annotation_type',
          'block_id',
          'highlight_color',
          'comment',
          'selected_text',
          'start_offset',
          'end_offset',
          'text_prefix',
          'text_suffix',
        ],
        where: 'status = ?',
        whereArgs: ['active'],
      );

      final flaggedBlockIds = <String>{};
      final highlightedBlocks = <String, HighlightTone>{};
      final blockComments = <String, String>{};
      final textHighlightsByBlock = <String, List<TextHighlightAnnotation>>{};

      for (final row in annotationRows) {
        final blockId = row['block_id'] as String?;
        if (blockId == null || blockId.isEmpty) {
          continue;
        }

        final annotationType = row['annotation_type'] as String;
        if (annotationType == 'flag') {
          flaggedBlockIds.add(blockId);
          continue;
        }

        if (annotationType == 'highlight') {
          final tone = HighlightTone.fromStorage(
            row['highlight_color'] as String?,
          );
          if (tone != HighlightTone.none) {
            highlightedBlocks[blockId] = tone;
          }
          continue;
        }

        if (annotationType == 'comment') {
          final comment = row['comment'] as String?;
          if (comment != null && comment.isNotEmpty) {
            blockComments[blockId] = comment;
          }
          continue;
        }

        if (annotationType == 'text-highlight') {
          final startOffset = row['start_offset'] as int?;
          final endOffset = row['end_offset'] as int?;
          final selectedText = row['selected_text'] as String?;
          if (startOffset == null ||
              endOffset == null ||
              selectedText == null ||
              selectedText.isEmpty) {
            continue;
          }

          final tone = HighlightTone.fromStorage(
            row['highlight_color'] as String?,
          );
          textHighlightsByBlock
              .putIfAbsent(blockId, () => [])
              .add(
                TextHighlightAnnotation(
                  id: row['id'] as String,
                  blockId: blockId,
                  selectedText: selectedText,
                  startOffset: startOffset,
                  endOffset: endOffset,
                  tone: tone == HighlightTone.none ? HighlightTone.amber : tone,
                  textPrefix: row['text_prefix'] as String?,
                  textSuffix: row['text_suffix'] as String?,
                  comment: row['comment'] as String?,
                ),
              );
        }
      }

      for (final highlights in textHighlightsByBlock.values) {
        highlights.sort(
          (left, right) => left.startOffset.compareTo(right.startOffset),
        );
      }

      return UserLibraryState(
        savedQuoteIds: savedRows
            .map((row) => row['quote_id'] as String)
            .toSet(),
        mutedQuoteIds: mutedRows
            .map((row) => row['quote_id'] as String)
            .toSet(),
        flaggedBlockIds: flaggedBlockIds,
        highlightedBlocks: highlightedBlocks,
        blockComments: blockComments,
        textHighlightsByBlock: textHighlightsByBlock,
      );
    } finally {
      await database.close();
    }
  }

  Future<void> setQuoteSaved({
    required String userDbPath,
    required String bundleVersion,
    required QuoteEntry quote,
    required bool isSaved,
  }) async {
    final database = await _factory.openDatabase(userDbPath);

    try {
      if (isSaved) {
        await database.insert('saved_quotes', {
          'id': _savedQuoteRowId(bundleVersion, quote.id),
          'quote_id': quote.id,
          'bundle_version': bundleVersion,
          'quote_text_snapshot': quote.text,
          'created_at': DateTime.now().toIso8601String(),
        }, conflictAlgorithm: ConflictAlgorithm.replace);
      } else {
        await database.delete(
          'saved_quotes',
          where: 'quote_id = ? AND bundle_version = ?',
          whereArgs: [quote.id, bundleVersion],
        );
      }
    } finally {
      await database.close();
    }
  }

  Future<void> setQuoteMuted({
    required String userDbPath,
    required String quoteId,
    required bool isMuted,
  }) async {
    final database = await _factory.openDatabase(userDbPath);

    try {
      if (isMuted) {
        await database.insert('muted_quotes', {
          'quote_id': quoteId,
          'created_at': DateTime.now().toIso8601String(),
        }, conflictAlgorithm: ConflictAlgorithm.replace);
      } else {
        await database.delete(
          'muted_quotes',
          where: 'quote_id = ?',
          whereArgs: [quoteId],
        );
      }
    } finally {
      await database.close();
    }
  }

  Future<void> setBlockFlag({
    required String userDbPath,
    required String bundleVersion,
    required ContentBlock block,
    required bool isFlagged,
  }) async {
    if (!isFlagged) {
      return _deleteAnnotation(
        userDbPath: userDbPath,
        annotationId: _annotationId('flag', block.id),
      );
    }

    return _upsertAnnotation(
      userDbPath: userDbPath,
      annotationId: _annotationId('flag', block.id),
      bundleVersion: bundleVersion,
      block: block,
      annotationType: 'flag',
      selectedText: block.title ?? block.body,
    );
  }

  Future<void> setBlockHighlight({
    required String userDbPath,
    required String bundleVersion,
    required ContentBlock block,
    required HighlightTone tone,
  }) async {
    if (tone == HighlightTone.none) {
      return _deleteAnnotation(
        userDbPath: userDbPath,
        annotationId: _annotationId('highlight', block.id),
      );
    }

    return _upsertAnnotation(
      userDbPath: userDbPath,
      annotationId: _annotationId('highlight', block.id),
      bundleVersion: bundleVersion,
      block: block,
      annotationType: 'highlight',
      selectedText: block.body,
      highlightColor: tone.storageKey,
    );
  }

  Future<void> setBlockComment({
    required String userDbPath,
    required String bundleVersion,
    required ContentBlock block,
    required String comment,
  }) async {
    if (comment.isEmpty) {
      return _deleteAnnotation(
        userDbPath: userDbPath,
        annotationId: _annotationId('comment', block.id),
      );
    }

    return _upsertAnnotation(
      userDbPath: userDbPath,
      annotationId: _annotationId('comment', block.id),
      bundleVersion: bundleVersion,
      block: block,
      annotationType: 'comment',
      selectedText: block.body,
      comment: comment,
    );
  }

  Future<TextHighlightAnnotation> addTextHighlight({
    required String userDbPath,
    required String bundleVersion,
    required ContentBlock block,
    required TextHighlightDraft draft,
    HighlightTone tone = HighlightTone.amber,
  }) async {
    final annotation = TextHighlightAnnotation(
      id: _textHighlightAnnotationId(
        blockId: block.id,
        startOffset: draft.startOffset,
        endOffset: draft.endOffset,
      ),
      blockId: block.id,
      selectedText: draft.selectedText,
      startOffset: draft.startOffset,
      endOffset: draft.endOffset,
      tone: tone,
      textPrefix: draft.textPrefix,
      textSuffix: draft.textSuffix,
    );

    await _upsertAnnotation(
      userDbPath: userDbPath,
      annotationId: annotation.id,
      bundleVersion: bundleVersion,
      block: block,
      annotationType: 'text-highlight',
      selectedText: annotation.selectedText,
      highlightColor: annotation.tone.storageKey,
      startOffset: annotation.startOffset,
      endOffset: annotation.endOffset,
      textPrefix: annotation.textPrefix,
      textSuffix: annotation.textSuffix,
    );

    return annotation;
  }

  Future<void> removeTextHighlight({
    required String userDbPath,
    required String annotationId,
  }) async {
    await _deleteAnnotation(userDbPath: userDbPath, annotationId: annotationId);
  }

  Future<TextHighlightAnnotation> setTextHighlightComment({
    required String userDbPath,
    required String bundleVersion,
    required ContentBlock block,
    required TextHighlightAnnotation annotation,
    required String comment,
  }) async {
    final updated = annotation.copyWith(
      comment: comment.isEmpty ? null : comment,
    );

    await _upsertAnnotation(
      userDbPath: userDbPath,
      annotationId: updated.id,
      bundleVersion: bundleVersion,
      block: block,
      annotationType: 'text-highlight',
      selectedText: updated.selectedText,
      highlightColor: updated.tone.storageKey,
      comment: updated.comment,
      startOffset: updated.startOffset,
      endOffset: updated.endOffset,
      textPrefix: updated.textPrefix,
      textSuffix: updated.textSuffix,
    );

    return updated;
  }

  Future<void> _upsertAnnotation({
    required String userDbPath,
    required String annotationId,
    required String bundleVersion,
    required ContentBlock block,
    required String annotationType,
    required String selectedText,
    String? highlightColor,
    String? comment,
    int? startOffset,
    int? endOffset,
    String? textPrefix,
    String? textSuffix,
  }) async {
    final database = await _factory.openDatabase(userDbPath);
    final now = DateTime.now().toIso8601String();

    try {
      await database.insert('annotations', {
        'id': annotationId,
        'bundle_version': bundleVersion,
        'article_id': block.articleId,
        'article_version_id': block.articleVersionId,
        'block_id': block.id,
        'annotation_type': annotationType,
        'highlight_color': highlightColor,
        'selected_text': selectedText,
        'text_prefix': textPrefix,
        'text_suffix': textSuffix,
        'start_offset': startOffset,
        'end_offset': endOffset,
        'comment': comment,
        'status': 'active',
        'created_at': now,
        'updated_at': now,
      }, conflictAlgorithm: ConflictAlgorithm.replace);
    } finally {
      await database.close();
    }
  }

  Future<void> _deleteAnnotation({
    required String userDbPath,
    required String annotationId,
  }) async {
    final database = await _factory.openDatabase(userDbPath);

    try {
      await database.delete(
        'annotations',
        where: 'id = ?',
        whereArgs: [annotationId],
      );
    } finally {
      await database.close();
    }
  }

  String _savedQuoteRowId(String bundleVersion, String quoteId) =>
      'saved::$bundleVersion::$quoteId';

  String _annotationId(String type, String blockId) => '$type::$blockId';

  String _textHighlightAnnotationId({
    required String blockId,
    required int startOffset,
    required int endOffset,
  }) => 'text-highlight::$blockId::$startOffset::$endOffset';
}

class UserLibraryState {
  const UserLibraryState({
    required this.savedQuoteIds,
    required this.mutedQuoteIds,
    required this.flaggedBlockIds,
    required this.highlightedBlocks,
    required this.blockComments,
    required this.textHighlightsByBlock,
  });

  final Set<String> savedQuoteIds;
  final Set<String> mutedQuoteIds;
  final Set<String> flaggedBlockIds;
  final Map<String, HighlightTone> highlightedBlocks;
  final Map<String, String> blockComments;
  final Map<String, List<TextHighlightAnnotation>> textHighlightsByBlock;
}
