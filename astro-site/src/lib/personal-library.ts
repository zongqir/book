import {
  getBookStatus,
  getBookStatusStorageKey,
  setBookStatus,
  type BookStatusRecord,
} from "./book-status-storage";

export type FavoritePageRecord = {
  page_id: string;
  page_title: string;
  page_url: string;
  page_summary: string;
  book_id: string;
  book_title: string;
  book_url: string;
  section_title: string;
  slot: string;
  updated_at: string;
};

type FavoritePageSnapshot = {
  schema_version: 1;
  updated_at: string;
  pages: Record<string, FavoritePageRecord>;
};

type FavoriteButtonContext =
  | {
      kind: "book";
      button: HTMLButtonElement;
      bookId: string;
      fallback: Partial<BookStatusRecord>;
    }
  | {
      kind: "page";
      button: HTMLButtonElement;
      page: FavoritePageRecord;
    };

const FAVORITE_PAGE_STORAGE_KEY = "book:favorite-pages:v1";

export function getFavoritePageStorageKey() {
  return FAVORITE_PAGE_STORAGE_KEY;
}

export function readFavoritePages(): Record<string, FavoritePageRecord> {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(FAVORITE_PAGE_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as Partial<FavoritePageSnapshot>;
    const pages = parsed.pages;
    if (!pages || typeof pages !== "object") return {};

    const next: Record<string, FavoritePageRecord> = {};
    Object.entries(pages).forEach(([pageId, value]) => {
      if (typeof pageId !== "string") return;
      const normalized = normalizeFavoritePage(value, pageId);
      if (!normalized) return;
      next[pageId] = normalized;
    });
    return next;
  } catch {
    return {};
  }
}

export function isPageFavorited(pageId: string) {
  return Boolean(readFavoritePages()[pageId]);
}

export function setPageFavorite(page: FavoritePageRecord) {
  const normalized = normalizeFavoritePage(page, page.page_id);
  if (!normalized) {
    throw new Error("Invalid favorite page payload");
  }

  const current = readFavoritePages();
  current[normalized.page_id] = {
    ...normalized,
    updated_at: new Date().toISOString(),
  };
  writeFavoritePages(current);
  dispatchPageFavoriteChange(normalized.page_id, true, current[normalized.page_id]);
  return current[normalized.page_id];
}

export function removePageFavorite(pageId: string) {
  const current = readFavoritePages();
  const existing = current[pageId];
  if (!existing) return false;
  delete current[pageId];
  writeFavoritePages(current);
  dispatchPageFavoriteChange(pageId, false, existing);
  return true;
}

export function togglePageFavorite(page: FavoritePageRecord) {
  if (isPageFavorited(page.page_id)) {
    removePageFavorite(page.page_id);
    return false;
  }
  setPageFavorite(page);
  return true;
}

export function initFavoriteButtons() {
  const buttons = Array.from(document.querySelectorAll("[data-favorite-toggle]")).filter(
    (node): node is HTMLButtonElement => node instanceof HTMLButtonElement,
  );
  if (!buttons.length) return;

  const contexts = buttons
    .map((button) => buildFavoriteButtonContext(button))
    .filter((context): context is FavoriteButtonContext => Boolean(context));

  contexts.forEach((context) => {
    if (context.button.dataset.favoriteBound === "true") return;
    context.button.dataset.favoriteBound = "true";
    renderFavoriteButton(context);

    context.button.addEventListener("click", () => {
      if (context.kind === "book") {
        const current = getBookStatus(context.bookId, context.fallback);
        const nextFavorite = current.curation_state !== "favorite";
        setBookStatus(
          context.bookId,
          {
            curation_state: nextFavorite ? "favorite" : "normal",
          },
          context.fallback,
        );
        return;
      }

      togglePageFavorite(context.page);
    });
  });

  window.addEventListener("book-status:changed", (event) => {
    const detail = (event as CustomEvent<{ bookId?: string }>).detail;
    if (!detail?.bookId) return;
    contexts.forEach((context) => {
      if (context.kind === "book" && context.bookId === detail.bookId) {
        renderFavoriteButton(context);
      }
    });
  });

  window.addEventListener("page-favorite:changed", (event) => {
    const detail = (event as CustomEvent<{ pageId?: string }>).detail;
    if (!detail?.pageId) return;
    contexts.forEach((context) => {
      if (context.kind === "page" && context.page.page_id === detail.pageId) {
        renderFavoriteButton(context);
      }
    });
  });

  window.addEventListener("storage", (event) => {
    if (event.key !== getBookStatusStorageKey() && event.key !== FAVORITE_PAGE_STORAGE_KEY) return;
    contexts.forEach((context) => {
      renderFavoriteButton(context);
    });
  });
}

