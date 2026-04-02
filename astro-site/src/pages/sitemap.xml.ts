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
  const siteUrl = site || new URL("https://book.zongqir.com");
  const urls = [
    { path: "/", updatedAt: "" },
    { path: "/discover/", updatedAt: "" },
    { path: "/library/", updatedAt: "" },
    { path: "/notes/", updatedAt: "" },
    ...index.sections
      .filter((item) => item.key !== "02_专业技术")
      .map((item) => ({ path: item.url, updatedAt: "" })),
    ...index.books
      .filter((item) => item.section_key !== "02_专业技术")
      .map((item) => ({ path: item.url, updatedAt: item.updated_at || "" })),
    ...index.pages
      .filter((item) => item.section_key !== "02_专业技术")
      .map((item) => ({ path: item.url, updatedAt: item.updated_at || "" })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${urls.map((item) => {
    const loc = new URL(item.path, siteUrl).toString();
    const lastmod = item.updatedAt ? `<lastmod>${escapeXml(new Date(item.updatedAt).toISOString())}</lastmod>` : "";
    return `<url><loc>${escapeXml(loc)}</loc>${lastmod}</url>`;
  }).join("\n  ")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=900",
    },
  });
}
