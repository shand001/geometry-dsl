---
name: geometry-dsl
description: Draw math geometry diagrams as PNG or SVG images using the Geometry DSL compiler. Use when the user asks to draw, shade, label, illustrate, or visually explain geometry, recreate a reference diagram, produce or repair Geometry DSL, or diagnose a diagram that looks wrong. Write DSL source, validate it with the bundled compiler, render it to an image, and visually inspect complex diagrams before delivering.
---

# Geometry DSL

Draw geometric diagrams for the user by writing Geometry DSL source, compiling it with the bundled scripts, and delivering the rendered **PNG or SVG image file**.

## Environment

All scripts in `scripts/` run with Node.js ≥ 22.18 and load the compiler automatically (repo `dist/` → repo `src/` → `GEOMETRY_DSL_MODULE` → installed npm package), so a fresh clone works with no build step. If a script reports that it cannot load the compiler, check the Node version first, then follow the install instructions in `README.md` ("Use it as an agent skill"). PNG output additionally needs `@resvg/resvg-js` (installed by `npm install`) or a system tool (`rsvg-convert`, ImageMagick, macOS Quick Look); SVG output always works.

## Mandatory delivery contract

When the user asks for a diagram, the final result delivered to the user **must be a rendered image file** (PNG by default, SVG when the user asks for vector output or no PNG backend is available):

1. Write the Geometry DSL source to a `.geom` file in the user's workspace.
2. Run `scripts/validate_geometry.mjs` on it and fix every error.
3. Run `scripts/render_geometry.mjs` to produce the image.
4. Deliver the image to the user: display it inline when the host interface supports images, and always state the output file path.

Describing the diagram in prose, printing the DSL source alone, or stopping after successful validation does **not** deliver the diagram. The `.geom` source is kept alongside the image so the user can revise it later.

Before finishing, verify that the delivered image was rendered from the latest source. If the source was revised after the last render, render again.

Choose the lightest sufficient verification level:

- **Simple**: the construction is short and deterministic — validate, render, deliver.
- **Complex, reference-matching, or reported broken**: validate, render to PNG, visually inspect the PNG in a following turn, repair if needed, re-render, then deliver.

## Core workflow

1. Identify the required objects, incidences, orientation, visible edges, and other invariants.
2. Place a few anchor points with fixed coordinates; derive dependent points with `along`, `project`, `intersect`, transforms, or object attributes.
3. Decide whether each line is a segment, ray, or infinite support. Hide construction-only objects with `visible=false`.
4. Write definitions in dependency order. Establish correct topology before adding labels, fills, marks, and other styling.
5. Validate with the compiler, render to an image, and deliver the image file. The DSL source is a working artifact; the image is the user-facing result.

## Language essentials

```text
name = expression
expression = number | "string" | true | false | none | name | call | [expression, ...]
```

- Use double-quoted strings and `#` comments; omit semicolons. Calls and lists may span lines and have trailing commas.
- Use finite-number arithmetic with `+ - * /` and parentheses.
- Define names before use and never reassign them. Use `_` to discard one result.
- Put positional geometry arguments first, named geometry options next, and styles last.
- Use read-only attributes such as `P.x`, `P.y`, `C.center`, `C.radius`, and `L.kind`. Use `point(C.center)` when an attribute point must be drawn separately.
- Do not use a function, enum, color, or style value as a target name; notably avoid `left`, `right`, `parallel`, `circle`, `line`, `start`, and `end`.
- Treat the functions listed below as the complete supported function set; every other call, including `sqrt()`, is unsupported. Do not invent loops, conditions, mutation, automatic tangencies, constraints, or other constructors.

## Constructors

`styles...` creates the returned drawable with the requested appearance but does not change its return type.

