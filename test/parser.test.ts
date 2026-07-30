import test from "node:test";
import assert from "node:assert/strict";
import { GeometryDslError, parse, tokenize } from "../src/index.ts";

test("lexer handles BOM, comments, multiline calls and escapes", () => {
  const tokens = tokenize("\ufeffA = point(\n  1e2, -3.5 # comment\n)\nlabel = \"a#b\\n\"\n");
  assert.ok(tokens.some(t => t.kind === "number" && t.value === 100));
  assert.ok(tokens.some(t => t.kind === "string" && t.value === "a#b\n"));
  assert.equal(parse("A = point(\n0,\n1,\n)\n").statements.length, 1);
});

test("parser enforces logical lines and positional-before-named", () => {
  assert.throws(() => parse("A = point(0, color=red, 1)\n"), /命名参数之后/);
  assert.throws(() => parse("A = point(0, 0) B = point(1, 1)\n"), /逻辑行/);
  assert.throws(() => parse("point = point(0, 0)\n"), /保留字/);
});

test("syntax diagnostics carry source position", () => {
  assert.throws(
    () => parse("\nA = point(0, 'x')\n"),
    (error: unknown) => error instanceof GeometryDslError && error.location?.line === 2,
  );
});
