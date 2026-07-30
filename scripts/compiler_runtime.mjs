import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryCompiler = path.resolve(scriptDirectory, "../dist/index.js");
const repositorySource = path.resolve(scriptDirectory, "../src/index.ts");

export async function loadCompiler() {
  const candidates = [];
  if (process.env.GEOMETRY_DSL_MODULE) {
    candidates.push(pathToFileURL(path.resolve(process.env.GEOMETRY_DSL_MODULE)).href);
  }
  try {
    await access(repositoryCompiler);
    candidates.push(pathToFileURL(repositoryCompiler).href);
  } catch {
    // Fall through to the TypeScript source or an installed package.
  }
  try {
    await access(repositorySource);
    // Node.js >= 22.18 imports TypeScript directly (type stripping).
    candidates.push(pathToFileURL(repositorySource).href);
  } catch {
    // Fall through to an installed package.
  }
  candidates.push("@geometry-dsl/renderer");

  const failures = [];
  for (const candidate of candidates) {
    try {
      const module = await import(candidate);
      if (typeof module.evaluate === "function" && typeof module.compileToSvg === "function") {
        return module;
      }
      failures.push(`${candidate}: missing evaluate/compileToSvg exports`);
    } catch (error) {
      failures.push(`${candidate}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(
    "Cannot load the Geometry DSL compiler. Use Node.js >= 22.18 (runs src/ directly), " +
    "build the repository with `npm run build`, install @geometry-dsl/renderer, or set GEOMETRY_DSL_MODULE.\n" +
    failures.join("\n"),
  );
}

export async function readInput(inputPath) {
  if (inputPath === "-") {
    let text = "";
    for await (const chunk of process.stdin) text += chunk;
    return { text, displayPath: "<stdin>" };
  }
  return { text: await readFile(inputPath, "utf8"), displayPath: path.resolve(inputPath) };
}

export function extractGeometryBlocks(text) {
  const blocks = [];
  const pattern = /^```(?:geometry|geometry-dsl|geom)(?:[ \t]+[^\r\n]*)?[ \t]*\r?\n(.*?)^```[ \t]*\r?$/gms;
  let match;
  while ((match = pattern.exec(text))) {
    const startLine = text.slice(0, match.index).split("\n").length + 1;
    blocks.push({ source: match[1], startLine });
  }
  return blocks;
}

export function selectSources(text, blockNumber) {
  const blocks = extractGeometryBlocks(text);
  if (!blocks.length) return [{ source: text, startLine: 1, blockNumber: null }];
  if (blockNumber !== undefined) {
    if (!Number.isInteger(blockNumber) || blockNumber < 1 || blockNumber > blocks.length) {
      throw new Error(`--block must be between 1 and ${blocks.length}`);
    }
    return [{ ...blocks[blockNumber - 1], blockNumber }];
  }
  return blocks.map((block, index) => ({ ...block, blockNumber: index + 1 }));
}

export function parsePositiveInteger(value, option) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw new Error(`${option} must be a positive integer`);
  return number;
}

export function parseFiniteNumber(value, option) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${option} must be a finite number`);
  return number;
}

export function compilerErrorMessage(error, context) {
  const reason = error instanceof Error ? error.message : String(error);
  const code = error && typeof error === "object" && "code" in error ? `${error.code}: ` : "";
  return `${context}: ${code}${reason}`;
}
