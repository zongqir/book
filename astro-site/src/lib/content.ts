import MarkdownIt from "markdown-it";
import { getContentSource, type SiteIndex } from "./content-source";
import { rewriteContentHref } from "./internal-links";

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
  read_state: "unread" | "reading" | "read";
  curation_state: "normal" | "favorite" | "uninterested";
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
      ancestorBooks: BookSummary[];
      childBooks: BookSummary[];
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
      ancestorBooks: BookSummary[];
      section: SectionSummary | undefined;
      siblingPages: PageSummary[];
      previousPage: PageSummary | null;
      nextPage: PageSummary | null;
      relatedBooks: RelatedBook[];
    };

const HIDDEN_SECTION_KEYS = new Set(["02_专业技术"]);
const FAVORITE_CURATION_STATE = "favorite";
const UNINTERESTED_CURATION_STATE = "uninterested";
const contentSource = getContentSource();

export function loadSiteIndex(): SiteIndex {
  return contentSource.loadSiteIndex();
}

export function getHomeData() {
  const index = loadSiteIndex();
  const topLevelBooks = getTopLevelBooks(index);
  const sections = index.sections
    .filter((item) => !HIDDEN_SECTION_KEYS.has(item.key))
    .map((section) => ({
      ...section,
      book_count: topLevelBooks.filter((book) => book.section_key === section.key).length,
    }));
  const visibleBooks = topLevelBooks.filter((item) => !HIDDEN_SECTION_KEYS.has(item.section_key));
  const books = visibleBooks
    .filter((item) => item.curation_state !== UNINTERESTED_CURATION_STATE)
    .sort(
      (a, b) =>
        getHomePriority(b) - getHomePriority(a) ||
        b.page_count - a.page_count ||
        a.title.localeCompare(b.title, "zh-CN"),
    );
  const quotes = index.quotes;
  return {
    counts: {
      sections: sections.length,
      books: visibleBooks.length,
      pages: index.pages.filter((item) => !HIDDEN_SECTION_KEYS.has(item.section_key)).length,
      quotes: quotes.length,
    },
    sections,
    books,
    quotes,
  };
}

function getHomePriority(book: Pick<BookSummary, "curation_state">): number {
  return book.curation_state === FAVORITE_CURATION_STATE ? 1 : 0;
}

export function getLibraryIndex() {
  const index = loadSiteIndex();
  const sections = index.sections.map((section) => ({
    ...section,
    books: getTopLevelBooks(index)
      .filter((book) => book.section_key === section.key)
      .sort((a, b) => a.title.localeCompare(b.title, "zh-CN")),
  }));
  return sections.map((section) => ({
    ...section,
    book_count: section.books.length,
  }));
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
      books: getTopLevelBooks(index)
        .filter((book) => book.section_key === section.key)
        .sort((a, b) => a.title.localeCompare(b.title, "zh-CN")),
    };
  }

  const book = index.books.find((item) => item.id === joined);
  if (book) {
    const ancestorBooks = getAncestorBooks(index, book);
    const childBooks = getChildBooks(index, book);
    const pages = index.pages
      .filter((page) => page.book_id === book.id)
      .sort((a, b) => a.url.localeCompare(b.url, "zh-CN"));
    return {
      kind: "book",
      title: book.title,
      url: book.url,
      book,
      ancestorBooks,
      childBooks,
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
  const html = addHeadingIds(renderMarkdown(markdown, getKnownInternalPaths(index)), headings);
  const siblingPages = index.pages
    .filter((item) => item.book_id === page.book_id)
    .sort((a, b) => a.url.localeCompare(b.url, "zh-CN"));
  const pageIndex = siblingPages.findIndex((item) => item.id === page.id);
  const parentBook = index.books.find((item) => item.id === page.book_id);
  const ancestorBooks = parentBook ? getAncestorBooks(index, parentBook) : [];
  const sectionForPage = index.sections.find((item) => item.key === page.section_key);
  return {
    kind: "page",
    title: page.title,
    url: page.url,
    page,
    html,
    headings,
    book: parentBook,
    ancestorBooks,
    section: sectionForPage,
    siblingPages,
    previousPage: pageIndex > 0 ? siblingPages[pageIndex - 1] : null,
    nextPage: pageIndex >= 0 && pageIndex < siblingPages.length - 1 ? siblingPages[pageIndex + 1] : null,
    relatedBooks: parentBook ? getRelatedBooks(index, parentBook, 3) : [],
  };
}

function getRelatedBooks(index: SiteIndex, currentBook: BookSummary, limit: number): RelatedBook[] {
  const parentId = getNearestParentBookId(currentBook.id, index.books);
  const candidatePool = parentId
    ? index.books.filter((item) => getNearestParentBookId(item.id, index.books) === parentId)
    : getTopLevelBooks(index);

  return candidatePool
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

function getSharedTags(left: string[], right: string[]): string[] {
  const rightSet = new Set(uniqueTags(right));
  return uniqueTags(left).filter((tag) => rightSet.has(tag));
}

function uniqueTags(tags: string[]): string[] {
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
}

function getTopLevelBooks(index: SiteIndex): BookSummary[] {
  return index.books.filter((book) => !getNearestParentBookId(book.id, index.books));
}

function getChildBooks(index: SiteIndex, parentBook: BookSummary): BookSummary[] {
  return index.books
    .filter((book) => getNearestParentBookId(book.id, index.books) === parentBook.id)
    .sort((a, b) => a.title.localeCompare(b.title, "zh-CN"));
}

function getAncestorBooks(index: SiteIndex, book: BookSummary): BookSummary[] {
  const byId = new Map(index.books.map((item) => [item.id, item]));
  const ancestors: BookSummary[] = [];
  let parentId = getNearestParentBookId(book.id, index.books);
  while (parentId) {
    const parent = byId.get(parentId);
    if (!parent) break;
    ancestors.unshift(parent);
    parentId = getNearestParentBookId(parent.id, index.books);
  }
  return ancestors;
}

function getNearestParentBookId(bookId: string, books: BookSummary[]): string | null {
  const bookIds = new Set(books.map((item) => item.id));
  let current = getParentPath(bookId);
  while (current) {
    if (bookIds.has(current)) return current;
    current = getParentPath(current);
  }
  return null;
}

function getParentPath(value: string): string | null {
  const parts = value.split("/").filter(Boolean);
  if (parts.length <= 1) return null;
  parts.pop();
  return parts.length ? parts.join("/") : null;
}

function renderMarkdown(markdown: string, knownInternalPaths: Set<string>): string {
  const transformed = transformShortcodes(markdown);
  return rewriteRenderedInternalLinks(md.render(transformed), knownInternalPaths);
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

function getKnownInternalPaths(index: SiteIndex): Set<string> {
  const paths = new Set<string>(["/", "/library/", "/notes/", "/app/", "/offline/"]);
  index.sections.forEach((item) => paths.add(item.url));
  index.books.forEach((item) => paths.add(item.url));
  index.pages.forEach((item) => paths.add(item.url));
  index.quotes.forEach((item) => paths.add(item.url));
  return paths;
}

function rewriteRenderedInternalLinks(html: string, knownInternalPaths: Set<string>): string {
  return html.replace(/(<a\b[^>]*\bhref=")([^"]+)(")/gi, (_match, prefix, href, suffix) => {
    return `${prefix}${rewriteContentHref(href, knownInternalPaths)}${suffix}`;
  });
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
