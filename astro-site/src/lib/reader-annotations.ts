type AnnotationColor = "amber";

type AnnotationAnchor = {
  start: number;
  end: number;
  quote: string;
  prefix: string;
  suffix: string;
};

export type ReaderAnnotation = {
  id: string;
  pageId: string;
  quote: string;
  note: string;
  color: AnnotationColor;
  createdAt: string;
  updatedAt: string;
  anchor: AnnotationAnchor;
};

type AnnotationDraft = {
  pageId: string;
  quote: string;
  note: string;
  color: AnnotationColor;
  anchor: AnnotationAnchor;
};

type ResolvedAnnotation = {
  annotation: ReaderAnnotation;
  start: number;
  end: number;
};

type PendingSelection = {
  quote: string;
  anchor: AnnotationAnchor;
  rect: DOMRect;
};

type AnnotationStore = {
  list(pageId: string): ReaderAnnotation[];
  create(draft: AnnotationDraft): ReaderAnnotation;
  update(id: string, patch: Partial<Pick<ReaderAnnotation, "note" | "color">>): ReaderAnnotation | null;
  remove(id: string): void;
};

type StorePayload = {
  version: 1;
  annotations: ReaderAnnotation[];
};

const STORAGE_KEY = "book-reader-annotations:v1";
const FAB_POSITION_KEY = "book-reader-notes-fab-position:v1";
const CONTEXT_WINDOW = 48;
const HIGHLIGHT_CLASS = "reader-highlight";
const ACTIVE_CLASS = "is-active";
const MOBILE_BREAKPOINT = 760;
const MOBILE_HIDE_DELAY_MS = 260;
const FAB_SIZE = 54;
const FAB_MARGIN = 18;
const FAB_DRAG_THRESHOLD = 6;
const MOBILE_PICK_SELECTOR = "p, li, blockquote, pre, td, th";

