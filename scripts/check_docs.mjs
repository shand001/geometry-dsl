#!/usr/bin/env node

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compilerErrorMessage, extractGeometryBlocks, loadCompiler } from "./compiler_runtime.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const skillDirectory = path.resolve(scriptDirectory, "..");
const referenceDirectory = path.join(skillDirectory, "references");

const referenceFiles = (await readdir(referenceDirectory))
  .filter((name) => name.endsWith(".md"))
  .map((name) => path.join(referenceDirectory, name));
const files = [path.join(skillDirectory, "SKILL.md"), ...referenceFiles];
const { evaluate } = await loadCompiler();

let blockCount = 0;
let failures = 0;
for (const file of files) {
  const text = await readFile(file, "utf8");
  const blocks = extractGeometryBlocks(text);
  for (let index = 0; index < blocks.length; index += 1) {
    blockCount += 1;
    const context = `${file}:geometry-block-${index + 1} (starts line ${blocks[index].startLine})`;
    try {
      evaluate(blocks[index].source);
      process.stdout.write(`OK: ${context}\n`);
    } catch (error) {
      failures += 1;
      process.stderr.write(`${compilerErrorMessage(error, context)}\n`);
    }
  }
}

if (!blockCount) {
  process.stderr.write("No geometry examples found.\n");
  process.exit(1);
}
if (failures) process.exit(1);
process.stdout.write(`Validated ${blockCount} documentation examples.\n`);
