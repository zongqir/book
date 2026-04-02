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
  list(pageId: string): Promise<ReaderParagraphNote[]>;
  create(draft: ReaderParagraphNoteDraft): Promise<ReaderParagraphNote>;
  update(id: string, payload: { note: string; color: ReaderNoteColor }): Promise<ReaderParagraphNote | null>;
  remove(id: string): Promise<void>;
};

export type PositionStore = {
  read(): Promise<ReaderNotePositions>;
  write(payload: ReaderNotePositions): Promise<void>;
};

export type ReaderStorageProvider = {
  createNoteStore(): NoteStore;
  createPositionStore(): PositionStore;
};

export type ReaderStorageProviderFactory = () => ReaderStorageProvider;

type StorePayload = {
  version: 1;
  notes: ReaderParagraphNote[];
};

type PositionRecord = {
  id: "fab";
  value: ReaderNotePositions;
};

const READER_DB_NAME = "book-reader-db";
const READER_DB_VERSION = 1;
const NOTE_STORE_NAME = "paragraph-notes";
const POSITION_STORE_NAME = "reader-positions";
export const NOTE_STORAGE_KEY = "book-reader-paragraph-notes:v1";
export const POSITION_STORAGE_KEY = "book-reader-paragraph-notes-position:v1";
const DEFAULT_COLOR: ReaderNoteColor = "amber";
const NOTE_COLORS: ReaderNoteColor[] = ["amber", "teal", "rose", "violet"];

let providerFactory: ReaderStorageProviderFactory | null = null;
let activeProvider: ReaderStorageProvider | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

class BrowserLocalNoteStore implements NoteStore {
  private load(): StorePayload {
    try {
      const raw = window.localStorage.getItem(NOTE_STORAGE_KEY);
      if (!raw) return { version: 1, notes: [] };
      const parsed = JSON.parse(raw) as Partial<StorePayload>;
      const notes = Array.isArray(parsed.notes)
        ? parsed.notes.map(normalizeStoredNote).filter((note): note is ReaderParagraphNote => !!note)
        : [];
      return { version: 1, notes };
    } catch {
      return { version: 1, notes: [] };
    }
  }

  private save(payload: StorePayload) {
    window.localStorage.setItem(NOTE_STORAGE_KEY, JSON.stringify(payload));
  }

