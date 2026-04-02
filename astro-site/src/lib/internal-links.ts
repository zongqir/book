const INTERNAL_LINK_MODE = import.meta.env.PUBLIC_INTERNAL_LINK_MODE === "html" ? "html" : "directory";
const SITE_ORIGIN = String(import.meta.env.SITE || "https://book.zongqir.com").replace(/\/$/, "");

export function toInternalHref(value: string): string {
  if (!value || INTERNAL_LINK_MODE !== "html") return value;
  if (/^(?:[a-z]+:)?\/\//i.test(value) || value.startsWith("mailto:") || value.startsWith("tel:")) {
    return value;
  }

  const [pathWithQuery = "", hash = ""] = value.split("#", 2);
  const [pathname = "", query = ""] = pathWithQuery.split("?", 2);

  if (!pathname || pathname === "/") {
    return joinHref("/", query, hash);
  }

  if (
    !pathname.startsWith("/") ||
    pathname.endsWith(".html") ||
    /\/[^/]+\.[^/]+$/.test(pathname)
  ) {
    return joinHref(pathname, query, hash);
  }

  const trimmedPath = pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  const htmlPath = `${trimmedPath}.html`;
  return joinHref(htmlPath, query, hash);
}

export function rewriteContentHref(value: string, knownInternalPaths: Set<string>): string {
  if (!value || INTERNAL_LINK_MODE !== "html") return value;
  if (!value.startsWith("/") || value.startsWith("//")) return value;

  const cleanPath = stripSearchAndHash(value);
  if (!cleanPath) return value;
  if (isStaticAssetPath(cleanPath)) return value;

  if (knownInternalPaths.has(cleanPath)) {
    return toInternalHref(value);
  }

  return `${SITE_ORIGIN}${value}`;
}

export function stripSearchAndHash(value: string): string {
  return value.split("#", 1)[0]?.split("?", 1)[0] || "";
}

export function isStaticAssetPath(pathname: string): boolean {
  return Boolean(
    pathname &&
      pathname !== "/" &&
      /\/[^/]+\.[^/]+$/.test(pathname) &&
      !pathname.endsWith(".html"),
  );
}

function joinHref(pathname: string, query: string, hash: string): string {
  const queryPart = query ? `?${query}` : "";
  const hashPart = hash ? `#${hash}` : "";
  return `${pathname}${queryPart}${hashPart}`;
}
