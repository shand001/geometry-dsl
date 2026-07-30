#!/usr/bin/env node

import { compilerErrorMessage, loadCompiler, parsePositiveInteger, readInput, selectSources } from "./compiler_runtime.mjs";

function usage(exitCode = 0) {
  const stream = exitCode ? process.stderr : process.stdout;
  stream.write(
    "Usage: validate_geometry.mjs <file.geom|file.md|-> [--block N] [--quiet]\n" +
    "Validates raw source or every Geometry DSL fence in Markdown using the official evaluator.\n",
  );
  process.exit(exitCode);
}

const args = process.argv.slice(2);
if (!args.length || args.includes("--help") || args.includes("-h")) usage(args.length ? 0 : 2);

let inputPath;
let blockNumber;
let quiet = false;
for (let index = 0; index < args.length; index += 1) {
  const argument = args[index];
  if (argument === "--block") blockNumber = parsePositiveInteger(args[++index], "--block");
  else if (argument === "--quiet") quiet = true;
  else if (argument.startsWith("-") && argument !== "-") usage(2);
  else if (inputPath === undefined) inputPath = argument;
  else usage(2);
}
if (inputPath === undefined) usage(2);

try {
  const [{ compileToSvg }, input] = await Promise.all([loadCompiler(), readInput(inputPath)]);
  const sources = selectSources(input.text, blockNumber);
  let failures = 0;
  for (const item of sources) {
    const context = item.blockNumber
      ? `${input.displayPath}:geometry-block-${item.blockNumber} (starts line ${item.startLine})`
      : input.displayPath;
    try {
      compileToSvg(item.source);
      if (!quiet) process.stdout.write(`OK: ${context}\n`);
    } catch (error) {
      failures += 1;
      process.stderr.write(`${compilerErrorMessage(error, context)}\n`);
    }
  }
  if (failures) process.exit(1);
  if (!quiet && sources.length > 1) process.stdout.write(`Validated ${sources.length} geometry blocks.\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(2);
}