class LocalAnnotationStore implements AnnotationStore {
  private load(): StorePayload {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return { version: 1, annotations: [] };
      const parsed = JSON.parse(raw) as Partial<StorePayload>;
      const annotations = Array.isArray(parsed.annotations) ? parsed.annotations.filter(isValidAnnotation) : [];
      return { version: 1, annotations };
    } catch {
      return { version: 1, annotations: [] };
    }
  }

  private save(payload: StorePayload) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }

  list(pageId: string) {
    return this.load()
      .annotations
      .filter((annotation) => annotation.pageId === pageId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  create(draft: AnnotationDraft) {
    const payload = this.load();
    const now = new Date().toISOString();
    const annotation: ReaderAnnotation = {
      id: createId(),
      pageId: draft.pageId,
      quote: draft.quote,
      note: draft.note,
      color: draft.color,
      createdAt: now,
      updatedAt: now,
      anchor: draft.anchor,
    };
    payload.annotations.push(annotation);
    this.save(payload);
    return annotation;
  }

  update(id: string, patch: Partial<Pick<ReaderAnnotation, "note" | "color">>) {
    const payload = this.load();
    const target = payload.annotations.find((annotation) => annotation.id === id);
    if (!target) return null;
    if (typeof patch.note === "string") target.note = patch.note;
    if (patch.color) target.color = patch.color;
    target.updatedAt = new Date().toISOString();
    this.save(payload);
    return target;
  }

  remove(id: string) {
    const payload = this.load();
    payload.annotations = payload.annotations.filter((annotation) => annotation.id !== id);
    this.save(payload);
  }
}

function isValidAnnotation(value: unknown): value is ReaderAnnotation {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ReaderAnnotation>;
  return !!(
    candidate.id &&
    candidate.pageId &&
    candidate.quote !== undefined &&
    candidate.note !== undefined &&
    candidate.anchor &&
    typeof candidate.anchor.start === "number" &&
    typeof candidate.anchor.end === "number"
  );
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "ann-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function getPlainText(root: HTMLElement) {
  return root.textContent ?? "";
}

function getNodeTextLength(node: Node | null): number {
  if (!node) return 0;
  if (node.nodeType === Node.TEXT_NODE) {
    return node.nodeValue?.length ?? 0;
  }
  let total = 0;
  node.childNodes.forEach((child) => {
    total += getNodeTextLength(child);
  });
  return total;
}

function getOffsetWithinRoot(root: HTMLElement, container: Node, offset: number): number {
  let cursor = 0;
  let found = false;

  function visit(node: Node) {
    if (found) return;
    if (node === container) {
      if (node.nodeType === Node.TEXT_NODE) {
        cursor += offset;
      } else {
        const max = Math.min(offset, node.childNodes.length);
        for (let index = 0; index < max; index += 1) {
          cursor += getNodeTextLength(node.childNodes[index]);
        }
      }
      found = true;
      return;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      cursor += node.nodeValue?.length ?? 0;
      return;
    }

    node.childNodes.forEach((child) => {
      visit(child);
    });
  }

  visit(root);
  return cursor;
}

function buildAnchor(root: HTMLElement, range: Range): AnnotationAnchor | null {
  const start = getOffsetWithinRoot(root, range.startContainer, range.startOffset);
  const end = getOffsetWithinRoot(root, range.endContainer, range.endOffset);
  if (end <= start) return null;
  const text = getPlainText(root);
  const quote = text.slice(start, end);
  if (!quote.trim()) return null;
  return {
    start,
    end,
    quote,
    prefix: text.slice(Math.max(0, start - CONTEXT_WINDOW), start),
    suffix: text.slice(end, Math.min(text.length, end + CONTEXT_WINDOW)),
  };
}

function resolveAnchor(root: HTMLElement, anchor: AnnotationAnchor): { start: number; end: number } | null {
  const text = getPlainText(root);
  if (anchor.end <= text.length && text.slice(anchor.start, anchor.end) === anchor.quote) {
    return { start: anchor.start, end: anchor.end };
  }

  if (!anchor.quote) return null;
  let bestMatch: { start: number; score: number } | null = null;
  let searchFrom = 0;

  while (searchFrom < text.length) {
    const index = text.indexOf(anchor.quote, searchFrom);
    if (index === -1) break;
    const prefix = text.slice(Math.max(0, index - anchor.prefix.length), index);
    const suffix = text.slice(index + anchor.quote.length, index + anchor.quote.length + anchor.suffix.length);
    const score = commonSuffixLength(prefix, anchor.prefix) * 2 + commonPrefixLength(suffix, anchor.suffix);
    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { start: index, score };
      if (score >= anchor.prefix.length * 2 + anchor.suffix.length) break;
    }
    searchFrom = index + anchor.quote.length;
  }

  if (!bestMatch) return null;
  return { start: bestMatch.start, end: bestMatch.start + anchor.quote.length };
}

function commonPrefixLength(left: string, right: string) {
  const length = Math.min(left.length, right.length);
  let index = 0;
  while (index < length && left[index] === right[index]) index += 1;
  return index;
}

function commonSuffixLength(left: string, right: string) {
  const length = Math.min(left.length, right.length);
  let index = 0;
  while (index < length && left[left.length - 1 - index] === right[right.length - 1 - index]) index += 1;
  return index;
}

function getTextSegments(root: HTMLElement, start: number, end: number) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const segments: Array<{ node: Text; start: number; end: number }> = [];
  let cursor = 0;
  let current = walker.nextNode();

  while (current) {
    const node = current as Text;
    const length = node.nodeValue?.length ?? 0;
    const nodeStart = cursor;
    const nodeEnd = cursor + length;
    if (end > nodeStart && start < nodeEnd) {
      segments.push({
        node,
        start: Math.max(0, start - nodeStart),
        end: Math.min(length, end - nodeStart),
      });
    }
    cursor = nodeEnd;
    current = walker.nextNode();
  }

  return segments;
}

function unwrapHighlights(root: HTMLElement) {
  root.querySelectorAll("mark[data-annotation-id]").forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    while (mark.firstChild) {
      parent.insertBefore(mark.firstChild, mark);
    }
    parent.removeChild(mark);
  });
  root.normalize();
}

