import type { MarkdownFrame } from "mdtheme";

export function detailsFrame(summary: string): MarkdownFrame {
  return {
    opening: `<details>\n<summary>${summary}</summary>\n\n`,
    closing: "\n</details>\n",
  };
}

export function noticeFrame(label: string): MarkdownFrame {
  return {
    opening: `> **${label}**\n>\n`,
    closing: "\n",
  };
}
