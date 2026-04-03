import { resolveShareUrl, shareContent, shareImageCard } from "./share";

type ShareElements = {
  area: HTMLElement;
  toggle: HTMLButtonElement | null;
  menu: HTMLElement | null;
};

type SharePayload = {
  title: string;
  text: string;
  url: string;
  imageUrl: string;
  filename: string;
};

type ShareCardPreviewElements = {
  root: HTMLElement;
  image: HTMLImageElement;
  title: HTMLElement;
  status: HTMLElement;
  shareButton: HTMLButtonElement;
  openButton: HTMLButtonElement;
};

let shareCardPreview: ShareCardPreviewElements | null = null;
let activePreviewPayload: SharePayload | null = null;
let activePreviewArea: HTMLElement | null = null;

export function initShareActions() {
  ensureShareCardPreview();

  const shareAreas = Array.from(document.querySelectorAll("[data-share-area]"))
    .filter((node): node is HTMLElement => node instanceof HTMLElement);

  const registeredAreas = shareAreas.map((area) => {
    const elements: ShareElements = {
      area,
      toggle: area.querySelector("[data-share-toggle]"),
      menu: area.querySelector("[data-share-menu]"),
    };

    bindShareArea(elements);
    return elements;
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Node)) return;
    registeredAreas.forEach((elements) => {
      if (!elements.area.contains(target)) {
        closeMenu(elements);
      }
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    registeredAreas.forEach(closeMenu);
    closeShareCardPreview();
  });

  window.addEventListener("scroll", () => {
    registeredAreas.forEach(closeMenu);
  }, { passive: true });

  window.addEventListener("resize", () => {
    registeredAreas.forEach(closeMenu);
  });
}

function bindShareArea(elements: ShareElements) {
  const { area, menu, toggle } = elements;
  if (!(toggle instanceof HTMLButtonElement) || !(menu instanceof HTMLElement)) return;
  if (area.dataset.shareBound === "true") return;
  area.dataset.shareBound = "true";

  toggle.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const isOpen = !menu.hidden;
    if (isOpen) {
      closeMenu(elements);
      return;
    }
    openMenu(elements);
  });

  menu.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const actionButton = target.closest("[data-share-action]");
    if (!(actionButton instanceof HTMLButtonElement)) return;

    event.preventDefault();
    event.stopPropagation();
    await runShareAction(elements, actionButton.dataset.shareAction || "");
  });
}

async function runShareAction(elements: ShareElements, action: string) {
  const payload = readPayload(elements.area);
  if (!payload.url) return;

  try {
    if (action === "image") {
      closeMenu(elements);
      openShareCardPreview(payload, elements.area);
      return;
    }

    if (elements.toggle) {
      elements.toggle.disabled = true;
    }
    setShareFeedback(elements.area, "正在处理…", "neutral");

    const result = await shareContent({
      title: payload.title,
      text: payload.text,
      url: payload.url,
    });
    setShareFeedback(elements.area, result.method === "clipboard" ? "已复制链接" : "已打开分享", "success");
    closeMenu(elements);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      closeMenu(elements);
      return;
    }
    console.error("Failed to run share action", error);
    setShareFeedback(elements.area, "分享失败", "danger");
  } finally {
    if (elements.toggle) {
      elements.toggle.disabled = false;
    }
  }
}

function openMenu(elements: ShareElements) {
  if (!(elements.menu instanceof HTMLElement) || !(elements.toggle instanceof HTMLButtonElement)) return;
  elements.menu.hidden = false;
  positionMenu(elements);
  elements.toggle.setAttribute("aria-expanded", "true");
}

function closeMenu(elements: ShareElements) {
  if (!(elements.menu instanceof HTMLElement) || !(elements.toggle instanceof HTMLButtonElement)) return;
  elements.menu.hidden = true;
  elements.menu.style.left = "";
  elements.menu.style.top = "";
  elements.menu.style.right = "";
  elements.menu.style.bottom = "";
  elements.menu.style.width = "";
  elements.menu.style.maxHeight = "";
  elements.menu.style.overflowY = "";
  elements.toggle.setAttribute("aria-expanded", "false");
}

