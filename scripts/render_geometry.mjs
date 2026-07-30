#!/usr/bin/env node

import { access, copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import {
  compilerErrorMessage,
  loadCompiler,
  parseFiniteNumber,
  parsePositiveInteger,
  readInput,
  selectSources,
} from "./compiler_runtime.mjs";

function usage(exitCode = 0) {
  const stream = exitCode ? process.stderr : process.stdout;
  stream.write(
    "Usage: render_geometry.mjs <file.geom|file.md|-> [options]\n" +
    "  --out FILE.png       PNG output path\n" +
    "  --svg FILE.svg       SVG output path (defaults beside PNG)\n" +
    "  --block N            Geometry block in Markdown (required when there are several)\n" +
    "  --width N            SVG width (default: auto-fit to geometry)\n" +
    "  --height N           SVG height (default: auto-fit to geometry)\n" +
    "  --padding N          SVG padding (default 48)\n" +
    "  --label-size N       Label size (default 28)\n" +
    "  --background COLOR   Background color (default white; use none for transparent)\n" +
    "  --scale N            PNG raster scale factor (default 2)\n" +
    "  --svg-only           Skip PNG conversion\n",
  );
  process.exit(exitCode);
}

const args = process.argv.slice(2);
if (!args.length || args.includes("--help") || args.includes("-h")) usage(args.length ? 0 : 2);

let inputPath;
let pngPath;
let svgPath;
let blockNumber;
let svgOnly = false;
let width;
let height;
let padding = 48;
let labelSize = 28;
let background = "white";
let scale = 2;

for (let index = 0; index < args.length; index += 1) {
  const argument = args[index];
  if (argument === "--out") pngPath = args[++index];
  else if (argument === "--svg") svgPath = args[++index];
  else if (argument === "--block") blockNumber = parsePositiveInteger(args[++index], "--block");
  else if (argument === "--width") width = parsePositiveInteger(args[++index], "--width");
  else if (argument === "--height") height = parsePositiveInteger(args[++index], "--height");
  else if (argument === "--padding") padding = parseFiniteNumber(args[++index], "--padding");
  else if (argument === "--label-size") labelSize = parseFiniteNumber(args[++index], "--label-size");
  else if (argument === "--background") background = args[++index];
  else if (argument === "--scale") scale = parseFiniteNumber(args[++index], "--scale");
  else if (argument === "--svg-only") svgOnly = true;
  else if (argument.startsWith("-") && argument !== "-") usage(2);
  else if (inputPath === undefined) inputPath = argument;
  else usage(2);
}
if (inputPath === undefined) usage(2);

function defaultStem() {
  if (inputPath === "-") return path.resolve("geometry-render");
  const resolved = path.resolve(inputPath);
  const extension = path.extname(resolved);
  const base = extension ? resolved.slice(0, -extension.length) : resolved;
  return base + (blockNumber ? `.block-${blockNumber}` : "");
}

const stem = defaultStem();
pngPath = path.resolve(pngPath ?? `${stem}.png`);
const pngExtension = path.extname(pngPath);
const pngStem = pngExtension ? pngPath.slice(0, -pngExtension.length) : pngPath;
svgPath = path.resolve(svgPath ?? `${pngStem}.svg`);

function commandPath(name) {
  const result = spawnSync("/usr/bin/env", ["which", name], { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : null;
}

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { encoding: "utf8" });
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || `exit ${result.status}`).trim();
    throw new Error(`${path.basename(command)} failed: ${detail}`);
  }
}

async function rasterize(svgFile, pngFile, size, svgText, scale) {
  try {
    const { Resvg } = await import("@resvg/resvg-js");
    const resvg = new Resvg(svgText, { background: null, fitTo: { mode: "zoom", value: scale } });
    await writeFile(pngFile, resvg.render().asPng());
    return "@resvg/resvg-js";
  } catch (error) {
    if (error?.code !== "ERR_MODULE_NOT_FOUND") throw error;
  }
  const rsvg = commandPath("rsvg-convert");
  if (rsvg) {
    run(rsvg, ["-o", pngFile, svgFile]);
    return "rsvg-convert";
  }
  const magick = commandPath("magick");
  if (magick) {
    run(magick, [svgFile, pngFile]);
    return "ImageMagick";
  }
  const convert = commandPath("convert");
  if (convert) {
    run(convert, [svgFile, pngFile]);
    return "ImageMagick";
  }
  const quickLook = "/usr/bin/qlmanage";
  try {
    await access(quickLook);
  } catch {
    throw new Error("No PNG backend found. Run `npm install` in the repository (installs @resvg/resvg-js), or install rsvg-convert or ImageMagick.");
  }
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "geometry-dsl-render-"));
  try {
    run(quickLook, ["-t", "-s", String(size), "-o", temporaryDirectory, svgFile]);
    const generated = path.join(temporaryDirectory, `${path.basename(svgFile)}.png`);
    await copyFile(generated, pngFile);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
  return "macOS Quick Look";
}

try {
  const [{ compileToSvg }, input] = await Promise.all([loadCompiler(), readInput(inputPath)]);
  const sources = selectSources(input.text, blockNumber);
  if (sources.length !== 1) {
    throw new Error(`Input contains ${sources.length} geometry blocks; choose one with --block N`);
  }
  const context = sources[0].blockNumber
    ? `${input.displayPath}:geometry-block-${sources[0].blockNumber}`
    : input.displayPath;
  const options = { padding, labelSize, background: background === "none" ? null : background };
  if (width !== undefined) options.width = width;
  if (height !== undefined) options.height = height;
  let svg;
  try {
    svg = compileToSvg(sources[0].source, options);
  } catch (error) {
    throw new Error(compilerErrorMessage(error, context));
  }
  await mkdir(path.dirname(svgPath), { recursive: true });
  await writeFile(svgPath, svg, "utf8");
  process.stdout.write(`SVG: ${svgPath}\n`);
  if (!svgOnly) {
    await mkdir(path.dirname(pngPath), { recursive: true });
    const svgWidth = Number(svg.match(/<svg[^>]*\bwidth="([\d.]+)"/)?.[1]);
    const svgHeight = Number(svg.match(/<svg[^>]*\bheight="([\d.]+)"/)?.[1]);
    const size = Math.max(svgWidth || 0, svgHeight || 0) || 1000;
    const backend = await rasterize(svgPath, pngPath, size, svg, scale);
    process.stdout.write(`PNG: ${pngPath}\nBackend: ${backend}\n`);
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
