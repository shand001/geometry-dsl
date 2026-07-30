import { compileToSvg } from "./index.ts";
import type { RenderOptions } from "./types.ts";

export const geometryMarkdownLanguages = ["geometry", "geometry-dsl", "geom"] as const;
export type GeometryMarkdownLanguage = (typeof geometryMarkdownLanguages)[number];

export type MarkdownItToken = {
  info?: string;
  content?: string;
};

export type MarkdownItRendererRule = (
  tokens: readonly MarkdownItToken[],
  index: number,
  options: unknown,
  env: unknown,
  self: unknown,
) => string;

export type MarkdownItLike = {
  renderer: {
    rules: Record<string, unknown>;
  };
};

export type GeometryMarkdownOptions = RenderOptions & {
  languages?: readonly string[];
  onError?: "render" | "throw";
};

const numericOptions = new Set(["width", "height", "padding", "precision", "labelSize"]);
const optionAliases: Record<string, keyof RenderOptions> = {
  "label-size": "labelSize",
  label_size: "labelSize",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);
}

function firstInfoWord(info: string | undefined): string {
  return info?.trim().split(/\s+/, 1)[0]?.toLowerCase() ?? "";
}

function parseFenceOptions(info: string | undefined): Partial<RenderOptions> {
  const words = info?.trim().split(/\s+/).slice(1) ?? [];
  const result: Partial<RenderOptions> = {};
  for (const word of words) {
    const separator = word.indexOf("=");
    if (separator <= 0) continue;
    const rawKey = word.slice(0, separator);
    const key = optionAliases[rawKey] ?? rawKey;
    const rawValue = word.slice(separator + 1);
    if (numericOptions.has(key)) {
      const value = Number(rawValue);
      if (Number.isFinite(value) && value > 0) (result as Record<string, unknown>)[key] = value;
    } else if (key === "background") {
      result.background = rawValue === "none" ? null : rawValue;
    }
  }
  return result;
}

function languageSet(options: GeometryMarkdownOptions): Set<string> {
  return new Set((options.languages ?? geometryMarkdownLanguages).map(language => language.toLowerCase()));
}

export function renderGeometryMarkdownBlock(source: string, options: GeometryMarkdownOptions = {}): string {
  try {
    const renderOptions: RenderOptions = { ...options };
    delete (renderOptions as { languages?: readonly string[] }).languages;
    delete (renderOptions as { onError?: "render" | "throw" }).onError;
    return `<div class="geometry-dsl-diagram" data-geometry-dsl="true">${compileToSvg(source, renderOptions)}</div>`;
  } catch (error) {
    if (options.onError === "throw") throw error;
    const message = error instanceof Error ? error.message : String(error);
    return `<div class="geometry-dsl-error" data-geometry-dsl-error="true"><strong>Geometry DSL</strong><pre><code>${escapeHtml(message)}</code></pre></div>`;
  }
}

export function geometryMarkdownPlugin<T extends MarkdownItLike>(
  md: T,
  options: GeometryMarkdownOptions = {},
): T {
  const rules = md.renderer.rules as Record<string, MarkdownItRendererRule | undefined>;
  const originalFence = rules.fence;
  const languages = languageSet(options);
  rules.fence = (tokens, index, renderOptions, env, self) => {
    const token = tokens[index];
    if (!languages.has(firstInfoWord(token?.info))) {
      if (originalFence) return originalFence(tokens, index, renderOptions, env, self);
      const content = token?.content ?? "";
      return `<pre><code>${escapeHtml(content)}</code></pre>`;
    }
    return renderGeometryMarkdownBlock(token?.content ?? "", {
      ...options,
      ...parseFenceOptions(token?.info),
    });
  };
  return md;
}