function positionMenu(elements: ShareElements) {
  if (!(elements.menu instanceof HTMLElement) || !(elements.toggle instanceof HTMLButtonElement)) return;

  const viewportPadding = 12;
  const gap = 10;
  const toggleRect = elements.toggle.getBoundingClientRect();

  elements.menu.style.visibility = "hidden";
  const menuRect = elements.menu.getBoundingClientRect();

  if (window.innerWidth <= 760) {
    const dock = document.querySelector(".mobile-app-dock");
    const safeBottom = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--safe-bottom") || "16",
    ) || 16;
    const dockTop = dock instanceof HTMLElement
      ? dock.getBoundingClientRect().top
      : window.innerHeight - (84 + safeBottom);
    const bottomOffset = Math.max(viewportPadding + safeBottom, window.innerHeight - dockTop + gap);
    const maxHeight = Math.max(140, window.innerHeight - viewportPadding - bottomOffset);

    elements.menu.style.left = `${viewportPadding}px`;
    elements.menu.style.right = `${viewportPadding}px`;
    elements.menu.style.top = "";
    elements.menu.style.bottom = `${Math.round(bottomOffset)}px`;
    elements.menu.style.width = `calc(100vw - ${viewportPadding * 2}px)`;
    elements.menu.style.maxHeight = `${Math.round(maxHeight)}px`;
    elements.menu.style.overflowY = "auto";
    elements.menu.style.visibility = "";
    return;
  }

  let left = toggleRect.right - menuRect.width;
  if (left < viewportPadding) left = viewportPadding;
  if (left + menuRect.width > window.innerWidth - viewportPadding) {
    left = window.innerWidth - viewportPadding - menuRect.width;
  }

  let top = toggleRect.bottom + gap;
  if (top + menuRect.height > window.innerHeight - viewportPadding) {
    top = toggleRect.top - gap - menuRect.height;
  }
  if (top < viewportPadding) top = viewportPadding;

  elements.menu.style.left = `${Math.round(left)}px`;
  elements.menu.style.top = `${Math.round(top)}px`;
  elements.menu.style.right = "";
  elements.menu.style.bottom = "";
  elements.menu.style.width = "";
  elements.menu.style.maxHeight = "";
  elements.menu.style.overflowY = "";
  elements.menu.style.visibility = "";
}

function readPayload(area: HTMLElement) {
  return {
    title: area.dataset.shareTitle || document.title,
    text: area.dataset.shareText || "",
    url: resolveShareUrl(area.dataset.shareUrl || window.location.href),
    imageUrl: resolveShareUrl(area.dataset.shareImage || ""),
    filename: sanitizeFilename(area.dataset.shareFilename || "book-share-card.svg"),
  };
}

