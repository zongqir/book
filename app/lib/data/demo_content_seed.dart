const demoSeedBooks = <Map<String, Object?>>[
  {
    'id': 'principles',
    'slug': 'principles',
    'title': '原则',
    'author': 'Ray Dalio',
    'category': '判断',
    'summary': '这本书最适合被拆成判断流程，而不是单纯励志句库。核心价值在于：把模糊经验压成可复盘的判断机制。',
    'created_at': '2026-03-28T10:00:00+08:00',
    'updated_at': '2026-03-28T10:00:00+08:00',
  },
  {
    'id': 'time-friend',
    'slug': 'time-friend',
    'title': '把时间当作朋友',
    'author': '李笑来',
    'category': '成长',
    'summary': '这本书不是讲时间管理技巧，而是训练你换一个长期单位来理解自己的投入。它更适合拆成一句、原则、案例和行动的连续结构。',
    'created_at': '2026-03-28T10:00:00+08:00',
    'updated_at': '2026-03-28T10:00:00+08:00',
  },
  {
    'id': 'systems-performance',
    'slug': 'systems-performance',
    'title': '性能之巅',
    'author': 'Brendan Gregg',
    'category': '技术',
    'summary': '这本书更像问题地图，而不是漂亮摘录。它的商业价值不在金句，而在于把性能排障从慌乱经验变成稳定路径。',
    'created_at': '2026-03-28T10:00:00+08:00',
    'updated_at': '2026-03-28T10:00:00+08:00',
  },
];

const demoSeedArticles = <Map<String, Object?>>[
  {
    'id': 'principles-overview',
    'book_id': 'principles',
    'slug': 'principles-overview',
    'title': '原则',
    'article_type': 'overview',
    'summary': '这本书最适合被拆成判断流程，而不是单纯励志句库。核心价值在于：把模糊经验压成可复盘的判断机制。',
    'source_basis': 'demo-seed',
    'evidence_status': 'llm-draft',
    'created_at': '2026-03-28T10:00:00+08:00',
    'updated_at': '2026-03-28T10:00:00+08:00',
  },
  {
    'id': 'time-friend-overview',
    'book_id': 'time-friend',
    'slug': 'time-friend-overview',
    'title': '把时间当作朋友',
    'article_type': 'overview',
    'summary': '这本书不是讲时间管理技巧，而是训练你换一个长期单位来理解自己的投入。它更适合拆成一句、原则、案例和行动的连续结构。',
    'source_basis': 'demo-seed',
    'evidence_status': 'llm-draft',
    'created_at': '2026-03-28T10:00:00+08:00',
    'updated_at': '2026-03-28T10:00:00+08:00',
  },
  {
    'id': 'systems-performance-overview',
    'book_id': 'systems-performance',
    'slug': 'systems-performance-overview',
    'title': '性能之巅',
    'article_type': 'overview',
    'summary': '这本书更像问题地图，而不是漂亮摘录。它的商业价值不在金句，而在于把性能排障从慌乱经验变成稳定路径。',
    'source_basis': 'demo-seed',
    'evidence_status': 'llm-draft',
    'created_at': '2026-03-28T10:00:00+08:00',
    'updated_at': '2026-03-28T10:00:00+08:00',
  },
];

const demoSeedArticleVersions = <Map<String, Object?>>[
  {
    'id': 'principles-overview@v1',
    'article_id': 'principles-overview',
    'version': 'v1',
    'content_hash': 'hash-principles-overview-v1',
    'is_current': 1,
    'created_at': '2026-03-28T10:00:00+08:00',
    'updated_at': '2026-03-28T10:00:00+08:00',
  },
  {
    'id': 'time-friend-overview@v1',
    'article_id': 'time-friend-overview',
    'version': 'v1',
    'content_hash': 'hash-time-friend-overview-v1',
    'is_current': 1,
    'created_at': '2026-03-28T10:00:00+08:00',
    'updated_at': '2026-03-28T10:00:00+08:00',
  },
  {
    'id': 'systems-performance-overview@v1',
    'article_id': 'systems-performance-overview',
    'version': 'v1',
    'content_hash': 'hash-systems-performance-overview-v1',
    'is_current': 1,
    'created_at': '2026-03-28T10:00:00+08:00',
    'updated_at': '2026-03-28T10:00:00+08:00',
  },
];

