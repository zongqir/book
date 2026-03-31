import { defineConfig } from "astro/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  site: "https://book.zongqir.com",
  output: "static",
  publicDir: fileURLToPath(new URL("../site/static", import.meta.url)),
});
