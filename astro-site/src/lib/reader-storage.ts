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

export type ReaderNotebookExport = {
  schema_version: 1;
  exported_at: string;
  notes: ReaderParagraphNote[];
  positions: ReaderNotePositions;
};

export type NoteStore = {
  list(pageId: string): Promise<ReaderParagraphNote[]>;
  listAll(): Promise<ReaderParagraphNote[]>;
  create(draft: ReaderParagraphNoteDraft): Promise<ReaderParagraphNote>;
  update(id: string, payload: { note: string; color: ReaderNoteColor }): Promise<ReaderParagraphNote | null>;
  remove(id: string): Promise<void>;
  replaceAll(notes: ReaderParagraphNote[]): Promise<void>;
  clear(): Promise<void>;
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
        ? normalizeImportedNotes(parsed.notes)
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
    return this.load().notes.filter((note) => note.pageId === pageId).sort(compareByCreatedAtAsc);
  }

  async listAll() {
    return [...this.load().notes].sort(compareByCreatedAtAsc);
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
    payload.notes = normalizeImportedNotes(payload.notes);
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
    store.notes = normalizeImportedNotes(store.notes);
    this.save(store);
    return target;
  }

  async remove(id: string) {
    const payload = this.load();
    payload.notes = payload.notes.filter((item) => item.id !== id);
    this.save(payload);
  }

  async replaceAll(notes: ReaderParagraphNote[]) {
    this.save({ version: 1, notes: normalizeImportedNotes(notes) });
  }

  async clear() {
    this.save({ version: 1, notes: [] });
  }
}

class BrowserLocalPositionStore implements PositionStore {
  async read(): Promise<ReaderNotePositions> {
    try {
      const raw = window.localStorage.getItem(POSITION_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as ReaderNotePositions;
      return normalizePositions(parsed);
    } catch {
      return {};
    }
  }

  async write(payload: ReaderNotePositions) {
    window.localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(normalizePositions(payload)));
  }
}

class IndexedDbNoteStore implements NoteStore {
  async list(pageId: string): Promise<ReaderParagraphNote[]> {
    const notes = await this.listAll();
    return notes.filter((note) => note.pageId === pageId);
  }

  async listAll(): Promise<ReaderParagraphNote[]> {
    const db = await openReaderDb();
    const notes = await readAllRecords<ReaderParagraphNote>(db, NOTE_STORE_NAME);
    return normalizeImportedNotes(notes).sort(compareByCreatedAtAsc);
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

  async replaceAll(notes: ReaderParagraphNote[]): Promise<void> {
    const db = await openReaderDb();
    await replaceAllRecords(db, NOTE_STORE_NAME, normalizeImportedNotes(notes));
  }

  async clear(): Promise<void> {
    const db = await openReaderDb();
    await clearStore(db, NOTE_STORE_NAME);
  }
}

class IndexedDbPositionStore implements PositionStore {
  async read(): Promise<ReaderNotePositions> {
    const db = await openReaderDb();
    const record = await getRecord<PositionRecord>(db, POSITION_STORE_NAME, "fab");
    return normalizePositions(record?.value ?? {});
  }

  async write(payload: ReaderNotePositions): Promise<void> {
    const db = await openReaderDb();
    await putRecord<PositionRecord>(db, POSITION_STORE_NAME, { id: "fab", value: normalizePositions(payload) });
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

function isValidTimestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(new Date(value).getTime());
}

function normalizeStoredNote(value: unknown): ReaderParagraphNote | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<ReaderParagraphNote>;
  if (!(candidate.id && candidate.pageId && candidate.blockId && typeof candidate.quote === "string" && typeof candidate.note === "string" && isValidTimestamp(candidate.createdAt) && isValidTimestamp(candidate.updatedAt))) {
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

function normalizeImportedNotes(values: unknown[]): ReaderParagraphNote[] {
  const notesById = new Map<string, ReaderParagraphNote>();
  for (const value of values) {
    const note = normalizeStoredNote(value);
    if (!note) continue;
    notesById.set(note.id, note);
  }
  return [...notesById.values()].sort(compareByCreatedAtAsc);
}

function normalizePositions(value: unknown): ReaderNotePositions {
  if (!value || typeof value !== "object") return {};
  const candidate = value as ReaderNotePositions;
  const next: ReaderNotePositions = {};
  if (isValidPosition(candidate.desktop)) {
    next.desktop = { x: candidate.desktop.x, y: candidate.desktop.y };
  }
  if (isValidPosition(candidate.mobile)) {
    next.mobile = { x: candidate.mobile.x, y: candidate.mobile.y };
  }
  return next;
}

function isValidPosition(value: unknown): value is ReaderNotePosition {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ReaderNotePosition>;
  return Number.isFinite(candidate.x) && Number.isFinite(candidate.y);
}

function compareByCreatedAtAsc(left: ReaderParagraphNote, right: ReaderParagraphNote) {
  return left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id);
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

function clearStore(db: IDBDatabase, storeName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error(`Failed to clear ${storeName}`));
    transaction.objectStore(storeName).clear();
  });
}

function replaceAllRecords<T extends { id: IDBValidKey }>(db: IDBDatabase, storeName: string, values: T[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error(`Failed to replace ${storeName}`));
    store.clear();
    values.forEach((value) => {
      store.put(value);
    });
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

export async function listAllReaderNotes(): Promise<ReaderParagraphNote[]> {
  return createNoteStore().listAll();
}

export async function removeReaderNote(id: string): Promise<void> {
  await createNoteStore().remove(id);
}

export async function clearReaderNotebook(): Promise<void> {
  const noteStore = createNoteStore();
  const positionStore = createPositionStore();
  await Promise.all([noteStore.clear(), positionStore.write({})]);
}

export async function exportReaderNotebook(): Promise<ReaderNotebookExport> {
  const noteStore = createNoteStore();
  const positionStore = createPositionStore();
  const [notes, positions] = await Promise.all([noteStore.listAll(), positionStore.read()]);
  return {
    schema_version: 1,
    exported_at: new Date().toISOString(),
    notes,
    positions,
  };
}

export async function importReaderNotebook(payload: unknown): Promise<ReaderNotebookExport> {
  if (!payload || typeof payload !== "object") {
    throw new Error("导入文件格式不对。");
  }

  const candidate = payload as Partial<ReaderNotebookExport> & { notes?: unknown; positions?: unknown };
  const notes = Array.isArray(candidate.notes) ? normalizeImportedNotes(candidate.notes) : null;
  if (!notes) {
    throw new Error("导入文件里没有可用的笔记列表。");
  }
  const positions = normalizePositions(candidate.positions);

  const noteStore = createNoteStore();
  const positionStore = createPositionStore();
  await noteStore.replaceAll(notes);
  await positionStore.write(positions);

  return {
    schema_version: 1,
    exported_at: new Date().toISOString(),
    notes,
    positions,
  };
}

export function registerReaderStorageProviderFactory(factory: ReaderStorageProviderFactory) {
  providerFactory = factory;
  activeProvider = null;
}

export function resetReaderStorageProviderFactory() {
  providerFactory = null;
  activeProvider = null;
}
