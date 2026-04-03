import { Share } from "@capacitor/share";

const PUBLIC_SITE_ORIGIN = String(import.meta.env.SITE || "https://book.zongqir.com").replace(/\/$/, "");

type SharePayload = {
  title?: string;
  text?: string;
  url?: string;
};

type ShareResult = {
  method: "native-share" | "web-share" | "clipboard" | "download";
};

export function resolveShareUrl(url?: string) {
  if (!url) return "";
  try {
    if (/^(?:[a-z]+:)?\/\//i.test(url)) {
      return new URL(url).toString();
    }

    if (url.startsWith("/")) {
      return new URL(url, PUBLIC_SITE_ORIGIN).toString();
    }

    const currentHref = typeof window !== "undefined" ? window.location.href : `${PUBLIC_SITE_ORIGIN}/`;
    const baseUrl = /^(?:capacitor:|file:)/i.test(currentHref) ? `${PUBLIC_SITE_ORIGIN}/` : currentHref;
    return new URL(url, baseUrl).toString();
  } catch (_error) {
    return url;
  }
}

function getCapacitorRuntime() {
  return typeof window !== "undefined" ? (window as typeof window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor : null;
}

export function isNativeShareRuntime() {
  const capacitor = getCapacitorRuntime();
  return Boolean(capacitor?.isNativePlatform?.());
}

function triggerNativeShare(payload: SharePayload) {
  void Share.share(payload).catch((error) => {
    if (error instanceof DOMException && error.name === "AbortError") return;
    console.error("Native share failed", error);
  });
}

export async function copyText(content: string) {
  const normalized = String(content || "");

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(normalized);
    return;
  }

  if (typeof document !== "undefined") {
    const textarea = document.createElement("textarea");
    textarea.value = normalized;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const copied = document.execCommand("copy");
    textarea.remove();
    if (copied) return;
  }

  throw new Error("copy-unavailable");
}

async function copyShareText(payload: Required<Pick<SharePayload, "title" | "text" | "url">>) {
  const content = [payload.title, payload.text, payload.url].filter(Boolean).join("\n");
  await copyText(content);
}

export async function shareContent(payload: SharePayload): Promise<ShareResult> {
  const title = (payload.title || "").trim();
  const text = (payload.text || "").trim();
  const url = resolveShareUrl(payload.url);
  const sharePayload = {
    title,
    text,
    url,
  };

  if (isNativeShareRuntime()) {
    triggerNativeShare(sharePayload);
    return { method: "native-share" };
  }

  await copyShareText({ title, text, url });
  return { method: "clipboard" };
}

export async function shareImageCard(payload: SharePayload & { imageUrl?: string; filename?: string }): Promise<ShareResult> {
  const title = (payload.title || "").trim();
  const text = (payload.text || "").trim();
  const imageUrl = resolveShareUrl(payload.imageUrl);
  const url = resolveShareUrl(payload.url);

  if (!imageUrl) {
    throw new Error("missing-image-url");
  }

  const mergedText = [text, `卡片预览：${imageUrl}`].filter(Boolean).join("\n");
  const sharePayload = {
    title,
    text: mergedText,
    url: url || imageUrl,
  };

  if (isNativeShareRuntime()) {
    triggerNativeShare(sharePayload);
    return { method: "native-share" };
  }

  await copyShareText({
    title,
    text: mergedText,
    url: url || imageUrl,
  });
  return { method: "clipboard" };
}
