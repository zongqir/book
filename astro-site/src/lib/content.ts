import MarkdownIt from "markdown-it";
import { getContentSource, type SiteIndex } from "./content-source";
import { DISCOVER_THEMES, type DiscoverThemeConfig } from "./discover-themes";

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: false,
});

export type SectionSummary = {
  key: string;
  title: string;
  book_count: number;
  page_count: number;
  url: string;
};

export type BookSummary = {
  id: string;
  title: string;
  section_key: string;
  section_title: string;
  summary: string;
  tags: string[];
  page_count: number;
  updated_at: string;
  url: string;
};

export type PageSummary = {
  id: string;
  book_id: string;
  book_title: string;
  section_key: string;
  section_title: string;
  slot: string;
  title: string;
  summary: string;
  intent: string;
  status: string;
  evidence_status: string;
  updated_at: string;
  tags: string[];
  headings: { level: number; title: string }[];
  url: string;
};

export type HeadingLink = {
  level: number;
  title: string;
  id: string;
};

export type QuoteSummary = {
  id: string;
  page_id: string;
  book_title: string;
  page_title: string;
  quote: string;
  url: string;
};

export type RelatedBook = {
  book: BookSummary;
  shared_tags: string[];
};

export type RelatedPage = {
  page: PageSummary;
  book: BookSummary | undefined;
  shared_tags: string[];
};

export type DiscoverData = {
  counts: {
    sections: number;
    books: number;
    pages: number;
    quotes: number;
  };
  sections: SectionSummary[];
  slots: string[];
  tags: { tag: string; count: number }[];
};

export type DiscoverThemeSummary = {
  slug: string;
  title: string;
  summary: string;
  prompt: string;
  tags: string[];
  counts: {
    books: number;
    pages: number;
    items: number;
  };
  leadBook: BookSummary | null;
  leadPage: PageSummary | null;
  relatedTags: { tag: string; count: number }[];
};

export type DiscoverThemeDetail = DiscoverThemeSummary & {
  books: BookSummary[];
  pages: PageSummary[];
  neighborThemes: {
    slug: string;
    title: string;
    summary: string;
    sharedTags: string[];
  }[];
};

export type PageNode =
  | {
      kind: "section";
      title: string;
      url: string;
      section: SectionSummary;
      books: BookSummary[];
    }
  | {
      kind: "book";
      title: string;
      url: string;
      book: BookSummary;
      pages: PageSummary[];
      relatedBooks: RelatedBook[];
    }
  | {
      kind: "page";
      title: string;
      url: string;
      page: PageSummary;
      html: string;
      headings: HeadingLink[];
      book: BookSummary | undefined;
      section: SectionSummary | undefined;
      siblingPages: PageSummary[];
      previousPage: PageSummary | null;
      nextPage: PageSummary | null;
      relatedPages: RelatedPage[];
      relatedBooks: RelatedBook[];
    };

const HIDDEN_SECTION_KEYS = new Set(["02_专业技术"]);
const contentSource = getContentSource();

export function loadSiteIndex(): SiteIndex {
  return contentSource.loadSiteIndex();
}

export function getHomeData() {
  const index = loadSiteIndex();
  const sections = index.sections.filter((item) => !HIDDEN_SECTION_KEYS.has(item.key));
  const books = index.books.filter((item) => !HIDDEN_SECTION_KEYS.has(item.section_key));
  const quotes = index.quotes;
  return {
    counts: {
      sections: sections.length,
      books: books.length,
      pages: index.pages.filter((item) => !HIDDEN_SECTION_KEYS.has(item.section_key)).length,
      quotes: quotes.length,
    },
    sections,
    books,
    quotes,
  };
}

