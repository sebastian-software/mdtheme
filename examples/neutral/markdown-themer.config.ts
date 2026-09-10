import { defineConfig } from "markdown-themer";

import { detailsFrame, noticeFrame } from "./theme-factory.ts";

export default defineConfig({
  source: "README.md.src",
  output: "README.md",
  themes: [detailsFrame("Project notes"), noticeFrame("Read first")],
});
