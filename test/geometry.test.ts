import test from "node:test";
import assert from "node:assert/strict";
import { evaluate, type CircleValue, type LineValue, type PointValue } from "../src/index.ts";

const point = (scene: ReturnType<typeof evaluate>, name: string): PointValue =>
  scene.values.get(name) as PointValue;

test("arithmetic, along, properties and aliases", () => {
  const scene = evaluate(`
A = point(0, 0)
B = point(10, 0)
t = 2 / (2 + 3)
M = along(A, B, t)
c = circle(A, B)
r = c.radius
O2 = c.center
`);
  assert.equal(point(scene, "M").x, 4);
  assert.equal(scene.values.get("r"), 10);
  assert.equal(scene.values.get("O2"), point(scene, "A"));
});

test("line-circle intersections honor range and deterministic order", () => {
  const scene = evaluate(`
O = point(0, 0)
A = point(-2, 0)
B = point(2, 0)
segmentAB = line(A, B)
c = circle(O, 1)
L, R = intersect(segmentAB, c)
positive_ray = line(O, B, kind=ray)
P = intersect(positive_ray, c, pick=0)
`);
  assert.ok(Math.abs(point(scene, "L").x + 1) < 1e-12);
  assert.ok(Math.abs(point(scene, "R").x - 1) < 1e-12);
  assert.ok(Math.abs(point(scene, "P").x - 1) < 1e-12);
});

test("circumcircle, projection, arc canonicalization and transforms", () => {
  const scene = evaluate(`
O = point(0, 0)
A = point(1, 0)
B = point(0, 1)
C = point(-1, 0)
c = circle(A, B, C)
arcAB = arc(c, A, B, sweep=short)
P = point(2, 2)
Q = project(P, c)
A2 = transform(A, rotate, O, 90)
A3 = transform(A2, mirror, line(O, B, kind=infinite, visible=false))
`);
  const c = scene.values.get("c") as CircleValue;
  assert.ok(Math.hypot(c.center.x, c.center.y) < 1e-12);
  assert.ok(Math.abs(point(scene, "Q").x - Math.SQRT1_2) < 1e-12);
  assert.ok(Math.abs(point(scene, "A2").y - 1) < 1e-12);
  assert.ok(Math.abs(point(scene, "A3").x) < 1e-12);
});

test("geometry and semantic errors are rejected", () => {
  assert.throws(() => evaluate("A = point(0, 0)\nA = point(1, 1)\n"), /已定义/);
  assert.throws(() => evaluate("A = point(0, 0, dashed=true)\n"), /不适用于 Point/);
  assert.throws(() => evaluate("A = point(0, 0)\nB = point(0, 0)\nl = line(A, B)\n"), /重合/);
  assert.throws(() => evaluate("A = point(0, 0)\nB = point(1, 0)\nl = line(A, B, color=red, kind=ray)\n"), /样式参数之后/);
  assert.throws(() => evaluate("A = point(0, 0)\nB = point(1, 0)\nC = point(2, 0)\nmark(right, A, B, C)\n"), /不是直角/);
  assert.throws(() => evaluate("x = 1 / 0\n"), /除数不能为零/);
});

test("transform list preserves order and styles", () => {
  const scene = evaluate(`
O = point(0, 0)
A = point(1, 0)
B = point(0, 1)
OA = line(O, A, color=blue, width=2)
OB = line(O, B, color=red)
copies = transform([OA, OB], rotate, O, 90, dashed=true)
`);
  const copies = scene.values.get("copies") as LineValue[];
  assert.equal(copies.length, 2);
  assert.equal(copies[0]!.style.color, "#0000ff");
  assert.equal(copies[0]!.style.dashed, true);
  assert.ok(Math.abs(copies[0]!.b.y - 1) < 1e-12);
});
