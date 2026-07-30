import test from "node:test";
import assert from "node:assert/strict";
import {
  geometryMarkdownPlugin,
  renderGeometryMarkdownBlock,
  type MarkdownItLike,
  type MarkdownItRendererRule,
} from "../src/markdown.ts";

const source = `A = point(0, 0)\nB = point(4, 0)\nAB = line(A, B)\nc = circle(A, 2)\n`;

test("Markdown block renderer uses the same SVG compiler", () => {
  const html = renderGeometryMarkdownBlock(source, { width: 480, height: 320 });
  assert.match(html, /^<div class="geometry-dsl-diagram"/);
  assert.match(html, /<svg /);
  assert.match(html, /data-type="Line"/);
  assert.doesNotMatch(html, /NaN|Infinity|undefined/);
});

test("Markdown plugin replaces only geometry fenced blocks", () => {
  const fallback: MarkdownItRendererRule = () => "<pre>normal</pre>";
  const md: MarkdownItLike = { renderer: { rules: { fence: fallback } } };
  geometryMarkdownPlugin(md);

  const rule = md.renderer.rules.fence as MarkdownItRendererRule;
  const renderedGeometry = rule([{ info: "geometry width=480 height=320", content: source }], 0, {}, {}, {});
  const renderedNormal = rule([{ info: "ts", content: "const x = 1;\n" }], 0, {}, {}, {});
  assert.match(renderedGeometry, /data-geometry-dsl="true"/);
  assert.match(renderedGeometry, /width="480" height="320"/);
  assert.equal(renderedNormal, "<pre>normal</pre>");
});

test("Markdown plugin renders a diagnostic instead of breaking the preview", () => {
  const md: MarkdownItLike = { renderer: { rules: {} } };
  geometryMarkdownPlugin(md);
  const rule = md.renderer.rules.fence as MarkdownItRendererRule;
  const html = rule([{ info: "geometry", content: "A = point(0, nope)\n" }], 0, {}, {}, {});
  assert.match(html, /data-geometry-dsl-error="true"/);
  assert.match(html, /名称 nope 尚未定义/);
});

test("Markdown block auto-sizes when dimensions are omitted", () => {
  const html = renderGeometryMarkdownBlock(source);
  assert.match(html, /<svg /);
  assert.doesNotMatch(html, /width="360"/);
  assert.doesNotMatch(html, /height="230"/);
  assert.match(html, /width="\d+" height="\d+"/);
});