export function getDiscoverData(): DiscoverData {
  const index = loadSiteIndex();
  const sections = index.sections.filter((item) => !HIDDEN_SECTION_KEYS.has(item.key));
  const books = index.books.filter((item) => !HIDDEN_SECTION_KEYS.has(item.section_key));
  const pages = index.pages.filter((item) => !HIDDEN_SECTION_KEYS.has(item.section_key));
  const tagCounts = new Map<string, number>();

  for (const item of [...books, ...pages]) {
    for (const tag of uniqueTags(item.tags)) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  const tags = [...tagCounts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "zh-CN"));

  const slots = [...new Set(pages.map((item) => item.slot).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "zh-CN"),
  );

  return {
    counts: {
      sections: sections.length,
      books: books.length,
      pages: pages.length,
      quotes: index.quotes.length,
    },
    sections,
    slots,
    tags,
  };
}

export function getDiscoverThemes(): DiscoverThemeSummary[] {
  const index = loadSiteIndex();
  return DISCOVER_THEMES.map((theme) => buildDiscoverThemeDetail(index, theme)).map((item) => ({
    slug: item.slug,
    title: item.title,
    summary: item.summary,
    prompt: item.prompt,
    tags: item.tags,
    counts: item.counts,
    leadBook: item.leadBook,
    leadPage: item.leadPage,
    relatedTags: item.relatedTags,
  }));
}

export function getDiscoverThemeSlugs(): string[] {
  return DISCOVER_THEMES.map((item) => item.slug);
}

export function getDiscoverThemeDetail(slug: string): DiscoverThemeDetail | null {
  const config = DISCOVER_THEMES.find((item) => item.slug === slug);
  if (!config) return null;
  return buildDiscoverThemeDetail(loadSiteIndex(), config);
}

export function getLibraryIndex() {
  const index = loadSiteIndex();
  const sections = index.sections.map((section) => ({
    ...section,
    books: index.books
      .filter((book) => book.section_key === section.key)
      .sort((a, b) => a.title.localeCompare(b.title, "zh-CN")),
  }));
  return sections;
}

export function getAllLibrarySlugs(): string[][] {
  const index = loadSiteIndex();
  const sectionSlugs = index.sections.map((section) => [section.key]);
  const bookSlugs = index.books.map((book) => book.id.split("/"));
  const pageSlugs = index.pages.map((page) => page.id.split("/"));
  return [...sectionSlugs, ...bookSlugs, ...pageSlugs];
}

export function getNodeBySlug(parts: string[]): PageNode | null {
  const index = loadSiteIndex();
  const joined = parts.join("/");

  const section = index.sections.find((item) => item.key === joined);
  if (section) {
    return {
      kind: "section",
      title: section.title,
      url: section.url,
      section,
      books: index.books
        .filter((book) => book.section_key === section.key)
        .sort((a, b) => a.title.localeCompare(b.title, "zh-CN")),
    };
  }

  const book = index.books.find((item) => item.id === joined);
  if (book) {
    const pages = index.pages
      .filter((page) => page.book_id === book.id)
      .sort((a, b) => a.url.localeCompare(b.url, "zh-CN"));
    return {
      kind: "book",
      title: book.title,
      url: book.url,
      book,
      pages,
      relatedBooks: getRelatedBooks(index, book, 4),
    };
  }

  const page = index.pages.find((item) => item.id === joined);
  if (!page) return null;

  const headings = page.headings.map((item, index) => ({
    ...item,
    id: `section-${index + 1}`,
  }));
  const markdown = contentSource.loadPageMarkdown(page.book_id, page.slot);
  const html = addHeadingIds(renderMarkdown(markdown), headings);
  const siblingPages = index.pages
    .filter((item) => item.book_id === page.book_id)
    .sort((a, b) => a.url.localeCompare(b.url, "zh-CN"));
  const pageIndex = siblingPages.findIndex((item) => item.id === page.id);
  const parentBook = index.books.find((item) => item.id === page.book_id);
  const sectionForPage = index.sections.find((item) => item.key === page.section_key);
  return {
    kind: "page",
    title: page.title,
    url: page.url,
    page,
    html,
    headings,
    book: parentBook,
    section: sectionForPage,
    siblingPages,
    previousPage: pageIndex > 0 ? siblingPages[pageIndex - 1] : null,
    nextPage: pageIndex >= 0 && pageIndex < siblingPages.length - 1 ? siblingPages[pageIndex + 1] : null,
    relatedPages: getRelatedPages(index, page, 4),
    relatedBooks: parentBook ? getRelatedBooks(index, parentBook, 3) : [],
  };
}

