import test from "node:test";
import assert from "node:assert/strict";
import {
  GeometryDslError,
  compileToSvg,
  evaluate,
  parse,
  type PointValue,
  type RegionValue,
  type TextValue,
} from "../src/index.ts";
import { regionContains } from "../src/geometry/index.ts";

function named<T>(scene: ReturnType<typeof evaluate>, name: string): T {
  return scene.values.get(name) as T;
}

function maskBody(svg: string, objectId: number): string {
  const match = svg.match(new RegExp(`<mask id="g-region-${objectId}"[^>]*>(.*?)</mask>`, "s"));
  assert.ok(match, `expected mask g-region-${objectId}`);
  return match[1]!;
}

function textElement(svg: string, content: string): string {
  const element = [...svg.matchAll(/<text\b[^>]*>.*?<\/text>/gs)]
    .map(match => match[0])
    .find(candidate => candidate.endsWith(`>${content}</text>`));
  assert.ok(element, `expected text element containing ${content}`);
  return element;
}

function numericAttribute(element: string, name: string): number {
  const match = element.match(new RegExp(`\\b${name}="([^"]+)"`));
  assert.ok(match, `expected ${name} on ${element}`);
  return Number(match[1]);
}

function expectSemanticError(source: string, pattern: RegExp): void {
  assert.throws(
    () => evaluate(source),
    (error: unknown) =>
      error instanceof GeometryDslError
      && error.code === "E_SEMANTIC"
      && pattern.test(error.message),
  );
}

test("parser reserves the five V0.4 constructors", () => {
  const program = parse(`
disk = inside(c)
joined = union(disk, other)
overlap = intersection(disk, other)
remainder = difference(disk, other)
caption = text(0, 0, "A")
`);
  assert.equal(program.statements.length, 5);

  for (const word of ["text", "inside", "union", "intersection", "difference"]) {
    assert.throws(
      () => parse(`${word} = point(0, 0)\n`),
      new RegExp(`保留字 ${word}`),
    );
  }
});

test("evaluator builds immutable-style Region expression trees and both Text overloads", () => {
  const scene = evaluate(`
O1 = point(-1, 0, visible=false)
O2 = point(1, 0, visible=false)
c1 = circle(O1, 3, visible=false)
c2 = circle(O2, 3, visible=false)
disk1 = inside(c1)
disk2 = inside(c2)
joined = union(disk1, disk2, fill=red, opacity=0.5, layer=-2)
overlap = intersection(disk1, disk2, fill=purple)
left_only = difference(disk1, disk2, fill="#abcdef")
fixed = text(0, 4, "Title", color=blue, size=18, layer=9)
automatic = text(overlap, "B")
`);
  const c1 = scene.values.get("c1");
  const disk1 = named<RegionValue>(scene, "disk1");
  const disk2 = named<RegionValue>(scene, "disk2");
  const joined = named<RegionValue>(scene, "joined");
  const overlap = named<RegionValue>(scene, "overlap");
  const leftOnly = named<RegionValue>(scene, "left_only");
  const fixed = named<TextValue>(scene, "fixed");
  const automatic = named<TextValue>(scene, "automatic");

  assert.equal(disk1.type, "Region");
  assert.deepEqual(disk1.style, { visible: true, fill: null, opacity: 1, layer: 0 });
  assert.equal(disk1.expression.kind, "inside");
  if (disk1.expression.kind === "inside") assert.equal(disk1.expression.source, c1);

  assert.equal(joined.expression.kind, "union");
  if (joined.expression.kind === "union") {
    assert.deepEqual(joined.expression.operands, [disk1, disk2]);
  }
  assert.deepEqual(joined.style, {
    visible: true,
    fill: "#ff0000",
    opacity: 0.5,
    layer: -2,
  });

  assert.equal(overlap.expression.kind, "intersection");
  assert.equal(leftOnly.expression.kind, "difference");
  if (leftOnly.expression.kind === "difference") {
    assert.equal(leftOnly.expression.left, disk1);
    assert.equal(leftOnly.expression.right, disk2);
  }

  assert.deepEqual(fixed.position, { kind: "fixed", x: 0, y: 4 });
  assert.equal(fixed.content, "Title");
  assert.equal(fixed.style.color, "#0000ff");
  assert.equal(fixed.style.size, 18);
  assert.equal(automatic.position.kind, "region");
  if (automatic.position.kind === "region") assert.equal(automatic.position.region, overlap);
  assert.equal(automatic.style.size, null);
});

