import type {
  ArcValue, CircleValue, GeometryValue, LineValue, MarkValue, PathValue,
  PointStyle, PointValue, RegionValue, RenderOptions, Scene, StrokeStyle, TextValue,
} from "../types.ts";
import { arcDirection, cross, normalize, regionBounds, sub } from "../geometry/index.ts";
import { pathSvgData, samplePath } from "../geometry/curves.ts";
import { estimateTextDimensions, layoutLabels, type ResolvedLabel } from "./layout.ts";

type Bounds = { minX: number; minY: number; maxX: number; maxY: number };
const escapeXml = (text: string): string => text.replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
const format = (value: number, precision: number): string => {
  const rounded = Number(value.toFixed(precision));
  return Object.is(rounded, -0) ? "0" : String(rounded);
};

const AUTO_BASE_SCALE = 50; // pixels per world unit
const AUTO_MIN_SIZE = 200;  // px
const AUTO_MAX_SIZE = 1200; // px

function clampSize(value: number): number {
  return Math.round(Math.max(AUTO_MIN_SIZE, Math.min(AUTO_MAX_SIZE, value)));
}

function resolveSize(
  options: RenderOptions,
  xSpan: number,
  ySpan: number,
  padding: number,
): { width: number; height: number } {
  let width: number;
  let height: number;
  if (options.width != null && options.height != null) {
    width = options.width;
    height = options.height;
  } else if (options.width != null) {
    width = options.width;
    height = clampSize(ySpan * ((width - 2 * padding) / xSpan) + 2 * padding);
  } else if (options.height != null) {
    height = options.height;
    width = clampSize(xSpan * ((height - 2 * padding) / ySpan) + 2 * padding);
  } else {
    width = clampSize(xSpan * AUTO_BASE_SCALE + 2 * padding);
    height = clampSize(ySpan * AUTO_BASE_SCALE + 2 * padding);
  }
  return { width, height };
}

function geometryBounds(objects: readonly GeometryValue[], includeFixedTextAnchors = true): Bounds {
  const bounds: Bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const add = (x: number, y: number): void => {
    bounds.minX = Math.min(bounds.minX, x); bounds.minY = Math.min(bounds.minY, y);
    bounds.maxX = Math.max(bounds.maxX, x); bounds.maxY = Math.max(bounds.maxY, y);
  };
  for (const object of objects) {
    if (!object.style?.visible || object.type === "Mark") continue;
    if (object.type === "Point") add(object.x, object.y);
    else if (object.type === "Line") { add(object.a.x, object.a.y); add(object.b.x, object.b.y); }
    else if (object.type === "Circle") {
      add(object.center.x - object.radius, object.center.y - object.radius);
      add(object.center.x + object.radius, object.center.y + object.radius);
    } else if (object.type === "Arc") {
      add(object.start.x, object.start.y); add(object.end.x, object.end.y);
      // Including the supporting circle makes auto framing stable and never clips an arc.
      add(object.circle.center.x - object.circle.radius, object.circle.center.y - object.circle.radius);
      add(object.circle.center.x + object.circle.radius, object.circle.center.y + object.circle.radius);
    } else if (object.type === "Path") {
      const samples = object.smooth ? samplePath(object, 48).map(s => s.point) : object.points;
      for (const point of samples) add(point.x, point.y);
    } else if (object.type === "Region") {
      const region = regionBounds(object);
      if (region) { add(region.minX, region.minY); add(region.maxX, region.maxY); }
    } else {
      if (object.position.kind === "fixed") {
        if (includeFixedTextAnchors) add(object.position.x, object.position.y);
      } else {
        const region = regionBounds(object.position.region);
        if (region) { add(region.minX, region.minY); add(region.maxX, region.maxY); }
      }
    }
  }
  if (!Number.isFinite(bounds.minX)) return { minX: -1, minY: -1, maxX: 1, maxY: 1 };
  if (bounds.maxX - bounds.minX < 1e-12) { bounds.minX -= 1; bounds.maxX += 1; }
  if (bounds.maxY - bounds.minY < 1e-12) { bounds.minY -= 1; bounds.maxY += 1; }
  return bounds;
}

