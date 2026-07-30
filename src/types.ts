export type SourceLocation = Readonly<{ line: number; column: number }>;

export class GeometryDslError extends Error {
  readonly code: string;
  readonly location?: SourceLocation;

  constructor(code: string, message: string, location?: SourceLocation) {
    super(`${location ? `${location.line}:${location.column}: ` : ""}${message}`);
    this.name = "GeometryDslError";
    this.code = code;
    this.location = location;
  }
}

export type TokenKind =
  | "number" | "string" | "identifier" | "newline" | "eof"
  | "(" | ")" | "[" | "]" | "," | "=" | "." | "+" | "-" | "*" | "/";

export type Token = SourceLocation & Readonly<{
  kind: TokenKind;
  value?: string | number;
}>;

export type Expression =
  | (SourceLocation & { type: "literal"; value: unknown; literalKind: string })
  | (SourceLocation & { type: "name"; name: string })
  | (SourceLocation & { type: "list"; items: Expression[] })
  | (SourceLocation & { type: "unary"; operator: "+" | "-"; operand: Expression })
  | (SourceLocation & { type: "binary"; operator: "+" | "-" | "*" | "/"; left: Expression; right: Expression })
  | (SourceLocation & { type: "attribute"; base: Expression; name: string })
  | CallExpression;

export type CallArgument = SourceLocation & Readonly<{
  name?: string;
  value: Expression;
}>;

export type CallExpression = SourceLocation & Readonly<{
  type: "call";
  name: string;
  arguments: CallArgument[];
}>;

export type Statement =
  | (SourceLocation & { type: "assignment"; targets: string[]; value: Expression })
  | (SourceLocation & { type: "mark"; value: CallExpression });

export type Program = Readonly<{ statements: Statement[] }>;

export type Color = string;
export type LineKind = "segment" | "ray" | "infinite";
export type Sweep = "short" | "long" | "cw" | "ccw";

export type CommonStyle = {
  visible: boolean;
  color: Color;
  opacity: number;
  layer: number;
};

export type StrokeStyle = CommonStyle & {
  width: number;
  dashed: boolean;
};

export type PointStyle = CommonStyle & {
  size: number;
  shape: "dot" | "circle" | "square" | "cross";
  label: "auto" | string | null;
  label_pos: "auto" | "above" | "below" | "left" | "right"
    | "above_left" | "above_right" | "below_left" | "below_right";
};

export type LineStyle = StrokeStyle & { arrow: "start" | "end" | "both" | null };
export type CircleStyle = StrokeStyle & { fill: Color | null };
export type PathStyle = CircleStyle & { fill_rule: "evenodd" | "nonzero" };
export type MarkStyle = StrokeStyle & { size: number };
export type TextStyle = {
  visible: boolean;
  color: Color;
  opacity: number;
  layer: number;
  size: number | null;
};
export type RegionStyle = {
  visible: boolean;
  fill: Color | null;
  opacity: number;
  layer: number;
};

type ValueBase = { objectId: number | null; created: number | null };

export type PointValue = ValueBase & {
  type: "Point"; x: number; y: number; style?: PointStyle; labelName?: string;
};
export type LineValue = ValueBase & {
  type: "Line"; a: PointValue; b: PointValue; kind: LineKind; style: LineStyle;
};
export type CircleValue = ValueBase & {
  type: "Circle"; center: PointValue; radius: number; style: CircleStyle;
};
export type ArcValue = ValueBase & {
  type: "Arc"; circle: CircleValue; start: PointValue; end: PointValue;
  sweep: Sweep; style: StrokeStyle;
};
export type PathValue = ValueBase & {
  type: "Path"; points: PointValue[]; closed: boolean; smooth: boolean; style: PathStyle;
};
export type RegionExpression =
  | { kind: "inside"; source: CircleValue | PathValue }
  | { kind: "union" | "intersection"; operands: RegionValue[] }
  | { kind: "difference"; left: RegionValue; right: RegionValue };
export type RegionValue = ValueBase & {
  type: "Region"; expression: RegionExpression; style: RegionStyle;
};
export type TextPosition =
  | { kind: "fixed"; x: number; y: number }
  | { kind: "region"; region: RegionValue };
export type TextValue = ValueBase & {
  type: "Text"; content: string; position: TextPosition; style: TextStyle;
};
export type MarkValue = ValueBase & {
  type: "Mark"; kind: "right" | "equal" | "equal_angle" | "parallel";
  operands: GeometryValue[]; style: MarkStyle;
};
export type GeometryValue =
  | PointValue | LineValue | CircleValue | ArcValue | PathValue | MarkValue
  | TextValue | RegionValue;
export type PrimitiveValue = number | boolean | string | null;
export type RuntimeValue = PrimitiveValue | GeometryValue | RuntimeValue[];

export type Scene = {
  readonly values: ReadonlyMap<string, RuntimeValue>;
  readonly objects: readonly GeometryValue[];
};

export type RenderOptions = {
  width?: number;
  height?: number;
  padding?: number;
  background?: string | null;
  precision?: number;
  labelSize?: number;
  viewBox?: { minX: number; minY: number; width: number; height: number };
};
