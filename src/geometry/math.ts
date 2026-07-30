import type { PointValue } from "../types.ts";

export type Vec = Readonly<{ x: number; y: number }>;
export const TAU = Math.PI * 2;
export const deg = (degrees: number): number => degrees * Math.PI / 180;
export const degrees = (radians: number): number => radians * 180 / Math.PI;
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const mul = (a: Vec, scalar: number): Vec => ({ x: a.x * scalar, y: a.y * scalar });
export const dot = (a: Vec, b: Vec): number => a.x * b.x + a.y * b.y;
export const cross = (a: Vec, b: Vec): number => a.x * b.y - a.y * b.x;
export const length = (a: Vec): number => Math.hypot(a.x, a.y);
export const distance = (a: Vec, b: Vec): number => length(sub(a, b));
export const normalize = (a: Vec): Vec => {
  const size = length(a);
  return { x: a.x / size, y: a.y / size };
};
export const rotate = (a: Vec, radians: number): Vec => ({
  x: a.x * Math.cos(radians) - a.y * Math.sin(radians),
  y: a.x * Math.sin(radians) + a.y * Math.cos(radians),
});
export const lerp = (a: Vec, b: Vec, t: number): Vec => add(a, mul(sub(b, a), t));
export const clamp = (n: number, min: number, max: number): number => Math.max(min, Math.min(max, n));
export const normalizeAngle = (angle: number): number => {
  const value = angle - TAU * Math.floor(angle / TAU);
  return value === TAU ? 0 : value;
};
export const ccwDelta = (start: number, end: number): number => normalizeAngle(end - start);
export const cwDelta = (start: number, end: number): number => normalizeAngle(start - end);
export const pointAngle = (center: Vec, point: Vec): number =>
  normalizeAngle(Math.atan2(point.y - center.y, point.x - center.x));

export function epsilon(points: readonly Vec[], lengths: readonly number[] = []): number {
  let g = 1, c = 1;
  for (const value of lengths) g = Math.max(g, Math.abs(value));
  for (let i = 0; i < points.length; i++) {
    c = Math.max(c, Math.abs(points[i]!.x), Math.abs(points[i]!.y));
    for (let j = i + 1; j < points.length; j++) g = Math.max(g, distance(points[i]!, points[j]!));
  }
  return Math.max(g * 1e-9, c * 1e-15);
}

export function barePoint(x: number, y: number): PointValue {
  return { type: "Point", x: x === 0 ? 0 : x, y: y === 0 ? 0 : y, objectId: null, created: null };
}

export const angleBetween = (a: Vec, b: Vec): number => {
  const na = normalize(a), nb = normalize(b);
  // atan2 remains accurate near 0° and 180°, where acos loses many bits.
  return Math.atan2(Math.abs(cross(na, nb)), clamp(dot(na, nb), -1, 1));
};

export function assertFinite(...numbers: number[]): void {
  if (numbers.some(value => !Number.isFinite(value))) throw new Error("non-finite geometry result");
}
