import { isNativeShareRuntime, resolveShareUrl, shareContent, shareImageCard } from "./share";

type ShareElements = {
  area: HTMLElement;
  toggle: HTMLButtonElement | null;
  menu: HTMLElement | null;
};

export function initShareActions() {
  const nativeShare = isNativeShareRuntime();

  const shareAreas = Array.from(document.querySelectorAll("[data-share-area]"))
    .filter((node): node is HTMLElement => node instanceof HTMLElement);

  const registeredAreas = shareAreas.map((area) => {
    const elements: ShareElements = {
      area,
      toggle: area.querySelector("[data-share-toggle]"),
      menu: area.querySelector("[data-share-menu]"),
    };

    tuneMenuForRuntime(area, nativeShare);
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
    if (elements.toggle) {
      elements.toggle.disabled = true;
    }
    setShareFeedback(elements.area, "正在处理…", "neutral");

    const result = action === "image"
      ? await shareImageCard({
        title: payload.title,
        text: payload.text,
        url: payload.url,
        imageUrl: payload.imageUrl,
        filename: payload.filename,
      })
      : await shareContent({
        title: payload.title,
        text: payload.text,
        url: payload.url,
      });
    setShareFeedback(elements.area, feedbackMessage(action, result.method), "success");
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

function tuneMenuForRuntime(area: HTMLElement, nativeShare: boolean) {
  const imageAction = area.querySelector('[data-share-action="image"]');
  const linkAction = area.querySelector('[data-share-action="link"]');

  if (linkAction instanceof HTMLButtonElement && !nativeShare) {
    linkAction.textContent = "复制链接";
  }

  if (imageAction instanceof HTMLButtonElement && !nativeShare) {
    imageAction.remove();
  }
}

function feedbackMessage(action: string, method: string) {
  if (action === "image") {
    return method === "clipboard" ? "已复制卡片链接" : "已打开分享";
  }

  return method === "clipboard" ? "已复制链接" : "已打开分享";
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
