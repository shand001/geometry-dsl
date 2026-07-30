import { parse } from "./language/parser.ts";
import { Evaluator } from "./runtime/evaluator.ts";
import { renderSvg } from "./render/svg.ts";
import type { Program, RenderOptions, Scene } from "./types.ts";

export * from "./types.ts";
export { tokenize } from "./language/lexer.ts";
export { parse } from "./language/parser.ts";
export { Evaluator } from "./runtime/evaluator.ts";
export { renderSvg } from "./render/svg.ts";

export function evaluate(sourceOrProgram: string | Program): Scene {
  return new Evaluator().evaluate(typeof sourceOrProgram === "string" ? parse(sourceOrProgram) : sourceOrProgram);
}

export function compileToSvg(source: string, options?: RenderOptions): string {
  return renderSvg(evaluate(source), options);
}
