import {
  GeometryDslError, type ArcValue, type CallExpression, type CircleValue,
  type Expression, type GeometryValue, type LineKind, type LineValue, type MarkValue,
  type PathValue, type PointValue, type Program, type RegionValue, type RuntimeValue,
  type Scene, type Sweep, type TextValue,
} from "../types.ts";
import { applyStyles, defaultStyle, styleKeys } from "./styles.ts";
import {
  add, angleBetween, arcDirection, barePoint, circumcircle, cross, deg, degrees,
  distance, epsilon, geometryAngle, intersections, length, mul, normalize, normalizeAngle,
  pointAngle, projectPoint, rotate, sub,
} from "../geometry/index.ts";

const geometryKeys: Record<string, Set<string>> = {
  line: new Set(["kind", "extend", "angle", "ratio"]),
  arc: new Set(["sweep"]),
  path: new Set(["closed", "smooth"]),
  intersect: new Set(["pick"]),
};
const angleEpsilon = 1e-7;

function typename(value: RuntimeValue): string {
  if (value === null) return "None";
  if (Array.isArray(value)) return "List";
  if (typeof value === "number") return "Number";
  if (typeof value === "boolean") return "Boolean";
  if (typeof value === "string") return "String/Enum/Color";
  return value.type;
}

export class Evaluator {
  private readonly values = new Map<string, RuntimeValue>();
  private readonly objects: GeometryValue[] = [];
  private nextObjectId = 1;
  private nextCreated = 0;

  evaluate(program: Program): Scene {
    for (const statement of program.statements) {
      try {
        if (statement.type === "mark") this.evaluateExpression(statement.value);
        else {
          for (const target of statement.targets) {
            if (target !== "_" && this.values.has(target)) this.fail(`名称 ${target} 已定义`, statement);
          }
          const value = this.evaluateExpression(statement.value);
          this.bind(statement.targets, value, statement);
        }
      } catch (error) {
        if (error instanceof GeometryDslError) throw error;
        const message = error instanceof Error ? error.message : String(error);
        const friendly: Record<string, string> = {
          INFINITE_INTERSECTIONS: "两个对象存在无穷多个交点",
          AMBIGUOUS_PROJECTION: "目标上存在多个等距最近点，投影不唯一",
          DEGENERATE_CIRCLE: "三点共线或近似共线，不能确定唯一圆",
        };
        this.fail(friendly[message] ?? message, statement);
      }
    }
    return { values: this.values, objects: [...this.objects] };
  }

  private fail(message: string, location: { line: number; column: number }): never {
    throw new GeometryDslError("E_SEMANTIC", message, location);
  }

  private bind(targets: string[], value: RuntimeValue, location: { line: number; column: number }): void {
    if (targets.length === 1) {
      const target = targets[0]!;
      if (target === "_") { this.discard(value); return; }
      this.values.set(target, value);
      if (!Array.isArray(value) && value && typeof value === "object" && value.type === "Point" && value.created !== null) {
        value.labelName = target;
      }
      return;
    }
    if (!Array.isArray(value)) this.fail(`多目标赋值需要 List，实际得到 ${typename(value)}`, location);
    if (value.length !== targets.length) this.fail(`多结果数量不匹配：左侧 ${targets.length} 个目标，右侧 ${value.length} 个结果`, location);
    targets.forEach((target, index) => {
      const item = value[index]!;
      if (target === "_") this.discard(item);
      else {
        this.values.set(target, item);
        if (!Array.isArray(item) && item && typeof item === "object" && item.type === "Point" && item.created !== null) item.labelName = target;
      }
    });
  }

  private discard(value: RuntimeValue): void {
    if (Array.isArray(value)) { for (const item of value) this.discard(item); return; }
    if (value && typeof value === "object" && "style" in value && value.style) value.style.visible = false;
  }

