import type {
  ArcValue, CircleValue, GeometryValue, LineValue, PathValue, PointValue,
} from "../types.ts";
import {
  add, angleBetween, barePoint, ccwDelta, clamp, cross, cwDelta, distance, dot,
  epsilon, length, lerp, mul, normalize, normalizeAngle, pointAngle, sub, TAU, type Vec,
} from "./math.ts";
import { pathPoint, pathSegmentCount, samplePath } from "./curves.ts";

export type Curve = LineValue | CircleValue | ArcValue | PathValue;
type Hit = { point: PointValue; p1: number; p2: number };

function lineParameter(line: LineValue, p: Vec): number {
  const d = sub(line.b, line.a);
  return dot(sub(p, line.a), d) / dot(d, d);
}

function inLineRange(line: LineValue, t: number, eps: number): boolean {
  const unit = length(sub(line.b, line.a));
  const margin = eps / unit;
  return line.kind === "infinite" || (line.kind === "ray" ? t >= -margin : t >= -margin && t <= 1 + margin);
}

export function arcDirection(arc: ArcValue): { clockwise: boolean; amount: number } {
  const a = pointAngle(arc.circle.center, arc.start);
  const b = pointAngle(arc.circle.center, arc.end);
  const ccw = ccwDelta(a, b), cw = cwDelta(a, b);
  if (arc.sweep === "ccw") return { clockwise: false, amount: ccw };
  if (arc.sweep === "cw") return { clockwise: true, amount: cw };
  if (arc.sweep === "short") return ccw < cw ? { clockwise: false, amount: ccw } : { clockwise: true, amount: cw };
  return ccw > cw ? { clockwise: false, amount: ccw } : { clockwise: true, amount: cw };
}

function arcProgress(arc: ArcValue, point: Vec): number {
  const start = pointAngle(arc.circle.center, arc.start);
  const angle = pointAngle(arc.circle.center, point);
  const direction = arcDirection(arc);
  return (direction.clockwise ? cwDelta(start, angle) : ccwDelta(start, angle)) / direction.amount;
}

function onArc(arc: ArcValue, point: Vec, eps: number): boolean {
  if (Math.abs(distance(point, arc.circle.center) - arc.circle.radius) > eps) return false;
  const progress = arcProgress(arc, point);
  return progress >= -eps / arc.circle.radius && progress <= 1 + eps / arc.circle.radius;
}

function parameter(object: Curve, point: Vec): number {
  if (object.type === "Line") return lineParameter(object, point);
  if (object.type === "Circle") return pointAngle(object.center, point);
  if (object.type === "Arc") return arcProgress(object, point);
  const samples = samplePath(object, object.smooth ? 128 : 1);
  let best = samples[0]!, bestDistance = Infinity;
  for (const sample of samples) {
    const d = distance(sample.point, point);
    if (d < bestDistance) { best = sample; bestDistance = d; }
  }
  return best.progress;
}

function lineLine(a: LineValue, b: LineValue): Vec[] {
  const r = sub(a.b, a.a), s = sub(b.b, b.a);
  const scale = epsilon([a.a, a.b, b.a, b.b], [length(r), length(s)]);
  const denominator = cross(r, s);
  if (Math.abs(denominator) <= scale * Math.max(length(r), length(s))) {
    if (Math.abs(cross(sub(b.a, a.a), r)) <= scale * length(r)) {
      const endpoints = [a.a, a.b, b.a, b.b].filter(p =>
        inLineRange(a, lineParameter(a, p), scale) && inLineRange(b, lineParameter(b, p), scale));
      if (endpoints.length > 1) throw new Error("INFINITE_INTERSECTIONS");
      return endpoints;
    }
    return [];
  }
  const delta = sub(b.a, a.a);
  const t = cross(delta, s) / denominator;
  const u = cross(delta, r) / denominator;
  return inLineRange(a, t, scale) && inLineRange(b, u, scale) ? [add(a.a, mul(r, t))] : [];
}

function lineCircle(line: LineValue, circle: CircleValue): Vec[] {
  const d = sub(line.b, line.a), f = sub(line.a, circle.center);
  const qa = dot(d, d), qb = 2 * dot(f, d), qc = dot(f, f) - circle.radius ** 2;
  const eps = epsilon([line.a, line.b, circle.center], [circle.radius, length(d)]);
  let discriminant = qb * qb - 4 * qa * qc;
  const threshold = eps * Math.max(1, qa, Math.abs(qb), Math.abs(qc));
  if (discriminant < -threshold) return [];
  if (Math.abs(discriminant) <= threshold) discriminant = 0;
  const root = Math.sqrt(Math.max(0, discriminant));
  const ts = discriminant === 0 ? [-qb / (2 * qa)] : [(-qb - root) / (2 * qa), (-qb + root) / (2 * qa)];
  return ts.filter(t => inLineRange(line, t, eps)).map(t => add(line.a, mul(d, t)));
}

