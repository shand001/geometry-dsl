import { GeometryDslError, type Token } from "../types.ts";

const punctuation = new Set(["(", ")", "[", "]", ",", "=", ".", "+", "-", "*", "/"]);

export function tokenize(input: string): Token[] {
  const source = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const result: Token[] = [];
  let i = 0, line = 1, column = 1, nesting = 0;
  const fail = (message: string, atLine = line, atColumn = column): never => {
    throw new GeometryDslError("E_LEX", message, { line: atLine, column: atColumn });
  };
  const isDigit = (value: string | undefined): boolean =>
    value !== undefined && value >= "0" && value <= "9";
  while (i < source.length) {
    const ch = source[i]!;
    if (ch === " " || ch === "\t") { i++; column++; continue; }
    if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && source[i + 1] === "\n") i++;
      if (nesting === 0) result.push({ kind: "newline", line, column });
      i++; line++; column = 1; continue;
    }
    if (ch === "#") {
      while (i < source.length && source[i] !== "\r" && source[i] !== "\n") { i++; column++; }
      continue;
    }
    if (ch === '"') {
      const startLine = line, startColumn = column;
      let value = ""; i++; column++;
      while (i < source.length && source[i] !== '"') {
        const c = source[i]!;
        if (c === "\r" || c === "\n") fail("字符串不能跨物理行", startLine, startColumn);
        if (c === "\\") {
          const esc = source[i + 1];
          const replacements: Record<string, string> = { '"': '"', "\\": "\\", n: "\n", t: "\t" };
          const replacement = esc === undefined ? undefined : replacements[esc];
          if (replacement === undefined) fail(`不支持的字符串转义 \\\\${esc ?? ""}`);
          value += replacement; i += 2; column += 2;
        } else { value += c; i++; column++; }
      }
      if (i >= source.length) fail("字符串未闭合", startLine, startColumn);
      i++; column++;
      result.push({ kind: "string", value, line: startLine, column: startColumn });
      continue;
    }
    if (ch >= "0" && ch <= "9") {
      const start = i, startColumn = column;
      while (isDigit(source[i])) i++;
      if (source[i] === ".") {
        i++;
        if (!isDigit(source[i])) fail("小数点后必须有数字", line, startColumn);
        while (isDigit(source[i])) i++;
      }
      if (source[i] === "e" || source[i] === "E") {
        i++;
        if (source[i] === "+" || source[i] === "-") i++;
        const exponentStart = i;
        while (isDigit(source[i])) i++;
        if (i === exponentStart) fail("指数部分缺少数字", line, startColumn);
      }
      const raw = source.slice(start, i);
      const value = Number(raw);
      if (!Number.isFinite(value)) fail(`数字 ${raw} 超出有限 Number 范围`, line, startColumn);
      result.push({ kind: "number", value, line, column: startColumn });
      column += i - start;
      continue;
    }
    if ((/[A-Za-z_]/).test(ch)) {
      const start = i, startColumn = column;
      i++;
      while (i < source.length && (/[A-Za-z0-9_]/).test(source[i]!)) i++;
      const value = source.slice(start, i);
      result.push({ kind: "identifier", value, line, column: startColumn });
      column += i - start;
      continue;
    }
    if (punctuation.has(ch)) {
      result.push({ kind: ch as Token["kind"], value: ch, line, column });
      if (ch === "(" || ch === "[") nesting++;
      if (ch === ")" || ch === "]") {
        nesting--;
        if (nesting < 0) fail(`多余的 ${ch}`);
      }
      i++; column++; continue;
    }
    fail(`非法字符 ${JSON.stringify(ch)}`);
  }
  if (nesting !== 0) fail("括号或列表未闭合");
  if (result.at(-1)?.kind !== "newline") result.push({ kind: "newline", line, column });
  result.push({ kind: "eof", line, column });
  return result;
}
