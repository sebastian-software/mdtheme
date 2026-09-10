/** A pair of Markdown fragments wrapped around the source document. */
export type MarkdownFrame = {
  opening: string;
  closing: string;
};

/** Configuration accepted by {@link defineConfig}. */
export type Config = {
  source?: string;
  output?: string;
  themes: readonly MarkdownFrame[];
};

const DEFAULT_SOURCE = "README.md.src";
const DEFAULT_OUTPUT = "README.md";

type RenderOptions = {
  sourceName?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a string`);
  }
  return value;
}

function requireNonEmptyString(value: unknown, name: string): string {
  const stringValue = requireString(value, name);
  if (stringValue.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return stringValue;
}

function validateFrame(value: unknown, index: number): MarkdownFrame {
  if (!isRecord(value)) {
    throw new TypeError(`themes[${index}] must be an object with opening and closing strings`);
  }

  const unknownKeys = Object.keys(value).filter((key) => key !== "opening" && key !== "closing");
  if (unknownKeys.length > 0) {
    throw new TypeError(
      `themes[${index}] has unknown key${unknownKeys.length === 1 ? "" : "s"}: ${unknownKeys.join(", ")}`,
    );
  }

  const opening = requireString(value.opening, `themes[${index}].opening`);
  const closing = requireString(value.closing, `themes[${index}].closing`);
  return { opening, closing };
}

function validateThemes(value: unknown): MarkdownFrame[] {
  if (!Array.isArray(value)) {
    throw new TypeError("themes must be an array of Markdown frames");
  }

  const frames: MarkdownFrame[] = [];
  for (let index = 0; index < value.length; index += 1) {
    if (!(index in value)) {
      throw new TypeError(`themes[${index}] is missing; sparse frame arrays are not supported`);
    }
    frames.push(validateFrame(value[index], index));
  }
  return frames;
}

function validateConfigObject(config: unknown): Record<string, unknown> {
  if (!isRecord(config)) {
    throw new TypeError("config must be an object");
  }

  const unknownKeys = Object.keys(config).filter(
    (key) => key !== "source" && key !== "output" && key !== "themes",
  );
  if (unknownKeys.length > 0) {
    throw new TypeError(
      `unknown config key${unknownKeys.length === 1 ? "" : "s"}: ${unknownKeys.join(", ")}`,
    );
  }

  if (!("themes" in config)) {
    throw new TypeError("themes is required");
  }
  return config;
}

/** Validate a config and return a detached normalized value. */
export function defineConfig(config: Config): Config {
  const value = validateConfigObject(config);
  const source =
    value.source === undefined ? DEFAULT_SOURCE : requireNonEmptyString(value.source, "source");
  const output =
    value.output === undefined ? DEFAULT_OUTPUT : requireNonEmptyString(value.output, "output");
  const themes = validateThemes(value.themes);

  return { source, output, themes };
}

function validateSourceName(value: unknown): string {
  const sourceName =
    value === undefined ? DEFAULT_SOURCE : requireNonEmptyString(value, "sourceName");

  // The name is interpolated into an HTML comment. Requiring a conservative
  // basename keeps path separators, newlines, and comment delimiters out of
  // generated Markdown and makes the resulting notice unambiguous.
  if (!isSafeSourceName(sourceName)) {
    throw new TypeError("sourceName must be a simple basename using letters, numbers, ., _, or -");
  }
  return sourceName;
}

function isAsciiAlphaNumeric(code: number): boolean {
  return (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function isSafeSourceName(sourceName: string): boolean {
  if (!isAsciiAlphaNumeric(sourceName.charCodeAt(0))) {
    return false;
  }
  for (let index = 1; index < sourceName.length; index += 1) {
    const code = sourceName.charCodeAt(index);
    if (!isAsciiAlphaNumeric(code) && code !== 46 && code !== 95 && code !== 45) {
      return false;
    }
  }
  return true;
}

function validateRenderOptions(options: unknown): string {
  if (options === undefined) {
    return DEFAULT_SOURCE;
  }
  if (!isRecord(options)) {
    throw new TypeError("options must be an object");
  }
  const unknownKeys = Object.keys(options).filter((key) => key !== "sourceName");
  if (unknownKeys.length > 0) {
    throw new TypeError(
      `unknown render option${unknownKeys.length === 1 ? "" : "s"}: ${unknownKeys.join(", ")}`,
    );
  }
  return validateSourceName(options.sourceName);
}

function countTrailingNewlines(document: string): number {
  let trailingNewlines = 0;
  for (let index = document.length - 1; index >= 0 && trailingNewlines < 2; index -= 1) {
    if (document.charCodeAt(index) !== 10) break;
    trailingNewlines += 1;
    if (index > 0 && document.charCodeAt(index - 1) === 13) index -= 1;
  }
  return trailingNewlines;
}

function addSectionBoundary(document: string): string {
  const trailingNewlines = countTrailingNewlines(document);
  return trailingNewlines < 2 ? document + "\n".repeat(2 - trailingNewlines) : document;
}

function joinSections(parts: readonly string[]): string {
  let document = "";
  let hasSection = false;
  for (const part of parts) {
    if (part.length === 0) continue;
    if (hasSection) document = addSectionBoundary(document);
    document += part;
    hasSection = true;
  }
  return document;
}

/**
 * Wrap Markdown source in the configured frames without reformatting its text.
 * Frames are supplied outer-first; their closing fragments are emitted
 * inner-first so each frame is properly nested.
 */
// Preserve the public Promise contract, including rejected validation errors.
// eslint-disable-next-line @typescript-eslint/require-await
export async function renderMarkdown(
  source: string,
  themes: readonly MarkdownFrame[],
  options?: RenderOptions,
): Promise<string> {
  requireString(source, "source");
  const sourceName = validateRenderOptions(options);
  const frames = validateThemes(themes);
  const opening = frames.map((frame) => frame.opening);
  const closing = frames.toReversed().map((frame) => frame.closing);
  return joinSections([
    `<!-- This file is generated by mdtheme. Edit ${sourceName} instead. -->`,
    ...opening,
    source,
    ...closing,
  ]);
}