function circleCircle(a: CircleValue, b: CircleValue): Vec[] {
  const d = distance(a.center, b.center);
  const eps = epsilon([a.center, b.center], [a.radius, b.radius]);
  if (d <= eps && Math.abs(a.radius - b.radius) <= eps) throw new Error("INFINITE_INTERSECTIONS");
  if (d > a.radius + b.radius + eps || d < Math.abs(a.radius - b.radius) - eps || d <= eps) return [];
  const x = (a.radius ** 2 - b.radius ** 2 + d ** 2) / (2 * d);
  let h2 = a.radius ** 2 - x ** 2;
  if (h2 < 0 && h2 >= -eps * Math.max(1, a.radius)) h2 = 0;
  if (h2 < 0) return [];
  const direction = normalize(sub(b.center, a.center));
  const base = add(a.center, mul(direction, x));
  const normal = { x: -direction.y, y: direction.x };
  const h = Math.sqrt(h2);
  return h <= eps ? [base] : [add(base, mul(normal, h)), add(base, mul(normal, -h))];
}

function segmentLine(a: Vec, b: Vec): LineValue {
  return {
    type: "Line", a: barePoint(a.x, a.y), b: barePoint(b.x, b.y), kind: "segment",
    objectId: null, created: null,
    style: { visible: false, color: "black", width: 1, dashed: false, opacity: 1, layer: 0, arrow: null },
  };
}

function pathAgainst(path: PathValue, other: Exclude<Curve, PathValue>): Vec[] {
  const samples = samplePath(path, path.smooth ? 192 : 1);
  const found: Vec[] = [];
  for (let i = 0; i < samples.length - 1; i++) {
    const a = samples[i]!, b = samples[i + 1]!;
    if (path.closed && i === samples.length - 2 && distance(a.point, b.point) === 0) continue;
    const segment = segmentLine(a.point, b.point);
    let hits: Vec[];
    if (other.type === "Line") hits = lineLine(segment, other);
    else if (other.type === "Circle") hits = lineCircle(segment, other);
    else hits = lineCircle(segment, other.circle).filter(p => onArc(other, p, epsilon([p, other.circle.center], [other.circle.radius])));
    found.push(...hits);
  }
  return found;
}

function pathPath(a: PathValue, b: PathValue): Vec[] {
  const as = samplePath(a, a.smooth ? 128 : 1), bs = samplePath(b, b.smooth ? 128 : 1);
  const found: Vec[] = [];
  for (let i = 0; i < as.length - 1; i++) {
    const la = segmentLine(as[i]!.point, as[i + 1]!.point);
    for (let j = 0; j < bs.length - 1; j++) found.push(...lineLine(la, segmentLine(bs[j]!.point, bs[j + 1]!.point)));
  }
  return found;
}

export function intersections(first: Curve, second: Curve): PointValue[] {
  const unwrap = (value: CircleValue | ArcValue): CircleValue => value.type === "Arc" ? value.circle : value;
  let raw: Vec[];
  if (first.type === "Path" && second.type === "Path") raw = pathPath(first, second);
  else if (first.type === "Path") raw = pathAgainst(first, second as Exclude<Curve, PathValue>);
  else if (second.type === "Path") raw = pathAgainst(second, first as Exclude<Curve, PathValue>);
  else if (first.type === "Line" && second.type === "Line") raw = lineLine(first, second);
  else if (first.type === "Line") raw = lineCircle(first, unwrap(second as CircleValue | ArcValue));
  else if (second.type === "Line") raw = lineCircle(second, unwrap(first as CircleValue | ArcValue));
  else raw = circleCircle(unwrap(first), unwrap(second));
  const eps = epsilon(raw.length ? raw : definingPoints(first).concat(definingPoints(second)), intrinsicLengths(first).concat(intrinsicLengths(second)));
  if (first.type === "Arc") raw = raw.filter(point => onArc(first, point, eps));
  if (second.type === "Arc") raw = raw.filter(point => onArc(second, point, eps));
  const unique: Vec[] = [];
  for (const point of raw) if (!unique.some(existing => distance(existing, point) <= eps)) unique.push(point);
  const hits: Hit[] = unique.map(point => ({
    point: barePoint(point.x, point.y), p1: parameter(first, point), p2: parameter(second, point),
  }));
  hits.sort((a, b) => a.p1 - b.p1 || a.p2 - b.p2 || a.point.x - b.point.x || a.point.y - b.point.y);
  return hits.map(hit => hit.point);
}

