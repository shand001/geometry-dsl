#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { compileToSvg, GeometryDslError } from "./index.ts";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    output: { type: "string", short: "o" },
    width: { type: "string" },
    height: { type: "string" },
    background: { type: "string" },
    help: { type: "boolean", short: "h" },
  },
});

if (values.help || positionals.length !== 1) {
  console.log(`Usage: geometry-dsl <input.geom> [-o output.svg] [--width N] [--height N] [--background COLOR]

Reads Geometry DSL V0.4 and writes SVG. Without -o, SVG is written to stdout.
Width and height are auto-sized from the geometry when omitted.`);
  process.exit(values.help ? 0 : 2);
}

try {
  const source = await readFile(positionals[0]!, "utf8");
  const svg = compileToSvg(source, {
    width: values.width ? Number(values.width) : undefined,
    height: values.height ? Number(values.height) : undefined,
    background: values.background,
  });
  if (values.output) await writeFile(values.output, svg, "utf8");
  else process.stdout.write(svg + "\n");
} catch (error) {
  if (error instanceof GeometryDslError) {
    console.error(`${error.code}: ${error.message}`);
    process.exit(1);
  }
  throw error;
}
