import type { PageNode } from "./content";

export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

type OgImageData = {
  eyebrow: string;
  title: string;
  summary: string;
  sourceTitle: string;
  sourceLines: Array<{ label: string; value: string }>;
  accent: "amber" | "teal";
};

export function buildLibraryOgImagePath(parts: string[]) {
  const encodedParts = parts.map((part) => encodeURIComponent(part)).join("/");
  return `/og/library/${encodedParts}.svg`;
}

export function describeNodeForOg(node: PageNode): string {
  if (node.kind === "section") return `${node.section.title}分类页`;
  if (node.kind === "book") return `《${node.book.title}》书页`;
  return `${node.book?.title || "今天读什么"} · ${node.page.title}`;
}

export function renderLibraryOgSvg(node: PageNode): string {
  const data = getOgImageData(node);
  const titleLines = wrapLines(data.title, 17, 3);
  const summaryLines = wrapLines(data.summary, 32, 5);
  const accent = data.accent === "teal"
    ? {
        strong: "#1d6d74",
        panel: "#eef6f5",
        line: "#9ebfc2",
      }
    : {
        strong: "#a45b2a",
        panel: "#fbf1e8",
        line: "#d7b89c",
      };
  const titleBaseY = titleLines.length >= 3 ? 178 : titleLines.length === 2 ? 210 : 244;
  const summaryBaseY = titleBaseY + titleLines.length * 68 + 34;
  const summaryMarkup = summaryLines.map((line, index) => `
    <text
      x="96"
      y="${summaryBaseY + index * 34}"
      font-size="28"
      fill="#365063"
      font-family="'Noto Sans SC', 'PingFang SC', sans-serif"
    >${escapeXml(line)}</text>
  `).join("");
  const sourceMarkup = data.sourceLines.slice(0, 4).map((item, index) => {
    const y = 208 + index * 84;
    return `
      <text x="890" y="${y}" font-size="15" fill="rgba(54,80,99,0.70)" letter-spacing="2">${escapeXml(item.label)}</text>
      <text
        x="890"
        y="${y + 32}"
        font-size="26"
        fill="#173043"
        font-family="'Noto Sans SC', 'PingFang SC', sans-serif"
      >${escapeXml(item.value)}</text>
    `;
  }).join("");

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" viewBox="0 0 ${OG_IMAGE_WIDTH} ${OG_IMAGE_HEIGHT}" role="img" aria-label="${escapeXml(describeNodeForOg(node))}">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f1e8dc" />
          <stop offset="100%" stop-color="#f8f3ea" />
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="16" stdDeviation="24" flood-color="rgba(23,48,67,0.12)" />
        </filter>
      </defs>
      <rect width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" fill="url(#bg)" />
      <rect x="56" y="52" width="1088" height="526" rx="34" fill="#fffdf8" stroke="rgba(90, 66, 45, 0.10)" filter="url(#shadow)" />
      <rect x="56" y="52" width="8" height="526" rx="4" fill="${accent.strong}" />
      <rect x="850" y="96" width="242" height="388" rx="26" fill="${accent.panel}" stroke="rgba(23,48,67,0.08)" />
      <line x1="820" y1="112" x2="820" y2="520" stroke="${accent.line}" />
      <text x="96" y="112" font-size="18" fill="${accent.strong}" letter-spacing="3">${escapeXml(data.eyebrow)}</text>
      ${titleLines.map((line, index) => `
        <text
          x="96"
          y="${titleBaseY + index * 66}"
          font-size="58"
          font-weight="700"
          fill="#173043"
          letter-spacing="-1.4"
          font-family="'Noto Serif SC', 'Source Han Serif SC', serif"
        >${escapeXml(line)}</text>
      `).join("")}
      <line x1="96" y1="${summaryBaseY - 24}" x2="792" y2="${summaryBaseY - 24}" stroke="rgba(23,48,67,0.10)" />
      ${summaryMarkup}
      <text x="890" y="142" font-size="16" fill="${accent.strong}" letter-spacing="3">${escapeXml(data.sourceTitle)}</text>
      ${sourceMarkup}
      <text x="96" y="534" font-size="20" fill="#5c7182">今天读什么 · book.zongqir.com</text>
    </svg>
  `.trim();
}

function getOgImageData(node: PageNode): OgImageData {
  if (node.kind === "section") {
    const bookTitles = node.books.slice(0, 3).map((book) => book.title);
    return {
      eyebrow: "今天读什么 · 分类",
      title: node.section.title,
      summary: `这个方向下有 ${node.books.length} 本书，可以从书页直接往里读。${bookTitles.length ? `先从 ${bookTitles.join("、")} 开始。` : ""}`,
      sourceTitle: "来源",
      sourceLines: [
        { label: "类型", value: "分类页" },
        { label: "数量", value: `${node.books.length} 本书` },
        { label: "站点", value: "今天读什么" },
      ],
      accent: "amber",
    };
  }

  if (node.kind === "book") {
    return {
      eyebrow: node.book.section_title,
      title: node.book.title,
      summary: node.book.summary || `这本书下有 ${node.pages.length} 个入口，可以直接从导图或具体文稿读进去。`,
      sourceTitle: "来源",
      sourceLines: [
        { label: "栏目", value: node.book.section_title },
        { label: "书名", value: node.book.title },
        { label: "入口", value: `${node.pages.length} 个入口` },
      ],
      accent: "amber",
    };
  }

  return {
    eyebrow: node.book ? `${node.section?.title || "今天读什么"} · ${node.book.title}` : "今天读什么",
    title: node.page.title,
    summary: node.page.summary || node.page.intent || `${node.book?.title || "这本书"}里的这一页，适合直接分享出去。`,
    sourceTitle: "来源",
    sourceLines: [
      { label: "书名", value: node.book?.title || "今天读什么" },
      { label: "栏目", value: node.page.section_title || "未分类" },
      { label: "页位", value: node.page.slot || "正文页" },
    ],
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

function escapeXml(value: string) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