  async list(pageId: string) {
    return this.load().notes.filter((note) => note.pageId === pageId).sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  async create(draft: ReaderParagraphNoteDraft) {
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

  async update(id: string, payload: { note: string; color: ReaderNoteColor }) {
    const store = this.load();
    const target = store.notes.find((item) => item.id === id);
    if (!target) return null;
    target.note = payload.note;
    target.color = payload.color;
    target.updatedAt = new Date().toISOString();
    this.save(store);
    return target;
  }

  async remove(id: string) {
    const payload = this.load();
    payload.notes = payload.notes.filter((item) => item.id !== id);
    this.save(payload);
  }
}

class BrowserLocalPositionStore implements PositionStore {
  async read(): Promise<ReaderNotePositions> {
    try {
      const raw = window.localStorage.getItem(POSITION_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as ReaderNotePositions;
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  async write(payload: ReaderNotePositions) {
    window.localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(payload));
  }
}

class IndexedDbNoteStore implements NoteStore {
  async list(pageId: string): Promise<ReaderParagraphNote[]> {
    const db = await openReaderDb();
    const notes = await readAllRecords<ReaderParagraphNote>(db, NOTE_STORE_NAME);
    return notes.filter((note) => note.pageId === pageId).sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  async create(draft: ReaderParagraphNoteDraft): Promise<ReaderParagraphNote> {
    const db = await openReaderDb();
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
    await putRecord(db, NOTE_STORE_NAME, note);
    return note;
  }

  async update(id: string, payload: { note: string; color: ReaderNoteColor }): Promise<ReaderParagraphNote | null> {
    const db = await openReaderDb();
    const existing = await getRecord<ReaderParagraphNote>(db, NOTE_STORE_NAME, id);
    if (!existing) return null;
    const next: ReaderParagraphNote = {
      ...existing,
      note: payload.note,
      color: payload.color,
      updatedAt: new Date().toISOString(),
    };
    await putRecord(db, NOTE_STORE_NAME, next);
    return next;
  }

  async remove(id: string): Promise<void> {
    const db = await openReaderDb();
    await deleteRecord(db, NOTE_STORE_NAME, id);
  }
}

class IndexedDbPositionStore implements PositionStore {
  async read(): Promise<ReaderNotePositions> {
    const db = await openReaderDb();
    const record = await getRecord<PositionRecord>(db, POSITION_STORE_NAME, "fab");
    return record?.value ?? {};
  }

  async write(payload: ReaderNotePositions): Promise<void> {
    const db = await openReaderDb();
    await putRecord<PositionRecord>(db, POSITION_STORE_NAME, { id: "fab", value: payload });
  }
}

class BrowserLocalReaderStorageProvider implements ReaderStorageProvider {
  createNoteStore(): NoteStore {
    return new BrowserLocalNoteStore();
  }

  createPositionStore(): PositionStore {
    return new BrowserLocalPositionStore();
  }
}

class IndexedDbReaderStorageProvider implements ReaderStorageProvider {
  createNoteStore(): NoteStore {
    return new IndexedDbNoteStore();
  }

  createPositionStore(): PositionStore {
    return new IndexedDbPositionStore();
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

function supportsIndexedDb() {
  return typeof indexedDB !== "undefined";
}

function resolveProvider(): ReaderStorageProvider {
  if (!activeProvider) {
    if (providerFactory) {
      activeProvider = providerFactory();
    } else {
      activeProvider = supportsIndexedDb() ? new IndexedDbReaderStorageProvider() : new BrowserLocalReaderStorageProvider();
    }
  }
  return activeProvider;
}

function openReaderDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(READER_DB_NAME, READER_DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(NOTE_STORE_NAME)) {
          db.createObjectStore(NOTE_STORE_NAME, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(POSITION_STORE_NAME)) {
          db.createObjectStore(POSITION_STORE_NAME, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB"));
    });
  }
  return dbPromise;
}

function readAllRecords<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve((request.result as T[]) ?? []);
    request.onerror = () => reject(request.error ?? new Error(`Failed to read ${storeName}`));
  });
}

function getRecord<T>(db: IDBDatabase, storeName: string, key: IDBValidKey): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.get(key);
    request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error(`Failed to get ${storeName} record`));
  });
}

function putRecord<T>(db: IDBDatabase, storeName: string, value: T): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error(`Failed to write ${storeName}`));
    transaction.objectStore(storeName).put(value);
  });
}

function deleteRecord(db: IDBDatabase, storeName: string, key: IDBValidKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error(`Failed to delete ${storeName}`));
    transaction.objectStore(storeName).delete(key);
  });
}

export function createBrowserNoteStore(): NoteStore {
  return new BrowserLocalNoteStore();
}

export function createBrowserPositionStore(): PositionStore {
  return new BrowserLocalPositionStore();
}

export function createIndexedDbNoteStore(): NoteStore {
  return new IndexedDbNoteStore();
}

export function createIndexedDbPositionStore(): PositionStore {
  return new IndexedDbPositionStore();
}

export function createNoteStore(): NoteStore {
  return resolveProvider().createNoteStore();
}

export function createPositionStore(): PositionStore {
  return resolveProvider().createPositionStore();
}

export function registerReaderStorageProviderFactory(factory: ReaderStorageProviderFactory) {
  providerFactory = factory;
  activeProvider = null;
}

export function resetReaderStorageProviderFactory() {
  providerFactory = null;
  activeProvider = null;
}
