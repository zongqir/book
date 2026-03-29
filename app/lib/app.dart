import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'content_models.dart';
import 'data/content_manifest.dart';
import 'data/content_repository.dart';
import 'data/local_bundle_store.dart';
import 'data/sqlite_schemas.dart';
import 'data/user_repository.dart';

const _paper = Color(0xFFF6F0E5);
const _paperDeep = Color(0xFFE9DDC8);
const _paperLift = Color(0xFFFFFBF5);
const _ink = Color(0xFF1F1A17);
const _inkSoft = Color(0xFF64594E);
const _inkBody = Color(0xFF2B211B);
const _inkMuted = Color(0xFF75685D);
const _accent = Color(0xFFC75C3A);
const _accentDeep = Color(0xFF8D3219);
const _olive = Color(0xFF6B775A);
const _amber = Color(0xFFE0B15A);

class BookApp extends StatelessWidget {
  const BookApp({super.key});

  @override
  Widget build(BuildContext context) {
    final uiText = GoogleFonts.notoSansScTextTheme(ThemeData.light().textTheme);
    final readingText = GoogleFonts.notoSerifScTextTheme(uiText);
    final colorScheme = const ColorScheme.light(
      primary: _ink,
      secondary: _accent,
      surface: _paperLift,
      onSurface: _ink,
      outline: Color(0x2A1F1A17),
    );

    return MaterialApp(
      title: '读书库 App',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: colorScheme,
        scaffoldBackgroundColor: _paper,
        dividerColor: _inkSoft.withValues(alpha: 0.18),
        textTheme: readingText.copyWith(
          displayLarge: uiText.displayLarge?.copyWith(
            color: _ink,
            height: 1.02,
            fontWeight: FontWeight.w700,
          ),
          displaySmall: uiText.displaySmall?.copyWith(
            color: _ink,
            fontSize: 33,
            height: 1.08,
            fontWeight: FontWeight.w700,
          ),
          headlineMedium: uiText.headlineMedium?.copyWith(
            color: _ink,
            height: 1.18,
            fontWeight: FontWeight.w700,
          ),
          headlineSmall: uiText.headlineSmall?.copyWith(
            color: _ink,
            fontSize: 26,
            height: 1.26,
            fontWeight: FontWeight.w700,
          ),
          titleLarge: uiText.titleLarge?.copyWith(
            color: _ink,
            fontSize: 23,
            height: 1.24,
            fontWeight: FontWeight.w700,
          ),
          titleMedium: uiText.titleMedium?.copyWith(
            color: _ink,
            fontSize: 18,
            height: 1.4,
            fontWeight: FontWeight.w600,
          ),
          titleSmall: uiText.titleSmall?.copyWith(
            color: _ink,
            fontSize: 15,
            height: 1.3,
            fontWeight: FontWeight.w700,
          ),
          bodyLarge: readingText.bodyLarge?.copyWith(
            color: _inkBody,
            fontSize: 17.5,
            height: 2.02,
            letterSpacing: 0.02,
          ),
          bodyMedium: readingText.bodyMedium?.copyWith(
            color: _inkMuted,
            fontSize: 15.5,
            height: 1.82,
          ),
          bodySmall: uiText.bodySmall?.copyWith(color: _inkMuted, height: 1.56),
          labelLarge: uiText.labelLarge?.copyWith(
            color: _ink,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.2,
          ),
        ),
        navigationBarTheme: NavigationBarThemeData(
          backgroundColor: Colors.transparent,
          indicatorColor: _paperDeep.withValues(alpha: 0.9),
          iconTheme: WidgetStateProperty.resolveWith((states) {
            final selected = states.contains(WidgetState.selected);
            return IconThemeData(
              color: selected ? _ink : _inkSoft,
              size: selected ? 24 : 22,
            );
          }),
          labelTextStyle: WidgetStateProperty.resolveWith((states) {
            final selected = states.contains(WidgetState.selected);
            return uiText.labelLarge?.copyWith(
              color: selected ? _ink : _inkSoft,
              fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
              letterSpacing: 0.1,
            );
          }),
        ),
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            backgroundColor: _ink,
            foregroundColor: _paperLift,
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 15),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(18),
            ),
            textStyle: uiText.labelLarge?.copyWith(fontWeight: FontWeight.w700),
          ),
        ),
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            foregroundColor: _ink,
            side: BorderSide(color: _ink.withValues(alpha: 0.12)),
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 15),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(18),
            ),
            textStyle: uiText.labelLarge?.copyWith(fontWeight: FontWeight.w700),
          ),
        ),
        textButtonTheme: TextButtonThemeData(
          style: TextButton.styleFrom(
            foregroundColor: _accentDeep,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            textStyle: uiText.labelLarge?.copyWith(fontWeight: FontWeight.w700),
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Colors.white,
          hintStyle: uiText.bodyMedium?.copyWith(color: _inkMuted),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(22),
            borderSide: BorderSide(color: _ink.withValues(alpha: 0.08)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(22),
            borderSide: BorderSide(color: _ink.withValues(alpha: 0.08)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(22),
            borderSide: BorderSide(color: _accent.withValues(alpha: 0.48)),
          ),
        ),
        useMaterial3: true,
      ),
      home: const AppShell(),
    );
  }
}

