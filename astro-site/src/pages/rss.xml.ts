import { loadSiteIndex } from "../lib/content";

function escapeXml(value: string) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function GET({ site }: { site: URL }) {
  const index = loadSiteIndex();
  const items = index.pages
    .slice()
    .sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")))
    .slice(0, 80);

  const siteUrl = site || new URL("https://book.zongqir.com");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml("读书库")}</title>
    <link>${escapeXml(siteUrl.toString())}</link>
    <description>${escapeXml("读书拆解、文稿与摘句更新订阅。")}</description>
    <language>zh-CN</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${items.map((item) => {
      const link = new URL(item.url, siteUrl).toString();
      const pubDate = item.updated_at ? new Date(item.updated_at).toUTCString() : new Date().toUTCString();
      const description = item.summary || item.intent || `${item.book_title} · ${item.title}`;
      return `<item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid>${escapeXml(link)}</guid>
      <pubDate>${escapeXml(pubDate)}</pubDate>
      <description>${escapeXml(description)}</description>
      <category>${escapeXml(item.section_title)}</category>
    </item>`;
    }).join("\n    ")}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=900",
    },
  });
}