function boundsWithFixedText(
  objects: readonly GeometryValue[],
  options: RenderOptions,
  padding: number,
  labelSize: number,
): Bounds {
  const base = geometryBounds(objects, false);
  let bounds = geometryBounds(objects);
  // Text dimensions are measured in pixels while geometry bounds are in world
  // units. Iterate because expanding the world bounds can change the final scale.
  for (let iteration = 0; iteration < 8; iteration++) {
    const xSpan = bounds.maxX - bounds.minX, ySpan = bounds.maxY - bounds.minY;
    const { width, height } = resolveSize(options, xSpan, ySpan, padding);
    const scale = Math.min((width - 2 * padding) / xSpan, (height - 2 * padding) / ySpan);
    const next = { ...base };
    for (const object of objects) {
      if (object.type !== "Text" || !object.style?.visible || object.style.opacity <= 0
        || object.position.kind !== "fixed") continue;
      const size = object.style.size ?? labelSize;
      const dimensions = estimateTextDimensions(object.content, size);
      const halfWidth = dimensions.width / (2 * scale);
      const halfHeight = dimensions.height / (2 * scale);
      next.minX = Math.min(next.minX, object.position.x - halfWidth);
      next.maxX = Math.max(next.maxX, object.position.x + halfWidth);
      next.minY = Math.min(next.minY, object.position.y - halfHeight);
      next.maxY = Math.max(next.maxY, object.position.y + halfHeight);
    }
    if (Math.max(
      Math.abs(next.minX - bounds.minX), Math.abs(next.maxX - bounds.maxX),
      Math.abs(next.minY - bounds.minY), Math.abs(next.maxY - bounds.maxY),
    ) < 1e-9) return next;
    bounds = next;
  }
  return bounds;
}

function clipLine(line: LineValue, bounds: Bounds): [{ x: number; y: number }, { x: number; y: number }] | null {
  const dx = line.b.x - line.a.x, dy = line.b.y - line.a.y;
  let low = line.kind === "infinite" ? -Infinity : 0;
  let high = line.kind === "segment" ? 1 : Infinity;
  const constraints: [number, number][] = [
    [-dx, line.a.x - bounds.minX], [dx, bounds.maxX - line.a.x],
    [-dy, line.a.y - bounds.minY], [dy, bounds.maxY - line.a.y],
  ];
  for (const [p, q] of constraints) {
    if (p === 0) { if (q < 0) return null; continue; }
    const r = q / p;
    if (p < 0) low = Math.max(low, r); else high = Math.min(high, r);
  }
  if (low > high) return null;
  return [
    { x: line.a.x + low * dx, y: line.a.y + low * dy },
    { x: line.a.x + high * dx, y: line.a.y + high * dy },
  ];
}

