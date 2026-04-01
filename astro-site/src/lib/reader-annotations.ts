import {
  UserSelectAction,
  W3CTextFormat,
  createTextAnnotator,
  type TextAnnotation,
  type W3CTextAnnotation,
  type W3CTextAnnotationTarget,
  type W3CTextPositionSelector,
  type W3CTextQuoteSelector,
} from "@recogito/text-annotator";

type LegacyAnnotationAnchor = {
  start: number;
  end: number;
  quote: string;
  prefix: string;
  suffix: string;
};

type LegacyReaderAnnotation = {
  id: string;
  pageId: string;
  quote: string;
  note: string;
  color: "amber";
  createdAt: string;
  updatedAt: string;
  anchor: LegacyAnnotationAnchor;
};

type StoredPayload = {
  version: 2;
  annotations: W3CTextAnnotation[];
};

type LegacyStoredPayload = {
  version?: 1;
  annotations: LegacyReaderAnnotation[];
};

type StoredAnnotationBody = {
  id?: string;
  type?: string;
  purpose?: string;
  value?: string;
  created?: string;
  modified?: string;
};

type PendingSelection = {
  quote: string;
  anchor: LegacyAnnotationAnchor;
  rect: DOMRect;
};

const STORAGE_KEY = "book-reader-annotations:v1";
const FAB_POSITION_KEY = "book-reader-notes-fab-position:v1";
const MOBILE_BREAKPOINT = 760;
const FAB_SIZE = 54;
const FAB_MARGIN = 18;
const FAB_DRAG_THRESHOLD = 6;
const CONTEXT_WINDOW = 48;
const MOBILE_PICK_SELECTOR = "p, li, blockquote, pre, td, th";
const W3C_CONTEXT = "http://www.w3.org/ns/anno.jsonld";

function getCurrentSource() {
  return window.location.href.split("#")[0];
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "ann-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function stampAnnotationPage(annotation: W3CTextAnnotation, pageId: string): W3CTextAnnotation {
  const normalized = normalizeStoredAnnotation(annotation);
  const source = getCurrentSource();
  const target = Array.isArray(normalized.target)
    ? normalized.target.map((item) => ({ ...item, scope: pageId, source }))
    : { ...normalized.target, scope: pageId, source };

  return {
    ...normalized,
    target,
    properties: {
      ...normalized.properties,
      pageId,
    },
  };
}

class LocalAnnotationStore {
  private loadRaw(): StoredPayload {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return { version: 2, annotations: [] };

      const parsed = JSON.parse(raw) as Partial<StoredPayload & LegacyStoredPayload>;
      const annotations = Array.isArray(parsed.annotations) ? parsed.annotations : [];
      if (annotations.length === 0) {
        return { version: 2, annotations: [] };
      }

      if (isLegacyAnnotation(annotations[0])) {
        return {
          version: 2,
          annotations: annotations.filter(isLegacyAnnotation).map(convertLegacyAnnotation),
        };
      }

      return {
        version: 2,
        annotations: annotations.filter(isStoredAnnotation).map(normalizeStoredAnnotation),
      };
    } catch {
      return { version: 2, annotations: [] };
    }
  }

  private save(payload: StoredPayload) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }

  list(pageId: string) {
    return this.loadRaw()
      .annotations
      .filter((annotation) => getAnnotationPageId(annotation) === pageId)
      .sort(compareAnnotations);
  }

  writePage(pageId: string, annotations: W3CTextAnnotation[]) {
    const payload = this.loadRaw();
    const others = payload.annotations.filter((annotation) => getAnnotationPageId(annotation) !== pageId);
    this.save({
      version: 2,
      annotations: [...others, ...annotations.map((annotation) => stampAnnotationPage(annotation, pageId))],
    });
  }
}

function isLegacyAnnotation(value: unknown): value is LegacyReaderAnnotation {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<LegacyReaderAnnotation>;
  return !!(
    candidate.id &&
    candidate.pageId &&
    candidate.anchor &&
    typeof candidate.anchor.start === "number" &&
    typeof candidate.anchor.end === "number"
  );
}

function isStoredAnnotation(value: unknown): value is W3CTextAnnotation {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<W3CTextAnnotation>;
  return !!candidate.id && !!candidate.target;
}

function parseDate(value: unknown) {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
  return undefined;
}

function toIsoString(value: unknown, fallback = new Date()) {
  return (parseDate(value) ?? fallback).toISOString();
}

