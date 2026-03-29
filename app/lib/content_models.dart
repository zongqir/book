import 'package:flutter/material.dart';

const _accent = Color(0xFFC75C3A);
const _accentDeep = Color(0xFF8D3219);
const _olive = Color(0xFF6B775A);
const _amber = Color(0xFFE0B15A);
const _sage = Color(0xFF93A37A);

class QuoteEntry {
  const QuoteEntry({
    required this.id,
    required this.bookId,
    required this.bookTitle,
    required this.category,
    required this.text,
    required this.note,
  });

  final String id;
  final String bookId;
  final String bookTitle;
  final String category;
  final String text;
  final String note;
}

class BookEntry {
  const BookEntry({
    required this.id,
    required this.title,
    required this.author,
    required this.category,
    required this.summary,
    required this.articleMarkdown,
    required this.blocks,
  });

  final String id;
  final String title;
  final String author;
  final String category;
  final String summary;
  final String articleMarkdown;
  final List<ContentBlock> blocks;
}

class ContentBlock {
  const ContentBlock({
    required this.id,
    required this.articleId,
    required this.articleVersionId,
    required this.type,
    required this.body,
    String? markdownBody,
    this.title,
  }) : markdownBody = markdownBody ?? body;

  final String id;
  final String articleId;
  final String articleVersionId;
  final BlockType type;
  final String body;
  final String markdownBody;
  final String? title;
}

class TextHighlightAnnotation {
  const TextHighlightAnnotation({
    required this.id,
    required this.blockId,
    required this.selectedText,
    required this.startOffset,
    required this.endOffset,
    required this.tone,
    this.textPrefix,
    this.textSuffix,
    this.comment,
  });

  final String id;
  final String blockId;
  final String selectedText;
  final int startOffset;
  final int endOffset;
  final HighlightTone tone;
  final String? textPrefix;
  final String? textSuffix;
  final String? comment;

  bool get hasComment => comment != null && comment!.isNotEmpty;

  TextHighlightAnnotation copyWith({String? comment}) {
    return TextHighlightAnnotation(
      id: id,
      blockId: blockId,
      selectedText: selectedText,
      startOffset: startOffset,
      endOffset: endOffset,
      tone: tone,
      textPrefix: textPrefix,
      textSuffix: textSuffix,
      comment: comment,
    );
  }
}

class TextHighlightDraft {
  const TextHighlightDraft({
    required this.selectedText,
    required this.startOffset,
    required this.endOffset,
    this.textPrefix,
    this.textSuffix,
  });

  final String selectedText;
  final int startOffset;
  final int endOffset;
  final String? textPrefix;
  final String? textSuffix;
}

enum BlockType {
  hook('一句话', _accentDeep),
  principle('原则', _olive),
  caseStudy('案例', _accent),
  action('行动', _amber);

  const BlockType(this.label, this.color);

  final String label;
  final Color color;

  static BlockType fromStorage(String value) {
    switch (value) {
      case 'hook':
        return BlockType.hook;
      case 'principle':
        return BlockType.principle;
      case 'caseStudy':
        return BlockType.caseStudy;
      case 'action':
        return BlockType.action;
      default:
        return BlockType.principle;
    }
  }
}

enum HighlightTone {
  none('未划线', Colors.transparent),
  amber('金色划线', _amber),
  sage('绿色划线', _sage),
  rust('陶土划线', _accent);

  const HighlightTone(this.label, this.color);

  final String label;
  final Color color;
  String get storageKey => name;

  HighlightTone get next {
    switch (this) {
      case HighlightTone.none:
        return HighlightTone.amber;
      case HighlightTone.amber:
        return HighlightTone.sage;
      case HighlightTone.sage:
        return HighlightTone.rust;
      case HighlightTone.rust:
        return HighlightTone.none;
    }
  }

  static HighlightTone fromStorage(String? value) {
    switch (value) {
      case 'amber':
        return HighlightTone.amber;
      case 'sage':
        return HighlightTone.sage;
      case 'rust':
        return HighlightTone.rust;
      default:
        return HighlightTone.none;
    }
  }
}

