import { defineConfig } from "markdown-themer";
import { sebastianTheme } from "sebastian-theme/markdown";

export default defineConfig({
  themes: [sebastianTheme({ copyrightYears: "2026" })],
});