function ensureShareCardPreview() {
  if (shareCardPreview) return shareCardPreview;
  if (typeof document === "undefined") return null;

  const root = document.createElement("section");
  root.className = "share-card-preview";
  root.hidden = true;
  root.setAttribute("aria-hidden", "true");
  root.innerHTML = `
    <div class="share-card-preview-backdrop" data-share-card-close></div>
    <div class="share-card-preview-sheet" role="dialog" aria-modal="true" aria-label="分享卡片预览">
      <div class="share-card-preview-head">
        <strong>分享卡片</strong>
        <button class="share-card-preview-close" type="button" data-share-card-close aria-label="关闭分享卡片预览">关闭</button>
      </div>
      <div class="share-card-preview-frame">
        <img class="share-card-preview-image" data-share-card-image alt="" loading="lazy" />
      </div>
      <p class="share-card-preview-title" data-share-card-title></p>
      <p class="share-card-preview-status" data-share-card-status aria-live="polite"></p>
      <div class="share-card-preview-actions">
        <button class="tool-switch" type="button" data-share-card-open>查看卡片</button>
        <button class="btn" type="button" data-share-card-share>立即分享</button>
      </div>
    </div>
  `;

  document.body.appendChild(root);

  const image = root.querySelector("[data-share-card-image]");
  const title = root.querySelector("[data-share-card-title]");
  const status = root.querySelector("[data-share-card-status]");
  const shareButton = root.querySelector("[data-share-card-share]");
  const openButton = root.querySelector("[data-share-card-open]");
  if (
    !(image instanceof HTMLImageElement) ||
    !(title instanceof HTMLElement) ||
    !(status instanceof HTMLElement) ||
    !(shareButton instanceof HTMLButtonElement) ||
    !(openButton instanceof HTMLButtonElement)
  ) {
    root.remove();
    return null;
  }

  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.closest("[data-share-card-close]")) {
      closeShareCardPreview();
      return;
    }

    if (target.closest("[data-share-card-open]")) {
      event.preventDefault();
      event.stopPropagation();
      if (activePreviewPayload?.imageUrl) {
        window.open(activePreviewPayload.imageUrl, "_blank", "noopener");
      }
      return;
    }

    if (target.closest("[data-share-card-share]")) {
      event.preventDefault();
      event.stopPropagation();
      void submitShareCardPreview();
    }
  });

  shareCardPreview = {
    root,
    image,
    title,
    status,
    shareButton,
    openButton,
  };
  return shareCardPreview;
}

function openShareCardPreview(payload: SharePayload, area: HTMLElement) {
  const preview = ensureShareCardPreview();
  if (!preview) return;

  activePreviewPayload = payload;
  activePreviewArea = area;
  preview.image.src = payload.imageUrl;
  preview.image.alt = payload.title;
  preview.title.textContent = payload.title;
  preview.status.textContent = "";
  preview.root.hidden = false;
  preview.root.setAttribute("aria-hidden", "false");
  preview.shareButton.disabled = false;
  preview.openButton.disabled = false;
  document.body.classList.add("share-card-preview-open");
}

function closeShareCardPreview() {
  if (!shareCardPreview) return;
  shareCardPreview.root.hidden = true;
  shareCardPreview.root.setAttribute("aria-hidden", "true");
  shareCardPreview.status.textContent = "";
  shareCardPreview.shareButton.disabled = false;
  shareCardPreview.openButton.disabled = false;
  document.body.classList.remove("share-card-preview-open");
  activePreviewPayload = null;
  activePreviewArea = null;
}

async function submitShareCardPreview() {
  if (!shareCardPreview || !activePreviewPayload) return;

  try {
    shareCardPreview.shareButton.disabled = true;
    shareCardPreview.openButton.disabled = true;
    shareCardPreview.status.textContent = "正在打开系统分享…";

    const result = await shareImageCard(activePreviewPayload);
    if (activePreviewArea) {
      setShareFeedback(activePreviewArea, result.method === "download" ? "已打开卡片" : "已打开分享", "success");
    }
    closeShareCardPreview();
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      closeShareCardPreview();
      return;
    }
    console.error("Failed to share card preview", error);
    shareCardPreview.status.textContent = "分享失败，请重试";
    shareCardPreview.shareButton.disabled = false;
    shareCardPreview.openButton.disabled = false;
  }
}

function sanitizeFilename(value: string) {
  return String(value || "book-share-card.svg")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-");
}

function setShareFeedback(area: HTMLElement, message: string, tone?: string) {
  const feedback = area.querySelector("[data-share-feedback]");
  if (!(feedback instanceof HTMLElement)) return;

  if (feedback.dataset.timerId) {
    window.clearTimeout(Number(feedback.dataset.timerId));
  }

  feedback.textContent = message;
  feedback.dataset.tone = tone || "neutral";

  if (!message) return;

  const timerId = window.setTimeout(() => {
    feedback.textContent = "";
    delete feedback.dataset.timerId;
  }, 2200);
  feedback.dataset.timerId = String(timerId);
}