function normalizeBody(body: StoredAnnotationBody): StoredAnnotationBody {
  return {
    ...body,
    created: typeof body.created === "string" ? body.created : undefined,
    modified: typeof body.modified === "string" ? body.modified : undefined,
  };
}

function normalizeTarget(target: W3CTextAnnotationTarget): W3CTextAnnotationTarget {
  return {
    ...target,
    source: target.source ?? getCurrentSource(),
  };
}

function getAnnotationBodies(annotation: W3CTextAnnotation): StoredAnnotationBody[] {
  const body = annotation.body;
  if (!body) return [];
  return Array.isArray(body) ? body : [body];
}

function normalizeStoredAnnotation(annotation: W3CTextAnnotation): W3CTextAnnotation {
  const target = Array.isArray(annotation.target)
    ? annotation.target.map((item) => normalizeTarget(item as W3CTextAnnotationTarget))
    : normalizeTarget(annotation.target as W3CTextAnnotationTarget);

  return {
    ...annotation,
    "@context": annotation["@context"] ?? W3C_CONTEXT,
    type: annotation.type ?? "Annotation",
    target,
    body: getAnnotationBodies(annotation).map(normalizeBody),
    properties: annotation.properties ? { ...annotation.properties } : undefined,
  };
}

function convertLegacyAnnotation(annotation: LegacyReaderAnnotation): W3CTextAnnotation {
  const created = parseDate(annotation.createdAt) ?? new Date();
  const updated = parseDate(annotation.updatedAt) ?? created;

  return {
    "@context": W3C_CONTEXT,
    type: "Annotation",
    id: annotation.id,
    created: created.toISOString(),
    modified: updated.toISOString(),
    body: annotation.note.trim()
      ? [{
          id: annotation.id + "#note",
          type: "TextualBody",
          purpose: "commenting",
          value: annotation.note.trim(),
          created: created.toISOString(),
          modified: updated.toISOString(),
        }]
      : [],
    properties: {
      pageId: annotation.pageId,
    },
    target: {
      source: getCurrentSource(),
      scope: annotation.pageId,
      selector: [
        {
          type: "TextQuoteSelector",
          exact: annotation.anchor.quote,
          prefix: annotation.anchor.prefix,
          suffix: annotation.anchor.suffix,
        },
        {
          type: "TextPositionSelector",
          start: annotation.anchor.start,
          end: annotation.anchor.end,
        },
      ],
    },
  };
}

function compareAnnotations(left: W3CTextAnnotation, right: W3CTextAnnotation) {
  return getAnnotationTimestamp(left).getTime() - getAnnotationTimestamp(right).getTime();
}

function getPrimaryTarget(annotation: W3CTextAnnotation): W3CTextAnnotationTarget {
  return Array.isArray(annotation.target)
    ? (annotation.target[0] as W3CTextAnnotationTarget)
    : (annotation.target as W3CTextAnnotationTarget);
}

function getSelectors(annotation: W3CTextAnnotation) {
  const selector = getPrimaryTarget(annotation).selector;
  return Array.isArray(selector) ? selector : [selector];
}

function getQuoteSelector(annotation: W3CTextAnnotation) {
  return getSelectors(annotation).find((selector): selector is W3CTextQuoteSelector => selector.type === "TextQuoteSelector");
}

function getPositionSelector(annotation: W3CTextAnnotation) {
  return getSelectors(annotation).find((selector): selector is W3CTextPositionSelector => selector.type === "TextPositionSelector");
}

function getAnnotationPageId(annotation: W3CTextAnnotation) {
  return String(annotation.properties?.pageId ?? getPrimaryTarget(annotation).scope ?? "");
}

function getAnnotationQuote(annotation: W3CTextAnnotation) {
  return getQuoteSelector(annotation)?.exact?.trim() ?? "";
}

function getAnnotationNote(annotation: W3CTextAnnotation) {
  return getAnnotationBodies(annotation).find((body) => body.purpose === "commenting")?.value?.trim() ?? "";
}

function getAnnotationTimestamp(annotation: W3CTextAnnotation) {
  return parseDate(annotation.modified) ?? parseDate(annotation.created) ?? new Date();
}