function getRelatedBooks(index: SiteIndex, currentBook: BookSummary, limit: number): RelatedBook[] {
  return index.books
    .filter((item) => item.id !== currentBook.id && item.section_key === currentBook.section_key)
    .map((book) => {
      const sharedTags = getSharedTags(currentBook.tags, book.tags);
      return {
        book,
        shared_tags: sharedTags,
        score: sharedTags.length * 10 + Math.min(book.page_count, 8),
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.book.page_count - a.book.page_count ||
        a.book.title.localeCompare(b.book.title, "zh-CN"),
    )
    .slice(0, limit)
    .map(({ book, shared_tags }) => ({ book, shared_tags }));
}

function buildDiscoverThemeDetail(index: SiteIndex, theme: DiscoverThemeConfig): DiscoverThemeDetail {
  const books = index.books.filter((item) => !HIDDEN_SECTION_KEYS.has(item.section_key));
  const pages = index.pages.filter((item) => !HIDDEN_SECTION_KEYS.has(item.section_key));
  const allItems = [...books, ...pages];

  const rankedBooks = books
    .map((item) => ({ item, score: getThemeScore(item, theme) }))
    .filter((item) => item.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.item.page_count - a.item.page_count ||
        a.item.title.localeCompare(b.item.title, "zh-CN"),
    );

  const rankedPages = pages
    .map((item) => ({ item, score: getThemeScore(item, theme) }))
    .filter((item) => item.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.item.slot.localeCompare(b.item.slot, "zh-CN") ||
        a.item.title.localeCompare(b.item.title, "zh-CN"),
    );

  const matchedItems = allItems.filter((item) => getThemeScore(item, theme) > 0);
  const relatedTagCounts = new Map<string, number>();
  const primaryTags = new Set(theme.tags);

  for (const item of matchedItems) {
    for (const tag of uniqueTags(item.tags)) {
      if (primaryTags.has(tag)) continue;
      relatedTagCounts.set(tag, (relatedTagCounts.get(tag) ?? 0) + 1);
    }
  }

  const relatedTags = [...relatedTagCounts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "zh-CN"))
    .slice(0, 8);

  const neighborThemes = DISCOVER_THEMES
    .filter((item) => item.slug !== theme.slug)
    .map((item) => {
      const sharedTags = uniqueTags([...theme.tags, ...(theme.optionalTags ?? [])]).filter((tag) =>
        new Set([...item.tags, ...(item.optionalTags ?? [])]).has(tag),
      );
      return {
        slug: item.slug,
        title: item.title,
        summary: item.summary,
        sharedTags,
        score: sharedTags.length,
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "zh-CN"))
    .slice(0, 3)
    .map(({ slug, title, summary, sharedTags }) => ({ slug, title, summary, sharedTags }));

  return {
    slug: theme.slug,
    title: theme.title,
    summary: theme.summary,
    prompt: theme.prompt,
    tags: theme.tags,
    counts: {
      books: rankedBooks.length,
      pages: rankedPages.length,
      items: rankedBooks.length + rankedPages.length,
    },
    leadBook: rankedBooks[0]?.item ?? null,
    leadPage: rankedPages[0]?.item ?? null,
    relatedTags,
    books: rankedBooks.slice(1, 7).map((item) => item.item),
    pages: rankedPages.slice(0, 8).map((item) => item.item),
    neighborThemes,
  };
}

function getThemeScore(
  item: Pick<BookSummary, "section_key" | "tags" | "title"> | Pick<PageSummary, "section_key" | "tags" | "slot" | "title">,
  theme: DiscoverThemeConfig,
): number {
  const tags = uniqueTags(item.tags);
  let score = 0;

  tags.forEach((tag) => {
    const coreIndex = theme.tags.indexOf(tag);
    if (coreIndex >= 0) {
      score += 20 - coreIndex * 2;
      return;
    }
    const optionalIndex = theme.optionalTags?.indexOf(tag) ?? -1;
    if (optionalIndex >= 0) {
      score += 8 - Math.min(optionalIndex, 4);
    }
  });

  if (theme.sectionKeys?.includes(item.section_key)) score += 4;
  if ("slot" in item) {
    if (item.slot === "00") score += 5;
    if (item.slot === "04" || item.slot === "05" || item.slot === "02") score += 2;
  }
  if ("page_count" in item) {
    score += Math.min(item.page_count, 6);
  }

  return score;
}

function getRelatedPages(index: SiteIndex, currentPage: PageSummary, limit: number): RelatedPage[] {
  return index.pages
    .filter((item) => item.id !== currentPage.id && item.book_id !== currentPage.book_id)
    .map((page) => {
      const sharedTags = getSharedTags(currentPage.tags, page.tags);
      const sameSection = page.section_key === currentPage.section_key ? 1 : 0;
      const sameSlot = page.slot === currentPage.slot ? 1 : 0;
      return {
        page,
        book: index.books.find((item) => item.id === page.book_id),
        shared_tags: sharedTags,
        score: sameSection * 18 + sameSlot * 14 + sharedTags.length * 6,
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.page.title.localeCompare(b.page.title, "zh-CN"))
    .slice(0, limit)
    .map(({ page, book, shared_tags }) => ({ page, book, shared_tags }));
}

function getSharedTags(left: string[], right: string[]): string[] {
  const rightSet = new Set(uniqueTags(right));
  return uniqueTags(left).filter((tag) => rightSet.has(tag));
}

function uniqueTags(tags: string[]): string[] {
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
}

function renderMarkdown(markdown: string): string {
  const transformed = transformShortcodes(markdown);
  return md.render(transformed);
}

function addHeadingIds(html: string, headings: HeadingLink[]): string {
  if (!headings.length) return html;
  let cursor = 0;
  return html.replace(/<h([1-6])>([\s\S]*?)<\/h\1>/g, (match, level) => {
    const current = headings[cursor];
    if (!current || Number(level) !== current.level) return match;
    cursor += 1;
    return `<h${level} id="${current.id}">${current.title}</h${level}>`;
  });
}

function transformShortcodes(markdown: string): string {
  let output = markdown;
  output = replacePairShortcodes(output, "principle", renderPrinciple);
  output = replacePairShortcodes(output, "callout", renderCallout);
  output = replacePairShortcodes(output, "sentence", renderSentence);
  output = replaceSelfClosingShortcodes(output, "sentence", renderSentence);
  output = replaceSelfClosingShortcodes(output, "memory-card", renderMemoryCard);
  return output;
}

function replacePairShortcodes(
  input: string,
  name: string,
  render: (attrs: Record<string, string>, inner: string) => string,
): string {
  const pattern = new RegExp(
    String.raw`\{\{<\s*${escapeRegex(name)}\b([^>]*)>\}\}([\s\S]*?)\{\{<\s*\/${escapeRegex(name)}\s*>\}\}`,
    "g",
  );
  return input.replace(pattern, (_match, attrsSource, inner) => render(parseAttrs(attrsSource), inner.trim()));
}

function replaceSelfClosingShortcodes(
  input: string,
  name: string,
  render: (attrs: Record<string, string>, inner: string) => string,
): string {
  const pattern = new RegExp(String.raw`\{\{<\s*${escapeRegex(name)}\b([^>]*?)\/?>\}\}`, "g");
  return input.replace(pattern, (match, attrsSource) => {
    if (match.includes(`/${name}`)) return match;
    return render(parseAttrs(attrsSource), "");
  });
}

function renderPrinciple(attrs: Record<string, string>, inner: string): string {
  const no = attrs.no ?? "";
  const type = attrs.type ?? "support";
  const statement = attrs.statement ?? "";
  const body = inner ? `<div class="principle-card-body">${md.render(inner)}</div>` : "";
  const badge = type === "core" ? "核心原则" : "支撑原则";
  const noHtml = no ? `<span class="principle-card-no">${escapeHtml(no)}</span>` : "";
  return `
<article class="principle-card principle-card--${escapeHtml(type)}">
  <header class="principle-card-head">
    ${noHtml}
    <span class="principle-card-badge">${badge}</span>
  </header>
  <div class="principle-card-statement">${md.render(statement)}</div>
  ${body}
</article>`;
}

function renderCallout(attrs: Record<string, string>, inner: string): string {
  const type = (attrs.type ?? "note").toLowerCase();
  const titleMap: Record<string, string> = {
    note: "补充说明",
    key: "关键结论",
    action: "行动建议",
    warning: "边界提醒",
    source: "来源提示",
  };
  const title = attrs.title ?? titleMap[type] ?? "提示";
  const subtitle = attrs.subtitle ? `<span class="callout-subtitle">${escapeHtml(attrs.subtitle)}</span>` : "";
  return `
<aside class="callout callout-${escapeHtml(type)}">
  <div class="callout-head">
    <span class="callout-label">${escapeHtml(title)}</span>
    ${subtitle}
  </div>
  <div class="callout-body">${md.render(inner)}</div>
</aside>`;
}

function renderSentence(attrs: Record<string, string>, inner: string): string {
  const quote = attrs.quote ?? "";
  const showNo = attrs.show_no === "true";
  const no =
    showNo && attrs.no
      ? `<header class="sentence-card-head"><span class="sentence-card-no">${escapeHtml(attrs.no)}</span></header>`
      : "";
  const quoteHtml = quote ? md.render(quote) : inner ? md.render(inner) : "";
  const body = quote && inner ? `<div class="sentence-card-body">${md.render(inner)}</div>` : "";
  return `
<article class="sentence-card">
  ${no}
  <div class="sentence-card-quote">${quoteHtml}</div>
  ${body}
</article>`;
}

function renderMemoryCard(attrs: Record<string, string>): string {
  const chapter = attrs.chapter ? `<span class="memory-card-kicker">${escapeHtml(attrs.chapter)}</span>` : "";
  const title = escapeHtml(attrs.title ?? "这一章最值得记住的判断");
  return `
<aside class="memory-card" aria-label="${title}">
  <header class="memory-card-head">
    ${chapter}
    <h3 class="memory-card-title">${title}</h3>
  </header>
  <div class="memory-card-grid">
    ${renderMemoryCardItem("看到什么现象", attrs.phenomenon ?? "")}
    ${renderMemoryCardItem("先别急着下什么结论", attrs.dont ?? "")}
    ${renderMemoryCardItem("先补哪组证据", attrs.check ?? "")}
    ${renderMemoryCardItem("什么时候才能升级成结论", attrs.upgrade ?? "")}
  </div>
</aside>`;
}

function renderMemoryCardItem(label: string, content: string): string {
  return `
<section class="memory-card-item">
  <div class="memory-card-label">${escapeHtml(label)}</div>
  <div class="memory-card-copy">${md.render(content)}</div>
</section>`;
}

function parseAttrs(source: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const pattern = /([A-Za-z_][A-Za-z0-9_-]*)=(?:"([^"]*)"|'([^']*)'|`([^`]*)`)/g;
  for (const match of source.matchAll(pattern)) {
    attrs[match[1]] = match[2] ?? match[3] ?? match[4] ?? "";
  }
  return attrs;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
