type ReaderNoteColor = "amber" | "teal" | "rose" | "violet";

type ReaderParagraphNote = {
  id: string;
  pageId: string;
  blockId: string;
  quote: string;
  note: string;
  color: ReaderNoteColor;
  createdAt: string;
  updatedAt: string;
};

type ReaderParagraphNoteDraft = {
  pageId: string;
  blockId: string;
  quote: string;
  note: string;
  color: ReaderNoteColor;
};

type StorePayload = {
  version: 1;
  notes: ReaderParagraphNote[];
};

type ReaderNotePosition = {
  x: number;
  y: number;
};

type ReaderNotePositions = Partial<Record<"desktop" | "mobile", ReaderNotePosition>>;

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  moved: boolean;
};

const STORAGE_KEY = "book-reader-paragraph-notes:v1";
const POSITION_STORAGE_KEY = "book-reader-paragraph-notes-position:v1";
const PICK_SELECTOR = "p, li, blockquote, pre, td, th, h2, h3";
const ACTIVE_CLASS = "reader-note-block--active";
const SAVED_CLASS = "reader-note-block--saved";
const PICK_MODE_CLASS = "reader-notes-pick-mode";
const MOBILE_BREAKPOINT_QUERY = "(max-width: 760px)";
const DRAG_THRESHOLD = 6;
const FAB_MARGIN = 12;
const MOBILE_FAB_SIZE = 52;
const DESKTOP_FAB_SIZE = 54;
const DEFAULT_COLOR: ReaderNoteColor = "amber";
const NOTE_COLORS: ReaderNoteColor[] = ["amber", "teal", "rose", "violet"];

type NoteStore = {
  list(pageId: string): ReaderParagraphNote[];
  create(draft: ReaderParagraphNoteDraft): ReaderParagraphNote;
  update(id: string, payload: { note: string; color: ReaderNoteColor }): ReaderParagraphNote | null;
  remove(id: string): void;
};

class LocalParagraphNoteStore implements NoteStore {
  private load(): StorePayload {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return { version: 1, notes: [] };
      const parsed = JSON.parse(raw) as Partial<StorePayload>;
      const notes = Array.isArray(parsed.notes) ? parsed.notes.map(normalizeStoredNote).filter((note): note is ReaderParagraphNote => !!note) : [];
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

function isValidPosition(value: unknown): value is ReaderNotePosition {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ReaderNotePosition>;
  return Number.isFinite(candidate.x) && Number.isFinite(candidate.y);
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

  const shell = document.querySelector<HTMLElement>("[data-reader-notes-shell]");
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
  const colorButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-reader-notes-color]"));

  if (!shell || !toggleButton || !panel || !closeButton || !captureButton || !count || !hint || !list || !empty || !editor || !editorTitle || !editorQuote || !editorInput || !editorCancel || !editorSave || !status || colorButtons.length === 0) {
    return;
  }

  const mediaQuery = window.matchMedia(MOBILE_BREAKPOINT_QUERY);
  const store = new LocalParagraphNoteStore();
  let notes = store.list(pageId);
  let panelOpen = !mediaQuery.matches;
  let pickMode = false;
  let activeId: string | null = null;
  let editingId: string | null = null;
  let pickedBlock: HTMLElement | null = null;
  let selectedColor: ReaderNoteColor = DEFAULT_COLOR;
  let shellPosition: ReaderNotePosition = { x: 0, y: 0 };
  let dragState: DragState | null = null;
  let suppressToggleClick = false;
  let lastMode: "desktop" | "mobile" = mediaQuery.matches ? "mobile" : "desktop";

  const blocks = Array.from(root.querySelectorAll<HTMLElement>(PICK_SELECTOR)).filter((block) => getBlockText(block).length >= 12);
  blocks.forEach((block, index) => {
    block.classList.add("reader-note-block");
    block.dataset.readerBlockId = createBlockId(block, index);
  });

  function currentMode(): "desktop" | "mobile" {
    return mediaQuery.matches ? "mobile" : "desktop";
  }

  function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
  }

  function getFabSize() {
    return currentMode() === "mobile" ? MOBILE_FAB_SIZE : DESKTOP_FAB_SIZE;
  }

  function normalizePosition(position: ReaderNotePosition): ReaderNotePosition {
    const size = getFabSize();
    const maxX = Math.max(FAB_MARGIN, window.innerWidth - size - FAB_MARGIN);
    const maxY = Math.max(FAB_MARGIN, window.innerHeight - size - FAB_MARGIN);
    return {
      x: clamp(position.x, FAB_MARGIN, maxX),
      y: clamp(position.y, FAB_MARGIN, maxY),
    };
  }