class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  final LocalBundleStore _bundleStore = createLocalBundleStore();
  List<QuoteEntry> _quotes = List<QuoteEntry>.of(sampleQuotes);
  Map<String, BookEntry> _booksById = {
    for (final book in sampleBooks) book.id: book,
  };
  final Set<String> _savedQuoteIds = <String>{'principle-1'};
  final Set<String> _mutedQuoteIds = <String>{};
  final Set<String> _flaggedBlockIds = <String>{};
  final Map<String, HighlightTone> _highlightedBlocks =
      <String, HighlightTone>{};
  final Map<String, String> _blockComments = <String, String>{};
  final Map<String, List<TextHighlightAnnotation>> _textHighlightsByBlock =
      <String, List<TextHighlightAnnotation>>{};
  BundleBootstrapState? _bundleState;
  String? _bootstrapError;
  int _selectedTab = 0;
  int _cursor = 0;

  @override
  void initState() {
    super.initState();
    _bootstrapBundleRuntime();
  }

  QuoteEntry get _currentQuote {
    final visible = _quotes
        .where((entry) => !_mutedQuoteIds.contains(entry.id))
        .toList();
    if (visible.isEmpty) {
      return _quotes.first;
    }
    return visible[_cursor % visible.length];
  }

  String? get _userDbPath => _bundleState?.userDbPath;

  String? get _currentBundleVersion {
    final manifest = _bundleState?.manifest;
    if (manifest == null || manifest.bundles.isEmpty) {
      return null;
    }
    return manifest.bundles.first.bundleVersion;
  }

  void _toggleSavedQuote(QuoteEntry quote) {
    final shouldSave = !_savedQuoteIds.contains(quote.id);
    setState(() {
      if (shouldSave) {
        _savedQuoteIds.add(quote.id);
      } else {
        _savedQuoteIds.remove(quote.id);
      }
    });
    _persistSavedQuote(quote, isSaved: shouldSave);
  }

  void _muteCurrentQuote() {
    final quote = _currentQuote;
    setState(() {
      _mutedQuoteIds.add(quote.id);
      _cursor++;
    });
    _persistMutedQuote(quote.id, isMuted: true);
  }

  void _nextQuote() {
    setState(() {
      _cursor++;
    });
  }

  Future<void> _bootstrapBundleRuntime() async {
    try {
      final state = await _bundleStore.bootstrap();
      final snapshot = await ContentRepository().loadSnapshot(
        contentDbPath: state.contentDbPath,
      );
      final userState = await UserRepository().loadState(state.userDbPath);
      if (!mounted) {
        return;
      }
      setState(() {
        _bundleState = state;
        _bootstrapError = null;
        if (snapshot.books.isNotEmpty) {
          _booksById = {for (final book in snapshot.books) book.id: book};
        }
        if (snapshot.quotes.isNotEmpty) {
          _quotes = snapshot.quotes;
        }
        _savedQuoteIds
          ..clear()
          ..addAll(userState.savedQuoteIds);
        _mutedQuoteIds
          ..clear()
          ..addAll(userState.mutedQuoteIds);
        _flaggedBlockIds
          ..clear()
          ..addAll(userState.flaggedBlockIds);
        _highlightedBlocks
          ..clear()
          ..addAll(userState.highlightedBlocks);
        _blockComments
          ..clear()
          ..addAll(userState.blockComments);
        _textHighlightsByBlock
          ..clear()
          ..addAll(userState.textHighlightsByBlock);
      });
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _bootstrapError = error.toString();
      });
    }
  }

  void _toggleFlag(ContentBlock block) {
    final isFlagged = !_flaggedBlockIds.contains(block.id);
    setState(() {
      if (isFlagged) {
        _flaggedBlockIds.add(block.id);
      } else {
        _flaggedBlockIds.remove(block.id);
      }
    });
    _persistBlockFlag(block, isFlagged: isFlagged);
  }

  void _cycleHighlight(ContentBlock block) {
    final current = _highlightedBlocks[block.id] ?? HighlightTone.none;
    final next = current.next;
    setState(() {
      if (next == HighlightTone.none) {
        _highlightedBlocks.remove(block.id);
      } else {
        _highlightedBlocks[block.id] = next;
      }
    });
    _persistBlockHighlight(block, tone: next);
  }

  Future<void> _editComment(BuildContext context, ContentBlock block) async {
    final result = await _promptForComment(
      context: context,
      initialText: _blockComments[block.id] ?? '',
    );
    if (!mounted || result == null) return;
    setState(() {
      if (result.isEmpty) {
        _blockComments.remove(block.id);
      } else {
        _blockComments[block.id] = result;
      }
    });
    _persistBlockComment(block, comment: result);
  }

  Future<void> _editTextHighlightComment(
    BuildContext context,
    ContentBlock block,
    TextHighlightAnnotation annotation,
  ) async {
    final result = await _promptForComment(
      context: context,
      initialText: annotation.comment ?? '',
      title: '给这段高亮留一句评论',
      subtitle: '让这条高亮不只是漂亮标记，而是变成你以后会回看的判断。',
      hintText: '例如：这句话正好戳中我现在的问题，后面要回来看。',
    );
    if (!mounted || result == null) {
      return;
    }

    final updated = await _persistTextHighlightComment(
      block,
      annotation,
      comment: result,
    );
    if (!mounted || updated == null) {
      return;
    }

    setState(() {
      final highlights = _textHighlightsByBlock[block.id];
      if (highlights == null) {
        return;
      }
      final index = highlights.indexWhere((item) => item.id == updated.id);
      if (index >= 0) {
        highlights[index] = updated;
      }
    });
  }

  void _openBook(BuildContext context, String bookId, {String? quoteId}) {
    final book = _booksById[bookId];
    if (book == null) return;
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (context) => BookDetailPage(
          book: book,
          quoteId: quoteId,
          highlightedBlocks: _highlightedBlocks,
          flaggedBlockIds: _flaggedBlockIds,
          blockComments: _blockComments,
          textHighlightsByBlock: _textHighlightsByBlock,
          onToggleFlag: _toggleFlag,
          onCycleHighlight: _cycleHighlight,
          onEditComment: _editComment,
          onSaveTextHighlight: _saveTextHighlight,
          onRemoveTextHighlight: _removeTextHighlight,
          onEditTextHighlightComment: _editTextHighlightComment,
        ),
      ),
    );
  }

  Future<void> _persistSavedQuote(
    QuoteEntry quote, {
    required bool isSaved,
  }) async {
    final userDbPath = _userDbPath;
    final bundleVersion = _currentBundleVersion;
    if (userDbPath == null || bundleVersion == null) {
      return;
    }

    await UserRepository().setQuoteSaved(
      userDbPath: userDbPath,
      bundleVersion: bundleVersion,
      quote: quote,
      isSaved: isSaved,
    );
  }

  Future<void> _persistMutedQuote(
    String quoteId, {
    required bool isMuted,
  }) async {
    final userDbPath = _userDbPath;
    if (userDbPath == null) {
      return;
    }

    await UserRepository().setQuoteMuted(
      userDbPath: userDbPath,
      quoteId: quoteId,
      isMuted: isMuted,
    );
  }

  Future<void> _persistBlockFlag(
    ContentBlock block, {
    required bool isFlagged,
  }) async {
    final userDbPath = _userDbPath;
    final bundleVersion = _currentBundleVersion;
    if (userDbPath == null || bundleVersion == null) {
      return;
    }

    await UserRepository().setBlockFlag(
      userDbPath: userDbPath,
      bundleVersion: bundleVersion,
      block: block,
      isFlagged: isFlagged,
    );
  }

  Future<void> _persistBlockHighlight(
    ContentBlock block, {
    required HighlightTone tone,
  }) async {
    final userDbPath = _userDbPath;
    final bundleVersion = _currentBundleVersion;
    if (userDbPath == null || bundleVersion == null) {
      return;
    }

    await UserRepository().setBlockHighlight(
      userDbPath: userDbPath,
      bundleVersion: bundleVersion,
      block: block,
      tone: tone,
    );
  }

  Future<void> _persistBlockComment(
    ContentBlock block, {
    required String comment,
  }) async {
    final userDbPath = _userDbPath;
    final bundleVersion = _currentBundleVersion;
    if (userDbPath == null || bundleVersion == null) {
      return;
    }

    await UserRepository().setBlockComment(
      userDbPath: userDbPath,
      bundleVersion: bundleVersion,
      block: block,
      comment: comment,
    );
  }

  Future<void> _saveTextHighlight(
    ContentBlock block,
    TextHighlightDraft draft,
  ) async {
    final userDbPath = _userDbPath;
    final bundleVersion = _currentBundleVersion;
    if (userDbPath == null || bundleVersion == null) {
      return;
    }

    final annotation = await UserRepository().addTextHighlight(
      userDbPath: userDbPath,
      bundleVersion: bundleVersion,
      block: block,
      draft: draft,
    );

    if (!mounted) {
      return;
    }

    setState(() {
      final highlights = _textHighlightsByBlock.putIfAbsent(
        block.id,
        () => <TextHighlightAnnotation>[],
      );
      final existingIndex = highlights.indexWhere(
        (item) => item.id == annotation.id,
      );
      if (existingIndex >= 0) {
        highlights[existingIndex] = annotation;
      } else {
        highlights.add(annotation);
        highlights.sort(
          (left, right) => left.startOffset.compareTo(right.startOffset),
        );
      }
    });
  }

  Future<void> _removeTextHighlight(String blockId, String annotationId) async {
    final userDbPath = _userDbPath;
    if (userDbPath == null) {
      return;
    }

    await UserRepository().removeTextHighlight(
      userDbPath: userDbPath,
      annotationId: annotationId,
    );

    if (!mounted) {
      return;
    }

    setState(() {
      final highlights = _textHighlightsByBlock[blockId];
      if (highlights == null) {
        return;
      }
      highlights.removeWhere((item) => item.id == annotationId);
      if (highlights.isEmpty) {
        _textHighlightsByBlock.remove(blockId);
      }
    });
  }

  Future<String?> _promptForComment({
    required BuildContext context,
    required String initialText,
    String title = '给这段留一句评论',
    String subtitle = '先留一个短判断，之后再决定要不要展开成长评论。',
    String hintText = '例如：这段特别像我现在的问题，值得以后回看。',
  }) async {
    final controller = TextEditingController(text: initialText);
    final result = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _CommentSheet(
        controller: controller,
        title: title,
        subtitle: subtitle,
        hintText: hintText,
      ),
    );
    controller.dispose();
    return result;
  }

  Future<TextHighlightAnnotation?> _persistTextHighlightComment(
    ContentBlock block,
    TextHighlightAnnotation annotation, {
    required String comment,
  }) async {
    final userDbPath = _userDbPath;
    final bundleVersion = _currentBundleVersion;
    if (userDbPath == null || bundleVersion == null) {
      return null;
    }

    return UserRepository().setTextHighlightComment(
      userDbPath: userDbPath,
      bundleVersion: bundleVersion,
      block: block,
      annotation: annotation,
      comment: comment,
    );
  }

  @override
  Widget build(BuildContext context) {
    final savedQuotes = _quotes
        .where((entry) => _savedQuoteIds.contains(entry.id))
        .toList();
    final textHighlightCommentCount = _textHighlightsByBlock.values
        .expand((items) => items)
        .where((item) => item.hasComment)
        .length;
    final pages = <Widget>[
      TodayPage(
        quote: _currentQuote,
        isSaved: _savedQuoteIds.contains(_currentQuote.id),
        onSave: () => _toggleSavedQuote(_currentQuote),
        onMute: _muteCurrentQuote,
        onNext: _nextQuote,
        onOpenArticle: () =>
            _openBook(context, _currentQuote.bookId, quoteId: _currentQuote.id),
      ),
      SavedPage(
        quotes: savedQuotes,
        onToggleSaved: _toggleSavedQuote,
        onOpenArticle: (quote) =>
            _openBook(context, quote.bookId, quoteId: quote.id),
      ),
      LibraryPage(
        books: _booksById.values.toList(growable: false),
        flaggedCount: _flaggedBlockIds.length,
        commentCount: _blockComments.length + textHighlightCommentCount,
        bundleState: _bundleState,
        bootstrapError: _bootstrapError,
        onOpenBook: (book) => _openBook(context, book.id),
      ),
    ];

    return Scaffold(
      body: AnimatedSwitcher(
        duration: const Duration(milliseconds: 350),
        switchInCurve: Curves.easeOutCubic,
        switchOutCurve: Curves.easeInCubic,
        child: KeyedSubtree(
          key: ValueKey<int>(_selectedTab),
          child: pages[_selectedTab],
        ),
      ),
      bottomNavigationBar: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.82),
              borderRadius: BorderRadius.circular(28),
              border: Border.all(color: Colors.black.withValues(alpha: 0.05)),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x14000000),
                  blurRadius: 24,
                  offset: Offset(0, 12),
                ),
              ],
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(28),
              child: NavigationBar(
                height: 72,
                selectedIndex: _selectedTab,
                labelBehavior:
                    NavigationDestinationLabelBehavior.onlyShowSelected,
                destinations: const [
                  NavigationDestination(
                    icon: Icon(Icons.auto_stories_outlined),
                    selectedIcon: Icon(Icons.auto_stories),
                    label: '今日',
                  ),
                  NavigationDestination(
                    icon: Icon(Icons.bookmark_border_rounded),
                    selectedIcon: Icon(Icons.bookmark_rounded),
                    label: '收藏',
                  ),
                  NavigationDestination(
                    icon: Icon(Icons.library_books_outlined),
                    selectedIcon: Icon(Icons.library_books_rounded),
                    label: '书库',
                  ),
                ],
                onDestinationSelected: (index) =>
                    setState(() => _selectedTab = index),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class TodayPage extends StatelessWidget {
  const TodayPage({
    required this.quote,
    required this.isSaved,
    required this.onSave,
    required this.onMute,
    required this.onNext,
    required this.onOpenArticle,
    super.key,
  });

  final QuoteEntry quote;
  final bool isSaved;
  final VoidCallback onSave;
  final VoidCallback onMute;
  final VoidCallback onNext;
  final VoidCallback onOpenArticle;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return _EditorialBackdrop(
      child: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
          children: [
            Text(
              '今日一句',
              style: theme.textTheme.titleSmall?.copyWith(
                letterSpacing: 3,
                color: _accentDeep,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              '打开它，不是为了多看一点，而是先被一句话拽住。',
              style: theme.textTheme.displaySmall?.copyWith(
                color: _ink,
                height: 1.12,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              '这不是首页横幅，而是你每天进入书库的门把手。先被一句话抓住，再决定要不要继续走进那本书。',
              style: theme.textTheme.bodyMedium?.copyWith(color: _inkSoft),
            ),
            const SizedBox(height: 18),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: const [
                _StatPill(label: '模式', value: '一句话'),
                _StatPill(label: '承接', value: '进文章'),
                _StatPill(label: '动作', value: '收藏/屏蔽'),
              ],
            ),
            const SizedBox(height: 24),
            _QuoteCard(
              quote: quote,
              isSaved: isSaved,
              onSave: onSave,
              onMute: onMute,
              onNext: onNext,
              onOpenArticle: onOpenArticle,
            ),
            const SizedBox(height: 22),
            const _SectionCard(
              eyebrow: '为什么留它',
              title: '收藏不是点赞，是把一句话升格成你的长期索引。',
              body:
                  '后续这句会进入你的个人句库，之后可以继续被编进专题、行动页和回看清单。你未来的推荐系统，也应该主要依赖这些选择信号。',
            ),
            const SizedBox(height: 16),
            const _SectionCard(
              eyebrow: '阅读路径',
              title: '句子不是终点，它只是把你推向那本书的入口。',
              body: '现在的主路径已经很明确：先被一句话抓住，再进入书页摘要、目录和正文；读到关键处时，再留下自己的高亮和批注。',
            ),
          ],
        ),
      ),
    );
  }
}

class _EditorialBackdrop extends StatelessWidget {
  const _EditorialBackdrop({required this.child, this.secondaryOrb = _olive});

  final Widget child;
  final Color secondaryOrb;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [_paper, Color(0xFFF4E8D8), Color(0xFFF1E3D0)],
        ),
      ),
      child: Stack(
        children: [
          const Positioned(
            top: -110,
            right: -40,
            child: _Orb(size: 240, color: _accent),
          ),
          Positioned(
            bottom: 120,
            left: -90,
            child: _Orb(size: 210, color: secondaryOrb),
          ),
          child,
        ],
      ),
    );
  }
}

class SavedPage extends StatelessWidget {
  const SavedPage({
    required this.quotes,
    required this.onToggleSaved,
    required this.onOpenArticle,
    super.key,
  });