function formatTime(value: Date | undefined) {
  if (!value) return "";
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");
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

function isRangeInsideRoot(root: HTMLElement, range: Range) {
  const startNode = range.startContainer.nodeType === Node.TEXT_NODE ? range.startContainer.parentNode : range.startContainer;
  const endNode = range.endContainer.nodeType === Node.TEXT_NODE ? range.endContainer.parentNode : range.endContainer;
  return !!startNode && !!endNode && root.contains(startNode) && root.contains(endNode);
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

function buildAnchor(root: HTMLElement, range: Range): LegacyAnnotationAnchor | null {
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

function createDraftAnnotation(pageId: string, anchor: LegacyAnnotationAnchor, note = ""): W3CTextAnnotation {
  const now = new Date().toISOString();
  const id = createId();
  return {
    "@context": W3C_CONTEXT,
    type: "Annotation",
    id,
    created: now,
    modified: now,
    body: note.trim()
      ? [{
          id: id + "#note",
          type: "TextualBody",
          purpose: "commenting",
          value: note.trim(),
          created: now,
          modified: now,
        }]
      : [],
    properties: {
      pageId,
    },
    target: {
      source: getCurrentSource(),
      scope: pageId,
      selector: [
        {
          type: "TextQuoteSelector",
          exact: anchor.quote,
          prefix: anchor.prefix,
          suffix: anchor.suffix,
        },
        {
          type: "TextPositionSelector",
          start: anchor.start,
          end: anchor.end,
        },
      ],
    },
  };
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
  const source = getCurrentSource();
  const annotator = createTextAnnotator<TextAnnotation, W3CTextAnnotation>(root, {
    adapter: W3CTextFormat<TextAnnotation, W3CTextAnnotation>(source, root),
    dismissOnNotAnnotatable: "ALWAYS",
    renderer: "SPANS",
    selectionMode: "all",
    style: (_annotation, state) => ({
      fill: state.selected ? "#a45b2a" : "#e0bf6a",
      fillOpacity: state.selected ? 0.28 : 0.46,
    }),
    userSelectAction: UserSelectAction.SELECT,
  });

  annotator.setAnnotations(store.list(pageId), true);

  let annotations = annotator.getAnnotations().sort(compareAnnotations);
  let activeId: string | null = null;
  let pendingCreatedId: string | null = null;
  let editingId: string | null = null;
  let isNotesPanelOpen = false;
  let lastSelectionRect: DOMRect | null = null;
  let mobilePickMode = false;
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
  mobilePickToggle.textContent = "点段落划线";
  mobilePickToggle.setAttribute("aria-label", "切换点段落划线模式");
  document.body.appendChild(mobilePickToggle);

  const notesFab = document.createElement("button");
  notesFab.type = "button";
  notesFab.className = "reader-notes-fab";
  notesFab.setAttribute("aria-label", "打开本页划线与笔记");
  notesFab.title = "本页划线与笔记";
  document.body.appendChild(notesFab);

  function isMobileSelectionUI() {
    return window.innerWidth <= MOBILE_BREAKPOINT || window.matchMedia("(pointer: coarse)").matches;
  }

  function syncAnnotatingMode() {
    annotator.setAnnotatingEnabled(!isMobileSelectionUI());
  }

  function setStatus(message: string) {
    status.textContent = message;
    status.hidden = !message;
  }

  function clearNativeSelection() {
    window.getSelection()?.removeAllRanges();
  }

  function captureSelectionRect() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
    const range = selection.getRangeAt(0);
    if (!isRangeInsideRoot(root, range)) return null;
    return range.getBoundingClientRect();
  }

  function hasOverlap(anchor: LegacyAnnotationAnchor, excludeId?: string) {
    return annotations.some((annotation) => {
      if (excludeId && annotation.id === excludeId) return false;
      const position = getPositionSelector(annotation);
      if (!position) return false;
      return anchor.start < position.end && anchor.end > position.start;
    });
  }

  function findPickableBlock(target: HTMLElement) {
    const block = target.closest<HTMLElement>(MOBILE_PICK_SELECTOR);
    if (!block || !root.contains(block)) return null;
    return block;
  }

  function captureBlockSelection(block: HTMLElement): PendingSelection | null {
    const range = document.createRange();
    range.selectNodeContents(block);
    const anchor = buildAnchor(root, range);
    range.detach?.();
    if (!anchor || hasOverlap(anchor)) return null;
    return {
      quote: anchor.quote.trim(),
      anchor,
      rect: block.getBoundingClientRect(),
    };
  }

  function hideToolbar() {
    toolbar.hidden = true;
    toolbar.classList.remove("reader-toolbar--docked");
    toolbar.style.removeProperty("left");
    toolbar.style.removeProperty("top");
    setActivePickTarget(null);
    syncMobilePickToggle();
  }

  function closeEditor() {
    editor.hidden = true;
    editorInput.value = "";
    editingId = null;
    syncMobilePickToggle();
    syncNotesPanel();
  }

  function getToolbarFallbackRect() {
    return root.getBoundingClientRect();
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

  function openToolbar() {
    toolbar.hidden = false;
    setToolbarPosition(lastSelectionRect ?? getToolbarFallbackRect());
    clearNativeSelection();
    syncMobilePickToggle();
    syncNotesPanel();
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

  function renderList() {
    count.textContent = String(annotations.length);
    empty.hidden = annotations.length > 0;
    list.innerHTML = annotations.map((annotation) => {
      const note = getAnnotationNote(annotation);
      const quote = getAnnotationQuote(annotation);
      const isActive = activeId === annotation.id;
      return (
        '<article class="reader-note-item' + (isActive ? ' is-active' : '') + '" data-annotation-item="' + escapeHtml(annotation.id) + '">' +
          '<button class="reader-note-focus" type="button" data-annotation-focus="' + escapeHtml(annotation.id) + '">' +
            '<span class="reader-note-quote">' + escapeHtml(quote) + '</span>' +
            '<span class="reader-note-meta">' + (note ? '有笔记' : '仅划线') + ' · ' + escapeHtml(formatTime(getAnnotationTimestamp(annotation))) + '</span>' +
          '</button>' +
          (note ? '<p class="reader-note-copy">' + escapeHtml(note) + '</p>' : '') +
          '<div class="reader-note-actions">' +
            '<button class="tool-switch" type="button" data-annotation-edit="' + escapeHtml(annotation.id) + '">编辑</button>' +
            '<button class="tool-switch" type="button" data-annotation-delete="' + escapeHtml(annotation.id) + '">删除</button>' +
          '</div>' +
        '</article>'
      );
    }).join("");
  }

  function refresh(persist = true) {
    annotations = annotator.getAnnotations().sort(compareAnnotations);
    renderList();
    syncNotesPanel();
    if (persist) {
      store.writePage(pageId, annotations);
    }
  }

  function getAnnotationById(id: string | null) {
    return id ? annotator.getAnnotationById(id) : undefined;
  }

  function setActive(id: string | null) {
    activeId = id;
    if (id) {
      annotator.setSelected(id, false);
    } else {
      annotator.cancelSelected();
    }
    renderList();
  }

  function persistAndClearDraft(message: string) {
    pendingCreatedId = null;
    hideToolbar();
    refresh(true);
    setStatus(message);
  }

  function removePendingAnnotation() {
    const pending = pendingCreatedId;
    if (!pending) return;
    annotator.removeAnnotation(pending);
    pendingCreatedId = null;
    activeId = null;
    hideToolbar();
    closeEditor();
    refresh(false);
    clearNativeSelection();
  }

  function openEditor(annotation: W3CTextAnnotation) {
    editingId = annotation.id;
    editor.hidden = false;
    editorQuote.textContent = getAnnotationQuote(annotation);
    editorInput.value = getAnnotationNote(annotation);
    editorInput.focus();
    hideToolbar();
    isNotesPanelOpen = false;
    syncNotesPanel();
  }

  function buildNoteBody(annotation: W3CTextAnnotation, note: string) {
    const previous = getAnnotationBodies(annotation).find((body) => body.purpose === "commenting");
    return {
      id: previous?.id ?? annotation.id + "#note",
      type: previous?.type ?? "TextualBody",
      purpose: "commenting",
      value: note,
      created: previous?.created ?? toIsoString(annotation.created),
      modified: new Date().toISOString(),
    };
  }

  function saveNote(annotation: W3CTextAnnotation, note: string) {
    const trimmed = note.trim();
    const bodies = getAnnotationBodies(annotation).filter((body) => body.purpose !== "commenting");
    const updated = annotator.updateAnnotation({
      ...annotation,
      modified: new Date().toISOString(),
      body: trimmed ? [...bodies, buildNoteBody(annotation, trimmed)] : [],
    });
    refresh(true);
    setActive(updated.id);
    return updated;
  }

  function focusAnnotation(id: string) {
    setActive(id);
    annotator.scrollIntoView(id);
  }

  function handlePendingAnnotation(annotation: W3CTextAnnotation) {
    if (pendingCreatedId && pendingCreatedId !== annotation.id) {
      annotator.removeAnnotation(pendingCreatedId);
    }
    pendingCreatedId = annotation.id;
    activeId = annotation.id;
    refresh(false);
    setActive(annotation.id);
    isNotesPanelOpen = false;
    openToolbar();
  }

  function addMobileBlockHighlight(selection: PendingSelection) {
    const annotation = createDraftAnnotation(pageId, selection.anchor);
    lastSelectionRect = selection.rect;
    annotator.addAnnotation(annotation);
    const created = getAnnotationById(annotation.id);
    if (created && pendingCreatedId !== annotation.id) {
      handlePendingAnnotation(created);
    }
  }

  annotator.on("createAnnotation", (annotation) => {
    lastSelectionRect = captureSelectionRect() ?? lastSelectionRect;
    handlePendingAnnotation(annotation);
  });

  annotator.on("clickAnnotation", (annotation) => {
    pendingCreatedId = null;
    setActive(annotation.id);
  });

  annotator.on("selectionChanged", (selected) => {
    if (!pendingCreatedId) {
      activeId = selected[0]?.id ?? null;
      renderList();
    }
  });

  addHighlightButton.addEventListener("click", () => {
    if (!pendingCreatedId) return;
    persistAndClearDraft("划线已保存到本地。");
  });

  addNoteButton.addEventListener("click", () => {
    const annotation = getAnnotationById(pendingCreatedId);
    if (!annotation) return;
    openEditor(annotation);
  });

  toolbar.addEventListener("pointerdown", (event) => {
    event.preventDefault();
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
    const annotation = getAnnotationById(editingId);
    if (!annotation) return;
    const note = editorInput.value.trim();
    const updated = saveNote(annotation, note);
    closeEditor();
    if (pendingCreatedId === updated.id) {
      pendingCreatedId = null;
      setStatus(note ? "笔记已保存到本地。" : "划线已保存到本地。");
    } else {
      setStatus("笔记已更新。");
    }
  });

  cancelButton.addEventListener("click", () => {
    if (pendingCreatedId && editingId === pendingCreatedId) {
      closeEditor();
      openToolbar();
      return;
    }
    closeEditor();
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
      const annotation = getAnnotationById(editButton.dataset.annotationEdit ?? null);
      if (!annotation) return;
      setActive(annotation.id);
      openEditor(annotation);
      return;
    }

    const deleteButton = target.closest<HTMLElement>("[data-annotation-delete]");
    if (deleteButton) {
      const id = deleteButton.dataset.annotationDelete;
      if (!id) return;
      annotator.removeAnnotation(id);
      if (pendingCreatedId === id) pendingCreatedId = null;
      if (editingId === id) closeEditor();
      if (activeId === id) activeId = null;
      refresh(true);
      setStatus("这条划线已从本地删除。");
    }
  });

  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!mobilePickMode || !isMobileSelectionUI()) return;
    if (target.closest(".r6o-annotation")) return;
    const block = findPickableBlock(target);
    if (!block) return;
    event.preventDefault();
    event.stopPropagation();
    const selection = captureBlockSelection(block);
    if (!selection) {
      setActivePickTarget(null);
      setStatus("这一段已经划过了，换一段试试。");
      return;
    }
    setActivePickTarget(block);
    addMobileBlockHighlight(selection);
  });

  document.addEventListener("mouseup", () => {
    lastSelectionRect = captureSelectionRect() ?? lastSelectionRect;
  });

  document.addEventListener("touchend", () => {
    window.setTimeout(() => {
      lastSelectionRect = captureSelectionRect() ?? lastSelectionRect;
    }, 20);
  });

  document.addEventListener("pointerdown", (event) => {
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (toolbar.contains(target) || editor.contains(target) || notesPanel.contains(target) || notesFab.contains(target) || mobilePickToggle.contains(target)) {
      return;
    }
    if (pendingCreatedId) {
      removePendingAnnotation();
    }
    if (isNotesPanelOpen) {
      isNotesPanelOpen = false;
      syncNotesPanel();
    }
  });

  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    annotator.setAnnotations(store.list(pageId), true);
    refresh(false);
  });

  window.addEventListener("resize", () => {
    syncAnnotatingMode();
    syncMobilePickToggle();
    applyFabPosition(fabX, fabY);
    if (!toolbar.hidden) {
      setToolbarPosition(lastSelectionRect ?? getToolbarFallbackRect());
    }
  });

  syncAnnotatingMode();
  const initialFabPosition = loadFabPosition();
  applyFabPosition(initialFabPosition.x, initialFabPosition.y);
  renderList();
  syncMobilePickToggle();
  syncNotesPanel();
}