function buildFavoriteButtonContext(button: HTMLButtonElement): FavoriteButtonContext | null {
  const kind = String(button.dataset.favoriteKind || "").trim();
  if (kind === "book") {
    const bookId = String(button.dataset.bookId || "").trim();
    if (!bookId) return null;
    return {
      kind: "book",
      button,
      bookId,
      fallback: {
        curation_state: button.dataset.defaultCurationState === "favorite"
          ? "favorite"
          : button.dataset.defaultCurationState === "uninterested"
            ? "uninterested"
            : "normal",
      },
    };
  }

  if (kind === "page") {
    const page = normalizeFavoritePage(
      {
        page_id: button.dataset.pageId,
        page_title: button.dataset.pageTitle,
        page_url: button.dataset.pageUrl,
        page_summary: button.dataset.pageSummary,
        book_id: button.dataset.bookId,
        book_title: button.dataset.bookTitle,
        book_url: button.dataset.bookUrl,
        section_title: button.dataset.sectionTitle,
        slot: button.dataset.pageSlot,
        updated_at: "",
      },
      button.dataset.pageId,
    );
    if (!page) return null;
    return {
      kind: "page",
      button,
      page,
    };
  }

  return null;
}

function renderFavoriteButton(context: FavoriteButtonContext) {
  const favorited = context.kind === "book"
    ? getBookStatus(context.bookId, context.fallback).curation_state === "favorite"
    : isPageFavorited(context.page.page_id);
  const button = context.button;
  const typeLabel = context.kind === "book" ? "这本书" : "这篇文章";
  button.dataset.favorited = favorited ? "true" : "false";
  button.setAttribute("aria-pressed", favorited ? "true" : "false");
  button.setAttribute("title", favorited ? `取消收藏${typeLabel}` : `收藏${typeLabel}`);
  button.setAttribute("aria-label", favorited ? `取消收藏${typeLabel}` : `收藏${typeLabel}`);

  const label = button.querySelector("[data-favorite-label]");
  if (label instanceof HTMLElement) {
    label.textContent = favorited ? "已收藏" : "收藏";
  }
}

function writeFavoritePages(pages: Record<string, FavoritePageRecord>) {
  if (typeof window === "undefined") return;
  const payload: FavoritePageSnapshot = {
    schema_version: 1,
    updated_at: new Date().toISOString(),
    pages,
  };
  window.localStorage.setItem(FAVORITE_PAGE_STORAGE_KEY, JSON.stringify(payload));
}

function dispatchPageFavoriteChange(pageId: string, favorited: boolean, page: FavoritePageRecord) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("page-favorite:changed", {
      detail: {
        pageId,
        favorited,
        page,
      },
    }),
  );
}

function normalizeFavoritePage(value: unknown, fallbackPageId?: unknown): FavoritePageRecord | null {
  const candidate = value && typeof value === "object"
    ? (value as Partial<FavoritePageRecord>)
    : {};
  const pageId = normalizeString(candidate.page_id || fallbackPageId);
  const pageTitle = normalizeString(candidate.page_title);
  const pageUrl = normalizeString(candidate.page_url);
  if (!pageId || !pageTitle || !pageUrl) return null;

  return {
    page_id: pageId,
    page_title: pageTitle,
    page_url: pageUrl,
    page_summary: normalizeString(candidate.page_summary),
    book_id: normalizeString(candidate.book_id),
    book_title: normalizeString(candidate.book_title),
    book_url: normalizeString(candidate.book_url),
    section_title: normalizeString(candidate.section_title),
    slot: normalizeString(candidate.slot),
    updated_at: normalizeTimestamp(candidate.updated_at),
  };
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTimestamp(value: unknown) {
  if (typeof value !== "string") return "";
  return Number.isNaN(new Date(value).getTime()) ? "" : value;
}
