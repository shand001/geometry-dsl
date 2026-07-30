import type { PathValue, PointValue } from "../types.ts";
import { add, distance, lerp, mul, sub, type Vec } from "./math.ts";

export function pathSegmentCount(path: PathValue): number {
  return path.closed ? path.points.length : path.points.length - 1;
}

function controls(path: PathValue, index: number): [Vec, Vec, Vec, Vec] {
  const p = path.points;
  const n = p.length;
  const p1 = p[index]!;
  const p2 = p[(index + 1) % n]!;
  if (path.closed) return [p[(index - 1 + n) % n]!, p1, p2, p[(index + 2) % n]!];
  const p0 = index === 0 ? sub(mul(p1, 2), p2) : p[index - 1]!;
  const p3 = index + 2 >= n ? sub(mul(p2, 2), p1) : p[index + 2]!;
  return [p0, p1, p2, p3];
}

/** The normative centripetal Catmull–Rom expression from section 10.4. */
export function pathPoint(path: PathValue, segment: number, u: number): Vec {
  const [p0, p1, p2, p3] = controls(path, segment);
  if (!path.smooth) return lerp(p1, p2, u);
  const alpha = 0.5;
  const t0 = 0;
  const t1 = t0 + distance(p0, p1) ** alpha;
  const t2 = t1 + distance(p1, p2) ** alpha;
  const t3 = t2 + distance(p2, p3) ** alpha;
  const t = t1 + u * (t2 - t1);
  const blend = (a: Vec, b: Vec, ta: number, tb: number): Vec =>
    add(mul(a, (tb - t) / (tb - ta)), mul(b, (t - ta) / (tb - ta)));
  const a1 = blend(p0, p1, t0, t1);
  const a2 = blend(p1, p2, t1, t2);
  const a3 = blend(p2, p3, t2, t3);
  const b1 = add(mul(a1, (t2 - t) / (t2 - t0)), mul(a2, (t - t0) / (t2 - t0)));
  const b2 = add(mul(a2, (t3 - t) / (t3 - t1)), mul(a3, (t - t1) / (t3 - t1)));
  return add(mul(b1, (t2 - t) / (t2 - t1)), mul(b2, (t - t1) / (t2 - t1)));
}

export type PathSample = { point: Vec; progress: number; segment: number; u: number };

export function samplePath(path: PathValue, smoothSteps = 96): PathSample[] {
  const count = pathSegmentCount(path);
  const steps = path.smooth ? smoothSteps : 1;
  const samples: PathSample[] = [];
  for (let segment = 0; segment < count; segment++) {
    for (let j = 0; j < steps; j++) {
      const u = j / steps;
      samples.push({ point: pathPoint(path, segment, u), progress: (segment + u) / count, segment, u });
    }
  }
  samples.push({
    point: pathPoint(path, count - 1, 1),
    progress: path.closed ? 0 : 1,
    segment: count - 1,
    u: 1,
  });
  return samples;
}

export function pathSvgData(path: PathValue, sx: (x: number) => number, sy: (y: number) => number): string {
  if (!path.smooth) {
    const commands = [`M ${sx(path.points[0]!.x)} ${sy(path.points[0]!.y)}`];
    for (const point of path.points.slice(1)) commands.push(`L ${sx(point.x)} ${sy(point.y)}`);
    if (path.closed) commands.push("Z");
    return commands.join(" ");
  }
  const samples = samplePath(path, 32);
  const commands = [`M ${sx(samples[0]!.point.x)} ${sy(samples[0]!.point.y)}`];
  for (const sample of samples.slice(1)) commands.push(`L ${sx(sample.point.x)} ${sy(sample.point.y)}`);
  if (path.closed) commands.push("Z");
  return commands.join(" ");
}

export function pointFromVec(point: Vec): PointValue {
  return { type: "Point", x: point.x, y: point.y, objectId: null, created: null };
}
