import { copyText, resolveShareUrl, shareContent, shareImageCard } from "./share";

type ShareElements = {
  area: HTMLElement;
  toggle: HTMLButtonElement | null;
  menu: HTMLElement | null;
};

export function initShareActions() {
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
    if (elements.toggle) {
      elements.toggle.disabled = true;
    }
    setShareFeedback(elements.area, "正在处理…", "neutral");

    if (action === "copy") {
      await copyText(payload.url);
      setShareFeedback(elements.area, "已复制链接", "success");
      closeMenu(elements);
      return;
    }

    if (action === "image") {
      const result = await shareImageCard({
        title: payload.title,
        text: payload.text,
        url: payload.url,
        imageUrl: payload.imageUrl,
        filename: payload.filename,
      });
      setShareFeedback(elements.area, result.method === "download" ? "已打开卡片" : "已分享卡片", "success");
      closeMenu(elements);
      return;
    }

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
  elements.toggle.setAttribute("aria-expanded", "true");
}

function closeMenu(elements: ShareElements) {
  if (!(elements.menu instanceof HTMLElement) || !(elements.toggle instanceof HTMLButtonElement)) return;
  elements.menu.hidden = true;
  elements.toggle.setAttribute("aria-expanded", "false");
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
