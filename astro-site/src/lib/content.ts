import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import MarkdownIt from "markdown-it";

const astroRoot = process.cwd();
const repoRoot = path.resolve(astroRoot, "..");
const libraryRoot = path.join(repoRoot, "site", "content", "library");
const siteIndexPath = path.join(repoRoot, "site", "static", "data", "site-content.json");

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: false,
});

type SiteIndex = {
  sections: SectionSummary[];
  books: BookSummary[];
  pages: PageSummary[];
  quotes: QuoteSummary[];
  counts: Record<string, number>;
};

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

export type QuoteSummary = {
  id: string;
  page_id: string;
  book_title: string;
  page_title: string;
  quote: string;
  url: string;
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
    }
  | {
      kind: "page";
      title: string;
      url: string;
      page: PageSummary;
      html: string;
      headings: { level: number; title: string }[];
      book: BookSummary | undefined;
      section: SectionSummary | undefined;
    };

let cachedIndex: SiteIndex | null = null;

export function loadSiteIndex(): SiteIndex {
  if (cachedIndex) return cachedIndex;
  const raw = fs.readFileSync(siteIndexPath, "utf-8");
  cachedIndex = JSON.parse(raw) as SiteIndex;
  return cachedIndex;
}

export function getHomeData() {
  const index = loadSiteIndex();
  const sections = index.sections.filter((item) => item.key !== "02_专业技术");
  const books = index.books.filter((item) => item.section_key !== "02_专业技术");
  const quotes = index.quotes;
  return {
    counts: {
      sections: sections.length,
      books: books.length,
      pages: index.pages.filter((item) => item.section_key !== "02_专业技术").length,
      quotes: quotes.length,
    },
    sections,
    books,
    quotes,
  };
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
    return {
      kind: "book",
      title: book.title,
      url: book.url,
      book,
      pages: index.pages
        .filter((page) => page.book_id === book.id)
        .sort((a, b) => a.url.localeCompare(b.url, "zh-CN")),
    };
  }

  const page = index.pages.find((item) => item.id === joined);
  if (!page) return null;

  const filePath = resolvePageFile(page);
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = matter(raw);
  const html = renderMarkdown(parsed.content);
  return {
    kind: "page",
    title: page.title,
    url: page.url,
    page,
    html,
    headings: page.headings,
    book: index.books.find((item) => item.id === page.book_id),
    section: index.sections.find((item) => item.key === page.section_key),
  };
}

function resolvePageFile(page: PageSummary): string {
  const bookDir = path.join(libraryRoot, page.book_id);
  const files = fs
    .readdirSync(bookDir)
    .filter((name) => name.endsWith(".md") && name !== "_index.md" && !name.endsWith(".QA.md"))
    .sort();
  const matched = files.find((name) => name.startsWith(`${page.slot}_`));
  if (!matched) {
    throw new Error(`Cannot resolve markdown file for page ${page.id}`);
  }
  return path.join(bookDir, matched);
}

function renderMarkdown(markdown: string): string {
  const transformed = transformShortcodes(markdown);
  return md.render(transformed);
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
  const pattern = new RegExp(
    String.raw`\{\{<\s*${escapeRegex(name)}\b([^>]*?)\/?>\}\}`,
    "g",
  );
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
  const subtitle = attrs.subtitle
    ? `<span class="callout-subtitle">${escapeHtml(attrs.subtitle)}</span>`
    : "";
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
  const no = showNo && attrs.no ? `<header class="sentence-card-head"><span class="sentence-card-no">${escapeHtml(attrs.no)}</span></header>` : "";
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