  final List<QuoteEntry> quotes;
  final ValueChanged<QuoteEntry> onToggleSaved;
  final ValueChanged<QuoteEntry> onOpenArticle;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return _EditorialBackdrop(
      secondaryOrb: _accentDeep,
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 22, 20, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '我的句库',
                style: theme.textTheme.titleSmall?.copyWith(
                  letterSpacing: 3,
                  color: _accentDeep,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                '这些被你留下来的句子，不该像便签堆在一起，而应该慢慢长成你的个人判断索引。',
                style: theme.textTheme.displaySmall?.copyWith(
                  color: _ink,
                  height: 1.14,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                '以后这里会继续参与推荐、专题和行动页生成。现在先把它做得像一个值得反复回看的句库。',
                style: theme.textTheme.bodyMedium?.copyWith(color: _inkSoft),
              ),
              const SizedBox(height: 18),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  _StatPill(label: '已收藏', value: '${quotes.length}'),
                  const _StatPill(label: '用途', value: '句库'),
                ],
              ),
              const SizedBox(height: 18),
              Expanded(
                child: quotes.isEmpty
                    ? const _EmptySavedState()
                    : ListView.separated(
                        itemCount: quotes.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 16),
                        itemBuilder: (context, index) {
                          final quote = quotes[index];
                          return DecoratedBox(
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                                colors: [Colors.white, Color(0xFFF9F3EA)],
                              ),
                              borderRadius: BorderRadius.circular(30),
                              border: Border.all(
                                color: Colors.black.withValues(alpha: 0.06),
                              ),
                              boxShadow: const [
                                BoxShadow(
                                  color: Color(0x12000000),
                                  blurRadius: 26,
                                  offset: Offset(0, 14),
                                ),
                              ],
                            ),
                            child: Padding(
                              padding: const EdgeInsets.fromLTRB(
                                22,
                                22,
                                22,
                                20,
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      _TagChip(label: quote.category),
                                      const Spacer(),
                                      Text(
                                        quote.bookTitle,
                                        style: theme.textTheme.labelLarge
                                            ?.copyWith(color: _inkSoft),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 18),
                                  Text(
                                    '“',
                                    style: theme.textTheme.displayLarge
                                        ?.copyWith(
                                          color: _accent.withValues(
                                            alpha: 0.45,
                                          ),
                                          height: 0.74,
                                        ),
                                  ),
                                  Text(
                                    quote.text,
                                    style: theme.textTheme.headlineSmall
                                        ?.copyWith(color: _ink, height: 1.42),
                                  ),
                                  const SizedBox(height: 16),
                                  Text(
                                    quote.note,
                                    style: theme.textTheme.bodyMedium?.copyWith(
                                      color: _inkSoft,
                                    ),
                                  ),
                                  const SizedBox(height: 18),
                                  Wrap(
                                    spacing: 10,
                                    runSpacing: 10,
                                    children: [
                                      FilledButton.tonalIcon(
                                        onPressed: () => onOpenArticle(quote),
                                        icon: const Icon(
                                          Icons.menu_book_outlined,
                                        ),
                                        label: const Text('打开文章'),
                                      ),
                                      TextButton.icon(
                                        onPressed: () => onToggleSaved(quote),
                                        icon: const Icon(
                                          Icons.bookmark_remove_outlined,
                                        ),
                                        label: const Text('取消收藏'),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class LibraryPage extends StatelessWidget {
  const LibraryPage({
    required this.books,
    required this.flaggedCount,
    required this.commentCount,
    required this.bundleState,
    required this.bootstrapError,
    required this.onOpenBook,
    super.key,
  });

  final List<BookEntry> books;
  final int flaggedCount;
  final int commentCount;
  final BundleBootstrapState? bundleState;
  final String? bootstrapError;
  final ValueChanged<BookEntry> onOpenBook;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return _EditorialBackdrop(
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 22, 20, 28),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '书库',
                style: theme.textTheme.titleSmall?.copyWith(
                  letterSpacing: 3,
                  color: _olive,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                '这里不该像文件列表，更像一套可以被慢慢走进去的书架。',
                style: theme.textTheme.displaySmall?.copyWith(
                  color: _ink,
                  fontWeight: FontWeight.w600,
                  height: 1.14,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                '每本书先给你一个入口摘要，再给目录，再进入正文。现在先把每本书的入口质感做对。',
                style: theme.textTheme.bodyMedium?.copyWith(color: _inkSoft),
              ),
              const SizedBox(height: 18),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  _StatPill(label: '书籍', value: '${books.length}'),
                  _StatPill(label: '已标记', value: '$flaggedCount'),
                  _StatPill(label: '已评论', value: '$commentCount'),
                  const _StatPill(label: '入口', value: '摘要/目录'),
                ],
              ),
              const SizedBox(height: 16),
              _BundleStatusCard(
                bundleState: bundleState,
                bootstrapError: bootstrapError,
              ),
              const SizedBox(height: 22),
              Expanded(
                child: ListView.separated(
                  itemCount: books.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 16),
                  itemBuilder: (context, index) {
                    final book = books[index];
                    return DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [Colors.white, Color(0xFFF8F2E7)],
                        ),
                        borderRadius: BorderRadius.circular(30),
                        border: Border.all(
                          color: Colors.black.withValues(alpha: 0.05),
                        ),
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0x14000000),
                            blurRadius: 28,
                            offset: Offset(0, 14),
                          ),
                        ],
                      ),
                      child: InkWell(
                        borderRadius: BorderRadius.circular(30),
                        onTap: () => onOpenBook(book),
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(22, 22, 22, 20),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Wrap(
                                spacing: 8,
                                runSpacing: 8,
                                children: [
                                  _TagChip(label: book.category),
                                  _TagChip(
                                    label: '${book.blocks.length} 段正文',
                                    foreground: _olive,
                                  ),
                                ],
                              ),
                              const SizedBox(height: 16),
                              Text(
                                book.title,
                                style: theme.textTheme.headlineSmall?.copyWith(
                                  color: _ink,
                                  height: 1.24,
                                ),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                book.author,
                                style: theme.textTheme.titleMedium?.copyWith(
                                  color: _accentDeep,
                                ),
                              ),
                              const SizedBox(height: 14),
                              Text(
                                book.summary,
                                style: theme.textTheme.bodyMedium?.copyWith(
                                  color: _inkSoft,
                                ),
                              ),
                              const SizedBox(height: 18),
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      '先看摘要与目录，再进入正文',
                                      style: theme.textTheme.labelLarge
                                          ?.copyWith(color: _olive),
                                    ),
                                  ),
                                  TextButton.icon(
                                    onPressed: () => onOpenBook(book),
                                    icon: const Icon(
                                      Icons.arrow_forward_rounded,
                                    ),
                                    label: const Text('进入书页'),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class BookDetailPage extends StatefulWidget {
  const BookDetailPage({
    required this.book,
    required this.highlightedBlocks,
    required this.flaggedBlockIds,
    required this.blockComments,
    required this.textHighlightsByBlock,
    required this.onToggleFlag,
    required this.onCycleHighlight,
    required this.onEditComment,
    required this.onSaveTextHighlight,
    required this.onRemoveTextHighlight,
    required this.onEditTextHighlightComment,
    this.quoteId,
    super.key,
  });

  final BookEntry book;
  final Map<String, HighlightTone> highlightedBlocks;
  final Set<String> flaggedBlockIds;
  final Map<String, String> blockComments;
  final Map<String, List<TextHighlightAnnotation>> textHighlightsByBlock;
  final ValueChanged<ContentBlock> onToggleFlag;
  final ValueChanged<ContentBlock> onCycleHighlight;
  final Future<void> Function(BuildContext, ContentBlock) onEditComment;
  final Future<void> Function(ContentBlock, TextHighlightDraft)
  onSaveTextHighlight;
  final Future<void> Function(String blockId, String annotationId)
  onRemoveTextHighlight;
  final Future<void> Function(
    BuildContext context,
    ContentBlock block,
    TextHighlightAnnotation annotation,
  )
  onEditTextHighlightComment;
  final String? quoteId;

  @override
  State<BookDetailPage> createState() => _BookDetailPageState();
}

class _BookDetailPageState extends State<BookDetailPage> {
  final ScrollController _scrollController = ScrollController();
  final Map<String, GlobalKey> _blockKeys = <String, GlobalKey>{};
  final GlobalKey _contentStartKey = GlobalKey();
  Timer? _flashTimer;
  String? _focusedBlockId;
  String? _activeBlockId;
  double _readingProgress = 0;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_handleScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) => _handleScroll());
  }

  GlobalKey _keyForBlock(String blockId) =>
      _blockKeys.putIfAbsent(blockId, GlobalKey.new);

  String? _currentActiveBlockId() {
    const anchorY = 220.0;
    String? passedBlockId;
    double passedTop = -double.infinity;
    String? upcomingBlockId;
    double upcomingTop = double.infinity;

    for (final block in widget.book.blocks) {
      final context = _blockKeys[block.id]?.currentContext;
      if (context == null) {
        continue;
      }
      final renderObject = context.findRenderObject();
      if (renderObject is! RenderBox) {
        continue;
      }

      final top = renderObject.localToGlobal(Offset.zero).dy;
      if (top <= anchorY && top > passedTop) {
        passedTop = top;
        passedBlockId = block.id;
      } else if (top > anchorY && top < upcomingTop) {
        upcomingTop = top;
        upcomingBlockId = block.id;
      }
    }

    return passedBlockId ?? upcomingBlockId;
  }

  int _textHighlightCountForBlock(String blockId) =>
      widget.textHighlightsByBlock[blockId]?.length ?? 0;

  int _commentCountForBlock(String blockId) {
    var count = 0;
    final blockComment = widget.blockComments[blockId];
    if (blockComment != null && blockComment.trim().isNotEmpty) {
      count++;
    }
    count +=
        widget.textHighlightsByBlock[blockId]
            ?.where((item) => item.hasComment)
            .length ??
        0;
    return count;
  }

  bool _blockHasSignals(ContentBlock block) {
    final tone = widget.highlightedBlocks[block.id] ?? HighlightTone.none;
    return widget.flaggedBlockIds.contains(block.id) ||
        tone != HighlightTone.none ||
        _textHighlightCountForBlock(block.id) > 0 ||
        _commentCountForBlock(block.id) > 0;
  }

  String? _blockMetaLabel(ContentBlock block) {
    if (_activeBlockId == block.id) {
      return '正在阅读';
    }
    final commentCount = _commentCountForBlock(block.id);
    if (commentCount > 0) {
      return '$commentCount 条批注';
    }
    final textHighlightCount = _textHighlightCountForBlock(block.id);
    if (textHighlightCount > 0) {
      return '$textHighlightCount 处高亮';
    }
    final tone = widget.highlightedBlocks[block.id] ?? HighlightTone.none;
    if (tone != HighlightTone.none) {
      return tone.label;
    }
    if (widget.flaggedBlockIds.contains(block.id)) {
      return '已标记';
    }
    return null;
  }

  void _handleScroll() {
    if (!_scrollController.hasClients) {
      return;
    }

    final maxExtent = _scrollController.position.maxScrollExtent;
    final progress = maxExtent <= 0
        ? 0.0
        : (_scrollController.offset / maxExtent).clamp(0.0, 1.0);
    final activeBlockId = _currentActiveBlockId();
    final progressChanged = (progress - _readingProgress).abs() >= 0.01;
    final activeChanged = activeBlockId != _activeBlockId;
    if (!progressChanged && !activeChanged) {
      return;
    }
    if (!mounted) {
      return;
    }
    setState(() {
      if (progressChanged) {
        _readingProgress = progress;
      }
      if (activeChanged) {
        _activeBlockId = activeBlockId;
      }
    });
  }

  Future<void> _jumpToBlock(String blockId) async {
    final key = _blockKeys[blockId];
    final context = key?.currentContext;
    if (context == null) {
      return;
    }

    await Scrollable.ensureVisible(
      context,
      duration: const Duration(milliseconds: 420),
      curve: Curves.easeInOutCubic,
      alignment: 0.18,
    );

    if (!mounted) {
      return;
    }

    _flashTimer?.cancel();
    setState(() => _focusedBlockId = blockId);
    _flashTimer = Timer(const Duration(milliseconds: 1400), () {
      if (!mounted) {
        return;
      }
      setState(() => _focusedBlockId = null);
    });
  }

  Future<void> _jumpToReadingStart() async {
    final context = _contentStartKey.currentContext;
    if (context == null) {
      return;
    }

    await Scrollable.ensureVisible(
      context,
      duration: const Duration(milliseconds: 420),
      curve: Curves.easeInOutCubic,
      alignment: 0.04,
    );
  }

  Future<void> _scrollToTop() async {
    if (!_scrollController.hasClients) {
      return;
    }

    await _scrollController.animateTo(
      0,
      duration: const Duration(milliseconds: 420),
      curve: Curves.easeInOutCubic,
    );
  }

  Future<void> _showTocSheet(
    BuildContext context,
    List<({ContentBlock block, String title, String preview})> tocItems,
  ) async {
    if (tocItems.isEmpty) {
      return;
    }

    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (sheetContext) {
        final theme = Theme.of(sheetContext);
        return Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 20),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: _paperLift,
              borderRadius: BorderRadius.circular(28),
              border: Border.all(color: Colors.black.withValues(alpha: 0.05)),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x18000000),
                  blurRadius: 28,
                  offset: Offset(0, 14),
                ),
              ],
            ),
            child: SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(18, 18, 18, 18),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          '目录跳转',
                          style: theme.textTheme.titleLarge?.copyWith(
                            color: _ink,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const Spacer(),
                        IconButton(
                          onPressed: () => Navigator.of(sheetContext).pop(),
                          icon: const Icon(Icons.close_rounded),
                        ),
                      ],
                    ),
                    Text(
                      '随时跳到你要的那一节，不用再手动滚回前面。',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: _inkSoft,
                      ),
                    ),
                    const SizedBox(height: 14),
                    Flexible(
                      child: ListView.separated(
                        shrinkWrap: true,
                        itemCount: tocItems.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 10),
                        itemBuilder: (context, index) {
                          final item = tocItems[index];
                          return _TocEntryTile(
                            index: index,
                            title: item.title,
                            preview: item.preview,
                            blockType: item.block.type,
                            isActive: _activeBlockId == item.block.id,
                            hasSignals: _blockHasSignals(item.block),
                            metaLabel: _blockMetaLabel(item.block),
                            commentCount: _commentCountForBlock(item.block.id),
                            textHighlightCount: _textHighlightCountForBlock(
                              item.block.id,
                            ),
                            onTap: () {
                              Navigator.of(sheetContext).pop();
                              _jumpToBlock(item.block.id);
                            },
                          );
                        },
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  List<Widget> _buildInlineTocPreview(
    BuildContext context,
    List<({ContentBlock block, String title, String preview})> tocItems,
  ) {
    return tocItems
        .asMap()
        .entries
        .map((entry) {
          final index = entry.key;
          final item = entry.value;
          return Padding(
            padding: EdgeInsets.only(
              bottom: index == tocItems.length - 1 ? 0 : 10,
            ),
            child: _TocEntryTile(
              index: index,
              title: item.title,
              preview: item.preview,
              blockType: item.block.type,
              isActive: _activeBlockId == item.block.id,
              hasSignals: _blockHasSignals(item.block),
              metaLabel: _blockMetaLabel(item.block),
              commentCount: _commentCountForBlock(item.block.id),
              textHighlightCount: _textHighlightCountForBlock(item.block.id),
              compact: true,
              onTap: () => _jumpToBlock(item.block.id),
            ),
          );
        })
        .toList(growable: false);
  }

  @override
  void dispose() {
    _flashTimer?.cancel();
    _scrollController.removeListener(_handleScroll);
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final progressPercent = (_readingProgress * 100).round();
    final tocItems = widget.book.blocks
        .map(
          (block) => (
            block: block,
            title: block.title ?? _blockDisplayTitle(block),
            preview: _previewText(block.body),
          ),
        )
        .toList(growable: false);
    return Scaffold(
      floatingActionButtonLocation: FloatingActionButtonLocation.endFloat,
      floatingActionButton: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          _ReadingQuickAction(
            icon: Icons.vertical_split_rounded,
            label: '目录',
            onTap: () => _showTocSheet(context, tocItems),
          ),
          const SizedBox(height: 12),
          _ReadingQuickAction(
            icon: Icons.keyboard_double_arrow_up_rounded,
            label: '顶部',
            onTap: _scrollToTop,
          ),
        ],
      ),
      body: _EditorialBackdrop(
        secondaryOrb: _accentDeep,
        child: SafeArea(
          child: CustomScrollView(
            controller: _scrollController,
            slivers: [
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 980),
                      child: Row(
                        children: [
                          IconButton.filledTonal(
                            onPressed: () => Navigator.of(context).pop(),
                            icon: const Icon(Icons.arrow_back_rounded),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  '阅读页',
                                  style: theme.textTheme.labelLarge?.copyWith(
                                    color: _accentDeep,
                                    letterSpacing: 1.4,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  widget.book.title,
                                  style: theme.textTheme.titleLarge?.copyWith(
                                    color: _ink,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 12),
                          _ProgressPill(progressPercent: progressPercent),
                          if (widget.quoteId != null) ...[
                            const SizedBox(width: 10),
                            const _TagChip(
                              label: '来自今日一句',
                              foreground: _accentDeep,
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ),
              ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 980),
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: [Colors.white, Color(0xFFF8F1E5)],
                          ),
                          borderRadius: BorderRadius.circular(34),
                          border: Border.all(
                            color: Colors.black.withValues(alpha: 0.05),
                          ),
                          boxShadow: const [
                            BoxShadow(
                              color: Color(0x12000000),
                              blurRadius: 30,
                              offset: Offset(0, 16),
                            ),
                          ],
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(26),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Wrap(
                                spacing: 8,
                                runSpacing: 8,
                                children: [
                                  _TagChip(label: widget.book.category),
                                  _TagChip(
                                    label: widget.book.author,
                                    foreground: _olive,
                                  ),
                                  _TagChip(
                                    label: '${widget.book.blocks.length} 节内容',
                                    foreground: _accentDeep,
                                  ),
                                ],
                              ),
                              const SizedBox(height: 20),
                              Text(
                                widget.book.title,
                                style: theme.textTheme.displaySmall?.copyWith(
                                  color: _ink,
                                  height: 1.14,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              const SizedBox(height: 10),
                              Text(
                                widget.book.summary,
                                style: theme.textTheme.bodyLarge?.copyWith(
                                  color: _inkBody,
                                  height: 1.82,
                                ),
                              ),
                              const SizedBox(height: 20),
                              Text(
                                '先看摘要和目录，再进入正文',
                                style: theme.textTheme.titleMedium?.copyWith(
                                  color: _accentDeep,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                '不要一打开就把整本书平铺给自己。先确认入口、气质和结构，再往下细读。',
                                style: theme.textTheme.bodyMedium?.copyWith(
                                  color: _inkSoft,
                                  height: 1.62,
                                ),
                              ),
                              const SizedBox(height: 18),
                              DecoratedBox(
                                decoration: BoxDecoration(
                                  color: _paperDeep.withValues(alpha: 0.36),
                                  borderRadius: BorderRadius.circular(999),
                                ),
                                child: ClipRRect(
                                  borderRadius: BorderRadius.circular(999),
                                  child: LinearProgressIndicator(
                                    minHeight: 8,
                                    value: _readingProgress,
                                    backgroundColor: Colors.transparent,
                                    valueColor: AlwaysStoppedAnimation<Color>(
                                      _accentDeep,
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(height: 10),
                              Text(
                                '阅读进度 $progressPercent%',
                                style: theme.textTheme.labelLarge?.copyWith(
                                  color: _inkSoft,
                                ),
                              ),
                              const SizedBox(height: 22),
                              Wrap(
                                spacing: 12,
                                runSpacing: 12,
                                children: [
                                  FilledButton.icon(
                                    onPressed: _jumpToReadingStart,
                                    icon: const Icon(Icons.play_arrow_rounded),
                                    label: const Text('开始阅读'),
                                  ),
                                  OutlinedButton.icon(
                                    onPressed: tocItems.isEmpty
                                        ? null
                                        : () => _jumpToBlock(
                                            tocItems.first.block.id,
                                          ),
                                    icon: const Icon(
                                      Icons.vertical_split_rounded,
                                    ),
                                    label: const Text('先看第一节'),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 26),
                              Container(
                                height: 1,
                                color: _inkSoft.withValues(alpha: 0.12),
                              ),
                              const SizedBox(height: 20),
                              Row(
                                children: [
                                  Text(
                                    '目录速览',
                                    style: theme.textTheme.titleLarge?.copyWith(
                                      color: _ink,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                  const Spacer(),
                                  TextButton.icon(
                                    onPressed: () =>
                                        _showTocSheet(context, tocItems),
                                    icon: const Icon(
                                      Icons.vertical_split_rounded,
                                    ),
                                    label: const Text('全部目录'),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text(
                                '先从哪一段进入，由你自己决定。',
                                style: theme.textTheme.bodyMedium?.copyWith(
                                  color: _inkSoft,
                                  height: 1.58,
                                ),
                              ),
                              const SizedBox(height: 16),
                              ..._buildInlineTocPreview(context, tocItems),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 28),
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 980),
                      child: DecoratedBox(
                        key: _contentStartKey,
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.88),
                          borderRadius: BorderRadius.circular(36),
                          border: Border.all(
                            color: Colors.black.withValues(alpha: 0.05),
                          ),
                          boxShadow: const [
                            BoxShadow(
                              color: Color(0x12000000),
                              blurRadius: 32,
                              offset: Offset(0, 16),
                            ),
                          ],
                        ),
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(24, 30, 24, 28),
                          child: Center(
                            child: ConstrainedBox(
                              constraints: const BoxConstraints(maxWidth: 640),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    '正文',
                                    style: theme.textTheme.labelLarge?.copyWith(
                                      color: _accentDeep,
                                      letterSpacing: 2,
                                    ),
                                  ),
                                  const SizedBox(height: 10),
                                  Text(
                                    '这里才是细读区。长按文字可以高亮，每一节下面都能直接留下你的判断、标记和评论。',
                                    style: theme.textTheme.bodyMedium?.copyWith(
                                      color: _inkSoft,
                                      height: 1.62,
                                    ),
                                  ),
                                  const SizedBox(height: 22),
                                  ...List.generate(widget.book.blocks.length, (
                                    index,
                                  ) {
                                    final block = widget.book.blocks[index];
                                    final nextBlock =
                                        index < widget.book.blocks.length - 1
                                        ? widget.book.blocks[index + 1]
                                        : null;
                                    final textHighlights =
                                        widget.textHighlightsByBlock[block
                                            .id] ??
                                        const <TextHighlightAnnotation>[];

                                    return Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        _ReadableArticleSection(
                                          sectionKey: _keyForBlock(block.id),
                                          sectionIndex: index,
                                          block: block,
                                          tone:
                                              widget.highlightedBlocks[block
                                                  .id] ??
                                              HighlightTone.none,
                                          isFlagged: widget.flaggedBlockIds
                                              .contains(block.id),
                                          isActive: _activeBlockId == block.id,
                                          isFocused:
                                              _focusedBlockId == block.id,
                                          textHighlights: textHighlights,
                                          comment:
                                              widget.blockComments[block.id],
                                          onToggleFlag: () =>
                                              widget.onToggleFlag(block),
                                          onCycleHighlight: () =>
                                              widget.onCycleHighlight(block),
                                          onEditComment: () => widget
                                              .onEditComment(context, block),
                                          onSaveTextHighlight: (draft) =>
                                              widget.onSaveTextHighlight(
                                                block,
                                                draft,
                                              ),
                                          onRemoveTextHighlight:
                                              (annotationId) =>
                                                  widget.onRemoveTextHighlight(
                                                    block.id,
                                                    annotationId,
                                                  ),
                                          onEditTextHighlightComment:
                                              (annotation) => widget
                                                  .onEditTextHighlightComment(
                                                    context,
                                                    block,
                                                    annotation,
                                                  ),
                                        ),
                                        if (nextBlock != null) ...[
                                          const SizedBox(height: 38),
                                          _SectionBreak(
                                            nextLabel:
                                                nextBlock.title ??
                                                _blockDisplayTitle(nextBlock),
                                            nextType: nextBlock.type,
                                          ),
                                          const SizedBox(height: 42),
                                        ],
                                      ],
                                    );
                                  }),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SectionBreak extends StatelessWidget {
  const _SectionBreak({required this.nextLabel, required this.nextType});

  final String nextLabel;
  final BlockType nextType;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: Container(
                height: 1,
                color: _inkSoft.withValues(alpha: 0.14),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              child: Text(
                '下一节',
                style: theme.textTheme.labelLarge?.copyWith(
                  color: _inkSoft,
                  letterSpacing: 1.4,
                ),
              ),
            ),
            Expanded(
              child: Container(
                height: 1,
                color: _inkSoft.withValues(alpha: 0.14),
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          crossAxisAlignment: WrapCrossAlignment.center,
          alignment: WrapAlignment.center,
          children: [
            _TagChip(label: nextType.label, foreground: nextType.color),
            Text(
              nextLabel,
              style: theme.textTheme.titleMedium?.copyWith(
                color: _ink,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _TocEntryTile extends StatelessWidget {
  const _TocEntryTile({
    required this.index,
    required this.title,
    required this.preview,
    required this.blockType,
    required this.isActive,
    required this.hasSignals,
    required this.metaLabel,
    required this.commentCount,
    required this.textHighlightCount,
    required this.onTap,
    this.compact = false,
  });

  final int index;
  final String title;
  final String preview;
  final BlockType blockType;
  final bool isActive;
  final bool hasSignals;
  final String? metaLabel;
  final int commentCount;
  final int textHighlightCount;
  final VoidCallback onTap;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final hasCounters = commentCount > 0 || textHighlightCount > 0;

    return InkWell(
      borderRadius: BorderRadius.circular(compact ? 18 : 20),
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOutCubic,
        padding: EdgeInsets.fromLTRB(
          compact ? 12 : 14,
          compact ? 12 : 12,
          compact ? 12 : 14,
          compact ? 12 : 12,
        ),
        decoration: BoxDecoration(
          color: isActive
              ? blockType.color.withValues(alpha: 0.1)
              : compact
              ? Colors.transparent
              : Colors.white.withValues(alpha: 0.74),
          borderRadius: BorderRadius.circular(compact ? 18 : 20),
          border: Border.all(
            color: isActive
                ? blockType.color.withValues(alpha: 0.3)
                : hasSignals
                ? blockType.color.withValues(alpha: 0.14)
                : Colors.black.withValues(alpha: compact ? 0.04 : 0.05),
          ),
          boxShadow: !compact && (isActive || hasSignals)
              ? const [
                  BoxShadow(
                    color: Color(0x0D000000),
                    blurRadius: 14,
                    offset: Offset(0, 8),
                  ),
                ]
              : null,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 30,
              alignment: Alignment.topLeft,
              child: Text(
                '${index + 1}'.padLeft(2, '0'),
                style: theme.textTheme.labelLarge?.copyWith(
                  color: blockType.color,
                  letterSpacing: 1.2,
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          title,
                          style: theme.textTheme.titleMedium?.copyWith(
                            color: _ink,
                            height: 1.32,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      _TagChip(
                        label: blockType.label,
                        foreground: blockType.color,
                      ),
                    ],
                  ),
                  const SizedBox(height: 5),
                  Text(
                    preview,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: _inkSoft,
                      height: 1.52,
                    ),
                  ),
                  if (metaLabel != null || hasCounters) ...[
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        if (metaLabel != null)
                          _InlineMeta(
                            label: metaLabel!,
                            accent: blockType.color,
                          ),
                        if (textHighlightCount > 0)
                          _InlineMeta(
                            label: '$textHighlightCount 处高亮',
                            accent: _amber,
                          ),
                        if (commentCount > 0)
                          _InlineMeta(
                            label: '$commentCount 条批注',
                            accent: _accentDeep,
                          ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _InlineMeta extends StatelessWidget {
  const _InlineMeta({required this.label, required this.accent});

  final String label;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
        child: Text(
          label,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: accent,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}

class _ProgressPill extends StatelessWidget {
  const _ProgressPill({required this.progressPercent});

  final int progressPercent;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.82),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: Colors.black.withValues(alpha: 0.05)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.menu_book_rounded, size: 16, color: _accentDeep),
            const SizedBox(width: 8),
            Text(
              '$progressPercent%',
              style: theme.textTheme.labelLarge?.copyWith(color: _ink),
            ),
          ],
        ),
      ),
    );
  }
}

class _ReadingQuickAction extends StatelessWidget {
  const _ReadingQuickAction({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: onTap,
        child: Ink(
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.9),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: Colors.black.withValues(alpha: 0.05)),
            boxShadow: const [
              BoxShadow(
                color: Color(0x14000000),
                blurRadius: 20,
                offset: Offset(0, 10),
              ),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 18, color: _ink),
                const SizedBox(width: 8),
                Text(
                  label,
                  style: theme.textTheme.labelLarge?.copyWith(color: _ink),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _BundleStatusCard extends StatelessWidget {
  const _BundleStatusCard({
    required this.bundleState,
    required this.bootstrapError,
  });

  final BundleBootstrapState? bundleState;
  final String? bootstrapError;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final manifest = bundleState?.manifest;
    final primaryBundle = manifest?.bundles.isNotEmpty == true
        ? manifest!.bundles.first
        : null;

    String statusTitle;
    String statusBody;

    if (bootstrapError != null) {
      statusTitle = 'Bundle 初始化失败';
      statusBody = bootstrapError!;
    } else if (bundleState == null) {
      statusTitle = '正在准备本地内容运行时';
      statusBody = '正在创建 manifest，并准备内容数据库与用户数据库。';
    } else {
      statusTitle = '内容运行时已落地';
      statusBody =
          '当前按整包体验启动，底层现在是 manifest + content.db + user.db；正文直接在内容库里，后续再补版本保留策略。';
    }

    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Colors.white, Color(0xFFF7F0E4)],
        ),
        borderRadius: BorderRadius.circular(30),
        border: Border.all(color: Colors.black.withValues(alpha: 0.06)),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(18, 18, 18, 18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              statusTitle,
              style: theme.textTheme.titleLarge?.copyWith(
                color: _ink,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
            Text(statusBody, style: theme.textTheme.bodyMedium),
            if (bundleState != null && primaryBundle != null) ...[
              const SizedBox(height: 16),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  _TagChip(label: 'bundle ${primaryBundle.bundleId}'),
                  _TagChip(
                    label: primaryBundle.bundleVersion,
                    foreground: _olive,
                  ),
                  _TagChip(label: 'db bundle', foreground: _accentDeep),
                ],
              ),
              const SizedBox(height: 14),
              Text(
                'manifest: ${bundleState!.manifestPath}\n'
                'content.db: ${bundleState!.contentDbPath}\n'
                'user.db: ${bundleState!.userDbPath}\n'
                'schema: content ${SqliteSchemas.contentDatabase.length} 条 / user ${SqliteSchemas.userDatabase.length} 条\n'
                'registered: bundles ${bundleState!.registeredBundleCount} / objects ${bundleState!.registeredObjectCount}',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: _inkSoft,
                  height: 1.5,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _QuoteCard extends StatelessWidget {
  const _QuoteCard({
    required this.quote,
    required this.isSaved,
    required this.onSave,
    required this.onMute,
    required this.onNext,
    required this.onOpenArticle,
  });

  final QuoteEntry quote;
  final bool isSaved;
  final VoidCallback onSave;
  final VoidCallback onMute;
  final VoidCallback onNext;
  final VoidCallback onOpenArticle;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(32),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Colors.white, Color(0xFFF8F1E6)],
        ),
        border: Border.all(color: Colors.black.withValues(alpha: 0.05)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x16000000),
            blurRadius: 40,
            offset: Offset(0, 18),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 24, 24, 22),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const _TagChip(label: '今日一句'),
                const SizedBox(width: 8),
                _TagChip(label: quote.category, foreground: _olive),
                const Spacer(),
                Text(
                  quote.bookTitle,
                  style: theme.textTheme.labelLarge?.copyWith(color: _inkSoft),
                ),
              ],
            ),
            const SizedBox(height: 18),
            Text(
              '今天从这句进去',
              style: theme.textTheme.labelLarge?.copyWith(
                color: _accentDeep,
                letterSpacing: 1.2,
              ),
            ),
            const SizedBox(height: 26),
            Transform.translate(
              offset: const Offset(-2, 0),
              child: Text(
                '“',
                style: theme.textTheme.displayLarge?.copyWith(
                  color: _accent.withValues(alpha: 0.55),
                  height: 0.68,
                ),
              ),
            ),
            Text(
              quote.text,
              style: theme.textTheme.headlineMedium?.copyWith(
                color: _ink,
                height: 1.46,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 18),
            Text(
              quote.note,
              style: theme.textTheme.bodyLarge?.copyWith(color: _inkSoft),
            ),
            const SizedBox(height: 16),
            Container(height: 1, color: _inkSoft.withValues(alpha: 0.12)),
            const SizedBox(height: 16),
            Text(
              '决定：把它收进句库，还是顺着它走进正文。',
              style: theme.textTheme.bodyMedium?.copyWith(color: _inkSoft),
            ),
            const SizedBox(height: 24),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                FilledButton.icon(
                  onPressed: onSave,
                  style: FilledButton.styleFrom(
                    backgroundColor: isSaved ? _accentDeep : _ink,
                    foregroundColor: _paper,
                  ),
                  icon: Icon(
                    isSaved
                        ? Icons.bookmark_rounded
                        : Icons.bookmark_add_outlined,
                  ),
                  label: Text(isSaved ? '已收藏' : '收藏句子'),
                ),
                OutlinedButton.icon(
                  onPressed: onOpenArticle,
                  icon: const Icon(Icons.menu_book_rounded),
                  label: const Text('进入文章'),
                ),
                OutlinedButton.icon(
                  onPressed: onMute,
                  icon: const Icon(Icons.visibility_off_outlined),
                  label: const Text('屏蔽这一类'),
                ),
                TextButton.icon(
                  onPressed: onNext,
                  icon: const Icon(Icons.east_rounded),
                  label: const Text('换一句'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ReadableArticleSection extends StatefulWidget {
  const _ReadableArticleSection({
    required this.sectionKey,
    required this.sectionIndex,
    required this.block,
    required this.tone,
    required this.isFlagged,
    required this.isActive,
    required this.isFocused,
    required this.textHighlights,
    required this.comment,
    required this.onToggleFlag,
    required this.onCycleHighlight,
    required this.onEditComment,
    required this.onSaveTextHighlight,
    required this.onRemoveTextHighlight,
    required this.onEditTextHighlightComment,
  });

  final Key sectionKey;
  final int sectionIndex;
  final ContentBlock block;
  final HighlightTone tone;
  final bool isFlagged;
  final bool isActive;
  final bool isFocused;
  final List<TextHighlightAnnotation> textHighlights;
  final String? comment;
  final VoidCallback onToggleFlag;
  final VoidCallback onCycleHighlight;
  final VoidCallback onEditComment;
  final Future<void> Function(TextHighlightDraft draft) onSaveTextHighlight;
  final Future<void> Function(String annotationId) onRemoveTextHighlight;
  final Future<void> Function(TextHighlightAnnotation annotation)
  onEditTextHighlightComment;

  @override
  State<_ReadableArticleSection> createState() =>
      _ReadableArticleSectionState();
}

class _ReadableArticleSectionState extends State<_ReadableArticleSection> {
  TextHighlightDraft? _pendingDraft;

  void _handleSelectionChangedForSegment(
    _MarkdownSegment segment,
    TextSelection selection,
    SelectionChangedCause? cause,
  ) {
    final text = segment.plainText;
    if (selection.isCollapsed) {
      if (_pendingDraft != null) {
        setState(() => _pendingDraft = null);
      }
      return;
    }

    final start = math.min(selection.start, selection.end);
    final end = math.max(selection.start, selection.end);
    if (start < 0 || end > text.length || start >= end) {
      return;
    }

    setState(() {
      final absoluteStart = segment.startOffset + start;
      final absoluteEnd = segment.startOffset + end;
      _pendingDraft = TextHighlightDraft(
        selectedText: widget.block.body.substring(absoluteStart, absoluteEnd),
        startOffset: absoluteStart,
        endOffset: absoluteEnd,
        textPrefix: widget.block.body.substring(
          math.max(0, absoluteStart - 12),
          absoluteStart,
        ),
        textSuffix: widget.block.body.substring(
          absoluteEnd,
          math.min(widget.block.body.length, absoluteEnd + 12),
        ),
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final hasComment = widget.comment != null && widget.comment!.isNotEmpty;
    final hasSignals =
        widget.textHighlights.isNotEmpty ||
        hasComment ||
        widget.tone != HighlightTone.none ||
        widget.isFlagged;
    final isFocused = widget.isFocused;
    final isActive = widget.isActive;
    final highlight = widget.tone.color;
    final textStyle = theme.textTheme.bodyLarge?.copyWith(
      color: _inkBody,
      fontSize: 17.5,
      height: 2.04,
    );
    final segments = _parseMarkdownSegments(
      widget.block.markdownBody,
      widget.block.body,
    );
    final hasPendingSelection =
        _pendingDraft != null &&
        !widget.textHighlights.any(
          (item) =>
              item.startOffset == _pendingDraft!.startOffset &&
              item.endOffset == _pendingDraft!.endOffset,
        );
    final sectionLabel = '${widget.sectionIndex + 1}'.padLeft(2, '0');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AnimatedContainer(
          key: widget.sectionKey,
          duration: const Duration(milliseconds: 280),
          curve: Curves.easeOutCubic,
          decoration: BoxDecoration(
            color: isFocused
                ? _amber.withValues(alpha: 0.12)
                : isActive
                ? Colors.white.withValues(alpha: 0.76)
                : hasSignals
                ? _paperLift.withValues(alpha: 0.78)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(28),
            border: Border.all(
              color: isFocused
                  ? _amber.withValues(alpha: 0.36)
                  : isActive
                  ? widget.block.type.color.withValues(alpha: 0.2)
                  : hasComment
                  ? _accent.withValues(alpha: 0.18)
                  : widget.textHighlights.isNotEmpty
                  ? _amber.withValues(alpha: 0.24)
                  : Colors.transparent,
              width: isFocused || isActive || hasSignals ? 1.2 : 0.5,
            ),
            boxShadow: isFocused
                ? const [
                    BoxShadow(
                      color: Color(0x18E0B15A),
                      blurRadius: 22,
                      offset: Offset(0, 10),
                    ),
                  ]
                : isActive
                ? const [
                    BoxShadow(
                      color: Color(0x0E000000),
                      blurRadius: 18,
                      offset: Offset(0, 8),
                    ),
                  ]
                : hasSignals
                ? const [
                    BoxShadow(
                      color: Color(0x10000000),
                      blurRadius: 18,
                      offset: Offset(0, 10),
                    ),
                  ]
                : null,
          ),
          padding: EdgeInsets.fromLTRB(
            hasSignals || isFocused ? 18 : 0,
            hasSignals || isFocused ? 18 : 0,
            hasSignals || isFocused ? 18 : 0,
            hasSignals || isFocused ? 18 : 0,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    sectionLabel,
                    style: theme.textTheme.labelLarge?.copyWith(
                      color: widget.block.type.color,
                      letterSpacing: 1.4,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        _TagChip(
                          label: widget.block.type.label,
                          foreground: widget.block.type.color,
                        ),
                        if (hasSignals)
                          _TagChip(
                            label: hasComment
                                ? '已批注'
                                : widget.tone != HighlightTone.none
                                ? widget.tone.label
                                : '已高亮',
                            foreground: hasComment
                                ? _accentDeep
                                : widget.tone != HighlightTone.none
                                ? highlight
                                : _amber,
                          ),
                        if (widget.isFlagged)
                          const _TagChip(label: '已标记', foreground: _accentDeep),
                        if (isActive)
                          _TagChip(
                            label: '阅读中',
                            foreground: widget.block.type.color,
                          ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              if (widget.block.type == BlockType.hook)
                DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        _accent.withValues(alpha: 0.08),
                        _paperDeep.withValues(alpha: 0.42),
                        Colors.white.withValues(alpha: 0.98),
                      ],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(30),
                    border: Border.all(color: _accent.withValues(alpha: 0.14)),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 20, 20, 20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '一句话开屏',
                          style: theme.textTheme.labelLarge?.copyWith(
                            color: _accentDeep,
                            letterSpacing: 1.6,
                          ),
                        ),
                        const SizedBox(height: 12),
                        ...segments.map(
                          (segment) => Padding(
                            padding: EdgeInsets.only(
                              bottom:
                                  segment.kind == _MarkdownSegmentKind.sentence
                                  ? 14
                                  : 12,
                            ),
                            child: _buildSegmentWidget(
                              context,
                              segment,
                              baseStyle:
                                  segment.kind == _MarkdownSegmentKind.sentence
                                  ? theme.textTheme.headlineSmall?.copyWith(
                                      color: _accentDeep,
                                      height: 1.58,
                                      fontWeight: FontWeight.w700,
                                    )
                                  : theme.textTheme.bodyLarge?.copyWith(
                                      color: _inkBody,
                                      height: 1.96,
                                    ),
                              onSelectionChanged: (selection, cause) =>
                                  _handleSelectionChangedForSegment(
                                    segment,
                                    selection,
                                    cause,
                                  ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                )
              else ...[
                if (widget.block.title != null) ...[
                  Text(
                    widget.block.title!,
                    style: theme.textTheme.headlineSmall?.copyWith(
                      color: _ink,
                      height: 1.36,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 14),
                ],
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: segments.isEmpty
                      ? [
                          _buildSegmentWidget(
                            context,
                            _MarkdownSegment(
                              kind: _MarkdownSegmentKind.paragraph,
                              markdownText: widget.block.markdownBody,
                              plainText: widget.block.body,
                              startOffset: 0,
                              endOffset: widget.block.body.length,
                            ),
                            baseStyle: textStyle,
                            onSelectionChanged: (selection, cause) =>
                                _handleSelectionChangedForSegment(
                                  _MarkdownSegment(
                                    kind: _MarkdownSegmentKind.paragraph,
                                    markdownText: widget.block.markdownBody,
                                    plainText: widget.block.body,
                                    startOffset: 0,
                                    endOffset: widget.block.body.length,
                                  ),
                                  selection,
                                  cause,
                                ),
                          ),
                        ]
                      : segments
                            .map(
                              (segment) => Padding(
                                padding: EdgeInsets.only(
                                  bottom:
                                      segment.kind ==
                                          _MarkdownSegmentKind.divider
                                      ? 20
                                      : 18,
                                ),
                                child: _buildSegmentWidget(
                                  context,
                                  segment,
                                  baseStyle: textStyle,
                                  onSelectionChanged: (selection, cause) =>
                                      _handleSelectionChangedForSegment(
                                        segment,
                                        selection,
                                        cause,
                                      ),
                                ),
                              ),
                            )
                            .toList(growable: false),
                ),
              ],
            ],
          ),
        ),
        if (hasPendingSelection ||
            widget.textHighlights.isNotEmpty ||
            hasComment ||
            widget.tone != HighlightTone.none ||
            widget.isFlagged) ...[
          const SizedBox(height: 18),
          Row(
            children: [
              Container(
                width: 24,
                height: 1,
                color: _inkSoft.withValues(alpha: 0.18),
              ),
              const SizedBox(width: 10),
              Text(
                '边注与留痕',
                style: theme.textTheme.labelLarge?.copyWith(
                  color: _inkSoft,
                  letterSpacing: 1.2,
                ),
              ),
            ],
          ),
        ],
        if (widget.textHighlights.isNotEmpty) ...[
          const SizedBox(height: 10),
          Row(
            children: [
              Icon(
                Icons.auto_awesome_rounded,
                size: 16,
                color: _amber.withValues(alpha: 0.9),
              ),
              const SizedBox(width: 6),
              Text(
                '已保存的文字高亮',
                style: theme.textTheme.labelLarge?.copyWith(
                  color: _amber.withValues(alpha: 0.92),
                  letterSpacing: 0.4,
                ),
              ),
            ],
          ),
        ],
        if (hasPendingSelection) ...[
          const SizedBox(height: 14),
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  _amber.withValues(alpha: 0.16),
                  _amber.withValues(alpha: 0.08),
                ],
              ),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: _amber.withValues(alpha: 0.22)),
            ),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text(
                      '已选中：${_pendingDraft!.selectedText}',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: _ink,
                        height: 1.58,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  FilledButton.tonal(
                    onPressed: () async {
                      final draft = _pendingDraft;
                      if (draft == null) {
                        return;
                      }
                      await widget.onSaveTextHighlight(draft);
                      if (!mounted) {
                        return;
                      }
                      setState(() => _pendingDraft = null);
                    },
                    child: const Text('保存高亮'),
                  ),
                ],
              ),
            ),
          ),
        ],
        if (widget.textHighlights.isNotEmpty) ...[
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: widget.textHighlights
                .map(
                  (item) => InputChip(
                    avatar: Icon(
                      item.hasComment
                          ? Icons.sticky_note_2_rounded
                          : Icons.format_color_text_rounded,
                      size: 16,
                      color: item.hasComment
                          ? _accentDeep
                          : item.tone.color.withValues(alpha: 0.92),
                    ),
                    label: Text(
                      item.hasComment
                          ? '${_previewText(item.selectedText)}  ·  已附注'
                          : _previewText(item.selectedText),
                      style: theme.textTheme.labelLarge?.copyWith(color: _ink),
                    ),
                    onPressed: () => widget.onEditTextHighlightComment(item),
                    onDeleted: () => widget.onRemoveTextHighlight(item.id),
                    deleteIcon: const Icon(Icons.close_rounded, size: 16),
                    backgroundColor: item.hasComment
                        ? _accent.withValues(alpha: 0.14)
                        : item.tone.color.withValues(alpha: 0.18),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                      side: BorderSide(
                        color: item.hasComment
                            ? _accent.withValues(alpha: 0.26)
                            : item.tone.color.withValues(alpha: 0.26),
                      ),
                    ),
                  ),
                )
                .toList(growable: false),
          ),
        ],
        if (widget.textHighlights.any((item) => item.hasComment)) ...[
          const SizedBox(height: 14),
          Column(
            children: widget.textHighlights
                .where((item) => item.hasComment)
                .map(
                  (item) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(18),
                      onTap: () => widget.onEditTextHighlightComment(item),
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              _accent.withValues(alpha: 0.12),
                              Colors.white.withValues(alpha: 0.9),
                            ],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(
                            color: _accent.withValues(alpha: 0.18),
                          ),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  const Icon(
                                    Icons.sticky_note_2_rounded,
                                    size: 16,
                                    color: _accentDeep,
                                  ),
                                  const SizedBox(width: 6),
                                  Text(
                                    _previewText(item.selectedText),
                                    style: theme.textTheme.labelLarge?.copyWith(
                                      color: _accentDeep,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text(
                                item.comment!,
                                style: theme.textTheme.bodyMedium?.copyWith(
                                  color: _ink,
                                  height: 1.62,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                )
                .toList(growable: false),
          ),
        ],
        if (hasComment) ...[
          const SizedBox(height: 14),
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  _accent.withValues(alpha: 0.12),
                  Colors.white.withValues(alpha: 0.88),
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: _accent.withValues(alpha: 0.18)),
            ),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      color: _accent.withValues(alpha: 0.12),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.mode_comment_rounded,
                      size: 16,
                      color: _accentDeep,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '这段有你的批注',
                          style: theme.textTheme.labelLarge?.copyWith(
                            color: _accentDeep,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          widget.comment!,
                          style: theme.textTheme.bodyMedium?.copyWith(
                            color: _ink,
                            height: 1.62,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
        const SizedBox(height: 14),
        DecoratedBox(
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.76),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: hasComment
                  ? _accent.withValues(alpha: 0.18)
                  : widget.tone != HighlightTone.none
                  ? highlight.withValues(alpha: 0.2)
                  : widget.textHighlights.isNotEmpty
                  ? _amber.withValues(alpha: 0.2)
                  : Colors.black.withValues(alpha: 0.05),
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    if (widget.tone != HighlightTone.none)
                      _TagChip(label: widget.tone.label, foreground: highlight),
                    if (widget.textHighlights.isNotEmpty)
                      _TagChip(
                        label: '${widget.textHighlights.length} 处文字高亮',
                        foreground: _amber,
                      ),
                    if (widget.textHighlights.any((item) => item.hasComment))
                      const _TagChip(label: '高亮有附注', foreground: _accentDeep),
                    if (hasComment)
                      const _TagChip(label: '有评论', foreground: _accentDeep),
                    if (!hasComment &&
                        widget.tone == HighlightTone.none &&
                        widget.textHighlights.isEmpty &&
                        !widget.isFlagged)
                      const _TagChip(label: '未留痕', foreground: _inkSoft),
                  ],
                ),
                const SizedBox(height: 10),
                Text(
                  '这节的留痕',
                  style: theme.textTheme.labelLarge?.copyWith(
                    color: _inkSoft,
                    letterSpacing: 1,
                  ),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    TextButton.icon(
                      onPressed: widget.onToggleFlag,
                      icon: Icon(
                        widget.isFlagged
                            ? Icons.flag_rounded
                            : Icons.outlined_flag_rounded,
                        size: 18,
                      ),
                      label: Text(widget.isFlagged ? '取消标记' : '标记'),
                    ),
                    TextButton.icon(
                      onPressed: widget.onCycleHighlight,
                      icon: const Icon(Icons.highlight_alt_rounded, size: 18),
                      label: Text(
                        widget.tone == HighlightTone.none ? '整段划线' : '换色',
                      ),
                    ),
                    TextButton.icon(
                      onPressed: widget.onEditComment,
                      icon: Icon(
                        hasComment
                            ? Icons.chat_bubble_rounded
                            : Icons.mode_comment_outlined,
                        size: 18,
                      ),
                      label: Text(hasComment ? '编辑评论' : '评论'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildSegmentWidget(
    BuildContext context,
    _MarkdownSegment segment, {
    required TextStyle? baseStyle,
    required void Function(TextSelection, SelectionChangedCause?)
    onSelectionChanged,
  }) {
    final theme = Theme.of(context);
    final segmentHighlights = _highlightsForSegment(
      segment,
      widget.textHighlights,
    );

    Widget buildSelectable(TextStyle? style) {
      return SelectableText.rich(
        TextSpan(
          children: _buildHighlightedSpans(
            text: segment.plainText,
            highlights: segmentHighlights,
            style: style,
          ),
        ),
        onSelectionChanged: onSelectionChanged,
      );
    }

    switch (segment.kind) {
      case _MarkdownSegmentKind.sentence:
        return DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Colors.white.withValues(alpha: 0.96),
                _paperDeep.withValues(alpha: 0.34),
              ],
            ),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: _accent.withValues(alpha: 0.18)),
            boxShadow: const [
              BoxShadow(
                color: Color(0x0F000000),
                blurRadius: 14,
                offset: Offset(0, 8),
              ),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 28,
                      height: 28,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: _accent.withValues(alpha: 0.14),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        segment.ordinal == null ? '句' : '${segment.ordinal}',
                        style: theme.textTheme.labelLarge?.copyWith(
                          color: _accentDeep,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Text(
                      '记忆句子',
                      style: theme.textTheme.labelLarge?.copyWith(
                        color: _accentDeep,
                        letterSpacing: 1.2,
                      ),
                    ),
                    const Spacer(),
                    Text(
                      '“”',
                      style: theme.textTheme.titleLarge?.copyWith(
                        color: _accent.withValues(alpha: 0.3),
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                buildSelectable(
                  theme.textTheme.headlineSmall?.copyWith(
                    color: _accentDeep,
                    height: 1.6,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        );
      case _MarkdownSegmentKind.heading:
        return Padding(
          padding: const EdgeInsets.only(top: 4, bottom: 2),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 42,
                height: 3,
                decoration: BoxDecoration(
                  color: _accent.withValues(alpha: 0.4),
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
              const SizedBox(height: 10),
              buildSelectable(
                theme.textTheme.titleLarge?.copyWith(
                  color: _inkBody,
                  height: 1.42,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        );
      case _MarkdownSegmentKind.quote:
        return DecoratedBox(
          decoration: BoxDecoration(
            color: _olive.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(22),
            border: Border(
              left: BorderSide(
                color: _olive.withValues(alpha: 0.68),
                width: 3.5,
              ),
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 14, 14),
            child: buildSelectable(
              theme.textTheme.titleMedium?.copyWith(
                color: _inkBody,
                height: 1.74,
                fontStyle: FontStyle.italic,
              ),
            ),
          ),
        );
      case _MarkdownSegmentKind.bullet:
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 18,
              alignment: Alignment.topCenter,
              margin: const EdgeInsets.only(right: 10, top: 6),
              child: Container(
                width: 6,
                height: 6,
                decoration: const BoxDecoration(
                  color: _accentDeep,
                  shape: BoxShape.circle,
                ),
              ),
            ),
            Expanded(
              child: buildSelectable(
                baseStyle?.copyWith(color: _inkBody, height: 1.88),
              ),
            ),
          ],
        );
      case _MarkdownSegmentKind.ordered:
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 24,
              height: 24,
              alignment: Alignment.center,
              margin: const EdgeInsets.only(right: 12, top: 4),
              decoration: BoxDecoration(
                color: _accent.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                '${segment.ordinal ?? 1}',
                style: theme.textTheme.labelLarge?.copyWith(
                  color: _accentDeep,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            Expanded(
              child: buildSelectable(
                baseStyle?.copyWith(color: _inkBody, height: 1.88),
              ),
            ),
          ],
        );
      case _MarkdownSegmentKind.divider:
        return Center(
          child: Container(
            width: 72,
            height: 1,
            color: _inkSoft.withValues(alpha: 0.22),
          ),
        );
      case _MarkdownSegmentKind.paragraph:
        return buildSelectable(
          baseStyle?.copyWith(color: _inkBody, height: 1.98),
        );
    }
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.eyebrow,
    required this.title,
    required this.body,
  });

  final String eyebrow;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Colors.white, Color(0xFFF8F1E6)],
        ),
        borderRadius: BorderRadius.circular(30),
        border: Border.all(color: Colors.black.withValues(alpha: 0.05)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x10000000),
            blurRadius: 20,
            offset: Offset(0, 10),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              eyebrow,
              style: theme.textTheme.labelLarge?.copyWith(
                color: _accentDeep,
                letterSpacing: 1.5,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              title,
              style: theme.textTheme.titleLarge?.copyWith(
                color: _ink,
                height: 1.32,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              body,
              style: theme.textTheme.bodyMedium?.copyWith(color: _inkSoft),
            ),
          ],
        ),
      ),
    );
  }
}

enum _MarkdownSegmentKind {
  paragraph,
  quote,
  bullet,
  ordered,
  heading,
  divider,
  sentence,
}

class _MarkdownSegment {
  const _MarkdownSegment({
    required this.kind,
    required this.markdownText,
    required this.plainText,
    required this.startOffset,
    required this.endOffset,
    this.ordinal,
  });

  final _MarkdownSegmentKind kind;
  final String markdownText;
  final String plainText;
  final int startOffset;
  final int endOffset;
  final int? ordinal;
}

class _MarkdownSegmentDraft {
  const _MarkdownSegmentDraft({
    required this.kind,
    required this.markdownText,
    required this.plainText,
    this.ordinal,
  });

  final _MarkdownSegmentKind kind;
  final String markdownText;
  final String plainText;
  final int? ordinal;
}

String _blockDisplayTitle(ContentBlock block) {
  if (block.type == BlockType.hook) {
    return '一句话开屏';
  }
  return block.type.label;
}

String _previewText(String text) {
  const maxLength = 68;
  final normalized = text.trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return '${normalized.substring(0, maxLength)}...';
}

List<_MarkdownSegment> _parseMarkdownSegments(
  String markdown,
  String plainText,
) {
  final normalizedSource = markdown.replaceAll('\r\n', '\n').trim();
  if (normalizedSource.isEmpty) {
    return <_MarkdownSegment>[
      _MarkdownSegment(
        kind: _MarkdownSegmentKind.paragraph,
        markdownText: plainText,
        plainText: plainText,
        startOffset: 0,
        endOffset: plainText.length,
      ),
    ];
  }

  final drafts = <_MarkdownSegmentDraft>[];
  final paragraphBuffer = <String>[];

  void flushParagraph() {
    if (paragraphBuffer.isEmpty) {
      return;
    }
    final raw = paragraphBuffer.join('\n').trim();
    final plain = _normalizeMarkdownPlainText(raw);
    if (plain.isNotEmpty) {
      drafts.add(
        _MarkdownSegmentDraft(
          kind: _MarkdownSegmentKind.paragraph,
          markdownText: raw,
          plainText: plain,
        ),
      );
    }
    paragraphBuffer.clear();
  }

  for (final line in normalizedSource.split('\n')) {
    final trimmed = line.trimRight();
    final compact = trimmed.trim();
    if (compact.isEmpty) {
      flushParagraph();
      continue;
    }

    final sentenceMatch = RegExp(
      r'^@@sentence\|([^|]*)\|(.+)$',
    ).firstMatch(compact);
    if (sentenceMatch != null) {
      flushParagraph();
      final sentenceText = sentenceMatch.group(2)!.trim();
      drafts.add(
        _MarkdownSegmentDraft(
          kind: _MarkdownSegmentKind.sentence,
          markdownText: sentenceText,
          plainText: _normalizeMarkdownPlainText(sentenceText),
          ordinal: int.tryParse(sentenceMatch.group(1) ?? ''),
        ),
      );
      continue;
    }

    final headingMatch = RegExp(r'^(#{1,4})\s+(.+)$').firstMatch(compact);
    if (headingMatch != null) {
      flushParagraph();
      final headingText = headingMatch.group(2)!.trim();
      drafts.add(
        _MarkdownSegmentDraft(
          kind: _MarkdownSegmentKind.heading,
          markdownText: headingText,
          plainText: _normalizeMarkdownPlainText(headingText),
        ),
      );
      continue;
    }

    if (compact == '---' || compact == '***') {
      flushParagraph();
      drafts.add(
        const _MarkdownSegmentDraft(
          kind: _MarkdownSegmentKind.divider,
          markdownText: '---',
          plainText: '',
        ),
      );
      continue;
    }

    final quoteMatch = RegExp(r'^>\s?(.*)$').firstMatch(compact);
    if (quoteMatch != null) {
      flushParagraph();
      final quoteText = quoteMatch.group(1)!.trim();
      drafts.add(
        _MarkdownSegmentDraft(
          kind: _MarkdownSegmentKind.quote,
          markdownText: quoteText,
          plainText: _normalizeMarkdownPlainText(quoteText),
        ),
      );
      continue;
    }

    final orderedMatch = RegExp(r'^(\d+)\.\s+(.+)$').firstMatch(compact);
    if (orderedMatch != null) {
      flushParagraph();
      final itemText = orderedMatch.group(2)!.trim();
      drafts.add(
        _MarkdownSegmentDraft(
          kind: _MarkdownSegmentKind.ordered,
          markdownText: itemText,
          plainText: _normalizeMarkdownPlainText(itemText),
          ordinal: int.tryParse(orderedMatch.group(1)!),
        ),
      );
      continue;
    }

    final bulletMatch = RegExp(r'^[-*]\s+(.+)$').firstMatch(compact);
    if (bulletMatch != null) {
      flushParagraph();
      final itemText = bulletMatch.group(1)!.trim();
      drafts.add(
        _MarkdownSegmentDraft(
          kind: _MarkdownSegmentKind.bullet,
          markdownText: itemText,
          plainText: _normalizeMarkdownPlainText(itemText),
        ),
      );
      continue;
    }

    paragraphBuffer.add(compact);
  }

  flushParagraph();

  if (drafts.isEmpty) {
    return <_MarkdownSegment>[
      _MarkdownSegment(
        kind: _MarkdownSegmentKind.paragraph,
        markdownText: plainText,
        plainText: plainText,
        startOffset: 0,
        endOffset: plainText.length,
      ),
    ];
  }

  final normalizedBlockText = _normalizeMarkdownPlainText(plainText);
  var cursor = 0;
  final segments = <_MarkdownSegment>[];

  for (final draft in drafts) {
    if (draft.kind == _MarkdownSegmentKind.divider || draft.plainText.isEmpty) {
      segments.add(
        _MarkdownSegment(
          kind: draft.kind,
          markdownText: draft.markdownText,
          plainText: draft.plainText,
          startOffset: cursor,
          endOffset: cursor,
          ordinal: draft.ordinal,
        ),
      );
      continue;
    }

    final located = _findSegmentRange(
      fullText: normalizedBlockText,
      segmentText: draft.plainText,
      cursor: cursor,
    );
    segments.add(
      _MarkdownSegment(
        kind: draft.kind,
        markdownText: draft.markdownText,
        plainText: draft.plainText,
        startOffset: located.$1,
        endOffset: located.$2,
        ordinal: draft.ordinal,
      ),
    );
    cursor = located.$2;
  }

  return segments;
}

String _normalizeMarkdownPlainText(String source) {
  var text = source;
  text = text.replaceAllMapped(
    RegExp(r'\[(.*?)\]\(.*?\)'),
    (match) => match.group(1) ?? '',
  );
  text = text.replaceAllMapped(
    RegExp(r'`([^`]+)`'),
    (match) => match.group(1) ?? '',
  );
  text = text.replaceAllMapped(
    RegExp(r'\*\*(.*?)\*\*'),
    (match) => match.group(1) ?? '',
  );
  text = text.replaceAllMapped(
    RegExp(r'__(.*?)__'),
    (match) => match.group(1) ?? '',
  );
  text = text.replaceAllMapped(
    RegExp(r'(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)'),
    (match) => match.group(1) ?? '',
  );
  text = text.replaceAllMapped(
    RegExp(r'(?<!_)_(?!_)(.+?)(?<!_)_(?!_)'),
    (match) => match.group(1) ?? '',
  );
  text = text.replaceAll(RegExp(r'\s+'), ' ');
  return text.trim();
}

(int, int) _findSegmentRange({
  required String fullText,
  required String segmentText,
  required int cursor,
}) {
  final located = fullText.indexOf(segmentText, cursor);
  if (located >= 0) {
    return (located, located + segmentText.length);
  }

  final safeStart = cursor.clamp(0, fullText.length);
  final safeEnd = math.min(fullText.length, safeStart + segmentText.length);
  return (safeStart, safeEnd);
}

List<TextHighlightAnnotation> _highlightsForSegment(
  _MarkdownSegment segment,
  List<TextHighlightAnnotation> highlights,
) {
  if (segment.endOffset <= segment.startOffset) {
    return const <TextHighlightAnnotation>[];
  }

  final result = <TextHighlightAnnotation>[];
  for (final item in highlights) {
    final start = math.max(item.startOffset, segment.startOffset);
    final end = math.min(item.endOffset, segment.endOffset);
    if (start >= end) {
      continue;
    }

    final relativeStart = start - segment.startOffset;
    final relativeEnd = end - segment.startOffset;
    result.add(
      TextHighlightAnnotation(
        id: item.id,
        blockId: item.blockId,
        selectedText: segment.plainText.substring(relativeStart, relativeEnd),
        startOffset: relativeStart,
        endOffset: relativeEnd,
        tone: item.tone,
        textPrefix: item.textPrefix,
        textSuffix: item.textSuffix,
        comment: item.comment,
      ),
    );
  }
  return result;
}

List<InlineSpan> _buildHighlightedSpans({
  required String text,
  required List<TextHighlightAnnotation> highlights,
  required TextStyle? style,
}) {
  if (highlights.isEmpty) {
    return [TextSpan(text: text, style: style)];
  }

  final spans = <InlineSpan>[];
  var cursor = 0;

  for (final highlight in highlights) {
    final start = highlight.startOffset;
    final end = highlight.endOffset;
    if (start < cursor || start < 0 || end > text.length || start >= end) {
      continue;
    }

    if (start > cursor) {
      spans.add(TextSpan(text: text.substring(cursor, start), style: style));
    }

    spans.add(
      TextSpan(
        text: text.substring(start, end),
        style: style?.copyWith(
          backgroundColor: highlight.tone.color.withValues(alpha: 0.24),
        ),
      ),
    );
    cursor = end;
  }

  if (cursor < text.length) {
    spans.add(TextSpan(text: text.substring(cursor), style: style));
  }

  if (spans.isEmpty) {
    spans.add(TextSpan(text: text, style: style));
  }

  return spans;
}

class _TagChip extends StatelessWidget {
  const _TagChip({required this.label, this.foreground = _accentDeep});

  final String label;
  final Color foreground;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: foreground.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: foreground.withValues(alpha: 0.12)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Text(
          label,
          style: Theme.of(
            context,
          ).textTheme.labelLarge?.copyWith(color: foreground),
        ),
      ),
    );
  }
}

class _StatPill extends StatelessWidget {
  const _StatPill({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.82),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: Colors.black.withValues(alpha: 0.05)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              value,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                color: _ink,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(width: 8),
            Text(label, style: Theme.of(context).textTheme.bodyMedium),
          ],
        ),
      ),
    );
  }
}

class _EmptySavedState extends StatelessWidget {
  const _EmptySavedState();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Colors.white, Color(0xFFF8F1E6)],
        ),
        borderRadius: BorderRadius.circular(30),
        border: Border.all(color: Colors.black.withValues(alpha: 0.05)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.menu_book_rounded,
              size: 54,
              color: _accent.withValues(alpha: 0.85),
            ),
            const SizedBox(height: 18),
            Text(
              '先收藏第一句',
              style: theme.textTheme.headlineSmall?.copyWith(
                color: _ink,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              '你的句库以后应该成为个人索引，而不是一堆漂亮摘录。收藏过的句子，会是后续推荐和复盘的主信号。',
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyMedium,
            ),
          ],
        ),
      ),
    );
  }
}

class _CommentSheet extends StatelessWidget {
  const _CommentSheet({
    required this.controller,
    this.title = '给这段留一句评论',
    this.subtitle = '先留一个短判断，之后再决定要不要展开成长评论。',
    this.hintText = '例如：这段特别像我现在的问题，值得以后回看。',
  });

  final TextEditingController controller;
  final String title;
  final String subtitle;
  final String hintText;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
        top: 16,
      ),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(28),
        ),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 18),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  color: _ink,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 8),
              Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
              const SizedBox(height: 16),
              TextField(
                controller: controller,
                maxLines: 4,
                minLines: 3,
                decoration: InputDecoration(
                  hintText: hintText,
                  filled: true,
                  fillColor: _paper,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(20),
                    borderSide: BorderSide.none,
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  TextButton(
                    onPressed: () => Navigator.of(context).pop(''),
                    child: const Text('清空'),
                  ),
                  const Spacer(),
                  FilledButton(
                    onPressed: () =>
                        Navigator.of(context).pop(controller.text.trim()),
                    style: FilledButton.styleFrom(
                      backgroundColor: _ink,
                      foregroundColor: _paper,
                    ),
                    child: const Text('保存评论'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Orb extends StatelessWidget {
  const _Orb({required this.size, required this.color});

  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Transform.rotate(
        angle: math.pi / 5,
        child: Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: RadialGradient(
              colors: [
                color.withValues(alpha: 0.22),
                color.withValues(alpha: 0.06),
                Colors.transparent,
              ],
            ),
          ),
        ),
      ),
    );
  }
}
