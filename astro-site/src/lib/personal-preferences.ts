export type ThemePreference = "light" | "dark";
export type ReaderFontSizePreference = "sm" | "md" | "lg";

export type LastVisitRecord = {
  url: string;
  title: string;
  label: string;
  context: string;
  summary: string;
  updatedAt: string;
};

export type RecentBookVisitRecord = {
  bookId: string;
  title: string;
  bookUrl: string;
  url: string;
  context: string;
  summary: string;
  updatedAt: string;
};

export const THEME_STORAGE_KEY = "book:theme:v1";
export const READER_FONT_SIZE_STORAGE_KEY = "book:reader-font-size:v1";
export const LAST_VISIT_STORAGE_KEY = "book:last-visit:v1";
export const RECENT_BOOK_VISITS_STORAGE_KEY = "book:recent-books:v1";
export const RECENT_BOOK_VISITS_LIMIT = 5;

const DEFAULT_THEME: ThemePreference = "light";
const DEFAULT_READER_FONT_SIZE: ReaderFontSizePreference = "md";

function isRecentBookVisitRecord(value: unknown): value is RecentBookVisitRecord {
  if (!value || typeof value !== "object") return false;
  const parsed = value as Partial<RecentBookVisitRecord>;
  return (
    typeof parsed.bookId === "string" && parsed.bookId.length > 0
    && typeof parsed.title === "string"
    && typeof parsed.bookUrl === "string"
    && typeof parsed.url === "string"
    && typeof parsed.context === "string"
    && typeof parsed.summary === "string"
    && typeof parsed.updatedAt === "string"
  );
}

export function readThemePreference(): ThemePreference {
  if (typeof window === "undefined") return DEFAULT_THEME;
  const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
  return raw === "dark" ? "dark" : "light";
}

export function writeThemePreference(value: ThemePreference) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(THEME_STORAGE_KEY, value);
  applyThemePreference(value);
  window.dispatchEvent(new CustomEvent("personal-preferences:theme", { detail: { theme: value } }));
}

export function applyThemePreference(value: ThemePreference) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = value;
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor instanceof HTMLMetaElement) {
    themeColor.content = value === "dark" ? "#0f1d29" : "#2f5b7c";
  }
  const colorScheme = document.querySelector('meta[name="color-scheme"]');
  if (colorScheme instanceof HTMLMetaElement) {
    colorScheme.content = value === "dark" ? "dark" : "light";
  }
}

export function readReaderFontSizePreference(): ReaderFontSizePreference {
  if (typeof window === "undefined") return DEFAULT_READER_FONT_SIZE;
  const raw = window.localStorage.getItem(READER_FONT_SIZE_STORAGE_KEY);
  return raw === "sm" || raw === "lg" ? raw : "md";
}

export function writeReaderFontSizePreference(value: ReaderFontSizePreference) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(READER_FONT_SIZE_STORAGE_KEY, value);
  applyReaderFontSizePreference(value);
  window.dispatchEvent(new CustomEvent("personal-preferences:font-size", { detail: { size: value } }));
}

export function applyReaderFontSizePreference(value: ReaderFontSizePreference) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.readerFontSize = value;
}

export function readLastVisit(): LastVisitRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LAST_VISIT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LastVisitRecord>;
    if (
      typeof parsed.url !== "string" ||
      typeof parsed.title !== "string" ||
      typeof parsed.label !== "string" ||
      typeof parsed.context !== "string" ||
      typeof parsed.summary !== "string" ||
      typeof parsed.updatedAt !== "string"
    ) {
      return null;
    }
    return {
      url: parsed.url,
      title: parsed.title,
      label: parsed.label,
      context: parsed.context,
      summary: parsed.summary,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

export function readRecentBookVisits(): RecentBookVisitRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_BOOK_VISITS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecentBookVisitRecord);
  } catch {
    return [];
  }
}

export function upsertRecentBookVisit(record: RecentBookVisitRecord) {
  if (typeof window === "undefined") return;
  const next = [record]
    .concat(readRecentBookVisits().filter((item) => item.bookId !== record.bookId))
    .slice(0, RECENT_BOOK_VISITS_LIMIT);
  window.localStorage.setItem(RECENT_BOOK_VISITS_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("recent-books:changed", { detail: { recentBooks: next } }));
}
