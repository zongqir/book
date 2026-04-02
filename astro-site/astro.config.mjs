import { defineConfig } from "astro/config";
import { fileURLToPath } from "node:url";

const useHtmlInternalLinks = process.env.BOOK_INTERNAL_LINK_MODE === "html";

export default defineConfig({
  site: "https://book.zongqir.com",
  output: "static",
  build: {
    format: useHtmlInternalLinks ? "file" : "directory",
  },
  publicDir: fileURLToPath(new URL("../site/static", import.meta.url)),
});