test("intersection regions do not change the legacy intersect point API", () => {
  const scene = evaluate(`
O1 = point(-1, 0, visible=false)
O2 = point(1, 0, visible=false)
c1 = circle(O1, 2, visible=false)
c2 = circle(O2, 2, visible=false)
A = inside(c1)
B = inside(c2)
overlap = intersection(A, B)
P, Q = intersect(c1, c2)
`);
  assert.equal(named<RegionValue>(scene, "overlap").type, "Region");
  for (const name of ["P", "Q"]) {
    const point = named<PointValue>(scene, name);
    assert.equal(point.type, "Point");
    assert.ok(Math.abs(point.x) < 1e-12);
    assert.ok(Math.abs(Math.abs(point.y) - Math.sqrt(3)) < 1e-12);
  }
});

test("Region and Text reject invalid arity, types, styles, properties and legacy operations", () => {
  const circle = `
O = point(0, 0, visible=false)
c = circle(O, 2, visible=false)
R = inside(c)
`;
  const openPath = `
A = point(0, 0, visible=false)
B = point(1, 0, visible=false)
p = path(A, B, visible=false)
`;

  const cases: Array<[string, RegExp]> = [
    [`P = point(0, 0)\nT = text(P, "P")\n`, /text 需要/],
    [`T = text(0, 0, 123)\n`, /content 必须是 String/],
    [`${openPath}R = inside(p)\n`, /必须 closed=true/],
    [`P = point(0, 0)\nR = inside(P)\n`, /inside 需要 Circle 或闭合 Path/],
    [`${circle}U = union(R)\n`, /union 至少需要两个 Region/],
    [`${circle}I = intersection(R, c)\n`, /region2 必须是 Region/],
    [`${circle}D = difference(R)\n`, /difference 需要两个 Region/],
    [`${circle}D = difference(R, R, R)\n`, /difference 需要两个 Region/],
    [`O = point(0, 0)\nc = circle(O, 2)\nR = inside(c, color=red)\n`, /color 不适用于 Region/],
    [`T = text(0, 0, "T", fill=red)\n`, /fill 不适用于 Text/],
    [`T = text(0, 0, "T")\nU = transform(T, move, 1, 1)\n`, /transform 不支持 Text/],
    [`${circle}P = point(3, 0)\nQ = project(P, R)\n`, /target 必须是 Line、Circle、Arc 或 Path，实际是 Region/],
    [`${circle}P = intersect(c, R, pick=0)\n`, /object2 必须是 Line、Circle、Arc 或 Path，实际是 Region/],
    [`${circle}x = R.radius\n`, /Region 没有属性 radius/],
  ];
  for (const [source, pattern] of cases) expectSemanticError(source, pattern);
});

test("SVG masks preserve exact circles and compose union, intersection and difference", () => {
  const svg = compileToSvg(`
O1 = point(-1, 0, visible=false)
O2 = point(1, 0, visible=false)
c1 = circle(O1, 3, visible=false)
c2 = circle(O2, 3, visible=false)
A = inside(c1)
B = inside(c2)
U = union(A, B, fill=red)
I = intersection(A, B, fill=green)
D = difference(A, B, fill=blue)
`, {
    width: 300,
    height: 200,
    viewBox: { minX: -5, minY: -4, width: 10, height: 8 },
  });

  const masks = [...svg.matchAll(/<mask id="g-region-(\d+)"/g)].map(match => Number(match[1]));
  assert.deepEqual(masks, [5, 6, 7, 8, 9]);
  assert.match(maskBody(svg, 5), /<circle [^>]* fill="white"\/>/);
  assert.match(maskBody(svg, 6), /<circle [^>]* fill="white"\/>/);
  assert.match(maskBody(svg, 7), /fill="white" mask="url\(#g-region-5\)"/);
  assert.match(maskBody(svg, 7), /fill="white" mask="url\(#g-region-6\)"/);
  assert.match(maskBody(svg, 8), /<g mask="url\(#g-region-6\)"><g mask="url\(#g-region-5\)">/);
  assert.match(maskBody(svg, 9), /<g mask="url\(#g-region-5\)">/);
  assert.match(maskBody(svg, 9), /fill="black" mask="url\(#g-region-6\)"/);

  assert.match(svg, /data-type="Region" data-object-id="7"[^>]*fill="#ff0000"[^>]*mask="url\(#g-region-7\)"/);
  assert.match(svg, /data-type="Region" data-object-id="8"[^>]*fill="#008000"[^>]*mask="url\(#g-region-8\)"/);
  assert.match(svg, /data-type="Region" data-object-id="9"[^>]*fill="#0000ff"[^>]*mask="url\(#g-region-9\)"/);
  assert.doesNotMatch(svg, /data-type="Circle"/);
});

