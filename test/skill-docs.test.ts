import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { compileToSvg } from "../src/index.ts";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillRoot = repositoryRoot;

test("every Geometry DSL skill example compiles independently", async () => {
  const references = (await readdir(path.join(skillRoot, "references")))
    .filter((name) => name.endsWith(".md"))
    .map((name) => path.join(skillRoot, "references", name));
  const files = [path.join(skillRoot, "SKILL.md"), ...references];
  const pattern = /^```(?:geometry|geometry-dsl|geom)(?:[ \t]+[^\r\n]*)?[ \t]*\r?\n(.*?)^```[ \t]*\r?$/gms;
  let count = 0;

  for (const file of files) {
    const text = await readFile(file, "utf8");
    for (const match of text.matchAll(pattern)) {
      count += 1;
      assert.doesNotThrow(
        () => compileToSvg(match[1]!),
        `${path.relative(repositoryRoot, file)} geometry block ${count} should compile`,
      );
    }
  }

  const exampleFiles = (await readdir(path.join(repositoryRoot, "examples")))
    .filter((name) => name.endsWith(".geom"));
  for (const name of exampleFiles) {
    count += 1;
    const source = await readFile(path.join(repositoryRoot, "examples", name), "utf8");
    assert.doesNotThrow(
      () => compileToSvg(source),
      `examples/${name} should compile`,
    );
  }
  assert.ok(count >= 4, "expected several independently compilable examples");
});