  function readSavedPositions(): ReaderNotePositions {
    try {
      const raw = window.localStorage.getItem(POSITION_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as ReaderNotePositions;
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function getSavedPosition() {
    const positions = readSavedPositions();
    const saved = positions[currentMode()];
    if (!isValidPosition(saved)) return null;
    return normalizePosition(saved);
  }

  function savePosition(position: ReaderNotePosition) {
    const positions = readSavedPositions();
    positions[currentMode()] = normalizePosition(position);
    window.localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(positions));
  }

  function getDefaultPosition() {
    const size = getFabSize();
    if (currentMode() === "mobile") {
      return normalizePosition({
        x: window.innerWidth - size - FAB_MARGIN,
        y: window.innerHeight - size - (FAB_MARGIN + 8),
      });
    }

    const rect = root.getBoundingClientRect();
    const maxDesktopY = Math.max(110, window.innerHeight - 420);
    return normalizePosition({
      x: rect.right + 18,
      y: Math.min(Math.max(110, rect.top + 72), maxDesktopY),
    });
  }

  function applyShellPosition(position: ReaderNotePosition) {
    shellPosition = normalizePosition(position);
    shell.style.left = `${shellPosition.x}px`;
    shell.style.top = `${shellPosition.y}px`;
    shell.style.right = "auto";
    shell.style.bottom = "auto";
    shell.dataset.panelSide = currentMode() === "mobile" ? "center" : shellPosition.x < 380 ? "right" : "left";
  }

  function syncLayoutMode(forceDefault = false) {
    const nextMode = currentMode();
    const modeChanged = nextMode !== lastMode;

    if (modeChanged) {
      lastMode = nextMode;
      setPickMode(false);
      panelOpen = nextMode === "desktop";
    }

    const targetPosition = getSavedPosition() ?? (modeChanged || forceDefault ? getDefaultPosition() : shellPosition);
    applyShellPosition(targetPosition);
    syncPanel();
  }

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

  function syncColorPicker() {
    colorButtons.forEach((button) => {
      const color = button.dataset.readerNotesColor;
      const selected = color === selectedColor;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", selected ? "true" : "false");
    });
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
    shell.classList.toggle("is-panel-open", panelOpen);
    shell.classList.toggle("is-pick-mode", pickMode);
    toggleButton.classList.toggle("is-active", panelOpen);
    toggleButton.classList.toggle("is-picking", pickMode);
    toggleButton.setAttribute("aria-expanded", panelOpen ? "true" : "false");
    const toggleLabel = pickMode ? "退出选段模式" : panelOpen ? "收起段落笔记" : "打开段落笔记";
    toggleButton.setAttribute("aria-label", toggleLabel);
    toggleButton.title = toggleLabel;
    toggleButton.dataset.count = String(notes.length);
  }

  function setPickMode(next: boolean) {
    pickMode = next;
    root.classList.toggle(PICK_MODE_CLASS, next);
    captureButton.classList.toggle("is-active", next);
    captureButton.textContent = next ? "退出选段" : "开始选段";
    hint.textContent = next ? "现在直接点正文。" : "点“开始选段”后，再点正文。";
    if (currentMode() === "mobile" && next) {
      panelOpen = false;
    }
    syncPanel();
  }

  function setActive(id: string | null) {
    activeId = id;
    blocks.forEach((block) => {
      block.classList.remove(ACTIVE_CLASS, SAVED_CLASS);
      delete block.dataset.readerNoteColor;
    });
    notes.forEach((note) => {
      const block = findBlock(note.blockId);
      if (!block) return;
      block.classList.add(SAVED_CLASS);
      block.dataset.readerNoteColor = note.color;
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
          '<article class="reader-notes-item reader-notes-item--' + note.color + (isActive ? ' is-active' : '') + '">' +
            '<button class="reader-notes-item-focus" type="button" data-reader-note-focus="' + escapeHtml(note.id) + '">' +
              '<span class="reader-notes-item-summary">' + escapeHtml(note.note || note.quote) + '</span>' +
              '<span class="reader-notes-item-time">' + escapeHtml(formatTime(note.updatedAt)) + '</span>' +
              '<span class="reader-notes-item-quote">' + escapeHtml(note.quote) + '</span>' +
            '</button>' +
            '<p class="reader-notes-item-copy">' + escapeHtml(note.note || '仅划线') + '</p>' +
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
    selectedColor = existing?.color ?? DEFAULT_COLOR;
    editor.hidden = false;
    panelOpen = false;
    syncPanel();
    setPickMode(false);
    editorTitle.textContent = existing ? "编辑这一段" : "记下这一段";
    editorQuote.textContent = getBlockText(block);
    editorInput.value = existing?.note ?? "";
    syncColorPicker();
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

    if (existing) {
      store.update(existing.id, { note: noteText, color: selectedColor });
      activeId = existing.id;
      setStatus(noteText ? "这段笔记已更新。" : "这段划线已更新。");
    } else {
      const created = store.create({ pageId, blockId, quote, note: noteText, color: selectedColor });
      activeId = created.id;
      setStatus(noteText ? "这段笔记已保存到本地。" : "这段划线已保存到本地。");
    }

    closeEditor();
    panelOpen = false;
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

  function openExistingNoteByBlock(block: HTMLElement) {
    const blockId = block.dataset.readerBlockId;
    if (!blockId) return false;
    const existing = findNoteByBlockId(blockId);
    if (!existing) return false;
    focusNote(existing);
    return true;
  }

  function finishDrag(pointerId: number) {
    if (!dragState || dragState.pointerId !== pointerId) return;
    const moved = dragState.moved;
    dragState = null;
    if (toggleButton.hasPointerCapture?.(pointerId)) {
      toggleButton.releasePointerCapture(pointerId);
    }
    if (moved) {
      savePosition(shellPosition);
      suppressToggleClick = true;
    }
  }

  toggleButton.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    dragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: shellPosition.x,
      originY: shellPosition.y,
      moved: false,
    };
    if (toggleButton.setPointerCapture) {
      toggleButton.setPointerCapture(event.pointerId);
    }
  });

  toggleButton.addEventListener("pointermove", (event) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;
    if (!dragState.moved && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) return;
    dragState.moved = true;
    event.preventDefault();
    applyShellPosition({
      x: dragState.originX + deltaX,
      y: dragState.originY + deltaY,
    });
  });

  toggleButton.addEventListener("pointerup", (event) => {
    finishDrag(event.pointerId);
  });

  toggleButton.addEventListener("pointercancel", (event) => {
    finishDrag(event.pointerId);
  });

  toggleButton.addEventListener("click", () => {
    if (suppressToggleClick) {
      suppressToggleClick = false;
      return;
    }
    if (currentMode() === "mobile" && pickMode) {
      setPickMode(false);
      panelOpen = true;
      syncPanel();
      return;
    }
    panelOpen = !panelOpen;
    if (!panelOpen) {
      setPickMode(false);
      return;
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

  colorButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const color = button.dataset.readerNotesColor;
      if (!isReaderNoteColor(color)) return;
      selectedColor = color;
      syncColorPicker();
    });
  });

