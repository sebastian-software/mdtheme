import { defineConfig, projectBadges } from "mdtheme";
import { sebastianTheme } from "sebastian-theme/markdown";

export default defineConfig({
  themes: [sebastianTheme("2026"), projectBadges(import.meta.url)],
});