const demoSeedArticleBlocks = <Map<String, Object?>>[
  {
    'id': 'principles-hook',
    'article_version_id': 'principles-overview@v1',
    'block_key': 'hook',
    'block_type': 'hook',
    'title': null,
    'plain_text': '如果你看不见自己是怎么做判断的，你就会把运气误认成能力。',
    'html': '<p>如果你看不见自己是怎么做判断的，你就会把运气误认成能力。</p>',
    'anchor': 'principles-hook',
    'sort_order': 1,
  },
  {
    'id': 'principles-principle',
    'article_version_id': 'principles-overview@v1',
    'block_key': 'principle-1',
    'block_type': 'principle',
    'title': '把判断流程显性化',
    'plain_text':
        '这本书真正值钱的地方，不是告诉你“要理性”，而是逼你把判断过程拆出来：你看了什么事实、用了什么标准、在哪一步最容易自欺。',
    'html':
        '<p>这本书真正值钱的地方，不是告诉你“要理性”，而是逼你把判断过程拆出来：你看了什么事实、用了什么标准、在哪一步最容易自欺。</p>',
    'anchor': 'principles-principle',
    'sort_order': 2,
  },
  {
    'id': 'principles-case',
    'article_version_id': 'principles-overview@v1',
    'block_key': 'case-1',
    'block_type': 'caseStudy',
    'title': '最典型的误判场景',
    'plain_text':
        '事情做成了一次，人很容易把它解释成自己水平够高；但如果没有回看过程，就无法分辨这次到底是判断好，还是只是环境刚好帮了你。',
    'html':
        '<p>事情做成了一次，人很容易把它解释成自己水平够高；但如果没有回看过程，就无法分辨这次到底是判断好，还是只是环境刚好帮了你。</p>',
    'anchor': 'principles-case',
    'sort_order': 3,
  },
  {
    'id': 'principles-action',
    'article_version_id': 'principles-overview@v1',
    'block_key': 'action-1',
    'block_type': 'action',
    'title': '最小动作',
    'plain_text': '下次做重要判断时，只记三件事：我基于什么事实、我用了什么标准、如果错了最可能错在哪。先别追求复杂，先让自己能复盘。',
    'html': '<p>下次做重要判断时，只记三件事：我基于什么事实、我用了什么标准、如果错了最可能错在哪。先别追求复杂，先让自己能复盘。</p>',
    'anchor': 'principles-action',
    'sort_order': 4,
  },
  {
    'id': 'time-hook',
    'article_version_id': 'time-friend-overview@v1',
    'block_key': 'hook',
    'block_type': 'hook',
    'title': null,
    'plain_text': '成长不是把时间塞满，而是把注意力用在长期会复利的地方。',
    'html': '<p>成长不是把时间塞满，而是把注意力用在长期会复利的地方。</p>',
    'anchor': 'time-hook',
    'sort_order': 1,
  },
  {
    'id': 'time-principle',
    'article_version_id': 'time-friend-overview@v1',
    'block_key': 'principle-1',
    'block_type': 'principle',
    'title': '先换判断单位',
    'plain_text': '如果总用“今天做了多少”来评价自己，就会不停追逐即时完成感；但很多真正重要的能力，恰恰是在长期、缓慢、重复里增长的。',
    'html': '<p>如果总用“今天做了多少”来评价自己，就会不停追逐即时完成感；但很多真正重要的能力，恰恰是在长期、缓慢、重复里增长的。</p>',
    'anchor': 'time-principle',
    'sort_order': 2,
  },
  {
    'id': 'time-case',
    'article_version_id': 'time-friend-overview@v1',
    'block_key': 'case-1',
    'block_type': 'caseStudy',
    'title': '为什么总想重新开始',
    'plain_text': '很多计划并不是难，而是切得太大。动作一旦大到让人每次都要重新鼓起劲，它就更像一次冲刺，而不像可以长期维持的结构。',
    'html': '<p>很多计划并不是难，而是切得太大。动作一旦大到让人每次都要重新鼓起劲，它就更像一次冲刺，而不像可以长期维持的结构。</p>',
    'anchor': 'time-case',
    'sort_order': 3,
  },
  {
    'id': 'time-action',
    'article_version_id': 'time-friend-overview@v1',
    'block_key': 'action-1',
    'block_type': 'action',
    'title': '最小动作',
    'plain_text': '把你现在最想建立的一件长期能力，切成一个 15 分钟就能完成的小动作，然后只要求连续 7 天，而不是一口气翻盘。',
    'html': '<p>把你现在最想建立的一件长期能力，切成一个 15 分钟就能完成的小动作，然后只要求连续 7 天，而不是一口气翻盘。</p>',
    'anchor': 'time-action',
    'sort_order': 4,
  },
  {
    'id': 'perf-hook',
    'article_version_id': 'systems-performance-overview@v1',
    'block_key': 'hook',
    'block_type': 'hook',
    'title': null,
    'plain_text': '排障真正怕的不是问题太复杂，而是你第一眼就把问题认错了。',
    'html': '<p>排障真正怕的不是问题太复杂，而是你第一眼就把问题认错了。</p>',
    'anchor': 'perf-hook',
    'sort_order': 1,
  },
  {
    'id': 'perf-principle',
    'article_version_id': 'systems-performance-overview@v1',
    'block_key': 'principle-1',
    'block_type': 'principle',
    'title': '先找方向，再找细节',
    'plain_text':
        '性能问题最容易让人一上来就钻到某个工具里，但更稳的做法是先判断瓶颈大致属于 CPU、内存、磁盘、网络还是锁，再进入细查。',
    'html':
        '<p>性能问题最容易让人一上来就钻到某个工具里，但更稳的做法是先判断瓶颈大致属于 CPU、内存、磁盘、网络还是锁，再进入细查。</p>',
    'anchor': 'perf-principle',
    'sort_order': 2,
  },
  {
    'id': 'perf-case',
    'article_version_id': 'systems-performance-overview@v1',
    'block_key': 'case-1',
    'block_type': 'caseStudy',
    'title': '最常见的错法',
    'plain_text':
        '看到响应慢就直接把锅甩给数据库，是典型的第一眼误判。很多问题看起来像 SQL 慢，实际上是上游线程等待、锁竞争或者 IO 抖动。',
    'html':
        '<p>看到响应慢就直接把锅甩给数据库，是典型的第一眼误判。很多问题看起来像 SQL 慢，实际上是上游线程等待、锁竞争或者 IO 抖动。</p>',
    'anchor': 'perf-case',
    'sort_order': 3,
  },
  {
    'id': 'perf-action',
    'article_version_id': 'systems-performance-overview@v1',
    'block_key': 'action-1',
    'block_type': 'action',
    'title': '最小动作',
    'plain_text': '给自己做一张排障顺序卡：出现慢请求时先看系统资源方向，再列对应工具。不要每次都从记忆里临时翻框架。',
    'html': '<p>给自己做一张排障顺序卡：出现慢请求时先看系统资源方向，再列对应工具。不要每次都从记忆里临时翻框架。</p>',
    'anchor': 'perf-action',
    'sort_order': 4,
  },
];