  editorCancel.addEventListener("click", () => {
    closeEditor();
    panelOpen = currentMode() === "desktop";
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
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const interactive = target.closest("a, button, input, textarea, select, summary");
    if (interactive) return;
    const block = target.closest<HTMLElement>(PICK_SELECTOR);
    if (!block || !root.contains(block)) return;

    if (pickMode) {
      event.preventDefault();
      event.stopPropagation();
      const blockId = block.dataset.readerBlockId;
      if (!blockId) return;
      const existing = findNoteByBlockId(blockId);
      setActive(existing?.id ?? null);
      openEditor(block, existing);
      return;
    }

    openExistingNoteByBlock(block);
  });

  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) {
      refresh();
      return;
    }
    if (event.key === POSITION_STORAGE_KEY && !dragState) {
      syncLayoutMode(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!editor.hidden) {
      closeEditor();
      panelOpen = currentMode() === "desktop";
      syncPanel();
      return;
    }
    if (pickMode) {
      setPickMode(false);
      return;
    }
    if (panelOpen && currentMode() === "mobile") {
      panelOpen = false;
      syncPanel();
    }
  });

  const handleMediaChange = () => {
    syncLayoutMode(true);
  };

  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", handleMediaChange);
  } else if (typeof mediaQuery.addListener === "function") {
    mediaQuery.addListener(handleMediaChange);
  }

  window.addEventListener("resize", () => {
    syncLayoutMode(false);
  });

  refresh();
  syncLayoutMode(true);
  syncColorPicker();
  setPickMode(false);
}
