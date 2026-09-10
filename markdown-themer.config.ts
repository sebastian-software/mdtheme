import { defineConfig, projectBadges } from "markdown-themer";
import { sebastianTheme } from "sebastian-theme/markdown";

export default defineConfig({
  themes: [sebastianTheme("2026"), projectBadges(import.meta.url, { published: false })],
});