  private evaluateExpression(expression: Expression): RuntimeValue {
    if (expression.type === "literal") return expression.value as RuntimeValue;
    if (expression.type === "name") {
      if (!this.values.has(expression.name)) this.fail(`名称 ${expression.name} 尚未定义`, expression);
      return this.values.get(expression.name)!;
    }
    if (expression.type === "list") return expression.items.map(item => this.evaluateExpression(item));
    if (expression.type === "unary") {
      const value = this.number(this.evaluateExpression(expression.operand), "一元运算数");
      const result = expression.operator === "-" ? -value : value;
      if (!Number.isFinite(result)) this.fail("数值结果不是有限数", expression);
      return result === 0 ? 0 : result;
    }
    if (expression.type === "binary") {
      const left = this.number(this.evaluateExpression(expression.left), "左运算数");
      const right = this.number(this.evaluateExpression(expression.right), "右运算数");
      if (expression.operator === "/" && right === 0) this.fail("除数不能为零", expression.right);
      const result = expression.operator === "+" ? left + right : expression.operator === "-" ? left - right
        : expression.operator === "*" ? left * right : left / right;
      if (!Number.isFinite(result)) this.fail("算术结果溢出或不是有限数", expression);
      return result === 0 ? 0 : result;
    }
    if (expression.type === "attribute") return this.attribute(this.evaluateExpression(expression.base), expression.name, expression);
    return this.call(expression);
  }

  private attribute(value: RuntimeValue, name: string, location: { line: number; column: number }): RuntimeValue {
    if (Array.isArray(value) || value === null || typeof value !== "object") this.fail(`${typename(value)} 没有属性 ${name}`, location);
    const allowed: Record<string, Set<string>> = {
      Point: new Set(["x", "y"]), Line: new Set(["kind"]), Circle: new Set(["center", "radius"]),
      Arc: new Set(["circle", "start", "end", "sweep"]),
      Path: new Set(["points", "closed", "smooth"]),
      Mark: new Set(), Text: new Set(), Region: new Set(),
    };
    if (!allowed[value.type]!.has(name)) this.fail(`${value.type} 没有属性 ${name}`, location);
    return (value as unknown as Record<string, RuntimeValue>)[name]!;
  }

  private call(call: CallExpression): RuntimeValue {
    const positional: RuntimeValue[] = [];
    const named = new Map<string, RuntimeValue>();
    let styleSeen = false;
    for (const argument of call.arguments) {
      const value = this.evaluateExpression(argument.value);
      if (argument.name === undefined) positional.push(value);
      else {
        if (styleKeys.has(argument.name)) styleSeen = true;
        else if (styleSeen) this.fail(`几何参数 ${argument.name} 不能出现在样式参数之后`, argument);
        named.set(argument.name, value);
      }
    }
    const allowedGeometry = geometryKeys[call.name] ?? new Set<string>();
    for (const key of named.keys()) if (!styleKeys.has(key) && !allowedGeometry.has(key)) this.fail(`${call.name} 不接受参数 ${key}`, call);
    const styles = new Map([...named].filter(([key]) => styleKeys.has(key)));
    const geometry = new Map([...named].filter(([key]) => !styleKeys.has(key)));
    switch (call.name) {
      case "point": return this.point(positional, styles, call);
      case "along": return this.along(positional, styles, call);
      case "line": return this.line(positional, geometry, styles, call);
      case "circle": return this.circle(positional, styles, call);
      case "arc": return this.arc(positional, geometry, styles, call);
      case "path": return this.path(positional, geometry, styles, call);
      case "project": return this.project(positional, styles, call);
      case "intersect": return this.intersect(positional, geometry, styles, call);
      case "transform": return this.transform(positional, styles, call);
      case "mark": return this.mark(positional, styles, call);
      case "text": return this.text(positional, styles, call);
      case "inside": return this.inside(positional, styles, call);
      case "union": return this.regionCombination("union", positional, styles, call);
      case "intersection": return this.regionCombination("intersection", positional, styles, call);
      case "difference": return this.difference(positional, styles, call);
      default: return this.fail(`未知函数 ${call.name}`, call);
    }
  }

