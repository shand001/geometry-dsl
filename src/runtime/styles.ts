import {
  type CommonStyle, type GeometryValue, type MarkStyle, type RuntimeValue,
} from "../types.ts";

export const namedColors: Record<string, string> = {
  black: "#000000", white: "#ffffff", gray: "#808080", red: "#ff0000",
  orange: "#ffa500", yellow: "#ffff00", green: "#008000", cyan: "#00ffff",
  blue: "#0000ff", purple: "#800080",
};

export const styleKeys = new Set([
  "visible", "color", "width", "dashed", "opacity", "layer", "fill", "fill_rule",
  "size", "shape", "label", "label_pos", "arrow",
]);

const common: CommonStyle = { visible: true, color: "#000000", opacity: 1, layer: 0 };
const stroke = { ...common, width: 1, dashed: false };

export function defaultStyle(type: GeometryValue["type"]): Record<string, unknown> {
  if (type === "Point") return { ...common, size: 4, shape: "dot", label: "auto", label_pos: "auto" };
  if (type === "Line") return { ...stroke, arrow: null };
  if (type === "Circle") return { ...stroke, fill: null };
  if (type === "Arc") return { ...stroke };
  if (type === "Path") return { ...stroke, fill: null, fill_rule: "evenodd" };
  if (type === "Text") return { ...common, size: null };
  if (type === "Region") {
    return { visible: true, fill: null, opacity: 1, layer: 0 };
  }
  return { ...stroke, size: 4 } satisfies MarkStyle;
}

const applicable: Record<GeometryValue["type"], Set<string>> = {
  Point: new Set(["visible", "color", "opacity", "layer", "size", "shape", "label", "label_pos"]),
  Line: new Set(["visible", "color", "width", "dashed", "opacity", "layer", "arrow"]),
  Circle: new Set(["visible", "color", "width", "dashed", "opacity", "layer", "fill"]),
  Arc: new Set(["visible", "color", "width", "dashed", "opacity", "layer"]),
  Path: new Set(["visible", "color", "width", "dashed", "opacity", "layer", "fill", "fill_rule"]),
  Mark: new Set(["visible", "color", "width", "dashed", "opacity", "layer", "size"]),
  Text: new Set(["visible", "color", "opacity", "layer", "size"]),
  Region: new Set(["visible", "fill", "opacity", "layer"]),
};

export function normalizeColor(value: RuntimeValue, key: string): string | null {
  if (value === null && key === "fill") return null;
  if (typeof value !== "string") throw new Error(`${key} 必须是颜色${key === "fill" ? "或 none" : ""}`);
  if (namedColors[value]) return namedColors[value]!;
  if (/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value)) {
    let hex = value.toLowerCase();
    if (hex.length === 4 || hex.length === 5) hex = "#" + [...hex.slice(1)].map(c => c + c).join("");
    return hex;
  }
  throw new Error(`${key} 不是合法的 Geometry DSL 颜色`);
}

const enumValues: Record<string, Set<unknown>> = {
  shape: new Set(["dot", "circle", "square", "cross"]),
  label_pos: new Set(["auto", "above", "below", "left", "right", "above_left",
    "above_right", "below_left", "below_right"]),
  arrow: new Set([null, "start", "end", "both"]),
  fill_rule: new Set(["evenodd", "nonzero"]),
};

export function applyStyles(
  type: GeometryValue["type"],
  base: Record<string, unknown>,
  overrides: ReadonlyMap<string, RuntimeValue>,
): Record<string, unknown> {
  const result = { ...base };
  for (const [key, value] of overrides) {
    if (!styleKeys.has(key)) throw new Error(`未知样式参数 ${key}`);
    if (!applicable[type].has(key)) throw new Error(`样式参数 ${key} 不适用于 ${type}`);
    if (key === "color" || key === "fill") { result[key] = normalizeColor(value, key); continue; }
    if (key === "visible" || key === "dashed") {
      if (typeof value !== "boolean") throw new Error(`${key} 必须是 Boolean`);
    } else if (key === "width" || key === "size") {
      if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) throw new Error(`${key} 必须是大于 0 的 Number`);
    } else if (key === "opacity") {
      if (typeof value !== "number" || value < 0 || value > 1) throw new Error("opacity 必须位于 [0, 1]");
    } else if (key === "layer") {
      if (typeof value !== "number" || !Number.isInteger(value)) throw new Error("layer 必须是整数");
    } else if (key === "label") {
      if (!(value === null || value === "auto" || typeof value === "string")) throw new Error("label 必须是 auto、none 或 String");
    } else if (!enumValues[key]?.has(value)) throw new Error(`${key} 使用了非法枚举值`);
    result[key] = value;
  }
  return result;
}