const sampleQuotes = <QuoteEntry>[
  QuoteEntry(
    id: 'principle-1',
    bookId: 'principles',
    bookTitle: '原则',
    category: '判断',
    text: '如果你看不见自己是怎么做判断的，你就会把运气误认成能力。',
    note: '适合做开屏句，因为它既有锋利度，也自然能往“原则页”继续展开。',
  ),
  QuoteEntry(
    id: 'friend-time-1',
    bookId: 'time-friend',
    bookTitle: '把时间当作朋友',
    category: '成长',
    text: '成长不是把时间塞满，而是把注意力用在长期会复利的地方。',
    note: '这类句子适合被收藏，因为它会反复对应到执行、学习和长期投入这些场景。',
  ),
  QuoteEntry(
    id: 'peak-performance-1',
    bookId: 'systems-performance',
    bookTitle: '性能之巅',
    category: '技术',
    text: '排障真正怕的不是问题太复杂，而是你第一眼就把问题认错了。',
    note: '工具型书也能有漂亮入口，但它更适合顺着这句话进入问题地图，而不是停在抒情。',
  ),
];

final sampleBooks = <BookEntry>[
  BookEntry(
    id: 'principles',
    title: '原则',
    author: 'Ray Dalio',
    category: '判断',
    summary: '这本书最适合被拆成判断流程，而不是单纯励志句库。核心价值在于：把模糊经验压成可复盘的判断机制。',
    articleMarkdown: '''
> 如果你看不见自己是怎么做判断的，你就会把运气误认成能力。

## 把判断流程显性化

这本书真正值钱的地方，不是告诉你“要理性”，而是逼你把判断过程拆出来：你看了什么事实、用了什么标准、在哪一步最容易自欺。

## 最典型的误判场景

事情做成了一次，人很容易把它解释成自己水平够高；但如果没有回看过程，就无法分辨这次到底是判断好，还是只是环境刚好帮了你。

## 最小动作

下次做重要判断时，只记三件事：我基于什么事实、我用了什么标准、如果错了最可能错在哪。先别追求复杂，先让自己能复盘。
''',
    blocks: [
      ContentBlock(
        id: 'principles-hook',
        articleId: 'principles-overview',
        articleVersionId: 'principles-overview@v1',
        type: BlockType.hook,
        body: '如果你看不见自己是怎么做判断的，你就会把运气误认成能力。',
      ),
      ContentBlock(
        id: 'principles-principle',
        articleId: 'principles-overview',
        articleVersionId: 'principles-overview@v1',
        type: BlockType.principle,
        title: '把判断流程显性化',
        body: '这本书真正值钱的地方，不是告诉你“要理性”，而是逼你把判断过程拆出来：你看了什么事实、用了什么标准、在哪一步最容易自欺。',
      ),
      ContentBlock(
        id: 'principles-case',
        articleId: 'principles-overview',
        articleVersionId: 'principles-overview@v1',
        type: BlockType.caseStudy,
        title: '最典型的误判场景',
        body: '事情做成了一次，人很容易把它解释成自己水平够高；但如果没有回看过程，就无法分辨这次到底是判断好，还是只是环境刚好帮了你。',
      ),
      ContentBlock(
        id: 'principles-action',
        articleId: 'principles-overview',
        articleVersionId: 'principles-overview@v1',
        type: BlockType.action,
        title: '最小动作',
        body: '下次做重要判断时，只记三件事：我基于什么事实、我用了什么标准、如果错了最可能错在哪。先别追求复杂，先让自己能复盘。',
      ),
    ],
  ),
  BookEntry(
    id: 'time-friend',
    title: '把时间当作朋友',
    author: '李笑来',
    category: '成长',
    summary: '这本书不是讲时间管理技巧，而是训练你换一个长期单位来理解自己的投入。它更适合拆成一句、原则、案例和行动的连续结构。',
    articleMarkdown: '''
> 成长不是把时间塞满，而是把注意力用在长期会复利的地方。

## 先换判断单位

如果总用“今天做了多少”来评价自己，就会不停追逐即时完成感；但很多真正重要的能力，恰恰是在长期、缓慢、重复里增长的。

## 为什么总想重新开始

很多计划并不是难，而是切得太大。动作一旦大到让人每次都要重新鼓起劲，它就更像一次冲刺，而不像可以长期维持的结构。

## 最小动作

把你现在最想建立的一件长期能力，切成一个 15 分钟就能完成的小动作，然后只要求连续 7 天，而不是一口气翻盘。
''',
    blocks: [
      ContentBlock(
        id: 'time-hook',
        articleId: 'time-friend-overview',
        articleVersionId: 'time-friend-overview@v1',
        type: BlockType.hook,
        body: '成长不是把时间塞满，而是把注意力用在长期会复利的地方。',
      ),
      ContentBlock(
        id: 'time-principle',
        articleId: 'time-friend-overview',
        articleVersionId: 'time-friend-overview@v1',
        type: BlockType.principle,
        title: '先换判断单位',
        body: '如果总用“今天做了多少”来评价自己，就会不停追逐即时完成感；但很多真正重要的能力，恰恰是在长期、缓慢、重复里增长的。',
      ),
      ContentBlock(
        id: 'time-case',
        articleId: 'time-friend-overview',
        articleVersionId: 'time-friend-overview@v1',
        type: BlockType.caseStudy,
        title: '为什么总想重新开始',
        body: '很多计划并不是难，而是切得太大。动作一旦大到让人每次都要重新鼓起劲，它就更像一次冲刺，而不像可以长期维持的结构。',
      ),
      ContentBlock(
        id: 'time-action',
        articleId: 'time-friend-overview',
        articleVersionId: 'time-friend-overview@v1',
        type: BlockType.action,
        title: '最小动作',
        body: '把你现在最想建立的一件长期能力，切成一个 15 分钟就能完成的小动作，然后只要求连续 7 天，而不是一口气翻盘。',
      ),
    ],
  ),
  BookEntry(
    id: 'systems-performance',
    title: '性能之巅',
    author: 'Brendan Gregg',
    category: '技术',
    summary: '这本书更像问题地图，而不是漂亮摘录。它的商业价值不在金句，而在于把性能排障从慌乱经验变成稳定路径。',
    articleMarkdown: '''
> 排障真正怕的不是问题太复杂，而是你第一眼就把问题认错了。

## 先找方向，再找细节

性能问题最容易让人一上来就钻到某个工具里，但更稳的做法是先判断瓶颈大致属于 CPU、内存、磁盘、网络还是锁，再进入细查。

## 最常见的错法

看到响应慢就直接把锅甩给数据库，是典型的第一眼误判。很多问题看起来像 SQL 慢，实际上是上游线程等待、锁竞争或者 IO 抖动。

## 最小动作

给自己做一张排障顺序卡：出现慢请求时先看系统资源方向，再列对应工具。不要每次都从记忆里临时翻框架。
''',
    blocks: [
      ContentBlock(
        id: 'perf-hook',
        articleId: 'systems-performance-overview',
        articleVersionId: 'systems-performance-overview@v1',
        type: BlockType.hook,
        body: '排障真正怕的不是问题太复杂，而是你第一眼就把问题认错了。',
      ),
      ContentBlock(
        id: 'perf-principle',
        articleId: 'systems-performance-overview',
        articleVersionId: 'systems-performance-overview@v1',
        type: BlockType.principle,
        title: '先找方向，再找细节',
        body: '性能问题最容易让人一上来就钻到某个工具里，但更稳的做法是先判断瓶颈大致属于 CPU、内存、磁盘、网络还是锁，再进入细查。',
      ),
      ContentBlock(
        id: 'perf-case',
        articleId: 'systems-performance-overview',
        articleVersionId: 'systems-performance-overview@v1',
        type: BlockType.caseStudy,
        title: '最常见的错法',
        body:
            '看到响应慢就直接把锅甩给数据库，是典型的第一眼误判。很多问题看起来像 SQL 慢，实际上是上游线程等待、锁竞争或者 IO 抖动。',
      ),
      ContentBlock(
        id: 'perf-action',
        articleId: 'systems-performance-overview',
        articleVersionId: 'systems-performance-overview@v1',
        type: BlockType.action,
        title: '最小动作',
        body: '给自己做一张排障顺序卡：出现慢请求时先看系统资源方向，再列对应工具。不要每次都从记忆里临时翻框架。',
      ),
    ],
  ),
];

String buildArticleMarkdown(List<ContentBlock> blocks) {
  final buffer = StringBuffer();

  for (final block in blocks) {
    final body = block.body.trim();
    if (body.isEmpty) {
      continue;
    }

    if (buffer.isNotEmpty) {
      buffer.writeln();
      buffer.writeln();
    }

    switch (block.type) {
      case BlockType.hook:
        buffer.write('> $body');
      case BlockType.principle:
      case BlockType.caseStudy:
      case BlockType.action:
        if (block.title != null && block.title!.trim().isNotEmpty) {
          buffer.writeln('## ${block.title!.trim()}');
          buffer.writeln();
        }
        buffer.write(body);
    }
  }

  return buffer.toString();
}