  private number(value: RuntimeValue, parameter: string): number {
    if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${parameter} 必须是有限 Number，实际是 ${typename(value)}`);
    return value;
  }
  private boolean(value: RuntimeValue, parameter: string): boolean {
    if (typeof value !== "boolean") throw new Error(`${parameter} 必须是 Boolean，实际是 ${typename(value)}`);
    return value;
  }
  private pointValue(value: RuntimeValue, parameter: string): PointValue {
    if (!value || Array.isArray(value) || typeof value !== "object" || value.type !== "Point") throw new Error(`${parameter} 必须是 Point，实际是 ${typename(value)}`);
    return value;
  }
  private regionValue(value: RuntimeValue, parameter: string): RegionValue {
    if (!value || Array.isArray(value) || typeof value !== "object" || value.type !== "Region")
      throw new Error(`${parameter} 必须是 Region，实际是 ${typename(value)}`);
    return value;
  }
  private string(value: RuntimeValue, parameter: string): string {
    if (typeof value !== "string") throw new Error(`${parameter} 必须是 String，实际是 ${typename(value)}`);
    return value;
  }
  private curve(value: RuntimeValue, parameter: string): LineValue | CircleValue | ArcValue | PathValue {
    if (!value || Array.isArray(value) || typeof value !== "object" || !["Line", "Circle", "Arc", "Path"].includes(value.type))
      throw new Error(`${parameter} 必须是 Line、Circle、Arc 或 Path，实际是 ${typename(value)}`);
    return value as LineValue | CircleValue | ArcValue | PathValue;
  }
  private enumValue<T extends string>(value: RuntimeValue, allowed: readonly T[], parameter: string): T {
    if (typeof value !== "string" || !allowed.includes(value as T)) throw new Error(`${parameter} 必须是 ${allowed.join("、")}`);
    return value as T;
  }
  private styled<T extends GeometryValue>(object: Omit<T, "objectId" | "created" | "style">, styles: Map<string, RuntimeValue>, inherited?: Record<string, unknown>): T {
    const type = object.type;
    const style = applyStyles(type, inherited ?? defaultStyle(type), styles);
    const result = { ...object, style, objectId: this.nextObjectId++, created: this.nextCreated++ } as T;
    this.objects.push(result);
    return result;
  }

  private point(pos: RuntimeValue[], styles: Map<string, RuntimeValue>, at: CallExpression): PointValue {
    let x: number, y: number;
    if (pos.length === 1) { const source = this.pointValue(pos[0]!, "source"); x = source.x; y = source.y; }
    else if (pos.length === 2) { x = this.number(pos[0]!, "x"); y = this.number(pos[1]!, "y"); }
    else return this.fail("point 需要 (x, y) 或 (Point) 参数", at);
    return this.styled<PointValue>({ type: "Point", x, y }, styles);
  }

  private text(pos: RuntimeValue[], styles: Map<string, RuntimeValue>, at: CallExpression): TextValue {
    if (pos.length === 3) {
      const x = this.number(pos[0]!, "x");
      const y = this.number(pos[1]!, "y");
      const content = this.string(pos[2]!, "content");
      return this.styled<TextValue>({
        type: "Text", content, position: { kind: "fixed", x, y },
      }, styles);
    }
    if (pos.length === 2 && this.isRegion(pos[0]!)) {
      const region = pos[0] as RegionValue;
      const content = this.string(pos[1]!, "content");
      return this.styled<TextValue>({
        type: "Text", content, position: { kind: "region", region },
      }, styles);
    }
    return this.fail("text 需要 (Number x, Number y, String content) 或 (Region, String content)", at);
  }

  private inside(pos: RuntimeValue[], styles: Map<string, RuntimeValue>, at: CallExpression): RegionValue {
    if (pos.length !== 1) return this.fail("inside 需要一个 Circle 或闭合 Path", at);
    const source = pos[0]!;
    if (this.isCircle(source)) {
      return this.styled<RegionValue>({
        type: "Region", expression: { kind: "inside", source },
      }, styles);
    }
    if (this.isPath(source)) {
      if (!source.closed) return this.fail("inside 的 Path 必须 closed=true", at);
      return this.styled<RegionValue>({
        type: "Region", expression: { kind: "inside", source },
      }, styles);
    }
    return this.fail(`inside 需要 Circle 或闭合 Path，实际是 ${typename(source)}`, at);
  }

  private regionCombination(
    kind: "union" | "intersection",
    pos: RuntimeValue[],
    styles: Map<string, RuntimeValue>,
    at: CallExpression,
  ): RegionValue {
    if (pos.length < 2) return this.fail(`${kind} 至少需要两个 Region`, at);
    const operands = pos.map((value, index) => this.regionValue(value, `region${index + 1}`));
    return this.styled<RegionValue>({
      type: "Region", expression: { kind, operands },
    }, styles);
  }

  private difference(pos: RuntimeValue[], styles: Map<string, RuntimeValue>, at: CallExpression): RegionValue {
    if (pos.length !== 2) return this.fail("difference 需要两个 Region", at);
    const left = this.regionValue(pos[0]!, "left");
    const right = this.regionValue(pos[1]!, "right");
    return this.styled<RegionValue>({
      type: "Region", expression: { kind: "difference", left, right },
    }, styles);
  }

  private along(pos: RuntimeValue[], styles: Map<string, RuntimeValue>, at: CallExpression): PointValue {
    if (pos.length !== 3) return this.fail("along 需要 (Point A, Point B, Number t)", at);
    const a = this.pointValue(pos[0]!, "A"), b = this.pointValue(pos[1]!, "B"), t = this.number(pos[2]!, "t");
    if (distance(a, b) <= epsilon([a, b])) return this.fail("along 的 A 与 B 重合", at);
    const p = add(a, mul(sub(b, a), t));
    return this.styled<PointValue>({ type: "Point", ...p }, styles);
  }

  private line(pos: RuntimeValue[], geom: Map<string, RuntimeValue>, styles: Map<string, RuntimeValue>, at: CallExpression): LineValue {
    let a: PointValue, b: PointValue, kind: LineKind;
    if (pos.length === 2 && this.isPoint(pos[0]!) && this.isPoint(pos[1]!)) {
      a = pos[0] as PointValue; b = pos[1] as PointValue;
      kind = this.enumValue(geom.get("kind") ?? "segment", ["segment", "ray", "infinite"], "kind");
      if (geom.has("angle") || geom.has("ratio")) return this.fail("两点 line 重载不接受 angle 或 ratio", at);
      const extend = this.number(geom.get("extend") ?? 0, "extend");
      if (extend < 0) return this.fail("extend 不能小于 0", at);
      if (kind !== "segment" && geom.has("extend")) return this.fail("extend 只适用于 segment", at);
      const size = distance(a, b);
      if (size <= epsilon([a, b])) return this.fail("line 的定向点重合", at);
      if (extend > 0) {
        const end = add(b, mul(normalize(sub(b, a)), extend));
        b = barePoint(end.x, end.y);
      }
    } else if (pos.length === 2 && this.isPoint(pos[0]!) && this.isLine(pos[1]!)) {
      a = pos[0] as PointValue;
      const reference = pos[1] as LineValue;
      kind = this.enumValue(geom.get("kind") ?? "infinite", ["ray", "infinite"], "kind");
      if (geom.has("ratio") || geom.has("extend")) return this.fail("方向 line 重载不接受 ratio 或 extend", at);
      const angle = this.number(geom.get("angle") ?? 0, "angle");
      const direction = rotate(normalize(sub(reference.b, reference.a)), deg(angle));
      b = barePoint(a.x + direction.x, a.y + direction.y);
    } else if (pos.length === 3 && pos.every(value => this.isPoint(value))) {
      a = pos[0] as PointValue;
      const edgeA = pos[1] as PointValue, edgeC = pos[2] as PointValue;
      if (!geom.has("ratio")) return this.fail("三点 line 重载必须提供 ratio", at);
      if (geom.has("angle") || geom.has("extend")) return this.fail("三点 line 重载不接受 angle 或 extend", at);
      const ratio = this.number(geom.get("ratio")!, "ratio");
      if (ratio < 0 || ratio > 1) return this.fail("ratio 必须位于 [0, 1]", at);
      kind = this.enumValue(geom.get("kind") ?? "ray", ["ray", "infinite"], "kind");
      const va = sub(edgeA, a), vc = sub(edgeC, a), eps = epsilon([a, edgeA, edgeC]);
      if (length(va) <= eps || length(vc) <= eps) return this.fail("角边退化", at);
      let delta = normalizeAngle(pointAngle(a, edgeC) - pointAngle(a, edgeA));
      if (delta > Math.PI) delta -= Math.PI * 2;
      if (Math.abs(Math.abs(delta) - Math.PI) * 180 / Math.PI <= angleEpsilon) return this.fail("角的两边反向，内插方向不唯一", at);
      const direction = rotate(normalize(va), delta * ratio);
      b = barePoint(a.x + direction.x, a.y + direction.y);
    } else return this.fail("line 参数不匹配任何重载", at);
    return this.styled<LineValue>({ type: "Line", a, b, kind }, styles);
  }

  private circle(pos: RuntimeValue[], styles: Map<string, RuntimeValue>, at: CallExpression): CircleValue {
    let center: PointValue, radius: number;
    if (pos.length === 2 && this.isPoint(pos[0]!) && typeof pos[1] === "number") {
      center = pos[0] as PointValue; radius = this.number(pos[1]!, "radius");
    } else if (pos.length === 2 && pos.every(value => this.isPoint(value))) {
      center = pos[0] as PointValue; radius = distance(center, pos[1] as PointValue);
    } else if (pos.length === 3 && pos.every(value => this.isPoint(value))) {
      ({ center, radius } = circumcircle(pos[0] as PointValue, pos[1] as PointValue, pos[2] as PointValue));
    } else return this.fail("circle 参数不匹配任何重载", at);
    if (radius <= epsilon([center], [radius])) return this.fail("圆半径太小或不为正", at);
    return this.styled<CircleValue>({ type: "Circle", center, radius }, styles);
  }

  private arc(pos: RuntimeValue[], geom: Map<string, RuntimeValue>, styles: Map<string, RuntimeValue>, at: CallExpression): ArcValue {
    if (pos.length !== 3 || !this.isCircle(pos[0]!)) return this.fail("arc 需要 (Circle, Point start, Point end)", at);
    const circle = pos[0] as CircleValue, startInput = this.pointValue(pos[1]!, "start"), endInput = this.pointValue(pos[2]!, "end");
    const eps = epsilon([circle.center, startInput, endInput], [circle.radius]);
    if (Math.abs(distance(circle.center, startInput) - circle.radius) > eps || Math.abs(distance(circle.center, endInput) - circle.radius) > eps)
      return this.fail("arc 的起点和终点必须位于圆上", at);
    const canonical = (p: PointValue): PointValue => {
      const v = add(circle.center, mul(normalize(sub(p, circle.center)), circle.radius));
      return barePoint(v.x, v.y);
    };
    const start = canonical(startInput), end = canonical(endInput);
    if (distance(start, end) <= eps) return this.fail("arc 起点和终点不能重合", at);
    const sweep = this.enumValue(geom.get("sweep") ?? "short", ["short", "long", "cw", "ccw"], "sweep") as Sweep;
    const diameter = Math.abs(degrees(angleBetween(sub(start, circle.center), sub(end, circle.center))) - 180) <= angleEpsilon;
    if (diameter && (sweep === "short" || sweep === "long")) return this.fail("半圆不能使用 short 或 long", at);
    return this.styled<ArcValue>({ type: "Arc", circle, start, end, sweep }, styles);
  }

  private path(pos: RuntimeValue[], geom: Map<string, RuntimeValue>, styles: Map<string, RuntimeValue>, at: CallExpression): PathValue {
    const points = pos.map((value, index) => this.pointValue(value, `p${index + 1}`));
    const closed = this.boolean(geom.get("closed") ?? false, "closed");
    const smooth = this.boolean(geom.get("smooth") ?? false, "smooth");
    if (points.length < (closed ? 3 : 2)) return this.fail(`${closed ? "闭合" : "开放"} path 控制点不足`, at);
    if (smooth && points.length < 3) return this.fail("平滑 path 至少需要三个控制点", at);
    const pairs = closed ? points.map((p, i) => [p, points[(i + 1) % points.length]!] as const) : points.slice(1).map((p, i) => [points[i]!, p] as const);
    if (pairs.some(([a, b]) => distance(a, b) <= epsilon(points))) return this.fail("path 存在相邻重合控制点", at);
    if (!closed && styles.has("fill") && styles.get("fill") !== null) return this.fail("开放 path 不能填充", at);
    return this.styled<PathValue>({ type: "Path", points, closed, smooth }, styles);
  }

  private project(pos: RuntimeValue[], styles: Map<string, RuntimeValue>, at: CallExpression): PointValue {
    if (pos.length !== 2) return this.fail("project 需要 (Point, target)", at);
    const result = projectPoint(this.pointValue(pos[0]!, "P"), this.curve(pos[1]!, "target"));
    return this.styled<PointValue>({ type: "Point", x: result.x, y: result.y }, styles);
  }

  private intersect(pos: RuntimeValue[], geom: Map<string, RuntimeValue>, styles: Map<string, RuntimeValue>, at: CallExpression): RuntimeValue {
    if (pos.length !== 2) return this.fail("intersect 需要两个几何对象", at);
    const first = this.curve(pos[0]!, "object1"), second = this.curve(pos[1]!, "object2");
    const results = intersections(first, second);
    if (geom.has("pick")) {
      const pick = this.number(geom.get("pick")!, "pick");
      if (!Number.isInteger(pick)) return this.fail("pick 必须是整数", at);
      if (pick < 0 || pick >= results.length) return this.fail(`pick=${pick} 越界；共有 ${results.length} 个交点`, at);
      const point = results[pick]!;
      return this.styled<PointValue>({ type: "Point", x: point.x, y: point.y }, styles);
    }
    return results.map(point => this.styled<PointValue>({ type: "Point", x: point.x, y: point.y }, styles));
  }

  private transform(pos: RuntimeValue[], styles: Map<string, RuntimeValue>, at: CallExpression): RuntimeValue {
    if (pos.length < 2) return this.fail("transform 缺少对象或变换模式", at);
    const source = pos[0]!;
    const mode = this.enumValue(pos[1]!, ["move", "rotate", "mirror", "scale"], "变换模式");
    const apply = (value: RuntimeValue): GeometryValue => {
      if (!value || Array.isArray(value) || typeof value !== "object"
        || value.type === "Mark" || value.type === "Text" || value.type === "Region") {
        throw new Error(`transform 不支持 ${typename(value)}`);
      }
      let mapPoint: (p: PointValue) => PointValue;
      let reflected = false, scaleFactor = 1;
      if (mode === "move") {
        if (pos.length !== 4) throw new Error("move 需要 dx, dy");
        const dx = this.number(pos[2]!, "dx"), dy = this.number(pos[3]!, "dy");
        mapPoint = p => barePoint(p.x + dx, p.y + dy);
      } else if (mode === "rotate") {
        if (pos.length !== 4) throw new Error("rotate 需要 center, angle");
        const center = this.pointValue(pos[2]!, "center"), angle = deg(this.number(pos[3]!, "angle"));
        mapPoint = p => { const q = add(center, rotate(sub(p, center), angle)); return barePoint(q.x, q.y); };
      } else if (mode === "scale") {
        if (pos.length !== 4) throw new Error("scale 需要 center, factor");
        const center = this.pointValue(pos[2]!, "center"); scaleFactor = this.number(pos[3]!, "factor");
        if (scaleFactor <= 0) throw new Error("factor 必须大于 0");
        mapPoint = p => { const q = add(center, mul(sub(p, center), scaleFactor)); return barePoint(q.x, q.y); };
      } else {
        if (pos.length !== 3 || !this.isLine(pos[2]!)) throw new Error("mirror 需要 Line axis");
        const axis = pos[2] as LineValue, direction = normalize(sub(axis.b, axis.a)); reflected = true;
        mapPoint = p => {
          const relative = sub(p, axis.a), projection = add(axis.a, mul(direction, relative.x * direction.x + relative.y * direction.y));
          const q = sub(mul(projection, 2), p); return barePoint(q.x, q.y);
        };
      }
      const inherited = { ...(value.style as unknown as Record<string, unknown>) };
      if (value.type === "Point") { const q = mapPoint(value); return this.styled<PointValue>({ type: "Point", x: q.x, y: q.y }, styles, inherited); }
      if (value.type === "Line") return this.styled<LineValue>({ type: "Line", a: mapPoint(value.a), b: mapPoint(value.b), kind: value.kind }, styles, inherited);
      if (value.type === "Circle") return this.styled<CircleValue>({ type: "Circle", center: mapPoint(value.center), radius: value.radius * scaleFactor }, styles, inherited);
      if (value.type === "Arc") {
        const center = mapPoint(value.circle.center);
        const circle: CircleValue = { ...value.circle, center, radius: value.circle.radius * scaleFactor, objectId: null, created: null };
        const swap: Record<Sweep, Sweep> = { cw: "ccw", ccw: "cw", short: "short", long: "long" };
        return this.styled<ArcValue>({ type: "Arc", circle, start: mapPoint(value.start), end: mapPoint(value.end), sweep: reflected ? swap[value.sweep] : value.sweep }, styles, inherited);
      }
      return this.styled<PathValue>({ type: "Path", points: value.points.map(mapPoint), closed: value.closed, smooth: value.smooth }, styles, inherited);
    };
    if (Array.isArray(source)) {
      if (!source.length || source.some(Array.isArray)) return this.fail("transform 列表必须非空且不能嵌套", at);
      // applyStyles in each element enforces that every explicit style is applicable.
      return source.map(apply);
    }
    return apply(source);
  }

  private mark(pos: RuntimeValue[], styles: Map<string, RuntimeValue>, at: CallExpression): MarkValue {
    if (!pos.length) return this.fail("mark 缺少标记种类", at);
    const kind = this.enumValue(pos[0]!, ["right", "equal", "equal_angle", "parallel"], "标记种类");
    const operands = pos.slice(1);
    if (kind === "right") {
      if (operands.length !== 3) return this.fail("right mark 需要 A, B, C", at);
      const [a, b, c] = operands.map((v, i) => this.pointValue(v, ["A", "B", "C"][i]!));
      if (Math.abs(degrees(geometryAngle(a!, b!, c!)) - 90) > angleEpsilon) return this.fail("∠ABC 不是直角", at);
    } else if (kind === "equal") {
      if (operands.length !== 2 || !operands.every(v => this.isLine(v) && (v as LineValue).kind === "segment")) return this.fail("equal mark 需要两个有限线段", at);
      const [a, b] = operands as LineValue[];
      if (Math.abs(distance(a!.a, a!.b) - distance(b!.a, b!.b)) > epsilon([a!.a, a!.b, b!.a, b!.b])) return this.fail("两个线段不等长", at);
    } else if (kind === "parallel") {
      if (operands.length !== 2 || !operands.every(v => this.isLine(v))) return this.fail("parallel mark 需要两个 Line", at);
      const [a, b] = operands as LineValue[];
      const angle = degrees(angleBetween(sub(a!.b, a!.a), sub(b!.b, b!.a)));
      if (Math.min(angle, 180 - angle) > angleEpsilon) return this.fail("两条线不平行", at);
    } else {
      if (operands.length !== 6) return this.fail("equal_angle mark 需要六个 Point", at);
      const p = operands.map((v, i) => this.pointValue(v, `point${i + 1}`));
      const a1 = degrees(geometryAngle(p[0]!, p[1]!, p[2]!)), a2 = degrees(geometryAngle(p[3]!, p[4]!, p[5]!));
      if (Math.abs(a1 - a2) > angleEpsilon) return this.fail("两个角不相等", at);
    }
    return this.styled<MarkValue>({ type: "Mark", kind, operands: operands as GeometryValue[] }, styles);
  }

  private isPoint(value: RuntimeValue): value is PointValue { return !!value && !Array.isArray(value) && typeof value === "object" && value.type === "Point"; }
  private isLine(value: RuntimeValue): value is LineValue { return !!value && !Array.isArray(value) && typeof value === "object" && value.type === "Line"; }
  private isCircle(value: RuntimeValue): value is CircleValue { return !!value && !Array.isArray(value) && typeof value === "object" && value.type === "Circle"; }
  private isPath(value: RuntimeValue): value is PathValue { return !!value && !Array.isArray(value) && typeof value === "object" && value.type === "Path"; }
  private isRegion(value: RuntimeValue): value is RegionValue { return !!value && !Array.isArray(value) && typeof value === "object" && value.type === "Region"; }
}
