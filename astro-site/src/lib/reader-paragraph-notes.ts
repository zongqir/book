type ReaderParagraphNote = {
  id: string;
  pageId: string;
  blockId: string;
  quote: string;
  note: string;
  createdAt: string;
  updatedAt: string;
};

type ReaderParagraphNoteDraft = {
  pageId: string;
  blockId: string;
  quote: string;
  note: string;
};

type StorePayload = {
  version: 1;
  notes: ReaderParagraphNote[];
};

const STORAGE_KEY = "book-reader-paragraph-notes:v1";
const PICK_SELECTOR = "p, li, blockquote, pre, td, th, h2, h3";
const ACTIVE_CLASS = "reader-note-block--active";
const SAVED_CLASS = "reader-note-block--saved";
const PICK_MODE_CLASS = "reader-notes-pick-mode";

type NoteStore = {
  list(pageId: string): ReaderParagraphNote[];
  create(draft: ReaderParagraphNoteDraft): ReaderParagraphNote;
  update(id: string, note: string): ReaderParagraphNote | null;
  remove(id: string): void;
};

class LocalParagraphNoteStore implements NoteStore {
  private load(): StorePayload {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return { version: 1, notes: [] };
      const parsed = JSON.parse(raw) as Partial<StorePayload>;
      const notes = Array.isArray(parsed.notes) ? parsed.notes.filter(isValidNote) : [];
      return { version: 1, notes };
    } catch {
      return { version: 1, notes: [] };
    }
  }

  private save(payload: StorePayload) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
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
      createdAt: now,
      updatedAt: now,
    };
    payload.notes.push(note);
    this.save(payload);
    return note;
  }

  update(id: string, note: string) {
    const payload = this.load();
    const target = payload.notes.find((item) => item.id === id);
    if (!target) return null;
    target.note = note;
    target.updatedAt = new Date().toISOString();
    this.save(payload);
    return target;
  }

  remove(id: string) {
    const payload = this.load();
    payload.notes = payload.notes.filter((item) => item.id !== id);
    this.save(payload);
  }
}

function isValidNote(value: unknown): value is ReaderParagraphNote {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ReaderParagraphNote>;
  return !!(candidate.id && candidate.pageId && candidate.blockId && typeof candidate.quote === "string" && typeof candidate.note === "string");
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "note-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function getBlockText(element: HTMLElement) {
  return normalizeText(element.textContent ?? "");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return month + "-" + day + " " + hours + ":" + minutes;
}