test("closed Path regions retain their path shape and fill rule in the mask", () => {
  const svg = compileToSvg(`
A = point(-2, -2, visible=false)
B = point(2, 2, visible=false)
C = point(-2, 2, visible=false)
D = point(2, -2, visible=false)
boundary = path(A, B, C, D, closed=true, fill_rule=nonzero, visible=false)
region = inside(boundary, fill="#123456")
`, { width: 240, height: 240 });
  const region = maskBody(svg, 6);

  assert.match(region, /<path d="M [^"]+ Z" fill="white" fill-rule="nonzero"\/>/);
  assert.match(svg, /data-type="Region" data-object-id="6"[^>]*fill="#123456"/);
});

test("automatic Region text stays fully inside the target and layout is deterministic", () => {
  const source = `
O1 = point(-1, 0, visible=false)
O2 = point(1, 0, visible=false)
c1 = circle(O1, 3)
c2 = circle(O2, 3)
A = inside(c1)
B = inside(c2)
overlap = intersection(A, B, fill=purple)
label = text(overlap, "交集", size=20, layer=5)
`;
  const options = {
    width: 500,
    height: 400,
    padding: 0,
    viewBox: { minX: -5, minY: -4, width: 10, height: 8 },
  } as const;
  const first = compileToSvg(source, options);
  const second = compileToSvg(source, options);
  assert.equal(first, second);

  const element = textElement(first, "交集");
  const x = numericAttribute(element, "x");
  const y = numericAttribute(element, "y");
  const size = numericAttribute(element, "font-size");
  assert.match(element, /data-type="Text"/);

  const halfWidth = size;
  const halfHeight = size * 0.6;
  const samples = [
    [-halfWidth, -halfHeight], [0, -halfHeight], [halfWidth, -halfHeight],
    [-halfWidth, 0], [0, 0], [halfWidth, 0],
    [-halfWidth, halfHeight], [0, halfHeight], [halfWidth, halfHeight],
  ];
  for (const [dx, dy] of samples) {
    const px = x + dx!;
    const py = y + dy!;
    assert.ok(Math.hypot(px - 200, py - 200) <= 146, "text box must stay inside the left disk");
    assert.ok(Math.hypot(px - 300, py - 200) <= 146, "text box must stay inside the right disk");
  }
});

test("higher-layer Text and Point labels share one collision-avoidance layout", () => {
  const svg = compileToSvg(`
P = point(0, 0, label="P", label_pos=above_right, layer=1)
T = text(0.244, 0.36, "T", size=20, layer=2)
`, {
    width: 500,
    height: 500,
    padding: 0,
    labelSize: 20,
    viewBox: { minX: -5, minY: -5, width: 10, height: 10 },
  });
  const text = textElement(svg, "T");
  const pointLabel = textElement(svg, "P");
  const textX = numericAttribute(text, "x");
  const textY = numericAttribute(text, "y");
  const pointX = numericAttribute(pointLabel, "x");
  const pointY = numericAttribute(pointLabel, "y");

  assert.equal(textX, 262.2);
  assert.equal(textY, 232);
  assert.ok(Math.hypot(pointX - textX, pointY - textY) >= 16.4);
  const pointNudge = Math.hypot(pointX - 262.2, pointY - 232);
  assert.ok(pointNudge > 0, "the explicit Point label should move away from the earlier Text");
  assert.ok(pointNudge <= 40, "Point label movement must stay within 2 × its original size");
});

test("hidden and zero-opacity geometry does not displace fixed Text", () => {
  const svg = compileToSvg(`
A = point(-2, 0, visible=false)
B = point(2, 0, visible=false)
hidden_line = line(A, B, visible=false)
transparent_line = line(A, B, opacity=0)
O = point(0, 0, label=none, opacity=0)
c = circle(O, 1, opacity=0)
transparent_region = inside(c, fill=red, opacity=0)
T = text(0, 0, "T", size=20)
`, {
    width: 500,
    height: 500,
    padding: 0,
    viewBox: { minX: -5, minY: -5, width: 10, height: 10 },
  });
  const text = textElement(svg, "T");
  assert.equal(numericAttribute(text, "x"), 250);
  assert.equal(numericAttribute(text, "y"), 250);
});