export function renderSvg(scene: Scene, options: RenderOptions = {}): string {
  const padding = options.padding ?? 32, precision = options.precision ?? 4;
  const labelSize = options.labelSize ?? 28;
  const raw = options.viewBox
    ? { minX: options.viewBox.minX, minY: options.viewBox.minY,
        maxX: options.viewBox.minX + options.viewBox.width, maxY: options.viewBox.minY + options.viewBox.height }
    : boundsWithFixedText(scene.objects, options, padding, labelSize);
  const xSpan = raw.maxX - raw.minX, ySpan = raw.maxY - raw.minY;
  const { width, height } = resolveSize(options, xSpan, ySpan, padding);
  const scale = Math.min((width - 2 * padding) / xSpan, (height - 2 * padding) / ySpan);
  const worldWidth = (width - 2 * padding) / scale, worldHeight = (height - 2 * padding) / scale;
  const cx = (raw.minX + raw.maxX) / 2, cy = (raw.minY + raw.maxY) / 2;
  const bounds = { minX: cx - worldWidth / 2, maxX: cx + worldWidth / 2,
    minY: cy - worldHeight / 2, maxY: cy + worldHeight / 2 };
  const sx = (x: number): number => padding + (x - bounds.minX) * scale;
  const sy = (y: number): number => height - padding - (y - bounds.minY) * scale;
  const wx = (x: number): number => bounds.minX + (x - padding) / scale;
  const wy = (y: number): number => bounds.minY + (height - padding - y) / scale;
  const f = (value: number): string => format(value, precision);
  const labels = layoutLabels(scene.objects, labelSize, {
    sx, sy, wx, wy, scale, bounds, width, height,
  });
  const objects = [...scene.objects].filter(o => o.style?.visible)
    .sort((a, b) => Number(a.style!.layer) - Number(b.style!.layer) || a.created! - b.created!);
  const masks = scene.objects
    .filter((object): object is RegionValue => object.type === "Region")
    .map(region => renderRegionMask(region, width, height, sx, sy, scale, f))
    .join("");
  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Geometry DSL rendering">`,
    `<defs><marker id="g-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto-start-reverse" markerUnits="strokeWidth"><path d="M0,0 L8,4 L0,8 Z" fill="context-stroke"/></marker>${masks}</defs>`,
  ];
  if (options.background) out.push(`<rect width="100%" height="100%" fill="${escapeXml(options.background)}"/>`);
  for (const object of objects) {
    if (object.type === "Point") out.push(renderPoint(object, sx, sy, f, labels.get(object.objectId!)));
    else if (object.type === "Line") out.push(renderLine(object, bounds, sx, sy, f));
    else if (object.type === "Circle") out.push(renderCircle(object, sx, sy, scale, f));
    else if (object.type === "Arc") out.push(renderArc(object, sx, sy, scale, f));
    else if (object.type === "Path") out.push(renderPath(object, sx, sy, f));
    else if (object.type === "Mark") out.push(renderMark(object, sx, sy, scale, f));
    else if (object.type === "Region") out.push(renderRegion(object, width, height));
    else out.push(renderText(object, labels.get(object.objectId!), f));
  }
  out.push("</svg>");
  return out.join("\n");
}

function baseStyle(style: StrokeStyle | PointStyle): string {
  const attrs = [`opacity="${style.opacity}"`];
  if ("width" in style) {
    attrs.push(`stroke="${style.color}"`, `stroke-width="${style.width}"`, `stroke-linecap="round"`, `stroke-linejoin="round"`);
    if (style.dashed) attrs.push(`stroke-dasharray="${style.width * 6} ${style.width * 4}"`);
  }
  return attrs.join(" ");
}

function renderPoint(
  point: PointValue,
  sx: (x: number) => number,
  sy: (y: number) => number,
  f: (n: number) => string,
  label: ResolvedLabel | undefined,
): string {
  const style = point.style!, x = sx(point.x), y = sy(point.y), size = style.size;
  const parts: string[] = [`<g data-type="Point" data-object-id="${point.objectId}" opacity="${style.opacity}" fill="${style.color}" stroke="${style.color}">`];
  if (style.shape === "dot") parts.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(size / 2)}"/>`);
  else if (style.shape === "circle") parts.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(size / 2)}" fill="none" stroke-width="1.5"/>`);
  else if (style.shape === "square") parts.push(`<rect x="${f(x - size / 2)}" y="${f(y - size / 2)}" width="${f(size)}" height="${f(size)}"/>`);
  else parts.push(`<path d="M ${f(x - size / 2)} ${f(y - size / 2)} L ${f(x + size / 2)} ${f(y + size / 2)} M ${f(x - size / 2)} ${f(y + size / 2)} L ${f(x + size / 2)} ${f(y - size / 2)}" fill="none" stroke-width="1.5"/>`);
  if (label) {
    parts.push(`<text x="${f(label.x)}" y="${f(label.y)}" text-anchor="middle" dominant-baseline="central" font-family="system-ui, sans-serif" font-size="${f(label.size)}" fill="${style.color}" stroke="none">${escapeXml(label.content)}</text>`);
  }
  parts.push("</g>");
  return parts.join("");
}

function regionMaskId(region: RegionValue): string {
  return `g-region-${region.objectId}`;
}

function maskRect(width: number, height: number, fill: "black" | "white", mask?: RegionValue): string {
  const maskAttribute = mask ? ` mask="url(#${regionMaskId(mask)})"` : "";
  return `<rect x="0" y="0" width="${width}" height="${height}" fill="${fill}"${maskAttribute}/>`;
}

