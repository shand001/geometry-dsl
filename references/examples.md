# Geometry DSL example gallery

Every figure lives in [`examples/`](../examples/) as a compilable `.geom` file plus rendered `.svg`/`.png`. Read the linked source when you need the full construction; the notes here tell you which file demonstrates which technique. Functions are explained at their first (clearest) occurrence — later entries only mention new usage.

Render any of them with:

```bash
node scripts/render_geometry.mjs examples/<name>.geom --out <name>.png
```

## Contents

- Classical constructions: [triangle](#trianglegeom), [orthocenter-circle](#orthocenter-circlegeom), [euler-line](#euler-linegeom), [incircle](#incirlegeom), [pythagoras](#pythagorasgeom)
- Regions and fills: [venn](#venngeom), [regions](#regionsgeom), [seed-of-life](#seed-of-lifegeom), [pentagram](#pentagramgeom)
- Curves and motifs: [four-leaf](#four-leafgeom), [fibonacci-spiral](#fibonacci-spiralgeom), [person](#persongeom)
- Other: [space_wireframe](#space_wireframegeom), [ex](#exgeom)

## triangle.geom

A triangle with an altitude, its foot, a circumcircle, and a right-angle mark.

- `point(x, y, label_pos=...)` — labeled vertices; `label_pos` is a preference the layout engine may adjust.
- `project(C, AB)` — perpendicular foot onto a segment.
- `circle(A, B, C)` — circumcircle through three points.
- `mark(right, C, F, A)` — validates the angle really is 90° before drawing the symbol.

## venn.geom

Two overlapping disks split into three softly colored areas with centered labels.

- `inside(circle)` — turns a boundary into a Region (disk).
- `difference(A, B)` / `intersection(A, B)` — Boolean region algebra with `fill`.
- `text(region, "A ∩ B")` — automatic label placement at the clearest spot inside a region.

## regions.geom

The same two disks plus the surrounding "outside" area — four labeled regions in total.

- Finite universe pattern: an invisible closed `path` + `inside(frame)`, then `difference(universe, union(A, B))` for the complement. There is no infinite complement operator.
- `layer` on regions controls which fill paints on top.

## orthocenter-circle.geom

A textbook figure reproduction: acute triangle inscribed in a circle, two altitudes, orthocenter, and auxiliary dashed radii.

- `project(A, BC)` onto the visible side segments is enough here because the feet land on the sides.
- `intersect(altA, altB, pick=0)` — `pick` selects one point from the sorted result list.
- Style strategy for dense figures: dark solid construction lines on high layers, dashed auxiliaries below.

## euler-line.geom

Circumcenter O, centroid G, orthocenter H on one red line, with medians, altitudes, and circumcircle.

- Hidden infinite supports: `line(B, C, kind=infinite, visible=false)` as projection targets, so feet are never clamped to a segment.
- `point(circum.center)` — attribute access turns a circle's center into a drawable point.
- `along(A, mA, 2/3)` — parametric point division; `2/3` along a median is the centroid.
- `kind=infinite` lines render clipped to the viewport, which suits lines whose endpoints don't matter.

## incircle.geom

Angle bisectors concurrent at the incenter, incircle tangent to all three sides, equal-angle and right-angle marks.

- `line(V, A, C, ratio=1/2, kind=ray)` — the three-point overload constructs the internal angular bisector at `V`.
- Ray trimming: bisectors are built as invisible rays, then `intersect(ray, oppositeSupport)` gives the point where the bisector meets the opposite side, so the visible dashed segment stops at the boundary.
- `circle(I, foot)` — center-plus-point overload; the radius is implicit, no distance arithmetic needed.
- `mark(equal_angle, B, A, I, I, A, C)` — verifies the bisector actually splits the angle evenly.

## pythagoras.geom

The 3-4-5 theorem as a poster: colored squares on each side with area numbers 9, 16, 25 inside.

- Outward squares are plain closed `path`s with `fill`; computing their corners is the model's job (rotate the side vector by 90°).
- `text(inside(square), "16")` reuses region label placement for the rotated square too — no manual center math.

## pentagram.geom

A golden five-pointed star with a darker inner pentagon, circumcircle, and faint outer pentagon.

- `intersect(e0, e2, pick=0)` on invisible star edges derives the five inner-pentagon vertices — geometry as computation scaffolding, drawing only the result.
- The star body is a single self-intersecting closed `path` with `fill_rule=evenodd`, which punches out the central pentagon automatically.

## four-leaf.geom

A compass-style construction: circle, perpendicular diameters, four rotated smooth petals, and guide lines.

- `line(N, diagonal, angle=90, kind=infinite)` — point-and-reference overload: through `N`, rotated from `diagonal`'s direction.
- `transform(petal, rotate, O, 90)` — transformed copies inherit source styles unless overridden.
- All four mark kinds in one figure: `mark(equal)`, `mark(right)`, `mark(equal_angle)`, `mark(parallel)`.

## fibonacci-spiral.geom

Fibonacci squares 1-1-2-3-5-8 with a continuous six-arc golden spiral and a text caption.

- `arc(circle, start, end, sweep=ccw)` — each quarter arc picks `ccw`/`cw` explicitly so consecutive arcs join tangent-to-tangent; hidden circles serve as arc supports.
- `text(x, y, "...")` — free text at fixed coordinates (the title sits in the empty quadrant).
- Note: auto-framing includes each arc's full supporting circle by design, so large arcs expand the canvas; plan captions for the resulting space.

## seed-of-life.geom

Seven equal circles (six rotated 60° apart) whose pairwise lenses form six pastel petals.

- `transform(c1, rotate, O, 60)` on a circle — repeated rotation builds the ring without trigonometry in the source.
- Petals are `intersection(inside(c0), inside(ci))` lens regions; decorative geometry can come entirely from region algebra.

## person.geom

A waving cartoon figure — proof the DSL can draw organic illustrations, not just math.

- `smooth=true` closed paths (Catmull-Rom) for shirts and shoes; thick `width` lines as limbs; small filled circles as hands and eyes.
- Every structural point is `visible=false`; only the final strokes render.

## space_wireframe.geom

A 3D-looking wireframe with hidden edges dashed and three arrowed axes.

- Depth is conveyed by convention: dashed `opacity`-reduced lines for occluded edges, `arrow=end` rays for axes.
- Axis labels are tiny (`size=1`) visible points whose labels carry the text — an alternative to `text(x, y)` when you want label-collision avoidance.

## ex.geom

The complete feature showcase in one file: attributes with arithmetic (`outer.center.x + 0.65`), all four `transform` modes (`move`, `rotate`, `mirror`, `scale`), lists (`[AB, BC, CD, DA]`), arrows, every point shape, and every mark kind. Read it last, after the focused examples above.
