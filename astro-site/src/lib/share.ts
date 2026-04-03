import { Share } from "@capacitor/share";

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
    return new URL(url, window.location.href).toString();
  } catch (_error) {
    return url;
  }
}

function getCapacitorRuntime() {
  return typeof window !== "undefined" ? (window as typeof window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor : null;
}

async function copyShareText(payload: Required<Pick<SharePayload, "title" | "text" | "url">>) {
  const content = [payload.title, payload.text, payload.url].filter(Boolean).join("\n");
  await navigator.clipboard.writeText(content);
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
    await Share.share(sharePayload);
    return { method: "native-share" };
  }

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    await navigator.share(sharePayload);
    return { method: "web-share" };
  }

  await copyShareText({ title, text, url });
  return { method: "clipboard" };
}
