import { Share } from "@capacitor/share";

const PUBLIC_SITE_ORIGIN = String(import.meta.env.SITE || "https://book.zongqir.com").replace(/\/$/, "");

type SharePayload = {
  title?: string;
  text?: string;
  url?: string;
};

type ShareResult = {
  method: "native-share" | "web-share" | "clipboard";
};

function getAbsoluteUrl(url?: string) {
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

async function copyShareText(payload: Required<Pick<SharePayload, "title" | "text" | "url">>) {
  const content = [payload.title, payload.text, payload.url].filter(Boolean).join("\n");

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(content);
    return;
  }

  if (typeof document !== "undefined") {
    const textarea = document.createElement("textarea");
    textarea.value = content;
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

export async function shareContent(payload: SharePayload): Promise<ShareResult> {
  const title = (payload.title || "").trim();
  const text = (payload.text || "").trim();
  const url = getAbsoluteUrl(payload.url);
  const sharePayload = {
    title,
    text,
    url,
  };

  const capacitor = getCapacitorRuntime();
  if (capacitor?.isNativePlatform?.()) {
    try {
      await Share.share(sharePayload);
      return { method: "native-share" };
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
    }
  }

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share(sharePayload);
      return { method: "web-share" };
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
    }
  }

  await copyShareText({ title, text, url });
  return { method: "clipboard" };
}