function renderInsideMask(
  region: RegionValue,
  sx: (x: number) => number,
  sy: (y: number) => number,
  scale: number,
  f: (n: number) => string,
): string {
  const expression = region.expression;
  if (expression.kind !== "inside") return "";
  const source = expression.source;
  if (source.type === "Circle") {
    return `<circle cx="${f(sx(source.center.x))}" cy="${f(sy(source.center.y))}" r="${f(source.radius * scale)}" fill="white"/>`;
  }
  const data = pathSvgData(source, x => Number(f(sx(x))), y => Number(f(sy(y))));
  return `<path d="${data}" fill="white" fill-rule="${source.style.fill_rule}"/>`;
}

function renderRegionMask(
  region: RegionValue,
  width: number,
  height: number,
  sx: (x: number) => number,
  sy: (y: number) => number,
  scale: number,
  f: (n: number) => string,
): string {
  const expression = region.expression;
  let body = maskRect(width, height, "black");
  if (expression.kind === "inside") {
    body += renderInsideMask(region, sx, sy, scale, f);
  } else if (expression.kind === "union") {
    body += expression.operands.map(operand => maskRect(width, height, "white", operand)).join("");
  } else if (expression.kind === "intersection") {
    let intersection = maskRect(width, height, "white");
    for (const operand of expression.operands) {
      intersection = `<g mask="url(#${regionMaskId(operand)})">${intersection}</g>`;
    }
    body += intersection;
  } else if (expression.kind === "difference") {
    body += `<g mask="url(#${regionMaskId(expression.left)})">${maskRect(width, height, "white")}${maskRect(width, height, "black", expression.right)}</g>`;
  }
  return `<mask id="${regionMaskId(region)}" x="0" y="0" width="${width}" height="${height}" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" style="mask-type:luminance">${body}</mask>`;
}

function renderRegion(region: RegionValue, width: number, height: number): string {
  if (region.style.fill === null || region.style.opacity <= 0) return "";
  return `<rect data-type="Region" data-object-id="${region.objectId}" x="0" y="0" width="${width}" height="${height}" fill="${region.style.fill}" opacity="${region.style.opacity}" mask="url(#${regionMaskId(region)})"/>`;
}

function renderText(text: TextValue, label: ResolvedLabel | undefined, f: (n: number) => string): string {
  if (!label) return "";
  return `<text data-type="Text" data-object-id="${text.objectId}" x="${f(label.x)}" y="${f(label.y)}" text-anchor="middle" dominant-baseline="central" font-family="system-ui, sans-serif" font-size="${f(label.size)}" fill="${text.style.color}" opacity="${text.style.opacity}">${escapeXml(text.content)}</text>`;
}

function renderLine(line: LineValue, bounds: Bounds, sx: (x: number) => number, sy: (y: number) => number, f: (n: number) => string): string {
  const clipped = clipLine(line, bounds);
  if (!clipped) return "";
  const [a, b] = clipped, style = line.style;
  const arrows = `${style.arrow === "start" || style.arrow === "both" ? ` marker-start="url(#g-arrow)"` : ""}${style.arrow === "end" || style.arrow === "both" ? ` marker-end="url(#g-arrow)"` : ""}`;
  return `<line data-type="Line" data-kind="${line.kind}" data-object-id="${line.objectId}" x1="${f(sx(a.x))}" y1="${f(sy(a.y))}" x2="${f(sx(b.x))}" y2="${f(sy(b.y))}" fill="none" ${baseStyle(style)}${arrows}/>`;
}

function renderCircle(circle: CircleValue, sx: (x: number) => number, sy: (y: number) => number, scale: number, f: (n: number) => string): string {
  return `<circle data-type="Circle" data-object-id="${circle.objectId}" cx="${f(sx(circle.center.x))}" cy="${f(sy(circle.center.y))}" r="${f(circle.radius * scale)}" fill="${circle.style.fill ?? "none"}" ${baseStyle(circle.style)}/>`;
}

