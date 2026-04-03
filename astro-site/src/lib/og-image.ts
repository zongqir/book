import type { PageNode } from "./content";

export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

type OgImageData = {
  eyebrow: string;
  title: string;
  summary: string;
  chips: string[];
  accent: "amber" | "teal";
};

export function buildLibraryOgImagePath(parts: string[]) {
  const encodedParts = parts.map((part) => encodeURIComponent(part)).join("/");
  return `/og/library/${encodedParts}.svg`;
}

export function describeNodeForOg(node: PageNode): string {
  if (node.kind === "section") return `${node.section.title}分类页`;
  if (node.kind === "book") return `《${node.book.title}》书页`;
  return `${node.book?.title || "读书库"} · ${node.page.title}`;
}

export function renderLibraryOgSvg(node: PageNode): string {
  const data = getOgImageData(node);
  const titleLines = wrapLines(data.title, 17, 3);
  const summaryLines = wrapLines(data.summary, 31, 3);
  const accent = data.accent === "teal"
    ? {
        strong: "#1d6d74",
        soft: "rgba(29, 109, 116, 0.18)",
        softAlt: "rgba(29, 109, 116, 0.08)",
      }
    : {
        strong: "#a45b2a",
        soft: "rgba(164, 91, 42, 0.2)",
        softAlt: "rgba(164, 91, 42, 0.08)",
      };

  const chipMarkup = data.chips.slice(0, 4).map((chip, index) => {
    const width = Math.max(120, measureTextWidth(chip, 18) + 36);
    const x = 92 + index * 154;
    return `
      <g transform="translate(${x} 500)">
        <rect width="${width}" height="42" rx="21" fill="rgba(255,255,255,0.72)" stroke="rgba(23,48,67,0.08)" />
        <text x="${width / 2}" y="27" text-anchor="middle" font-size="18" fill="#365063">${escapeXml(chip)}</text>
      </g>
    `;
  }).join("");

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" viewBox="0 0 ${OG_IMAGE_WIDTH} ${OG_IMAGE_HEIGHT}" role="img" aria-label="${escapeXml(describeNodeForOg(node))}">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#efe6d8" />
          <stop offset="52%" stop-color="#f7f2e9" />
          <stop offset="100%" stop-color="#f3ece0" />
        </linearGradient>
        <linearGradient id="panel" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="rgba(255,255,255,0.9)" />
          <stop offset="100%" stop-color="rgba(255,248,240,0.82)" />
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="20" stdDeviation="28" flood-color="rgba(23,48,67,0.14)" />
        </filter>
      </defs>
      <rect width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" fill="url(#bg)" />
      <circle cx="1038" cy="102" r="150" fill="${accent.soft}" />
      <circle cx="168" cy="552" r="132" fill="${accent.softAlt}" />
      <rect x="58" y="54" width="1084" height="522" rx="36" fill="url(#panel)" stroke="rgba(255,255,255,0.72)" filter="url(#shadow)" />
      <rect x="92" y="92" width="72" height="72" rx="22" fill="#173043" />
      <text x="128" y="138" text-anchor="middle" font-size="26" font-weight="700" fill="#f8f3ea" letter-spacing="2">BQ</text>
      <text x="196" y="128" font-size="24" fill="${accent.strong}" letter-spacing="4">${escapeXml(data.eyebrow)}</text>
      ${titleLines.map((line, index) => `
        <text x="92" y="${218 + index * 72}" font-size="56" font-weight="700" fill="#173043" letter-spacing="-1.5">${escapeXml(line)}</text>
      `).join("")}
      ${summaryLines.map((line, index) => `
        <text x="92" y="${398 + index * 34}" font-size="28" fill="#365063">${escapeXml(line)}</text>
      `).join("")}
      ${chipMarkup}
      <text x="92" y="592" font-size="21" fill="#5c7182">book.zongqir.com</text>
    </svg>
  `.trim();
}

function getOgImageData(node: PageNode): OgImageData {
  if (node.kind === "section") {
    const bookTitles = node.books.slice(0, 3).map((book) => book.title);
    return {
      eyebrow: "读书库 · 分类",
      title: node.section.title,
      summary: `这个方向下有 ${node.books.length} 本书，可以从书页直接往里读。${bookTitles.length ? `先从 ${bookTitles.join("、")} 开始。` : ""}`,
      chips: [String(node.books.length) + " 本书", "直接开读"],
      accent: "amber",
    };
  }

  if (node.kind === "book") {
    return {
      eyebrow: node.book.section_title,
      title: node.book.title,
      summary: node.book.summary || `这本书下有 ${node.pages.length} 个入口，可以直接从导图或具体文稿读进去。`,
      chips: [String(node.pages.length) + " 个入口", ...node.book.tags.slice(0, 3)],
      accent: "amber",
    };
  }

  return {
    eyebrow: node.book ? `${node.section?.title || "读书库"} · ${node.book.title}` : "读书库",
    title: node.page.title,
    summary: node.page.summary || node.page.intent || `${node.book?.title || "这本书"}里的这一页，适合直接分享出去。`,
    chips: [node.page.slot, ...node.page.tags.slice(0, 3)].filter(Boolean),
    accent: "teal",
  };
}

function wrapLines(input: string, maxUnits: number, maxLines: number) {
  const text = String(input || "").replace(/\s+/g, " ").trim();
  if (!text) return [""];

  const result: string[] = [];
  let current = "";
  let currentUnits = 0;

  for (const char of text) {
    const units = charWidth(char);
    if (current && currentUnits + units > maxUnits) {
      result.push(current);
      current = char;
      currentUnits = units;
      if (result.length === maxLines - 1) break;
      continue;
    }
    current += char;
    currentUnits += units;
  }

  if (result.length < maxLines && current) {
    result.push(current);
  }

  const consumed = result.join("");
  if (consumed.length < text.length) {
    result[result.length - 1] = `${result[result.length - 1].slice(0, -1)}…`;
  }

  return result.slice(0, maxLines);
}

function charWidth(char: string) {
  return /[^\u0000-\u00ff]/.test(char) ? 2 : 1;
}

function measureTextWidth(text: string, fontSize: number) {
  return Array.from(text).reduce((total, char) => total + (charWidth(char) === 2 ? fontSize : fontSize * 0.58), 0);
}

function escapeXml(value: string) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
