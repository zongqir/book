export type BookReadState = "unread" | "reading" | "read";
export type BookCurationState = "normal" | "favorite" | "uninterested";

export type BookStatusRecord = {
  read_state: BookReadState;
  curation_state: BookCurationState;
  updated_at: string;
};

type BookStatusSnapshot = {
  schema_version: 1;
  updated_at: string;
  books: Record<string, BookStatusRecord>;
};

type BookStatusFallback = Partial<BookStatusRecord>;

const BOOK_STATUS_STORAGE_KEY = "book:statuses:v1";
const DEFAULT_READ_STATE: BookReadState = "unread";
const DEFAULT_CURATION_STATE: BookCurationState = "normal";
const READ_STATES: BookReadState[] = ["unread", "reading", "read"];
const CURATION_STATES: BookCurationState[] = ["normal", "favorite", "uninterested"];

export function getBookStatusStorageKey() {
  return BOOK_STATUS_STORAGE_KEY;
}

export function readBookStatuses(): Record<string, BookStatusRecord> {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(BOOK_STATUS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<BookStatusSnapshot>;
    const books = parsed.books;
    if (!books || typeof books !== "object") return {};

    const next: Record<string, BookStatusRecord> = {};
    Object.entries(books).forEach(([bookId, value]) => {
      if (typeof bookId !== "string") return;
      next[bookId] = normalizeBookStatus(value);
    });
    return next;
  } catch {
    return {};
  }
}

export function getBookStatus(bookId: string, fallback?: BookStatusFallback): BookStatusRecord {
  const base = normalizeBookStatus(fallback);
  const stored = readBookStatuses()[bookId];
  if (!stored) return base;
  return normalizeBookStatus(stored, base);
}

export function setBookStatus(
  bookId: string,
  next: Partial<BookStatusRecord>,
  fallback?: BookStatusFallback,
): BookStatusRecord {
  const current = getBookStatus(bookId, fallback);
  const resolved = normalizeBookStatus(
    {
      ...current,
      ...next,
      updated_at: new Date().toISOString(),
    },
    current,
  );

  const allStatuses = readBookStatuses();
  allStatuses[bookId] = resolved;
  writeBookStatuses(allStatuses);

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("book-status:changed", {
        detail: {
          bookId,
          status: resolved,
        },
      }),
    );
  }

  return resolved;
}

export function setupBookStatusControls() {
  const roots = Array.from(document.querySelectorAll("[data-book-status-root]"));
  roots.forEach((root) => {
    if (!(root instanceof HTMLElement)) return;
    setupBookStatusControl(root);
  });
}

