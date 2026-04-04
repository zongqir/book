import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export type SiteIndex = {
  sections: {
    key: string;
    title: string;
    book_count: number;
    page_count: number;
    url: string;
  }[];
  books: {
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
  }[];
  pages: {
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
  }[];
  quotes: {
    id: string;
    page_id: string;
    book_title: string;
    page_title: string;
    quote: string;
    url: string;
  }[];
  counts: Record<string, number>;
};

export type PageContentEntry = {
  page_id: string;
  book_id: string;
  slot: string;
  updated_at: string;
  markdown: string;
};

export type PageContentBundle = {
  schema_version: number;
  generated_at: string;
  pages: Record<string, PageContentEntry>;
};

export type ContentSource = {
  loadSiteIndex(): SiteIndex;
  loadPageMarkdown(pageId: string): string;
};

export type ContentSourceFactory = () => ContentSource;

const astroRoot = process.cwd();
const repoRoot = path.resolve(astroRoot, "..");
const libraryRoot = path.join(repoRoot, "site", "content", "library");
const siteIndexPath = path.join(repoRoot, "site", "static", "data", "site-content.json");
const sitePageContentPath = path.join(repoRoot, "site", "static", "data", "site-page-content.json");

let overrideFactory: ContentSourceFactory | null = null;
let activeContentSource: ContentSource | null = null;

export function makePageContentKey(pageId: string): string {
  return pageId;
}

export class FileSystemContentSource implements ContentSource {
  private cachedIndex: SiteIndex | null = null;

  loadSiteIndex(): SiteIndex {
    if (this.cachedIndex) return this.cachedIndex;
    const raw = fs.readFileSync(siteIndexPath, "utf-8");
    this.cachedIndex = JSON.parse(raw) as SiteIndex;
    return this.cachedIndex;
  }

  loadPageMarkdown(pageId: string): string {
    const filePath = this.resolvePageFile(pageId);
    const raw = fs.readFileSync(filePath, "utf-8");
    return matter(raw).content;
  }

  private resolvePageFile(pageId: string): string {
    const filePath = path.join(libraryRoot, `${pageId}.md`);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Cannot resolve markdown file for ${pageId}`);
    }
    return filePath;
  }
}

export class BundledContentSource implements ContentSource {
  private cachedBundle: PageContentBundle | null = null;

  constructor(
    private readonly indexSource: ContentSource = new FileSystemContentSource(),
    private readonly bundlePath: string = sitePageContentPath,
  ) {}

  loadSiteIndex(): SiteIndex {
    return this.indexSource.loadSiteIndex();
  }

  loadPageMarkdown(pageId: string): string {
    const bundle = this.loadBundle();
    const entry = bundle.pages[makePageContentKey(pageId)];
    if (!entry) {
      throw new Error(`Missing bundled page markdown for ${pageId}`);
    }
    return entry.markdown;
  }

  private loadBundle(): PageContentBundle {
    if (this.cachedBundle) return this.cachedBundle;
    const raw = fs.readFileSync(this.bundlePath, "utf-8");
    this.cachedBundle = JSON.parse(raw) as PageContentBundle;
    return this.cachedBundle;
  }
}

export function createFileSystemContentSource(): ContentSource {
  return new FileSystemContentSource();
}

export function createBundledContentSource(): ContentSource {
  return new BundledContentSource();
}

export function registerContentSourceFactory(factory: ContentSourceFactory) {
  overrideFactory = factory;
  activeContentSource = null;
}

export function resetContentSourceFactory() {
  overrideFactory = null;
  activeContentSource = null;
}

export function getContentSource(): ContentSource {
  if (!activeContentSource) {
    activeContentSource = resolveContentSource();
  }
  return activeContentSource;
}

function resolveContentSource(): ContentSource {
  if (overrideFactory) return overrideFactory();
  const preferBundle = process.env.BOOK_CONTENT_SOURCE === "bundle";
  if (preferBundle && fs.existsSync(sitePageContentPath)) {
    return createBundledContentSource();
  }
  return createFileSystemContentSource();
}
