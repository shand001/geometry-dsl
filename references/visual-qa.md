# Visual QA for Geometry DSL

Compilation checks syntax, types, geometry predicates, and deterministic results. Visual QA checks whether those valid results express the intended diagram.

## Render

From the skill directory:

```bash
node scripts/render_geometry.mjs /absolute/path/to/diagram.geom \
  --out /absolute/path/to/diagram.png \
  --width 1000 --height 800 \
  --background white
```

The command also writes an SVG beside the PNG. It accepts raw `.geom`, Markdown containing one `geometry` fence, or `-` for stdin. Use `--block N` when a Markdown file contains multiple geometry blocks.

PNG conversion prefers the bundled `@resvg/resvg-js` (installed with `npm install` in the repository), then falls back to `rsvg-convert`, ImageMagick, and macOS Quick Look in that order. In a sandbox, Quick Look may require rerunning the command with approval outside the sandbox.

## Inspect in this order

1. **Topology** — correct number of points, edges, circles, arcs, regions, and intersections.
2. **Incidence** — required points actually lie on the intended lines/circles/paths.
3. **Range** — segments stop correctly, rays face the right way, infinite helpers are hidden.
4. **Orientation** — clockwise/counter-clockwise choices, arc sweeps, axes, and mirrored parts.
5. **Regions and layers** — expected Boolean pieces are filled, holes are correct, boundaries remain exact, and construction lines/foreground marks have the intended order.
6. **Labels** — correct text, no accidental helper labels, every Region label stays fully inside its area, and automatic movement or shrinking remains readable.
7. **Style** — color, width, dash, opacity, fill, arrows, and visual hierarchy.
8. **Framing** — nothing important is clipped and proportions resemble the requested figure.

## Reference-image reconstruction

Before writing source, extract:

- anchor points and their approximate coordinate relationships;
- which objects intersect or are tangent;
- visible versus hidden edges;
- symmetry, repeated motifs, and transformations;
- label placement and primary visual hierarchy.

Match topology first, then proportions, then styling. A precise color match cannot repair a wrong intersection graph.

## Extreme-case checks

- Render once with construction helpers visible in a faint color if topology is hard to debug.
- Temporarily label derived intersections to verify ordering, then remove or hide those labels.
- Test both intersection argument orders when the expected `pick` is unclear.
- For a dense diagram, render at 1200–1600 pixels and increase `labelSize`.
- For overlapping fills, inspect at full opacity first to expose path order, then restore transparency.
- For Boolean Regions, temporarily give each intermediate result a distinct opaque fill. Check `difference` operand order, disconnected pieces, Path `fill_rule`, and the finite-universe boundary.
- Compare `intersect(c1, c2)` points with `intersection(inside(c1), inside(c2))` only as a debugging aid; they intentionally return different value types.
- For automatic Region text, inspect the whole padded text box rather than only its center. Confirm it avoids boundaries, visible geometry, Point labels, and earlier Text.
- If a label moves or shrinks unexpectedly, temporarily hide nearby helpers and rerender. Layout may move explicit text or Point-label anchors by at most twice the original font size and may try 90%, 80%, 70%, then 60%, with a 10px floor.
- Render the same source twice when deterministic layout matters and compare the SVG output byte-for-byte.
- For transformed patterns, inspect the seed alone before adding copies.

## Acceptance rule

A complex diagram is complete only when:

- the validator succeeds;
- the rendered PNG was actually viewed;
- every required relationship is visible and correctly oriented;
- every required Region has the intended membership, fill, holes, and finite extent;
- automatic text is readable, lies inside its requested Region, and does not cover important geometry;
- no helper or styling artifact contradicts the intended geometry.