function setupBookStatusControl(root: HTMLElement) {
  const bookId = String(root.dataset.bookId || "").trim();
  if (!bookId) return;

  const fallback = normalizeBookStatus({
    read_state: root.dataset.defaultReadState,
    curation_state: root.dataset.defaultCurationState,
  });

  const readChip = root.querySelector("[data-book-status-read-chip]");
  const curationChip = root.querySelector("[data-book-status-curation-chip]");
  const copyNode = root.querySelector("[data-book-status-copy]");
  const buttons = Array.from(root.querySelectorAll("[data-book-status-kind][data-book-status-value]"));

  function render(status: BookStatusRecord) {
    root.dataset.readState = status.read_state;
    root.dataset.curationState = status.curation_state;

    if (readChip instanceof HTMLElement) {
      readChip.textContent = "阅读 · " + getReadStateLabel(status.read_state);
      readChip.setAttribute("aria-label", "切换阅读进度，当前" + getReadStateLabel(status.read_state));
    }
    if (curationChip instanceof HTMLElement) {
      curationChip.textContent = "书单 · " + getCurationStateLabel(status.curation_state);
      curationChip.setAttribute("aria-label", "切换书单状态，当前" + getCurationStateLabel(status.curation_state));
    }
    if (copyNode instanceof HTMLElement) {
      copyNode.textContent = buildStatusCopy(status);
    }

    buttons.forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      const kind = button.dataset.bookStatusKind;
      const value = button.dataset.bookStatusValue;
      const selected =
        (kind === "read" && status.read_state === value) ||
        (kind === "curation" && status.curation_state === value);
      button.dataset.selected = selected ? "true" : "false";
      button.setAttribute("aria-pressed", selected ? "true" : "false");
    });
  }

  function getNextReadState(value: BookReadState): BookReadState {
    if (value === "unread") return "reading";
    if (value === "reading") return "read";
    return "unread";
  }

  function getNextCurationState(value: BookCurationState): BookCurationState {
    if (value === "normal") return "favorite";
    if (value === "favorite") return "uninterested";
    return "normal";
  }

  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const cycleTrigger = target.closest("[data-book-status-cycle]");
    if (cycleTrigger instanceof HTMLButtonElement) {
      const currentStatus = getBookStatus(bookId, fallback);
      const cycleKind = cycleTrigger.dataset.bookStatusCycle;
      if (cycleKind === "read") {
        render(setBookStatus(bookId, { read_state: getNextReadState(currentStatus.read_state) }, fallback));
        return;
      }
      if (cycleKind === "curation") {
        render(setBookStatus(bookId, { curation_state: getNextCurationState(currentStatus.curation_state) }, fallback));
        return;
      }
    }

    const button = target.closest("[data-book-status-kind][data-book-status-value]");
    if (!(button instanceof HTMLButtonElement)) return;

    const kind = button.dataset.bookStatusKind;
    const value = button.dataset.bookStatusValue;
    if (kind === "read" && isBookReadState(value)) {
      render(setBookStatus(bookId, { read_state: value }, fallback));
      return;
    }
    if (kind === "curation" && isBookCurationState(value)) {
      render(setBookStatus(bookId, { curation_state: value }, fallback));
    }
  });

  window.addEventListener("book-status:changed", (event) => {
    const detail = (event as CustomEvent<{ bookId?: string; status?: BookStatusRecord }>).detail;
    if (!detail || detail.bookId !== bookId || !detail.status) return;
    render(normalizeBookStatus(detail.status, fallback));
  });

  render(getBookStatus(bookId, fallback));
}

function writeBookStatuses(books: Record<string, BookStatusRecord>) {
  if (typeof window === "undefined") return;
  const payload: BookStatusSnapshot = {
    schema_version: 1,
    updated_at: new Date().toISOString(),
    books,
  };
  window.localStorage.setItem(BOOK_STATUS_STORAGE_KEY, JSON.stringify(payload));
}

function normalizeBookStatus(value: unknown, fallback?: BookStatusFallback): BookStatusRecord {
  const candidate = value && typeof value === "object" ? (value as Partial<BookStatusRecord>) : {};
  return {
    read_state: isBookReadState(candidate.read_state)
      ? candidate.read_state
      : isBookReadState(fallback?.read_state)
        ? fallback.read_state
        : DEFAULT_READ_STATE,
    curation_state: isBookCurationState(candidate.curation_state)
      ? candidate.curation_state
      : isBookCurationState(fallback?.curation_state)
        ? fallback.curation_state
        : DEFAULT_CURATION_STATE,
    updated_at: isValidTimestamp(candidate.updated_at)
      ? candidate.updated_at
      : isValidTimestamp(fallback?.updated_at)
        ? fallback.updated_at
        : "",
  };
}

function isBookReadState(value: unknown): value is BookReadState {
  return typeof value === "string" && READ_STATES.includes(value as BookReadState);
}

function isBookCurationState(value: unknown): value is BookCurationState {
  return typeof value === "string" && CURATION_STATES.includes(value as BookCurationState);
}

function isValidTimestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(new Date(value).getTime());
}

function getReadStateLabel(value: BookReadState) {
  if (value === "reading") return "在读";
  if (value === "read") return "已读";
  return "未读";
}

function getCurationStateLabel(value: BookCurationState) {
  if (value === "favorite") return "收藏";
  if (value === "uninterested") return "排除随机";
  return "保留";
}

function buildStatusCopy(status: BookStatusRecord) {
  const progress =
    status.read_state === "reading"
      ? "现在正在读。"
      : status.read_state === "read"
        ? "这本已经读过。"
        : "这本还没开始。";
  const curation =
    status.curation_state === "favorite"
      ? "它会继续参与随机，而且更常出现。"
      : status.curation_state === "uninterested"
        ? "它会从首页随机里排除，但目录里还保留。"
        : "它会按普通权重参与随机。";
  return progress + curation + " 只保存在当前浏览器。";
}
