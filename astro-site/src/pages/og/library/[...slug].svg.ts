import type { APIRoute } from "astro";
import { getAllLibrarySlugs, getNodeBySlug } from "../../../lib/content";
import { renderLibraryOgSvg } from "../../../lib/og-image";

export const prerender = true;

export function getStaticPaths() {
  return getAllLibrarySlugs().map((slugParts) => ({
    params: { slug: slugParts.join("/") },
    props: { slugParts },
  }));
}

export const GET: APIRoute = ({ props }) => {
  const slugParts = Array.isArray(props?.slugParts) ? props.slugParts : [];
  const node = getNodeBySlug(slugParts);

  if (!node) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(renderLibraryOgSvg(node), {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
