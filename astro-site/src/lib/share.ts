import { Directory, Filesystem } from "@capacitor/filesystem";
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

async function triggerNativeShare(payload: SharePayload & { files?: string[] }) {
  try {
    await Share.share(payload);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    throw error;
  }
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
    await triggerNativeShare(sharePayload);
    return { method: "native-share" };
  }

  await copyShareText({ title, text, url });
  return { method: "clipboard" };
}

export async function shareImageCard(payload: SharePayload & { imageUrl?: string; filename?: string }): Promise<ShareResult> {
  const title = (payload.title || "").trim();
  const text = (payload.text || "").trim();
  const imageUrl = resolveShareUrl(payload.imageUrl);

  if (!imageUrl) {
    throw new Error("missing-image-url");
  }

  if (isNativeShareRuntime()) {
    const fileUri = await createNativeShareImage(imageUrl, payload.filename);
    await triggerNativeShare({
      title,
      text,
      files: [fileUri],
    });
    return { method: "native-share" };
  }

  const url = resolveShareUrl(payload.url);
  const mergedText = [text, `卡片预览：${imageUrl}`].filter(Boolean).join("\n");
  await copyShareText({
    title,
    text: mergedText,
    url: url || imageUrl,
  });
  return { method: "clipboard" };
}

async function createNativeShareImage(imageUrl: string, filename?: string) {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`image-fetch-failed:${response.status}`);
  }

  const sourceBlob = await response.blob();
  const shareBlob = shouldRasterizeToPng(sourceBlob, imageUrl)
    ? await rasterizeImageBlobToPng(sourceBlob)
    : sourceBlob;
  const finalFilename = normalizeShareFilename(filename, shareBlob.type);
  const data = await blobToBase64(shareBlob);
  const writeResult = await Filesystem.writeFile({
    path: `share/${Date.now()}-${finalFilename}`,
    data,
    directory: Directory.Cache,
    recursive: true,
  });

  return writeResult.uri;
}

function shouldRasterizeToPng(blob: Blob, imageUrl: string) {
  return blob.type === "image/svg+xml" || imageUrl.toLowerCase().endsWith(".svg");
}

async function rasterizeImageBlobToPng(blob: Blob) {
  const objectUrl = URL.createObjectURL(blob);

  try {
    const image = await loadImage(objectUrl);
    const width = image.naturalWidth || 1200;
    const height = image.naturalHeight || 630;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("canvas-context-unavailable");
    }

    context.fillStyle = "#f7f3eb";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) {
          resolve(result);
          return;
        }
        reject(new Error("image-encode-failed"));
      }, "image/png", 0.96);
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image-load-failed"));
    image.src = url;
  });
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error("blob-read-failed"));
    reader.onloadend = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      if (!base64) {
        reject(new Error("blob-read-failed"));
        return;
      }
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });
}

function normalizeShareFilename(filename: string | undefined, mimeType: string) {
  const fallbackBase = sanitizeShareFilename(filename || "book-share-card");
  const nameWithoutExtension = fallbackBase.replace(/\.[a-z0-9]+$/i, "");
  return `${nameWithoutExtension}${extensionForMimeType(mimeType)}`;
}

function sanitizeShareFilename(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "-");
}

function extensionForMimeType(mimeType: string) {
  switch (mimeType) {
    case "image/png":
      return ".png";
    case "image/jpeg":
      return ".jpg";
    case "image/webp":
      return ".webp";
    default:
      return ".png";
  }
}