| Function | Returns | Signatures and meaning |
|---|---|---|
| `point` | `Point` | `point(x, y, styles...)` creates a point at fixed world coordinates.<br>`point(existingPoint, styles...)` creates a separately drawable point at the same coordinates. |
| `along` | `Point` | `along(A, B, t, styles...)` creates `A + t(B - A)`; use `t=0.5` for the midpoint and values outside `[0,1]` for extension. |
| `line` | `Line` | `line(A, B, kind=segment, extend=0, styles...)` creates a segment, ray, or infinite line directed from `A` through `B`; `extend` lengthens only a segment beyond `B`.<br>`line(P, referenceLine, angle=0, kind=infinite, styles...)` creates a ray or infinite line through `P`, rotated counter-clockwise from the reference direction.<br>`line(V, A, C, ratio=r, kind=ray, styles...)` creates a ray or infinite line from `V` by angularly interpolating from direction `V→A` to `V→C`; `r=0.5` is the internal bisector, not a side-length ratio. |
| `circle` | `Circle` | `circle(center, radius, styles...)` uses a numeric radius.<br>`circle(center, pointOnCircle, styles...)` uses the distance to the second point as radius.<br>`circle(A, B, C, styles...)` creates the unique circle through three points. |
| `arc` | `Arc` | `arc(circle, startPoint, endPoint, sweep=short, styles...)` takes two points on the circle and selects the `short`, `long`, clockwise (`cw`), or counter-clockwise (`ccw`) arc. |
| `path` | `Path` | `path(P1, P2, ..., closed=false, smooth=false, styles...)` joins points in order; `closed=true` adds the last-to-first edge and `smooth=true` creates a smooth interpolating path. |
| `text` | `Text` | `text(x, y, "content", styles...)` places independent text near the requested coordinate.<br>`text(region, "content", styles...)` automatically places text inside the clearest usable part of a Region. Point labels remain `point(..., label="P")`; `text(Point, ...)` is unsupported. |
| `inside` | `Region` | `inside(circleOrClosedPath, styles...)` creates the finite interior of a Circle or closed Path. The source's drawing style does not change the Region geometry. |
| `union` | `Region` | `union(region1, region2, ..., styles...)` creates the union of two or more Regions. |
| `intersection` | `Region` | `intersection(region1, region2, ..., styles...)` creates the common area of two or more Regions. This is distinct from `intersect`, which returns points. |
| `difference` | `Region` | `difference(leftRegion, rightRegion, styles...)` creates `leftRegion - rightRegion`. |
| `project` | `Point` | `project(P, lineOrCircleOrArcOrPath, styles...)` creates the unique nearest point to `P` on the target's actual range. |
| `intersect` | `List[Point]` or `Point` | `intersect(object1, object2, styles...)` returns every intersection as an ordered list.<br>`intersect(object1, object2, pick=i, styles...)` returns the zero-based intersection `i` after the same ordering. |
| `transform` | same type as input, or `List` for list input | `transform(object, move, dx, dy, styles...)` translates.<br>`transform(object, rotate, center, angle, styles...)` rotates counter-clockwise in degrees.<br>`transform(object, mirror, axis, styles...)` reflects across a line.<br>`transform(object, scale, center, factor, styles...)` scales by a positive factor. Each overload also accepts a non-empty flat list and preserves its order and element types. |
| `mark` | `Mark` | `mark(right, A, B, C, styles...)` verifies and marks `∠ABC` as right.<br>`mark(equal, segment1, segment2, styles...)` verifies and marks equal segment lengths.<br>`mark(equal_angle, A1, V1, B1, A2, V2, B2, styles...)` verifies and marks two equal angles.<br>`mark(parallel, line1, line2, styles...)` verifies and marks parallel lines. Use `mark(...)` as a standalone statement unless the mark itself needs a name. |

Common styles:

- points, lines, circles, arcs, paths, marks, and text: `visible`, `color`, `opacity`, `layer`
- regions: `visible`, `fill`, `opacity`, `layer`
- lines, circles, arcs, paths, marks: `width`, `dashed`
- circles and paths: `fill`; paths also accept `fill_rule=evenodd|nonzero`
- points: `size`, `shape=dot|circle|square|cross`, `label`, `label_pos`
- text: `size`; omitted `size` uses the renderer's `labelSize`
- lines: `arrow=none|start|end|both`

Built-in colors are `black`, `white`, `gray`, `red`, `orange`, `yellow`, `green`, `cyan`, `blue`, and `purple`. Hex colors must be strings, for example `"#2563eb"`.

## Minimal example

```geometry
A = point(-3, -2, label_pos=below_left, layer=5)
B = point(3, -2, label_pos=below_right, layer=5)
C = point(0, 3, label_pos=above, layer=5)
AB = line(A, B, color=blue, width=2, layer=2)
BC = line(B, C, color=blue, width=2, layer=2)
CA = line(C, A, color=blue, width=2, layer=2)
F = project(C, AB, label_pos=below, color=red, layer=5)
altitude = line(C, F, dashed=true, color=red, layer=3)
circumcircle = circle(A, B, C, color=gray, width=1.5, layer=0)
mark(right, C, F, A, color=red, layer=6)
mark(equal, CA, BC, color=purple, layer=6)
mark(equal_angle, B, A, C, A, B, C, color=orange, layer=6)
```