test("explicit Text and Point anchors stay exact without conflicts and nudge by at most 2 × size", () => {
  const options = {
    width: 500,
    height: 500,
    padding: 0,
    labelSize: 20,
    viewBox: { minX: -5, minY: -5, width: 10, height: 10 },
  } as const;

  const freeText = textElement(compileToSvg(`
T = text(0, 0, "T", size=20)
`, options), "T");
  assert.equal(numericAttribute(freeText, "x"), 250);
  assert.equal(numericAttribute(freeText, "y"), 250);

  const freePoint = textElement(compileToSvg(`
P = point(0, 0, label="P", label_pos=above_right)
`, options), "P");
  assert.equal(numericAttribute(freePoint, "x"), 262.2);
  assert.equal(numericAttribute(freePoint, "y"), 232);

  const blockedText = textElement(compileToSvg(`
P = point(0, 0, label=none)
T = text(0, 0, "T", size=20)
`, options), "T");
  const nudge = Math.hypot(
    numericAttribute(blockedText, "x") - 250,
    numericAttribute(blockedText, "y") - 250,
  );
  assert.ok(nudge > 0, "fixed Text should move when its preferred anchor is blocked");
  assert.ok(nudge <= 40, "fixed Text movement must stay within 2 × its original size");
});

test("auto framing reserves the full estimated box for long fixed text", () => {
  const svg = compileToSvg(`
F1 = point(-6, -5.5, visible=false)
F2 = point(6, -5.5, visible=false)
F3 = point(6, 5.5, visible=false)
F4 = point(-6, 5.5, visible=false)
frame = path(F1, F2, F3, F4, closed=true, visible=false)
universe = inside(frame)
O = point(0, 2.5, visible=false)
c = circle(O, 2.5, width=2)
outside = difference(universe, inside(c), fill="#f3f4f6")
title = text(0, 5.3, "3 circles, 8 regions", size=16, layer=5)
`, { width: 1000, height: 800 });

  const title = textElement(svg, "3 circles, 8 regions");
  assert.equal(numericAttribute(title, "font-size"), 16);
  assert.ok(numericAttribute(title, "x") > 0 && numericAttribute(title, "x") < 1000);
  assert.ok(numericAttribute(title, "y") > 0 && numericAttribute(title, "y") < 800);
});

test("Region text fits inside a triangular Path rather than its rectangular bounds", () => {
  const source = `
A = point(-3, -2, visible=false)
B = point(3, -2, visible=false)
C = point(0.5, 2.5, visible=false)
D = project(C, line(A, B, kind=infinite), visible=false)
triangle = path(C, D, B, closed=true, visible=false)
area = inside(triangle, fill=blue)
caption = text(area, "S2", size=18)
`;
  const scene = evaluate(source);
  const region = named<RegionValue>(scene, "area");
  const svg = compileToSvg(source, {
    width: 744,
    height: 616,
    padding: 0,
    viewBox: { minX: -3, minY: -2, width: 6, height: 4.5 },
  });
  const caption = textElement(svg, "S2");
  const x = numericAttribute(caption, "x");
  const y = numericAttribute(caption, "y");
  const world = { x: -3 + x / 124, y: 2.5 - y / 124 };
  assert.ok(regionContains(region, world));
});

test("layout shrinks only through the documented floor and reports E_LAYOUT when it still cannot fit", () => {
  const options = {
    width: 200,
    height: 200,
    padding: 0,
    viewBox: { minX: -1, minY: -1, width: 2, height: 2 },
  } as const;
  const fitted = compileToSvg(`
O = point(0, 0, visible=false)
c = circle(O, 0.23, visible=false)
R = inside(c, fill=blue)
T = text(R, "W", size=40)
`, options);
  assert.equal(numericAttribute(textElement(fitted, "W"), "font-size"), 24);

  assert.throws(
    () => compileToSvg(`
O = point(0, 0, visible=false)
c = circle(O, 0.15, visible=false)
R = inside(c, fill=blue)
T = text(R, "W", size=40)
`, options),
    (error: unknown) =>
      error instanceof GeometryDslError
      && error.code === "E_LAYOUT"
      && /减小 size、调整坐标或扩大区域/.test(error.message),
  );
});

test("Text preserves Chinese and XML-escapes all special characters", () => {
  const svg = compileToSvg(
    String.raw`caption = text(0, 0, "集合 <A&B> \"Q\" '单'", size=20)
`,
    {
      width: 600,
      height: 200,
      padding: 0,
      viewBox: { minX: -3, minY: -1, width: 6, height: 2 },
    },
  );
  assert.match(
    svg,
    />集合 &lt;A&amp;B&gt; &quot;Q&quot; &apos;单&apos;<\/text>/,
  );
  assert.doesNotMatch(svg, />集合 <A&B>/);
});
