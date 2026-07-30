import type { CircleValue, PathValue, RegionValue } from "../types.ts";
import { samplePath } from "./curves.ts";
import { distance, type Vec } from "./math.ts";

export type RegionBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

function pathVertices(path: PathValue): Vec[] {
  if (!path.smooth) return path.points;
  const samples = samplePath(path, 32).map(sample => sample.point);
  if (path.closed && samples.length > 1 && distance(samples[0]!, samples[samples.length - 1]!) < 1e-12) {
    samples.pop();
  }
  return samples;
}

function sourceBounds(source: CircleValue | PathValue): RegionBounds {
  if (source.type === "Circle") {
    return {
      minX: source.center.x - source.radius,
      minY: source.center.y - source.radius,
      maxX: source.center.x + source.radius,
      maxY: source.center.y + source.radius,
    };
  }
  const points = pathVertices(source);
  return {
    minX: Math.min(...points.map(point => point.x)),
    minY: Math.min(...points.map(point => point.y)),
    maxX: Math.max(...points.map(point => point.x)),
    maxY: Math.max(...points.map(point => point.y)),
  };
}

function unionBounds(bounds: readonly RegionBounds[]): RegionBounds | null {
  if (!bounds.length) return null;
  return {
    minX: Math.min(...bounds.map(bound => bound.minX)),
    minY: Math.min(...bounds.map(bound => bound.minY)),
    maxX: Math.max(...bounds.map(bound => bound.maxX)),
    maxY: Math.max(...bounds.map(bound => bound.maxY)),
  };
}

function intersectionBounds(bounds: readonly RegionBounds[]): RegionBounds | null {
  if (!bounds.length) return null;
  const result = {
    minX: Math.max(...bounds.map(bound => bound.minX)),
    minY: Math.max(...bounds.map(bound => bound.minY)),
    maxX: Math.min(...bounds.map(bound => bound.maxX)),
    maxY: Math.min(...bounds.map(bound => bound.maxY)),
  };
  return result.minX <= result.maxX && result.minY <= result.maxY ? result : null;
}

export function regionBounds(region: RegionValue): RegionBounds | null {
  const expression = region.expression;
  if (expression.kind === "inside") return sourceBounds(expression.source);
  if (expression.kind === "difference") return regionBounds(expression.left);
  const operandBounds = expression.operands.map(regionBounds);
  if (expression.kind === "intersection" && operandBounds.some(bound => bound === null)) return null;
  const bounds = operandBounds.filter((bound): bound is RegionBounds => bound !== null);
  return expression.kind === "union" ? unionBounds(bounds) : intersectionBounds(bounds);
}

function segmentDistance(point: Vec, a: Vec, b: Vec): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return distance(point, a);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

function pathWinding(point: Vec, vertices: readonly Vec[]): { crossings: number; winding: number } {
  let crossings = 0, winding = 0;
  for (let index = 0; index < vertices.length; index++) {
    const a = vertices[index]!, b = vertices[(index + 1) % vertices.length]!;
    const crossesRay = (a.y > point.y) !== (b.y > point.y);
    if (crossesRay) {
      const x = a.x + (point.y - a.y) * (b.x - a.x) / (b.y - a.y);
      if (x > point.x) crossings += 1;
    }
    const side = (b.x - a.x) * (point.y - a.y) - (point.x - a.x) * (b.y - a.y);
    if (a.y <= point.y && b.y > point.y && side > 0) winding += 1;
    else if (a.y > point.y && b.y <= point.y && side < 0) winding -= 1;
  }
  return { crossings, winding };
}

function pathSignedDistance(path: PathValue, point: Vec): number {
  const vertices = pathVertices(path);
  let boundaryDistance = Infinity;
  for (let index = 0; index < vertices.length; index++) {
    boundaryDistance = Math.min(
      boundaryDistance,
      segmentDistance(point, vertices[index]!, vertices[(index + 1) % vertices.length]!),
    );
  }
  const { crossings, winding } = pathWinding(point, vertices);
  const inside = path.style.fill_rule === "evenodd" ? crossings % 2 === 1 : winding !== 0;
  return inside ? boundaryDistance : -boundaryDistance;
}

export function regionSignedDistance(region: RegionValue, point: Vec): number {
  const expression = region.expression;
  if (expression.kind === "inside") {
    if (expression.source.type === "Circle") {
      return expression.source.radius - distance(point, expression.source.center);
    }
    return pathSignedDistance(expression.source, point);
  }
  if (expression.kind === "difference") {
    return Math.min(
      regionSignedDistance(expression.left, point),
      -regionSignedDistance(expression.right, point),
    );
  }
  const distances = expression.operands.map(operand => regionSignedDistance(operand, point));
  return expression.kind === "union" ? Math.max(...distances) : Math.min(...distances);
}

export function regionContains(region: RegionValue, point: Vec, tolerance = 0): boolean {
  return regionSignedDistance(region, point) >= -tolerance;
}