function renderArc(arc: ArcValue, sx: (x: number) => number, sy: (y: number) => number, scale: number, f: (n: number) => string): string {
  const direction = arcDirection(arc);
  const large = direction.amount > Math.PI ? 1 : 0;
  // World y-up is mapped to SVG y-down, so clockwise is SVG sweep=1.
  const sweep = direction.clockwise ? 1 : 0, radius = arc.circle.radius * scale;
  const d = `M ${f(sx(arc.start.x))} ${f(sy(arc.start.y))} A ${f(radius)} ${f(radius)} 0 ${large} ${sweep} ${f(sx(arc.end.x))} ${f(sy(arc.end.y))}`;
  return `<path data-type="Arc" data-sweep="${arc.sweep}" data-object-id="${arc.objectId}" d="${d}" fill="none" ${baseStyle(arc.style)}/>`;
}

function renderPath(path: PathValue, sx: (x: number) => number, sy: (y: number) => number, f: (n: number) => string): string {
  const data = pathSvgData(path, x => Number(f(sx(x))), y => Number(f(sy(y))));
  return `<path data-type="Path" data-smooth="${path.smooth}" data-closed="${path.closed}" data-object-id="${path.objectId}" d="${data}" fill="${path.style.fill ?? "none"}" fill-rule="${path.style.fill_rule}" ${baseStyle(path.style)}/>`;
}

function renderMark(mark: MarkValue, sx: (x: number) => number, sy: (y: number) => number, scale: number, f: (n: number) => string): string {
  const style = mark.style, paths: string[] = [];
  const point = (p: PointValue): { x: number; y: number } => ({ x: sx(p.x), y: sy(p.y) });
  if (mark.kind === "right") {
    const [a, b, c] = mark.operands as PointValue[], pa = point(a!), pb = point(b!), pc = point(c!);
    const u = normalize(sub(pa, pb)), v = normalize(sub(pc, pb)), s = style.size * 2;
    const p1 = { x: pb.x + u.x * s, y: pb.y + u.y * s }, p3 = { x: pb.x + v.x * s, y: pb.y + v.y * s };
    const p2 = { x: p1.x + v.x * s, y: p1.y + v.y * s };
    paths.push(`M ${f(p1.x)} ${f(p1.y)} L ${f(p2.x)} ${f(p2.y)} L ${f(p3.x)} ${f(p3.y)}`);
  } else if (mark.kind === "equal" || mark.kind === "parallel") {
    for (const line of mark.operands as LineValue[]) {
      const a = point(line.a), b = point(line.b), mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const d = normalize(sub(b, a)), n = { x: -d.y, y: d.x }, s = style.size;
      if (mark.kind === "equal") paths.push(`M ${f(mid.x - n.x * s)} ${f(mid.y - n.y * s)} L ${f(mid.x + n.x * s)} ${f(mid.y + n.y * s)}`);
      else paths.push(`M ${f(mid.x - d.x * s - n.x * s)} ${f(mid.y - d.y * s - n.y * s)} L ${f(mid.x + n.x * s)} ${f(mid.y + n.y * s)} L ${f(mid.x + d.x * s - n.x * s)} ${f(mid.y + d.y * s - n.y * s)}`);
    }
  } else {
    const p = mark.operands as PointValue[];
    const angleSets: [PointValue, PointValue, PointValue][] =
      [[p[0]!, p[1]!, p[2]!], [p[3]!, p[4]!, p[5]!]];
    for (const [a, v, b] of angleSets) {
      const pa = point(a), pv = point(v), pb = point(b), radius = style.size * 2.5;
      const start = normalize(sub(pa, pv)), end = normalize(sub(pb, pv));
      // The SVG y-axis points down, so a positive screen-space cross product
      // corresponds to sweep=1 for the minor angle centered at the vertex.
      // Deriving the sweep from
      // the two rays keeps the marker on the same side when their order is
      // reversed (A,V,B vs B,V,A).
      const sweep = cross(start, end) > 0 ? 1 : 0;
      paths.push(`M ${f(pv.x + start.x * radius)} ${f(pv.y + start.y * radius)} A ${f(radius)} ${f(radius)} 0 0 ${sweep} ${f(pv.x + end.x * radius)} ${f(pv.y + end.y * radius)}`);
    }
  }
  return `<path data-type="Mark" data-kind="${mark.kind}" data-object-id="${mark.objectId}" d="${paths.join(" ")}" fill="none" ${baseStyle(style)}/>`;
}