const demoSeedQuotes = <Map<String, Object?>>[
  {
    'id': 'principle-1',
    'article_version_id': 'principles-overview@v1',
    'block_id': 'principles-hook',
    'text': '如果你看不见自己是怎么做判断的，你就会把运气误认成能力。',
    'category': '判断',
    'weight': 1.0,
    'is_active': 1,
  },
  {
    'id': 'friend-time-1',
    'article_version_id': 'time-friend-overview@v1',
    'block_id': 'time-hook',
    'text': '成长不是把时间塞满，而是把注意力用在长期会复利的地方。',
    'category': '成长',
    'weight': 0.9,
    'is_active': 1,
  },
  {
    'id': 'peak-performance-1',
    'article_version_id': 'systems-performance-overview@v1',
    'block_id': 'perf-hook',
    'text': '排障真正怕的不是问题太复杂，而是你第一眼就把问题认错了。',
    'category': '技术',
    'weight': 0.8,
    'is_active': 1,
  },
];

final demoArticleMarkdownByHash = <String, String>{
  for (final entry in _demoArticleVersionHashes.entries)
    entry.value: _buildMarkdownForVersion(entry.key),
};

const _demoArticleVersionHashes = <String, String>{
  'principles-overview@v1': 'hash-principles-overview-v1',
  'time-friend-overview@v1': 'hash-time-friend-overview-v1',
  'systems-performance-overview@v1': 'hash-systems-performance-overview-v1',
};

String _buildMarkdownForVersion(String articleVersionId) {
  final blocks = demoSeedArticleBlocks.where(
    (row) => row['article_version_id'] == articleVersionId,
  );
  final buffer = StringBuffer();

  for (final row in blocks) {
    final title = row['title'] as String?;
    final body = (row['plain_text'] as String).trim();
    final blockType = row['block_type'] as String;

    if (body.isEmpty) {
      continue;
    }

    if (buffer.isNotEmpty) {
      buffer.writeln();
      buffer.writeln();
    }

    if (blockType == 'hook') {
      buffer.write('> $body');
      continue;
    }

    if (title != null && title.trim().isNotEmpty) {
      buffer.writeln('## ${title.trim()}');
      buffer.writeln();
    }

    buffer.write(body);
  }

  return buffer.toString();
}
