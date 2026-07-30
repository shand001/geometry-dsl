import { tokenize } from "./lexer.ts";
import {
  GeometryDslError, type CallArgument, type CallExpression, type Expression,
  type Program, type Statement, type Token, type TokenKind,
} from "../types.ts";

const functions = new Set(["point", "along", "line", "circle", "arc", "path",
  "project", "intersect", "transform", "mark", "text", "inside", "union",
  "intersection", "difference"]);
const colors = new Set(["black", "white", "gray", "red", "orange", "yellow",
  "green", "cyan", "blue", "purple"]);
const enums = new Set(["segment", "ray", "infinite", "short", "long", "cw", "ccw",
  "move", "rotate", "mirror", "scale", "right", "equal", "equal_angle", "parallel",
  "evenodd", "nonzero", "dot", "circle", "square", "cross", "auto", "above", "below",
  "left", "above_left", "above_right", "below_left", "below_right", "start", "end", "both"]);
const reserved = new Set(["true", "false", "none", ...functions, ...colors, ...enums]);
const attributes = new Set(["x", "y", "kind", "center", "radius", "circle", "start",
  "end", "sweep", "points", "closed", "smooth"]);

class Parser {
  private readonly tokens: Token[];
  private position = 0;

  constructor(source: string) { this.tokens = tokenize(source); }
  private get current(): Token { return this.tokens[this.position]!; }
  private advance(): Token { return this.tokens[this.position++]!; }
  private accept(kind: TokenKind): Token | undefined {
    return this.current.kind === kind ? this.advance() : undefined;
  }
  private expect(kind: TokenKind, message: string): Token {
    if (this.current.kind !== kind) this.fail(message);
    return this.advance();
  }
  private fail(message: string, token = this.current): never {
    throw new GeometryDslError("E_PARSE", message, token);
  }

  parse(): Program {
    const statements: Statement[] = [];
    while (this.current.kind !== "eof") {
      if (this.accept("newline")) continue;
      statements.push(this.statement());
      this.expect("newline", "一条语句必须占一个逻辑行");
    }
    return { statements };
  }

  private statement(): Statement {
    if (this.current.kind === "identifier" && this.current.value === "mark") {
      const call = this.primary();
      if (call.type !== "call") this.fail("mark 必须是函数调用");
      return { type: "mark", value: call, line: call.line, column: call.column };
    }
    const start = this.current;
    const targets: string[] = [];
    do {
      const target = this.expect("identifier", "赋值左侧必须是名称");
      const name = String(target.value);
      if (name !== "_" && reserved.has(name)) this.fail(`保留字 ${name} 不能作为名称`, target);
      targets.push(name);
    } while (this.accept(","));
    this.expect("=", "赋值语句缺少 =");
    return { type: "assignment", targets, value: this.expression(), line: start.line, column: start.column };
  }

  private expression(): Expression { return this.additive(); }
  private additive(): Expression {
    let left = this.multiplicative();
    while (this.current.kind === "+" || this.current.kind === "-") {
      const operator = this.advance().kind as "+" | "-";
      left = { type: "binary", operator, left, right: this.multiplicative(), line: left.line, column: left.column };
    }
    return left;
  }
  private multiplicative(): Expression {
    let left = this.unary();
    while (this.current.kind === "*" || this.current.kind === "/") {
      const operator = this.advance().kind as "*" | "/";
      left = { type: "binary", operator, left, right: this.unary(), line: left.line, column: left.column };
    }
    return left;
  }
  private unary(): Expression {
    if (this.current.kind === "+" || this.current.kind === "-") {
      const token = this.advance();
      return { type: "unary", operator: token.kind as "+" | "-", operand: this.unary(), line: token.line, column: token.column };
    }
    return this.postfix();
  }
  private postfix(): Expression {
    let base = this.primary();
    while (this.accept(".")) {
      const token = this.expect("identifier", "属性名缺失");
      const name = String(token.value);
      if (!attributes.has(name)) this.fail(`未知属性 ${name}`, token);
      base = { type: "attribute", base, name, line: base.line, column: base.column };
    }
    return base;
  }

  private primary(): Expression {
    const token = this.current;
    if (this.accept("number")) return { ...token, type: "literal", value: token.value, literalKind: "number" };
    if (this.accept("string")) return { ...token, type: "literal", value: token.value, literalKind: "string" };
    if (this.accept("identifier")) {
      const name = String(token.value);
      if (functions.has(name) && this.current.kind === "(") return this.call(token, name);
      if (name === "true" || name === "false") return { ...token, type: "literal", value: name === "true", literalKind: "boolean" };
      if (name === "none") return { ...token, type: "literal", value: null, literalKind: "none" };
      if (colors.has(name)) return { ...token, type: "literal", value: name, literalKind: "color" };
      if (enums.has(name)) return { ...token, type: "literal", value: name, literalKind: "enum" };
      return { type: "name", name, line: token.line, column: token.column };
    }
    if (this.accept("(")) {
      const value = this.expression();
      this.expect(")", "缺少右括号");
      return value;
    }
    if (this.accept("[")) {
      const items: Expression[] = [];
      if (this.current.kind !== "]") {
        do {
          if ((this.current.kind as TokenKind) === "]") break;
          items.push(this.expression());
        } while (this.accept(","));
      }
      this.expect("]", "列表缺少 ]");
      return { type: "list", items, line: token.line, column: token.column };
    }
    return this.fail("此处需要表达式");
  }

  private call(token: Token, name: string): CallExpression {
    this.expect("(", "函数调用缺少 (");
    const args: CallArgument[] = [];
    const names = new Set<string>();
    let namedSeen = false;
    if (this.current.kind !== ")") {
      do {
        if ((this.current.kind as TokenKind) === ")") break;
        if (this.current.kind === "identifier" && this.tokens[this.position + 1]?.kind === "=") {
          const key = this.advance();
          this.advance();
          const keyName = String(key.value);
          if (names.has(keyName)) this.fail(`参数 ${keyName} 重复`, key);
          names.add(keyName); namedSeen = true;
          args.push({ name: keyName, value: this.expression(), line: key.line, column: key.column });
        } else {
          if (namedSeen) this.fail("命名参数之后不能出现位置参数");
          const value = this.expression();
          args.push({ value, line: value.line, column: value.column });
        }
      } while (this.accept(","));
    }
    this.expect(")", `${name} 调用缺少 )`);
    return { type: "call", name, arguments: args, line: token.line, column: token.column };
  }
}

export function parse(source: string): Program { return new Parser(source).parse(); }
