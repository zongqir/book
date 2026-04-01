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

export type ContentSource = {
  loadSiteIndex(): SiteIndex;
  loadPageMarkdown(bookId: string, slot: string): string;
};

const astroRoot = process.cwd();
const repoRoot = path.resolve(astroRoot, "..");
const libraryRoot = path.join(repoRoot, "site", "content", "library");
const siteIndexPath = path.join(repoRoot, "site", "static", "data", "site-content.json");

class FileSystemContentSource implements ContentSource {
  private cachedIndex: SiteIndex | null = null;

  loadSiteIndex(): SiteIndex {
    if (this.cachedIndex) return this.cachedIndex;
    const raw = fs.readFileSync(siteIndexPath, "utf-8");
    this.cachedIndex = JSON.parse(raw) as SiteIndex;
    return this.cachedIndex;
  }

  loadPageMarkdown(bookId: string, slot: string): string {
    const filePath = this.resolvePageFile(bookId, slot);
    const raw = fs.readFileSync(filePath, "utf-8");
    return matter(raw).content;
  }

  private resolvePageFile(bookId: string, slot: string): string {
    const bookDir = path.join(libraryRoot, bookId);
    const files = fs
      .readdirSync(bookDir)
      .filter((name) => name.endsWith(".md") && name !== "_index.md" && !name.endsWith(".QA.md"))
      .sort();
    const matched = files.find((name) => name.startsWith(`${slot}_`));
    if (!matched) {
      throw new Error(`Cannot resolve markdown file for ${bookId}/${slot}`);
    }
    return path.join(bookDir, matched);
  }
}

const defaultContentSource = new FileSystemContentSource();

export function getContentSource(): ContentSource {
  return defaultContentSource;
}
