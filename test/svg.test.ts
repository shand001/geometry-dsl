import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { compileToSvg, evaluate, renderSvg } from "../src/index.ts";

test("SVG backend renders all drawable object families", async () => {
  const source = await readFile(new URL("../examples/four-leaf.geom", import.meta.url), "utf8");
  const scene = evaluate(source);
  const svg = renderSvg(scene, { width: 900, height: 700, background: "#ffffff" });
  assert.match(svg, /^<svg /);
  assert.match(svg, /data-type="Point"/);
  assert.match(svg, /data-type="Line"/);
  assert.match(svg, /data-type="Circle"/);
  assert.match(svg, /data-type="Arc"/);
  assert.match(svg, /data-type="Path"/);
  assert.match(svg, /data-type="Mark"/);
  assert.match(svg, /data-kind="infinite"/);
  assert.doesNotMatch(svg, /NaN|Infinity|undefined/);
});

test("layers determine SVG order and labels remain upright text", () => {
  const svg = compileToSvg(`
A = point(0, 0, layer=2)
B = point(1, 0, layer=-1)
AB = line(A, B, layer=1)
`);
  assert.ok(svg.indexOf('data-object-id="2"') < svg.indexOf('data-object-id="3"'));
  assert.ok(svg.indexOf('data-object-id="3"') < svg.indexOf('data-object-id="1"'));
  assert.match(svg, /<text [^>]*>A<\/text>/);
});

test("auto-sizes SVG from geometry bounds when dimensions are omitted", () => {
  const svgSmall = compileToSvg(`
A = point(0, 0)
B = point(1, 1)
`);
  assert.match(svgSmall, /width="200" height="200"/);

  const svgMedium = compileToSvg(`
A = point(-3, -2)
B = point(3, 2)
`);
  assert.match(svgMedium, /width="364" height="264"/);

  const svgLarge = compileToSvg(`
A = point(0, 0)
B = point(30, 20)
`);
  assert.match(svgLarge, /width="1200" /);
  assert.match(svgLarge, /height="1064"/);

  const svgExplicit = compileToSvg(`
A = point(0, 0)
B = point(100, 100)
`, { width: 360, height: 230 });
  assert.match(svgExplicit, /width="360" height="230"/);
});

test("preserves aspect ratio when only one dimension is given", () => {
  const svg = compileToSvg(`
A = point(0, 0)
B = point(4, 2)
`, { width: 400 });
  assert.match(svg, /width="400" height="232"/);
});

test("equal-angle marker keeps the minor angle when ray endpoints are reversed", () => {
  const svg = compileToSvg(`
A = point(0, 0)
B = point(1, 0)
C = point(0, 1)
mark(equal_angle, C, A, B, B, A, C)
`);
  const path = svg.match(/<path data-type="Mark" data-kind="equal_angle"[^>]* d="([^"]+)"/)?.[1];
  assert.ok(path);
  assert.deepEqual([...path.matchAll(/A [^ ]+ [^ ]+ 0 0 ([01])/g)].map(match => match[1]), ["1", "0"]);
});