export function projectPoint(point: PointValue, target: Curve): PointValue {
  if (target.type === "Line") {
    const d = sub(target.b, target.a);
    let t = dot(sub(point, target.a), d) / dot(d, d);
    if (target.kind === "segment") t = clamp(t, 0, 1);
    else if (target.kind === "ray") t = Math.max(0, t);
    const result = add(target.a, mul(d, t));
    return barePoint(result.x, result.y);
  }
  if (target.type === "Circle") {
    const d = sub(point, target.center);
    if (length(d) <= epsilon([point, target.center], [target.radius])) throw new Error("AMBIGUOUS_PROJECTION");
    const result = add(target.center, mul(normalize(d), target.radius));
    return barePoint(result.x, result.y);
  }
  if (target.type === "Arc") {
    const radial = sub(point, target.circle.center);
    const candidates: Vec[] = [target.start, target.end];
    if (length(radial) > epsilon([point, target.circle.center], [target.circle.radius])) {
      const circlePoint = add(target.circle.center, mul(normalize(radial), target.circle.radius));
      if (onArc(target, circlePoint, epsilon([circlePoint, target.circle.center], [target.circle.radius]))) candidates.push(circlePoint);
    }
    return uniqueClosest(point, candidates);
  }
  const count = pathSegmentCount(target);
  const candidates: Vec[] = [];
  for (let segment = 0; segment < count; segment++) {
    if (!target.smooth) {
      const a = pathPoint(target, segment, 0), b = pathPoint(target, segment, 1), d = sub(b, a);
      candidates.push(add(a, mul(d, clamp(dot(sub(point, a), d) / dot(d, d), 0, 1))));
      continue;
    }
    // Bracket every local basin, then minimize squared distance by golden-section search.
    const samples = 64;
    const values = Array.from({ length: samples + 1 }, (_, i) => {
      const u = i / samples, p = pathPoint(target, segment, u);
      return { u, d: dot(sub(p, point), sub(p, point)) };
    });
    for (let i = 0; i <= samples; i++) {
      if (values[i]!.d <= (values[i - 1]?.d ?? Infinity) && values[i]!.d <= (values[i + 1]?.d ?? Infinity)) {
        let lo = Math.max(0, (i - 1) / samples), hi = Math.min(1, (i + 1) / samples);
        for (let iteration = 0; iteration < 80; iteration++) {
          const u1 = hi - (hi - lo) / 1.618033988749895, u2 = lo + (hi - lo) / 1.618033988749895;
          const p1 = pathPoint(target, segment, u1), p2 = pathPoint(target, segment, u2);
          const d1 = dot(sub(p1, point), sub(p1, point)), d2 = dot(sub(p2, point), sub(p2, point));
          if (d1 < d2) hi = u2; else lo = u1;
        }
        candidates.push(pathPoint(target, segment, (lo + hi) / 2));
      }
    }
  }
  return uniqueClosest(point, candidates);
}

function uniqueClosest(origin: Vec, candidates: Vec[]): PointValue {
  candidates.sort((a, b) => distance(origin, a) - distance(origin, b));
  const eps = epsilon([origin, ...candidates]);
  const best = candidates[0]!;
  const tied = candidates.filter(p => Math.abs(distance(origin, p) - distance(origin, best)) <= eps);
  const distinct: Vec[] = [];
  for (const p of tied) if (!distinct.some(q => distance(p, q) <= eps)) distinct.push(p);
  if (distinct.length > 1) throw new Error("AMBIGUOUS_PROJECTION");
  return barePoint(best.x, best.y);
}

export function definingPoints(object: Curve): PointValue[] {
  if (object.type === "Line") return [object.a, object.b];
  if (object.type === "Circle") return [object.center];
  if (object.type === "Arc") return [object.circle.center, object.start, object.end];
  return object.points;
}
function intrinsicLengths(object: Curve): number[] {
  if (object.type === "Line") return [distance(object.a, object.b)];
  if (object.type === "Circle") return [object.radius];
  if (object.type === "Arc") return [object.circle.radius];
  return object.points.map((p, i) => i ? distance(p, object.points[i - 1]!) : 0);
}

export function circumcircle(a: PointValue, b: PointValue, c: PointValue): { center: PointValue; radius: number } {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  const eps = epsilon([a, b, c]);
  if (Math.abs(d) <= eps * Math.max(distance(a, b), distance(b, c), distance(c, a))) throw new Error("DEGENERATE_CIRCLE");
  const aa = a.x ** 2 + a.y ** 2, bb = b.x ** 2 + b.y ** 2, cc = c.x ** 2 + c.y ** 2;
  const x = (aa * (b.y - c.y) + bb * (c.y - a.y) + cc * (a.y - b.y)) / d;
  const y = (aa * (c.x - b.x) + bb * (a.x - c.x) + cc * (b.x - a.x)) / d;
  const center = barePoint(x, y);
  return { center, radius: distance(center, a) };
}

export const geometryAngle = (a: PointValue, vertex: PointValue, b: PointValue): number =>
  angleBetween(sub(a, vertex), sub(b, vertex));
