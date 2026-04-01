export type ReaderNoteColor = "amber" | "teal" | "rose" | "violet";

export type ReaderParagraphNote = {
  id: string;
  pageId: string;
  blockId: string;
  quote: string;
  note: string;
  color: ReaderNoteColor;
  createdAt: string;
  updatedAt: string;
};

export type ReaderParagraphNoteDraft = {
  pageId: string;
  blockId: string;
  quote: string;
  note: string;
  color: ReaderNoteColor;
};

export type ReaderNotePosition = {
  x: number;
  y: number;
};

export type ReaderNotePositions = Partial<Record<"desktop" | "mobile", ReaderNotePosition>>;

export type NoteStore = {
  list(pageId: string): ReaderParagraphNote[];
  create(draft: ReaderParagraphNoteDraft): ReaderParagraphNote;
  update(id: string, payload: { note: string; color: ReaderNoteColor }): ReaderParagraphNote | null;
  remove(id: string): void;
};

export type PositionStore = {
  read(): ReaderNotePositions;
  write(payload: ReaderNotePositions): void;
};

type StorePayload = {
  version: 1;
  notes: ReaderParagraphNote[];
};

export const NOTE_STORAGE_KEY = "book-reader-paragraph-notes:v1";
export const POSITION_STORAGE_KEY = "book-reader-paragraph-notes-position:v1";
const DEFAULT_COLOR: ReaderNoteColor = "amber";
const NOTE_COLORS: ReaderNoteColor[] = ["amber", "teal", "rose", "violet"];

class BrowserLocalNoteStore implements NoteStore {
  private load(): StorePayload {
    try {
      const raw = window.localStorage.getItem(NOTE_STORAGE_KEY);
      if (!raw) return { version: 1, notes: [] };
      const parsed = JSON.parse(raw) as Partial<StorePayload>;
      const notes = Array.isArray(parsed.notes) ? parsed.notes.map(normalizeStoredNote).filter((note): note is ReaderParagraphNote => !!note) : [];
      return { version: 1, notes };
    } catch {
      return { version: 1, notes: [] };
    }
  }

  private save(payload: StorePayload) {
    window.localStorage.setItem(NOTE_STORAGE_KEY, JSON.stringify(payload));
  }

  list(pageId: string) {
    return this.load().notes.filter((note) => note.pageId === pageId).sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  create(draft: ReaderParagraphNoteDraft) {
    const payload = this.load();
    const now = new Date().toISOString();
    const note: ReaderParagraphNote = {
      id: createId(),
      pageId: draft.pageId,
      blockId: draft.blockId,
      quote: draft.quote,
      note: draft.note,
      color: draft.color,
      createdAt: now,
      updatedAt: now,
    };
    payload.notes.push(note);
    this.save(payload);
    return note;
  }

  update(id: string, payload: { note: string; color: ReaderNoteColor }) {
    const store = this.load();
    const target = store.notes.find((item) => item.id === id);
    if (!target) return null;
    target.note = payload.note;
    target.color = payload.color;
    target.updatedAt = new Date().toISOString();
    this.save(store);
    return target;
  }

  remove(id: string) {
    const payload = this.load();
    payload.notes = payload.notes.filter((item) => item.id !== id);
    this.save(payload);
  }
}

class BrowserLocalPositionStore implements PositionStore {
  read(): ReaderNotePositions {
    try {
      const raw = window.localStorage.getItem(POSITION_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as ReaderNotePositions;
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  write(payload: ReaderNotePositions) {
    window.localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(payload));
  }
}

function isReaderNoteColor(value: unknown): value is ReaderNoteColor {
  return typeof value === "string" && NOTE_COLORS.includes(value as ReaderNoteColor);
}

function normalizeStoredNote(value: unknown): ReaderParagraphNote | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<ReaderParagraphNote>;
  if (!(candidate.id && candidate.pageId && candidate.blockId && typeof candidate.quote === "string" && typeof candidate.note === "string" && typeof candidate.createdAt === "string" && typeof candidate.updatedAt === "string")) {
    return null;
  }
  return {
    id: candidate.id,
    pageId: candidate.pageId,
    blockId: candidate.blockId,
    quote: candidate.quote,
    note: candidate.note,
    color: isReaderNoteColor(candidate.color) ? candidate.color : DEFAULT_COLOR,
    createdAt: candidate.createdAt,
    updatedAt: candidate.updatedAt,
  };
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "note-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function createBrowserNoteStore(): NoteStore {
  return new BrowserLocalNoteStore();
}

export function createBrowserPositionStore(): PositionStore {
  return new BrowserLocalPositionStore();
}