## Regions and independent text

Use a hidden closed Path as the finite universe when the diagram needs the area outside other shapes. Intermediate Regions default to `fill=none`; apply a fill to each Region that should be drawn.

```geometry
F1 = point(-6, -4, visible=false)
F2 = point(6, -4, visible=false)
F3 = point(6, 4, visible=false)
F4 = point(-6, 4, visible=false)
frame = path(F1, F2, F3, F4, closed=true, visible=false)
universe = inside(frame)

O1 = point(-1.8, 0, visible=false)
O2 = point(1.8, 0, visible=false)
c1 = circle(O1, 3, fill=none, color=blue, width=2, layer=3)
c2 = circle(O2, 3, fill=none, color=red, width=2, layer=3)
d1 = inside(c1)
d2 = inside(c2)

leftOnly = difference(d1, d2, fill="#bfdbfe", layer=1)
overlap = intersection(d1, d2, fill="#c4b5fd", layer=1)
rightOnly = difference(d2, d1, fill="#fecaca", layer=1)
outside = difference(universe, union(d1, d2), fill="#f3f4f6", layer=0)

labelA = text(leftOnly, "A", size=24, layer=5)
labelB = text(overlap, "B", size=24, layer=5)
labelC = text(rightOnly, "C", size=24, layer=5)
labelD = text(outside, "D", size=24, layer=5)
title = text(0, 4.8, "Two sets", size=20, layer=5)
```

## Correctness rules

- `line(A, B)` is the finite segment `AB`. Set `kind=ray` or `kind=infinite` explicitly when the construction requires a larger range.
- `project(P, segment)` clamps to the segment. For a foot on the full supporting line, project onto a hidden infinite line.
- `intersect` respects actual object ranges. Confirm result count and deterministic ordering before binding multiple results or using `pick`.
- `intersect(c1, c2)` returns intersection points; use `intersection(inside(c1), inside(c2))` for the shared area.
- Marks only verify relations already created; they never impose constraints.
- Arc endpoints must lie exactly on the circle. For diameter endpoints, use `sweep=cw` or `sweep=ccw`.
- Open paths cannot be filled; set `closed=true`. Check point order before using `smooth=true` or overlapping fills.
- `inside(path)` also requires `closed=true`; a self-intersecting Path follows its `fill_rule`.
- A complement needs an explicit finite universe: write `difference(universe, region)`. Infinite complement regions are unsupported.
- Automatic Region text must fit inside the Region and may search its full extent. Fixed text and Point-label anchors may move by at most twice the original font size. All labels use deterministic collision avoidance and may shrink to 60% with a 10px floor (unless the requested size was already below 10px); if no valid placement exists, revise the geometry, reduce `size`, or choose a clearer coordinate.
- Styles never change geometry. Do not conceal a construction error with styling or hand-placed duplicate points.

## Verification and repair

Do not skip validation: the compiler is the source of truth, and its error codes name the exact repair. All scripts live in this skill's `scripts/` directory and run with Node.js (≥22.18); paths below are relative to the skill directory.

Write the source into the user's workspace, then validate:

```bash
node <skill>/scripts/validate_geometry.mjs geometry/diagram.geom --quiet
```

Then render to PNG (add `--svg-only` to skip rasterization, or `--background none` for transparency):

```bash
node <skill>/scripts/render_geometry.mjs geometry/diagram.geom --out geometry/diagram.png
```

For complex diagrams, read the PNG back and inspect it in this order: topology and incidences; segment/ray/infinite ranges; intersection choice and arc orientation; hidden helpers and layers; labels and styling. Fix the first validation error and rerun; repeat validation and rendering after every geometry change. A complex diagram is complete only after a successful validation and an actually inspected render that matches the request.

## References

Read only the reference needed for the task:

- [language-reference.md](references/language-reference.md): exact overloads, reserved words, attributes, ranges, styles, and intersection ordering.
- [examples.md](references/examples.md): gallery of the compilable figures in `examples/`, indexed by the technique each one demonstrates.
- [error-catalog.md](references/error-catalog.md): compiler diagnostics and repair patterns.
- [visual-qa.md](references/visual-qa.md): complex diagrams, reference-image reconstruction, and detailed visual acceptance checks.

For hard errors the references cannot fix, consult the full language protocol at [docs/spec.md](docs/spec.md) — it is the authoritative spec for syntax, semantics, degenerate cases, and error conditions.