export function setupReaderParagraphNotes() {
  const root = document.querySelector<HTMLElement>("[data-reader-notes-root]");
  if (!root) return;

  const pageId = root.dataset.pageId;
  if (!pageId) return;

  const toggleButton = document.querySelector<HTMLButtonElement>("[data-reader-notes-toggle]");
  const panel = document.querySelector<HTMLElement>("[data-reader-notes-panel]");
  const closeButton = document.querySelector<HTMLButtonElement>("[data-reader-notes-close]");
  const captureButton = document.querySelector<HTMLButtonElement>("[data-reader-notes-capture]");
  const count = document.querySelector<HTMLElement>("[data-reader-notes-count]");
  const hint = document.querySelector<HTMLElement>("[data-reader-notes-hint]");
  const list = document.querySelector<HTMLElement>("[data-reader-notes-list]");
  const empty = document.querySelector<HTMLElement>("[data-reader-notes-empty]");
  const editor = document.querySelector<HTMLElement>("[data-reader-notes-editor]");
  const editorTitle = document.querySelector<HTMLElement>("[data-reader-notes-editor-title]");
  const editorQuote = document.querySelector<HTMLElement>("[data-reader-notes-quote]");
  const editorInput = document.querySelector<HTMLTextAreaElement>("[data-reader-notes-input]");
  const editorCancel = document.querySelector<HTMLButtonElement>("[data-reader-notes-cancel]");
  const editorSave = document.querySelector<HTMLButtonElement>("[data-reader-notes-save]");
  const status = document.querySelector<HTMLElement>("[data-reader-notes-status]");

  if (!toggleButton || !panel || !closeButton || !captureButton || !count || !hint || !list || !empty || !editor || !editorTitle || !editorQuote || !editorInput || !editorCancel || !editorSave || !status) {
    return;
  }

  const store = new LocalParagraphNoteStore();
  let notes = store.list(pageId);
  let panelOpen = false;
  let pickMode = false;
  let activeId: string | null = null;
  let editingId: string | null = null;
  let pickedBlock: HTMLElement | null = null;

  const blocks = Array.from(root.querySelectorAll<HTMLElement>(PICK_SELECTOR)).filter((block) => getBlockText(block).length >= 12);
  blocks.forEach((block, index) => {
    block.classList.add("reader-note-block");
    block.dataset.readerBlockId = createBlockId(block, index);
  });

  function createBlockId(block: HTMLElement, index: number) {
    const text = getBlockText(block).slice(0, 180);
    return block.tagName.toLowerCase() + "-" + hashText(pageId + "|" + index + "|" + text);
  }

  function findBlock(blockId: string) {
    return root.querySelector<HTMLElement>('[data-reader-block-id="' + CSS.escape(blockId) + '"]');
  }

  function findNoteByBlockId(blockId: string) {
    return notes.find((note) => note.blockId === blockId) ?? null;
  }

  function setStatus(message: string) {
    status.textContent = message;
    status.hidden = !message;
    if (!message) return;
    window.clearTimeout(Number(status.dataset.timerId || 0));
    const timerId = window.setTimeout(() => {
      status.hidden = true;
      status.textContent = "";
    }, 2200);
    status.dataset.timerId = String(timerId);
  }

  function syncPanel() {
    panel.hidden = !panelOpen;
    toggleButton.classList.toggle("is-active", panelOpen);
    toggleButton.setAttribute("aria-expanded", panelOpen ? "true" : "false");
    toggleButton.dataset.count = String(notes.length);
  }

  function setPickMode(next: boolean) {
    pickMode = next;
    root.classList.toggle(PICK_MODE_CLASS, next);
    captureButton.classList.toggle("is-active", next);
    hint.textContent = next ? "现在直接点正文里的段落，就会打开笔记框。" : "只按段落记，不用拖选文字，内容保存在当前浏览器。";
  }

  function setActive(id: string | null) {
    activeId = id;
    blocks.forEach((block) => block.classList.remove(ACTIVE_CLASS, SAVED_CLASS));
    notes.forEach((note) => {
      const block = findBlock(note.blockId);
      if (!block) return;
      block.classList.add(SAVED_CLASS);
      if (note.id === activeId) {
        block.classList.add(ACTIVE_CLASS);
      }
    });
    renderList();
  }

  function renderList() {
    count.textContent = String(notes.length);
    empty.hidden = notes.length > 0;
    list.innerHTML = notes
      .map((note) => {
        const isActive = note.id === activeId;
        return (
          '<article class="reader-notes-item' + (isActive ? ' is-active' : '') + '">' +
            '<button class="reader-notes-item-focus" type="button" data-reader-note-focus="' + escapeHtml(note.id) + '">' +
              '<span class="reader-notes-item-quote">' + escapeHtml(note.quote) + '</span>' +
              '<span class="reader-notes-item-time">' + escapeHtml(formatTime(note.updatedAt)) + '</span>' +
            '</button>' +
            '<p class="reader-notes-item-copy">' + escapeHtml(note.note || '未写内容') + '</p>' +
            '<div class="reader-notes-item-actions">' +
              '<button class="tool-switch tool-switch--compact" type="button" data-reader-note-edit="' + escapeHtml(note.id) + '">编辑</button>' +
              '<button class="tool-switch tool-switch--compact" type="button" data-reader-note-delete="' + escapeHtml(note.id) + '">删除</button>' +
            '</div>' +
          '</article>'
        );
      })
      .join('');
  }

  function refresh() {
    notes = store.list(pageId);
    syncPanel();
    setActive(activeId && notes.some((note) => note.id === activeId) ? activeId : null);
  }

  function openEditor(block: HTMLElement, existing?: ReaderParagraphNote | null) {
    pickedBlock = block;
    editingId = existing?.id ?? null;
    editor.hidden = false;
    panelOpen = false;
    syncPanel();
    setPickMode(false);
    editorTitle.textContent = existing ? "编辑这段笔记" : "给这一段写一句笔记";
    editorQuote.textContent = getBlockText(block);
    editorInput.value = existing?.note ?? "";
    editorInput.focus();
  }

  function closeEditor() {
    editor.hidden = true;
    editingId = null;
    pickedBlock = null;
    editorInput.value = "";
  }

  function saveCurrentNote() {
    if (!pickedBlock) return;
    const blockId = pickedBlock.dataset.readerBlockId;
    if (!blockId) return;
    const quote = getBlockText(pickedBlock);
    const noteText = editorInput.value.trim();
    const existing = editingId ? notes.find((note) => note.id === editingId) ?? null : findNoteByBlockId(blockId);

    if (!noteText) {
      setStatus("先写一句提醒再保存。");
      return;
    }

    if (existing) {
      store.update(existing.id, noteText);
      activeId = existing.id;
      setStatus("这段笔记已更新。");
    } else {
      const created = store.create({ pageId, blockId, quote, note: noteText });
      activeId = created.id;
      setStatus("这段笔记已保存到本地。");
    }

    closeEditor();
    panelOpen = true;
    refresh();
  }

  function focusNote(note: ReaderParagraphNote) {
    const block = findBlock(note.blockId);
    panelOpen = true;
    syncPanel();
    if (!block) return;
    setActive(note.id);
    block.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  toggleButton.addEventListener("click", () => {
    panelOpen = !panelOpen;
    if (!panelOpen) {
      setPickMode(false);
    }
    syncPanel();
  });

  closeButton.addEventListener("click", () => {
    panelOpen = false;
    setPickMode(false);
    syncPanel();
  });

  captureButton.addEventListener("click", () => {
    panelOpen = true;
    syncPanel();
    setPickMode(!pickMode);
  });

  editorCancel.addEventListener("click", () => {
    closeEditor();
    panelOpen = true;
    syncPanel();
  });

  editorSave.addEventListener("click", () => {
    saveCurrentNote();
  });

  list.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const focusButton = target.closest<HTMLElement>("[data-reader-note-focus]");
    if (focusButton) {
      const id = focusButton.dataset.readerNoteFocus;
      const note = notes.find((item) => item.id === id);
      if (note) focusNote(note);
      return;
    }

    const editButton = target.closest<HTMLElement>("[data-reader-note-edit]");
    if (editButton) {
      const id = editButton.dataset.readerNoteEdit;
      const note = notes.find((item) => item.id === id);
      if (!note) return;
      const block = findBlock(note.blockId);
      if (!block) return;
      setActive(note.id);
      openEditor(block, note);
      return;
    }

    const deleteButton = target.closest<HTMLElement>("[data-reader-note-delete]");
    if (deleteButton) {
      const id = deleteButton.dataset.readerNoteDelete;
      if (!id) return;
      store.remove(id);
      if (activeId === id) activeId = null;
      setStatus("这段笔记已删除。");
      refresh();
    }
  });

  root.addEventListener("click", (event) => {
    if (!pickMode) return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const interactive = target.closest("a, button, input, textarea, select, summary");
    if (interactive) return;
    const block = target.closest<HTMLElement>(PICK_SELECTOR);
    if (!block || !root.contains(block)) return;
    event.preventDefault();
    event.stopPropagation();
    const blockId = block.dataset.readerBlockId;
    if (!blockId) return;
    const existing = findNoteByBlockId(blockId);
    setActive(existing?.id ?? null);
    openEditor(block, existing);
  });

  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    refresh();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!editor.hidden) {
      closeEditor();
      panelOpen = true;
      syncPanel();
      return;
    }
    if (pickMode) {
      setPickMode(false);
    }
  });

  refresh();
  renderList();
  syncPanel();
  setPickMode(false);
}
