<div align="center">

# Geometry DSL

**A deterministic geometry diagram language built for AI agents.**
Text in — precise math figures out. Validate, render, inspect, repair: a closed loop an LLM can actually drive.

English | [简体中文](README.zh-CN.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22.18-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Zero runtime dependencies](https://img.shields.io/badge/runtime%20deps-0-brightgreen)](package.json)
[![Agent Skills](https://img.shields.io/badge/agent%20skills-compatible-blueviolet)](https://agentskills.io)

<br><br>

<a href="examples/seed-of-life.geom"><img src="examples/seed-of-life.png" width="400" alt="Seed of life — six rotated circles and Boolean lens petals"></a>
&nbsp;&nbsp;
<a href="examples/pythagoras.geom"><img src="examples/pythagoras.png" width="400" alt="Pythagorean theorem — region area labels and a verified right-angle mark"></a>

*Every figure on this page is compiled from a short `.geom` file — click any image to read its source.*

</div>

---

LLMs understand geometry problems but fumble raw SVG coordinates and TikZ. Geometry DSL is the layer in between: the agent writes short, high-level constructions — `intersect`, `project`, `along`, Boolean regions — and a zero-dependency compiler produces exact SVG/PNG with **stable, machine-readable error codes**. The agent can validate, render, *look at the result*, and repair it before the user ever sees a broken figure.

```geometry
A = point(-3, -2, label_pos=below_left)
B = point(3, -2, label_pos=below_right)
C = point(0, 3, label_pos=above)
AB = line(A, B, color=blue, width=2)
BC = line(B, C, color=blue, width=2)
CA = line(C, A, color=blue, width=2)
F = project(C, AB, color=red, label_pos=below)
altitude = line(C, F, dashed=true, color=red)
circumcircle = circle(A, B, C, color=gray, width=1.5)
mark(right, C, F, A, color=red)
```

<div align="center"><img src="docs/images/triangle.svg" width="420" alt="Triangle with altitude, circumcircle, and right-angle mark"></div>

## Why not SVG, TikZ, or Mermaid?

| | Raw SVG / HTML canvas | TikZ / Asymptote | Mermaid | **Geometry DSL** |
|---|---|---|---|---|
| Made for LLM generation | ❌ coordinate soup | ⚠️ powerful but error-prone | ✅ | ✅ |
| Geometry semantics (intersect, project, bisector) | ❌ | ✅ | ❌ | ✅ |
| Deterministic output (byte-identical) | — | ⚠️ | ❌ | ✅ |
| Structured error codes for self-repair | ❌ | ❌ TeX logs | ❌ | ✅ (`E_LAYOUT`, line/col) |
| Boolean regions + auto label placement | manual | manual | ❌ | ✅ |
| Runtime dependencies | — | TeX distribution | JS bundle | **0** |

## Features

- 🎯 **Geometry-first primitives** — points, lines/rays/segments, circles, arcs, paths, projections, intersections, transforms, semantic marks (right angle, equal length, equal angle, parallel)
- 🧩 **Real Boolean regions** — `inside` / `union` / `intersection` / `difference` rendered as exact arc-boundary masks, never discretized polygons
- 🏷️ **Automatic label layout** — point labels, free text, and in-region text share one deterministic collision-avoidance engine; `text(region, "...")` finds the clearest spot inside a region
- 🔁 **Built for agent loops** — stable error codes with line/column, deterministic byte-identical output, validate → render → inspect → repair workflow baked into the bundled skill
- 📦 **Zero runtime dependencies** — plain TypeScript core; runs in Node, browsers, and Markdown pipelines
- 🖼️ **SVG + PNG output** — SVG natively; PNG via `@resvg/resvg-js` (optional) or system tools
- 🤖 **Ships as an Agent Skill** — works with Claude Code, OpenAI Agents, and any skills-compatible host

## Gallery

| **Pentagram** — golden-ratio points via `intersect` | **Euler line** — O, G, H collinear | **Fibonacci spiral** — chained quarter arcs |
|:---:|:---:|:---:|
| [<img src="examples/pentagram.png" width="240" alt="Pentagram with inner pentagon from edge intersections">](examples/pentagram.geom) | [<img src="examples/euler-line.png" width="240" alt="Euler line through circumcenter, centroid, orthocenter">](examples/euler-line.geom) | [<img src="examples/fibonacci-spiral.png" width="240" alt="Fibonacci tiling with golden spiral">](examples/fibonacci-spiral.geom) |
| **Incircle** — bisectors + tangency marks | **Boolean regions** — exact arc masks | **Four-leaf curve** — transforms & marks |
| [<img src="examples/incircle.png" width="240" alt="Triangle incircle with angle bisectors and right-angle marks">](examples/incircle.geom) | [<img src="examples/regions.png" width="240" alt="Two-circle Boolean regions with auto-placed labels">](examples/regions.geom) | [<img src="examples/four-leaf.png" width="240" alt="Four-leaf construction with marks and transforms">](examples/four-leaf.geom) |
| **Orthocenter circle** | **3-set Venn** | **Wireframe paths** |
| [<img src="examples/orthocenter-circle.png" width="240" alt="Orthocenter circle construction">](examples/orthocenter-circle.geom) | [<img src="examples/venn-3set.png" width="240" alt="Three-set Venn diagram">](examples/venn.geom) | [<img src="examples/space_wireframe.png" width="240" alt="Space wireframe from paths">](examples/space_wireframe.geom) |

More in [`examples/`](examples/).

## Quick start

Requires Node.js ≥ 22.18 (runs TypeScript directly).

```bash
npm install
npm run build

# CLI: compile .geom → SVG
node dist/cli.js examples/four-leaf.geom -o four-leaf.svg

# Validate + render PNG
node scripts/validate_geometry.mjs examples/four-leaf.geom
node scripts/render_geometry.mjs examples/four-leaf.geom --out four-leaf.png
```

Library API:

```ts
import { parse, evaluate, renderSvg, compileToSvg } from "@geometry-dsl/renderer";

const svg = compileToSvg(source);                 // one step
// or: parse(source) → evaluate(ast) → renderSvg(scene, { width, height })
```

All failures throw `GeometryDslError` with a stable code, line, column, and reason.

## Use it as an agent skill

**This repository is the skill.** The root [`SKILL.md`](SKILL.md) follows the [Agent Skills](https://agentskills.io) format: it teaches an agent the language and the validate → render → inspect → repair loop, and points at the bundled [`scripts/`](scripts/).

### One-sentence install

Just tell your agent:

> **"Install this skill: https://github.com/shand001/geometry-dsl.git"**

Claude Code, Codex, or any skills-compatible agent will clone it into its skills directory (e.g. `~/.claude/skills/geometry-dsl`) and it's ready — the scripts run the TypeScript compiler source directly on Node.js ≥ 22.18, **no build step required**. Then ask: *"draw the orthocenter construction of an acute triangle"* and the agent writes DSL, validates, renders, checks the image, and hands you a PNG.

### Manual install

```bash
git clone https://github.com/shand001/geometry-dsl.git ~/.claude/skills/geometry-dsl
# optional but recommended: build dist/ and enable the resvg PNG backend
cd ~/.claude/skills/geometry-dsl && npm install && npm run build
```

**OpenAI Agents:** an adapter is included at [`agents/openai.yaml`](agents/openai.yaml). The scripts locate the compiler automatically: repo `dist/` → repo `src/` (Node ≥ 22.18) → `GEOMETRY_DSL_MODULE` → the installed npm package.

## Language at a glance

15 orthogonal core functions:

```text
point  along  line  circle  arc  path
project  intersect  transform  mark
text  inside  union  intersection  difference
```

- **Exact semantics** — a segment, a ray, and an infinite line are different objects, not display options; `intersect` respects actual ranges
- **Immutable definitions** — define once, derive everything else with `along`, `project`, `intersect`, `transform`
- **Verifying marks** — `mark(right, A, B, C)` checks the angle really is 90° before drawing the symbol; a wrong figure fails loudly instead of lying quietly

Full language protocol: [docs/spec.md](docs/spec.md) (Chinese; English translation in progress — contributions welcome).
Skill-facing reference: [references/language-reference.md](references/language-reference.md).

## Project layout

```text
src/language    lexer + parser (pure syntax front end)
src/runtime     evaluator: names, types, overloads, styles, region expressions
src/geometry    platform-independent numeric geometry and region kernel
src/render      deterministic text layout, region masks, SVG output
src/cli.ts      Node CLI adapter
SKILL.md        agent skill entry point (Agent Skills format)
references/     skill-facing language reference, examples, error catalog, visual QA
scripts/        validate / render / docs-check drivers used by the skill
examples/       sample .geom files with rendered output
docs/spec.md    the V0.4 language protocol
```

Everything except `src/cli.ts` is free of Node APIs, DOM, and third-party dependencies.

## Development

```bash
npm run build      # type-check + emit dist/
npm test           # node --test (parser, geometry, regions, svg, markdown, skill docs)
npm run check:docs # compile every geometry example embedded in the skill docs
```

## Contributing

Issues and PRs are welcome — especially: English translation of the language spec, new example diagrams, and evaluation sets of real geometry problems. Please run `npm run check && npm run check:docs` before submitting.

---

If Geometry DSL helps your agent draw better figures, a ⭐ on GitHub helps others discover it.

## License

[MIT](LICENSE) © Geometry DSL contributors