function wrapHighlight(root: HTMLElement, item: ResolvedAnnotation, activeId: string | null) {
  const segments = getTextSegments(root, item.start, item.end);
  [...segments].reverse().forEach((segment) => {
    if (segment.end <= segment.start) return;
    const rangeNode = segment.node.splitText(segment.start);
    const tail = rangeNode.splitText(segment.end - segment.start);
    const mark = document.createElement("mark");
    mark.className = HIGHLIGHT_CLASS;
    if (item.annotation.id === activeId) {
      mark.classList.add(ACTIVE_CLASS);
    }
    mark.dataset.annotationId = item.annotation.id;
    mark.dataset.annotationColor = item.annotation.color;
    mark.tabIndex = 0;
    if (item.annotation.note) {
      mark.title = item.annotation.note;
    }
    rangeNode.parentNode?.insertBefore(mark, tail);
    mark.appendChild(rangeNode);
  });
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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function setupReaderAnnotations() {
  const root = document.querySelector<HTMLElement>("[data-reader-root]");
  if (!root) return;
  const pageId = root.dataset.pageId;
  if (!pageId) return;

  const toolbar = document.querySelector<HTMLElement>("[data-reader-toolbar]");
  const editor = document.querySelector<HTMLElement>("[data-reader-editor]");
  const editorQuote = document.querySelector<HTMLElement>("[data-reader-editor-quote]");
  const editorInput = document.querySelector<HTMLTextAreaElement>("[data-reader-editor-input]");
  const list = document.querySelector<HTMLElement>("[data-reader-list]");
  const empty = document.querySelector<HTMLElement>("[data-reader-empty]");
  const count = document.querySelector<HTMLElement>("[data-reader-count]");
  const status = document.querySelector<HTMLElement>("[data-reader-status]");
  const notesPanel = document.querySelector<HTMLElement>("[data-reader-panel]");
  const panelCloseButton = document.querySelector<HTMLButtonElement>("[data-reader-panel-close]");
  const saveButton = document.querySelector<HTMLButtonElement>("[data-reader-save]");
  const cancelButton = document.querySelector<HTMLButtonElement>("[data-reader-cancel]");
  const addHighlightButton = document.querySelector<HTMLButtonElement>("[data-reader-add-highlight]");
  const addNoteButton = document.querySelector<HTMLButtonElement>("[data-reader-add-note]");

  if (!toolbar || !editor || !editorQuote || !editorInput || !list || !empty || !count || !status || !notesPanel || !panelCloseButton || !saveButton || !cancelButton || !addHighlightButton || !addNoteButton) {
    return;
  }

  const store = new LocalAnnotationStore();
  let annotations = store.list(pageId);
  let resolved = new Map<string, ResolvedAnnotation>();
  let pendingSelection: PendingSelection | null = null;
  let editingId: string | null = null;
  let activeId: string | null = null;
  let hideToolbarTimer = 0;
  let mobilePickMode = false;
  let isNotesPanelOpen = false;
  let activePickTarget: HTMLElement | null = null;
  let fabX = 0;
  let fabY = 0;
  let fabPointerId: number | null = null;
  let fabPressX = 0;
  let fabPressY = 0;
  let fabStartX = 0;
  let fabStartY = 0;
  let isDraggingFab = false;
  const mobilePickToggle = document.createElement("button");
  mobilePickToggle.type = "button";
  mobilePickToggle.className = "reader-mobile-pick-toggle tool-switch";
  mobilePickToggle.hidden = true;
  mobilePickToggle.setAttribute("aria-label", "切换划线模式");
  document.body.appendChild(mobilePickToggle);

  const notesFab = document.createElement("button");
  notesFab.type = "button";
  notesFab.className = "reader-notes-fab";
  notesFab.setAttribute("aria-label", "打开本页划线与笔记");
  notesFab.title = "本页划线与笔记";
  document.body.appendChild(notesFab);

  function setStatus(message: string) {
    status.textContent = message;
    status.hidden = !message;
  }

  function isMobileSelectionUI() {
    return window.innerWidth <= MOBILE_BREAKPOINT || window.matchMedia("(pointer: coarse)").matches;
  }

  function clearHideToolbarTimer() {
    if (!hideToolbarTimer) return;
    window.clearTimeout(hideToolbarTimer);
    hideToolbarTimer = 0;
  }

  function clampFabPosition(nextX: number, nextY: number) {
    const size = notesFab.offsetWidth || FAB_SIZE;
    const minX = 12;
    const minY = 96;
    const maxX = Math.max(minX, window.innerWidth - size - FAB_MARGIN);
    const maxY = Math.max(minY, window.innerHeight - size - FAB_MARGIN);
    return {
      x: Math.min(maxX, Math.max(minX, nextX)),
      y: Math.min(maxY, Math.max(minY, nextY)),
    };
  }

  function saveFabPosition() {
    window.localStorage.setItem(FAB_POSITION_KEY, JSON.stringify({ x: fabX, y: fabY }));
  }

  function getDefaultFabPosition() {
    const rootRect = root.getBoundingClientRect();
    const size = notesFab.offsetWidth || FAB_SIZE;
    const fallbackX = window.innerWidth - size - FAB_MARGIN;
    const preferredX = Math.min(fallbackX, Math.max(12, rootRect.right - size - 12));
    const preferredY = Math.min(window.innerHeight - size - FAB_MARGIN, Math.max(140, rootRect.top + 120));
    return clampFabPosition(preferredX, preferredY);
  }

  function loadFabPosition() {
    try {
      const raw = window.localStorage.getItem(FAB_POSITION_KEY);
      if (!raw) return getDefaultFabPosition();
      const parsed = JSON.parse(raw) as Partial<{ x: number; y: number }>;
      if (typeof parsed.x !== "number" || typeof parsed.y !== "number") {
        return getDefaultFabPosition();
      }
      return clampFabPosition(parsed.x, parsed.y);
    } catch {
      return getDefaultFabPosition();
    }
  }

  function positionNotesPanel() {
    if (notesPanel.hidden) return;
    const panelWidth = Math.min(360, window.innerWidth - 32);
    const panelHeight = Math.min(notesPanel.offsetHeight || 320, Math.min(window.innerHeight * 0.68, 560));
    const fabRect = notesFab.getBoundingClientRect();
    const gap = 12;
    const nextLeft = Math.min(window.innerWidth - panelWidth - 12, Math.max(12, fabRect.right - panelWidth));
    let nextTop = fabRect.top - panelHeight - gap;
    if (nextTop < 12) {
      nextTop = Math.min(window.innerHeight - panelHeight - 12, fabRect.bottom + gap);
    }
    notesPanel.style.left = nextLeft + "px";
    notesPanel.style.right = "auto";
    notesPanel.style.top = Math.max(12, nextTop) + "px";
    notesPanel.style.bottom = "auto";
  }

  function applyFabPosition(nextX: number, nextY: number) {
    const next = clampFabPosition(nextX, nextY);
    fabX = next.x;
    fabY = next.y;
    notesFab.style.left = fabX + "px";
    notesFab.style.right = "auto";
    notesFab.style.top = fabY + "px";
    notesFab.style.bottom = "auto";
    positionNotesPanel();
  }

  function syncNotesPanel() {
    const shouldShowFab = editor.hidden && toolbar.hidden;
    if (!shouldShowFab) {
      isNotesPanelOpen = false;
    }
    notesFab.hidden = !shouldShowFab;
    notesPanel.hidden = !isNotesPanelOpen;
    notesFab.classList.toggle("is-active", isNotesPanelOpen);
    notesFab.dataset.count = String(annotations.length);
    positionNotesPanel();
  }

  function setActivePickTarget(element: HTMLElement | null) {
    if (activePickTarget && activePickTarget !== element) {
      activePickTarget.classList.remove("reader-mobile-pick-target");
    }
    activePickTarget = element;
    activePickTarget?.classList.add("reader-mobile-pick-target");
  }

  function syncMobilePickToggle() {
    const shouldShow = isMobileSelectionUI() && editor.hidden && toolbar.hidden;
    if (!shouldShow && mobilePickMode) {
      mobilePickMode = false;
      setActivePickTarget(null);
    }
    mobilePickToggle.hidden = !shouldShow;
    mobilePickToggle.textContent = mobilePickMode ? "点正文以划线" : "点段落划线";
    mobilePickToggle.classList.toggle("is-active", mobilePickMode && shouldShow);
    root.classList.toggle("reader-mobile-pick-root", mobilePickMode && shouldShow);
  }

  function setToolbarPosition(rect: DOMRect) {
    if (isMobileSelectionUI()) {
      toolbar.classList.add("reader-toolbar--docked");
      toolbar.style.removeProperty("left");
      toolbar.style.removeProperty("top");
      return;
    }

    toolbar.classList.remove("reader-toolbar--docked");
    const left = Math.min(window.innerWidth - 180, Math.max(12, rect.left + rect.width / 2 - 78));
    const top = Math.max(12, rect.top + window.scrollY - 52);
    toolbar.style.left = left + "px";
    toolbar.style.top = top + "px";
  }

  function hideToolbar() {
    clearHideToolbarTimer();
    toolbar.hidden = true;
    toolbar.classList.remove("reader-toolbar--docked");
    toolbar.style.removeProperty("left");
    toolbar.style.removeProperty("top");
    pendingSelection = null;
    setActivePickTarget(null);
    syncMobilePickToggle();
  }

  function scheduleToolbarHide() {
    clearHideToolbarTimer();
    hideToolbarTimer = window.setTimeout(() => {
      hideToolbar();
    }, MOBILE_HIDE_DELAY_MS);
  }

  function openToolbar(selection: PendingSelection) {
    clearHideToolbarTimer();
    mobilePickMode = false;
    isNotesPanelOpen = false;
    pendingSelection = selection;
    toolbar.hidden = false;
    setToolbarPosition(selection.rect);
    syncMobilePickToggle();
    syncNotesPanel();
  }

  function closeEditor() {
    editor.hidden = true;
    editorInput.value = "";
    editingId = null;
    syncMobilePickToggle();
    syncNotesPanel();
  }

  function openEditor(mode: "create" | "edit", annotation?: ReaderAnnotation) {
    editor.hidden = false;
    isNotesPanelOpen = false;
    syncMobilePickToggle();
    syncNotesPanel();
    editorInput.focus();

    if (mode === "edit" && annotation) {
      editingId = annotation.id;
      editorQuote.textContent = annotation.quote;
      editorInput.value = annotation.note;
      return;
    }

    if (!pendingSelection) return;
    editingId = null;
    editorQuote.textContent = pendingSelection.quote;
    editorInput.value = "";
  }

  function setActive(id: string | null) {
    activeId = id;
    renderHighlights();
    renderList();
  }

  function renderHighlights() {
    unwrapHighlights(root);
    resolved = new Map();
    const items = annotations
      .map((annotation) => {
        const position = resolveAnchor(root, annotation.anchor);
        if (!position) return null;
        return { annotation, start: position.start, end: position.end } satisfies ResolvedAnnotation;
      })
      .filter(Boolean)
      .sort((left, right) => left!.start - right!.start) as ResolvedAnnotation[];

    let lastEnd = -1;
    items.forEach((item) => {
      if (item.start < lastEnd) return;
      wrapHighlight(root, item, activeId);
      resolved.set(item.annotation.id, item);
      lastEnd = item.end;
    });
  }

  function renderList() {
    count.textContent = String(annotations.length);
    empty.hidden = annotations.length > 0;
    list.innerHTML = annotations
      .map((annotation) => {
        const isActive = activeId === annotation.id;
        const note = annotation.note.trim();
        return (
          '<article class="reader-note-item' + (isActive ? ' is-active' : '') + '" data-annotation-item="' + escapeHtml(annotation.id) + '">' +
            '<button class="reader-note-focus" type="button" data-annotation-focus="' + escapeHtml(annotation.id) + '">' +
              '<span class="reader-note-quote">' + escapeHtml(annotation.quote.trim()) + '</span>' +
              '<span class="reader-note-meta">' + (note ? '有笔记' : '仅划线') + ' · ' + escapeHtml(formatTime(annotation.updatedAt)) + '</span>' +
            '</button>' +
            (note ? '<p class="reader-note-copy">' + escapeHtml(note) + '</p>' : '') +
            '<div class="reader-note-actions">' +
              '<button class="tool-switch" type="button" data-annotation-edit="' + escapeHtml(annotation.id) + '">编辑</button>' +
              '<button class="tool-switch" type="button" data-annotation-delete="' + escapeHtml(annotation.id) + '">删除</button>' +
            '</div>' +
          '</article>'
        );
      })
      .join("");
  }

  function refresh() {
    annotations = store.list(pageId);
    renderHighlights();
    renderList();
    syncNotesPanel();
  }

  function hasOverlap(anchor: AnnotationAnchor, excludeId?: string) {
    return annotations.some((annotation) => {
      if (excludeId && annotation.id === excludeId) return false;
      return anchor.start < annotation.anchor.end && anchor.end > annotation.anchor.start;
    });
  }

  function clearNativeSelection() {
    const selection = window.getSelection();
    selection?.removeAllRanges();
  }

  function captureSelection() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
    const range = selection.getRangeAt(0);
    const startNode = range.startContainer.nodeType === Node.TEXT_NODE ? range.startContainer.parentNode : range.startContainer;
    const endNode = range.endContainer.nodeType === Node.TEXT_NODE ? range.endContainer.parentNode : range.endContainer;
    if (!(startNode instanceof Node) || !(endNode instanceof Node)) return null;
    if (!root.contains(startNode) || !root.contains(endNode)) return null;
    const anchor = buildAnchor(root, range);
    if (!anchor) return null;
    if (hasOverlap(anchor)) return null;
    const rect = range.getBoundingClientRect();
    return {
      quote: anchor.quote.trim(),
      anchor,
      rect,
    } satisfies PendingSelection;
  }

  function captureBlockSelection(block: HTMLElement) {
    const range = document.createRange();
    range.selectNodeContents(block);
    const anchor = buildAnchor(root, range);
    if (!anchor) return null;
    if (hasOverlap(anchor)) return null;
    return {
      quote: anchor.quote.trim(),
      anchor,
      rect: block.getBoundingClientRect(),
    } satisfies PendingSelection;
  }

  function findPickableBlock(target: HTMLElement) {
    const block = target.closest<HTMLElement>(MOBILE_PICK_SELECTOR);
    if (!block || !root.contains(block)) return null;
    return block;
  }

  function addSelectionAsHighlight(note: string) {
    if (!pendingSelection) return;
    const draft: AnnotationDraft = {
      pageId,
      quote: pendingSelection.quote,
      note: note.trim(),
      color: "amber",
      anchor: pendingSelection.anchor,
    };
    store.create(draft);
    hideToolbar();
    closeEditor();
    clearNativeSelection();
    setStatus(note.trim() ? "笔记已保存到本地。" : "划线已保存到本地。");
    refresh();
  }

  function focusAnnotation(id: string) {
    setActive(id);
    const target = root.querySelector<HTMLElement>('[data-annotation-id="' + CSS.escape(id) + '"]');
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function syncSelectionToolbar() {
    if (!editor.hidden) return;
    const nextSelection = captureSelection();
    if (!nextSelection) {
      if (isMobileSelectionUI() && pendingSelection && !toolbar.hidden) return;
      hideToolbar();
      return;
    }
    openToolbar(nextSelection);
  }

  addHighlightButton.addEventListener("click", () => {
    addSelectionAsHighlight("");
  });

  toolbar.addEventListener("pointerdown", (event) => {
    event.preventDefault();
  });

  addNoteButton.addEventListener("click", () => {
    if (!pendingSelection) return;
    openEditor("create");
  });

  notesFab.addEventListener("pointerdown", (event) => {
    fabPointerId = event.pointerId;
    fabPressX = event.clientX;
    fabPressY = event.clientY;
    fabStartX = fabX;
    fabStartY = fabY;
    isDraggingFab = false;
    notesFab.setPointerCapture(event.pointerId);
  });

  notesFab.addEventListener("pointermove", (event) => {
    if (fabPointerId !== event.pointerId) return;
    const deltaX = event.clientX - fabPressX;
    const deltaY = event.clientY - fabPressY;
    if (!isDraggingFab && Math.hypot(deltaX, deltaY) >= FAB_DRAG_THRESHOLD) {
      isDraggingFab = true;
      notesFab.classList.add("is-dragging");
    }
    if (!isDraggingFab) return;
    applyFabPosition(fabStartX + deltaX, fabStartY + deltaY);
  });

  notesFab.addEventListener("pointerup", (event) => {
    if (fabPointerId !== event.pointerId) return;
    if (notesFab.hasPointerCapture(event.pointerId)) {
      notesFab.releasePointerCapture(event.pointerId);
    }
    if (isDraggingFab) {
      saveFabPosition();
      notesFab.classList.remove("is-dragging");
    } else {
      isNotesPanelOpen = !isNotesPanelOpen;
      syncNotesPanel();
    }
    fabPointerId = null;
    isDraggingFab = false;
  });

  notesFab.addEventListener("pointercancel", (event) => {
    if (fabPointerId !== event.pointerId) return;
    if (notesFab.hasPointerCapture(event.pointerId)) {
      notesFab.releasePointerCapture(event.pointerId);
    }
    fabPointerId = null;
    isDraggingFab = false;
    notesFab.classList.remove("is-dragging");
    applyFabPosition(fabX, fabY);
  });

  panelCloseButton.addEventListener("click", () => {
    isNotesPanelOpen = false;
    syncNotesPanel();
  });

  mobilePickToggle.addEventListener("click", () => {
    mobilePickMode = !mobilePickMode;
    setActivePickTarget(null);
    if (mobilePickMode) {
      clearNativeSelection();
      setStatus("已进入划线模式：点一段正文，再选划线或记笔记。");
    } else {
      setStatus("");
    }
    syncMobilePickToggle();
  });

  saveButton.addEventListener("click", () => {
    const note = editorInput.value.trim();
    if (editingId) {
      store.update(editingId, { note });
      const currentId = editingId;
      closeEditor();
      setStatus("笔记已更新。");
      refresh();
      setActive(currentId);
      return;
    }
    addSelectionAsHighlight(note);
  });

  cancelButton.addEventListener("click", () => {
    closeEditor();
  });

  document.addEventListener("selectionchange", () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      if (!editor.hidden) return;
      if (isMobileSelectionUI() && pendingSelection && !toolbar.hidden) {
        scheduleToolbarHide();
        return;
      }
      hideToolbar();
    }
  });

  document.addEventListener("mouseup", () => {
    window.setTimeout(syncSelectionToolbar, 0);
  });

  document.addEventListener("touchend", () => {
    window.setTimeout(syncSelectionToolbar, 20);
  });

  document.addEventListener("pointerdown", (event) => {
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (toolbar.contains(target) || editor.contains(target)) return;
    if (pendingSelection && !toolbar.hidden) {
      hideToolbar();
    }
  });

  list.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const focusButton = target.closest<HTMLElement>("[data-annotation-focus]");
    if (focusButton) {
      const id = focusButton.dataset.annotationFocus;
      if (id) focusAnnotation(id);
      isNotesPanelOpen = false;
      syncNotesPanel();
      return;
    }

    const editButton = target.closest<HTMLElement>("[data-annotation-edit]");
    if (editButton) {
      const id = editButton.dataset.annotationEdit;
      const annotation = annotations.find((item) => item.id === id);
      if (!annotation) return;
      setActive(annotation.id);
      openEditor("edit", annotation);
      return;
    }

    const deleteButton = target.closest<HTMLElement>("[data-annotation-delete]");
    if (deleteButton) {
      const id = deleteButton.dataset.annotationDelete;
      if (!id) return;
      store.remove(id);
      if (activeId === id) activeId = null;
      setStatus("这条划线已从本地删除。");
      refresh();
      return;
    }
  });

  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (mobilePickMode) {
      const mark = target.closest<HTMLElement>("[data-annotation-id]");
      if (!mark) {
        const block = findPickableBlock(target);
        if (block) {
          event.preventDefault();
          event.stopPropagation();
          const selection = captureBlockSelection(block);
          if (!selection) {
            setActivePickTarget(null);
            setStatus("这一段已经划过了，换一段试试。");
            return;
          }
          setActivePickTarget(block);
          openToolbar(selection);
          return;
        }
      }
    }

    const mark = target.closest<HTMLElement>("[data-annotation-id]");
    if (!mark) return;
    const id = mark.dataset.annotationId;
    if (!id) return;
    setActive(id);
  });

  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    refresh();
  });

  document.addEventListener("pointerdown", (event) => {
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (!isNotesPanelOpen) return;
    if (notesPanel.contains(target) || notesFab.contains(target)) return;
    isNotesPanelOpen = false;
    syncNotesPanel();
  });

  window.addEventListener("resize", () => {
    syncMobilePickToggle();
    applyFabPosition(fabX, fabY);
    if (!pendingSelection || toolbar.hidden) return;
    setToolbarPosition(pendingSelection.rect);
  });

  const initialFabPosition = loadFabPosition();
  applyFabPosition(initialFabPosition.x, initialFabPosition.y);
  refresh();
  renderList();
  syncMobilePickToggle();
  syncNotesPanel();
}
