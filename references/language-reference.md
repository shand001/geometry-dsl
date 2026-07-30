# Geometry DSL language reference

Use this reference when exact syntax, overloads, ranges, styles, or result ordering matters.

## Contents

- [Lexical rules](#lexical-rules)
- [Reserved words](#reserved-words)
- [Statements, values, and attributes](#statements-values-and-attributes)
- [Function reference](#function-reference)
- [Styles](#styles)
- [Text layout](#text-layout)
- [Capability boundary](#capability-boundary)

## Lexical rules

```text
identifier := [A-Za-z_][A-Za-z0-9_]*
number     := [0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?
```

- Source is UTF-8; a leading BOM is accepted.
- Strings use double quotes and support `\"`, `\\`, `\n`, and `\t`.
- `#` starts a comment outside strings.
- Calls and lists may span physical lines while brackets are open; trailing commas are accepted.
- Arithmetic supports finite numbers, `+ - * /`, unary signs, and parentheses.
- Names are defined before use and cannot be reassigned.
- The only standalone expression statement is `mark(...)`.

## Reserved words

Never use any of these as an assignment target:

```text
true false none

black white gray red orange yellow green cyan blue purple

point along line circle arc path text inside union intersection difference
project intersect transform mark

segment ray infinite
short long cw ccw
move rotate mirror scale
right equal equal_angle parallel
evenodd nonzero
dot square cross auto above below left
above_left above_right below_left below_right
start end both
```

Some words have multiple roles. For example, `right` is both a mark kind and a label position, and `circle` is both a function and a point shape. Their role is determined by argument position, but they remain unavailable as user names.

## Statements, values, and attributes

```text
name = expression
A, B = list_expression
mark(right, A, B, C)
```

Values are `Number`, `Boolean`, `String`, `None`, `Point`, `Line`, `Circle`, `Arc`, `Path`, `Text`, `Region`, `Mark`, and ordered `List`.

Read-only attributes:

| Type | Attributes |
|---|---|
| Point | `x`, `y` |
| Line | `kind` |
| Circle | `center`, `radius` |
| Arc | `circle`, `start`, `end`, `sweep` |
| Path | `points`, `closed`, `smooth` |

Binding an attribute creates an alias, not another drawing. Use `point(c.center)` to draw a separate point.
`Text`, `Region`, and `Mark` have no public attributes. Property access on them is an error.

## Function reference

Overload selection uses positional argument count and types. Named geometry options never select an overload. Put positional arguments first, geometry options next, and applicable styles last.

### `point`

```text
point(Number x, Number y, styles...) -> Point
point(Point source, styles...) -> Point
```

Coordinates are finite world coordinates, not pixels. The copy overload reads `source.x` and `source.y` and creates a new drawable; it does not alias or modify `source`. Use it when an attribute such as `circle.center` must appear as its own point.

The call fails for missing or non-finite coordinates, a non-`Point` source, or an inapplicable style. There is no zero-argument free-point or constraint-point overload.

### `along`

```text
along(Point A, Point B, Number t, styles...) -> Point
```

The exact construction is `A + t(B - A)`. `t` is unrestricted: values between `0` and `1` lie inside segment `AB`, while negative values and values greater than `1` extend past an endpoint. `A` and `B` must be distinct within the operation's length tolerance, and `t` must be finite.

### `line`

Every `Line` has an oriented first point and direction. Its `kind` controls both rendering and the range used by projection and intersection:

| `kind` | Actual range |
|---|---|
| `segment` | From the first point through the effective finite endpoint |
| `ray` | From the first point onward in the stored direction |
| `infinite` | The entire supporting line |

#### Two-point overload

```text
line(Point A, Point B, kind=segment, extend=0, styles...) -> Line
```

The stored direction is `A → B`. `A` and `B` must differ. `kind` may be `segment`, `ray`, or `infinite`.

`extend` is a non-negative world-coordinate length allowed only for a segment. It replaces the effective endpoint with:

```text
B + normalize(B - A) * extend
```

This changes the segment's real geometry and intersection range; it is not a visual-only extension. This overload rejects `angle` and `ratio`.

#### Point-and-reference overload

```text
line(Point P, Line reference, angle=0, kind=infinite, styles...) -> Line
```

The result passes through `P`. Its direction is the oriented direction of `reference`, rotated counter-clockwise by `angle` degrees. Only `ray` and `infinite` are valid kinds because this form has no finite second endpoint. It rejects `extend` and `ratio`.

#### Three-point angular interpolation overload

```text
line(Point V, Point A, Point C, ratio=r, kind=ray, styles...) -> Line
```

`V` is the vertex; `A` and `C` specify directions `V → A` and `V → C`, not endpoints of the result. `ratio` is required and must be in `[0,1]`. The evaluator takes the signed shortest turn from `V → A` to `V → C` and rotates the first direction by that turn multiplied by `ratio`.

Thus `ratio=0` follows `V → A`, `ratio=1` follows `V → C`, and `ratio=1/2` is the internal angular bisector. It is neither a side-length ratio nor a point-division parameter. Only `ray` and `infinite` are valid kinds. The call fails if either side is degenerate or the two sides are opposite within angular tolerance, because the interpolation direction is then not unique. This overload rejects `angle` and `extend`.

### `circle`

```text
circle(Point center, Number radius, styles...) -> Circle
circle(Point center, Point onCircle, styles...) -> Circle
circle(Point A, Point B, Point C, styles...) -> Circle
```

The numeric-radius overload requires a positive radius greater than the operation's length tolerance. The second overload uses `distance(center, onCircle)`. The three-point overload returns the unique circumcircle through `A`, `B`, and `C`.

The call fails for a zero or tolerance-sized radius, coincident center and circumference point, repeated defining points, or three collinear or near-collinear points.

### `arc`

```text
arc(Circle circle, Point start, Point end, sweep=short, styles...) -> Arc
```

Both endpoints must lie on `circle` within length tolerance and must not coincide. The evaluator normalizes accepted endpoints back onto the exact circumference without modifying or separately drawing the input points.

`sweep` determines the actual arc range:

| Value | Range from `start` to `end` |
|---|---|
| `short` | The shorter arc |
| `long` | The longer arc |
| `cw` | The clockwise arc |
| `ccw` | The counter-clockwise arc |

Diameter endpoints require `cw` or `ccw` because their short and long arcs are indistinguishable. Use `circle`, not an arc with coincident endpoints, for a complete circumference.

### `path`

```text
path(Point p1, Point p2, ..., closed=false, smooth=false, styles...) -> Path
```

With `smooth=false`, points are joined in order by straight segments. `closed=true` also joins the last point to the first. With `smooth=true`, the path is an interpolating centripetal Catmull-Rom spline through every control point; closed paths wrap their control-point neighborhood.

An open path needs at least two points. A closed or smooth path needs at least three. Adjacent points may not coincide within length tolerance, including the last-first pair of a closed path. Only a closed path may have a non-`none` fill. Self-intersection is allowed.

For deterministic ordering on a path, a point in segment or spline span `i` at local parameter `u` has progress `(i + u) / spanCount`; this is not arc length.

### `text`

```text
text(Number x, Number y, String content, styles...) -> Text
text(Region region, String content, styles...) -> Text
```

The coordinate overload creates independent text with `(x, y)` as its preferred center. The layout stage keeps that center when it is clear and may move it by at most twice the original font size in screen pixels to avoid visible geometry or other text.

The Region overload searches inside the Region and chooses the connected part and position with the greatest usable clearance. The entire padded text box, not only its center, must fit inside the Region.

There is intentionally no `text(Point, String)` overload. Label a geometric point with its `label` and `label_pos` styles. Text has no geometric attributes and is not accepted by `project`, `intersect`, or `transform`.

### `inside`

```text
inside(Circle source, styles...) -> Region
inside(Path source, styles...) -> Region
```

`inside(circle)` is the disk bounded by the circle. `inside(path)` requires `closed=true`; a self-intersecting Path follows the source's `fill_rule` (`evenodd` by default). The operation reads only source geometry and fill rule: source `visible`, `fill`, `color`, and other visual styles do not alter the Region.

The source may be hidden. A visible Region still contributes the source geometry to automatic framing. The returned Region has `fill=none` unless the call supplies a fill.

### `union`

```text
union(Region first, Region second, Region..., styles...) -> Region
```

The call requires at least two Regions and returns every point that belongs to any operand. Operand order does not change membership. The returned Region is an immutable expression and defaults to `fill=none`.

### `intersection`

```text
intersection(Region first, Region second, Region..., styles...) -> Region
```

The call requires at least two Regions and returns only points that belong to every operand. An empty result is valid but draws nothing and cannot host automatic Region text.

Do not confuse this function with `intersect`: `intersect(c1, c2)` returns circumference intersection points, while `intersection(inside(c1), inside(c2))` returns the shared area of the two disks.

### `difference`

```text
difference(Region left, Region right, styles...) -> Region
```

The call requires exactly two Regions and returns the points in `left` but not `right`. It is ordered and is not symmetric.

There is no infinite `complement` operation. Express a finite complement relative to an explicit universe:

```geometry
F1 = point(-6, -4, visible=false)
F2 = point(6, -4, visible=false)
F3 = point(6, 4, visible=false)
F4 = point(-6, 4, visible=false)
frame = path(F1, F2, F3, F4, closed=true, visible=false)
universe = inside(frame)

O1 = point(-2, 0, visible=false)
O2 = point(2, 0, visible=false)
regionA = inside(circle(O1, 3, visible=false))
regionB = inside(circle(O2, 3, visible=false))
outside = difference(universe, union(regionA, regionB), fill="#f3f4f6")
```

Use a Region created from a closed Path or Circle as `universe`.

### `project`

```text
project(Point P, Line|Circle|Arc|Path target, styles...) -> Point
```

The result is the unique global nearest point to `P` on the target's actual range. A segment projection clamps to an endpoint when its supporting-line foot is outside the segment; a ray likewise clamps at its origin. Use an infinite `Line` when the construction needs an unconstrained perpendicular foot.

Circle projection follows the radial direction from the center and is ambiguous when `P` is the center. Arc and path projection considers the whole finite target, not the first local minimum. If distinct target points tie within tolerance for the global minimum, the call fails instead of choosing arbitrarily.

### `intersect`

```text
intersect(Line|Circle|Arc|Path object1, Line|Circle|Arc|Path object2, styles...) -> List[Point]
intersect(Line|Circle|Arc|Path object1, Line|Circle|Arc|Path object2, pick=i, styles...) -> Point
```

All pairings of `Line`, `Circle`, `Arc`, and `Path` are supported. Candidate points must lie in both objects' actual ranges. Tangencies, shared endpoints, and repeated path hits at the same location are merged within length tolerance. Coincident portions with infinitely many intersections are errors.

Without `pick`, the call returns an ordered list, including an empty list when there is no intersection. A single assignment keeps the list; comma-separated targets destructure it and must match its exact length. Each returned point is a new drawable result rather than an alias of an input endpoint.

Results are sorted by progress on `object1`:

| `object1` type | Primary ordering |
|---|---|
| `Line` | Increasing oriented line parameter |
| `Circle` | Counter-clockwise angle from the positive x-axis |
| `Arc` | Progress from `start` along its sweep |
| `Path` | Span progress defined in the `path` section |

After de-duplication, ties are resolved by progress on `object2`, then `x`, then `y`. Swapping the arguments can therefore change list order. `pick` must be a zero-based integer in range and is applied only after sorting.

### `transform`

```text
transform(T object, move, Number dx, Number dy, styles...) -> T
transform(T object, rotate, Point center, Number angle, styles...) -> T
transform(T object, mirror, Line axis, styles...) -> T
transform(T object, scale, Point center, Number factor, styles...) -> T
transform(List[T] objects, mode, ..., styles...) -> List[T]
```

`T` may be `Point`, `Line`, `Circle`, `Arc`, or `Path`. A list must be non-empty, flat, and contain only supported geometry; result order and each element's type are preserved. `Text`, `Region`, `Mark`, primitives, empty lists, and nested lists are rejected. To transform a Region, transform its source Circle or Path first and then call `inside` again.

`move` adds `(dx, dy)`. `rotate` uses counter-clockwise degrees. `mirror` uses the complete supporting line of `axis`, regardless of its kind. `scale` requires `factor > 0`.

Every result is a new drawable. Source styles are inherited before explicit styles from the call override them. `Line.kind` is preserved. Reflection swaps an arc's `cw` and `ccw` sweep; all other modes preserve sweep, and `short` or `long` remains unchanged.

### `mark`

```text
mark(right, Point A, Point B, Point C, styles...) -> Mark
mark(equal, Line segment1, Line segment2, styles...) -> Mark
mark(equal_angle, Point A1, Point V1, Point B1, Point A2, Point V2, Point B2, styles...) -> Mark
mark(parallel, Line line1, Line line2, styles...) -> Mark
```

`right` treats `B` as the vertex of `∠ABC` and requires a 90-degree non-reflex angle. `equal` requires two `kind=segment` lines with equal actual lengths. `equal_angle` compares the non-reflex angles at `V1` and `V2`. `parallel` accepts any line kinds and treats same or opposite directions as parallel.

A mark validates an already true relation and fails when the relation, operand count, or operand types are wrong; it never constrains or moves geometry. `mark(...)` may be a standalone statement or may be assigned when the result needs a name.

## Styles

Styles are named and must come after geometry options.

| Style | Applies to | Values |
|---|---|---|
| `visible` | point/line/circle/arc/path/text/region/mark | Boolean |
| `color` | point/line/circle/arc/path/text/mark | built-in color or hex string |
| `opacity` | point/line/circle/arc/path/text/region/mark | number in `[0,1]` |
| `layer` | point/line/circle/arc/path/text/region/mark | integer |
| `width`, `dashed` | line/circle/arc/path/mark | positive number; Boolean |
| `fill` | circle/path/region | color or `none` |
| `fill_rule` | path | `evenodd`, `nonzero` |
| `size` | point/text/mark | positive number |
| `shape` | point | `dot`, `circle`, `square`, `cross` |
| `label` | point | `auto`, `none`, or string |
| `label_pos` | point | `auto`, compass-style positions listed above |
| `arrow` | line | `none`, `start`, `end`, `both` |

Hex colors accept `#RGB`, `#RGBA`, `#RRGGBB`, and `#RRGGBBAA`.

Region accepts only `visible`, `fill`, `opacity`, and `layer`. It has no outline style: draw its source Circle or Path separately when a visible boundary is required. Text accepts only `visible`, `color`, `opacity`, `layer`, and `size`; omitted `size` uses `RenderOptions.labelSize`.

## Text layout

Text and Point labels are laid out together after all geometry is evaluated and the world-to-screen transform is known. Placement is deterministic:

- `text(region, "...")` searches for a padded text box wholly inside the Region and favors maximum clearance from its boundary and other obstacles. A Region with multiple disconnected parts receives one label in the best part.
- `text(x, y, "...")` treats `(x, y)` as the preferred center. If blocked, it may move within twice the original font size in screen pixels.
- A Point's explicit `label_pos` is its preferred anchor and may be adjusted within the same two-font-size radius. `label_pos=auto` tries all eight compass positions; an exact tie retains the existing `above_right` preference.
- Obstacles are visible, nonzero-opacity points, lines, circle circumferences, arcs, Path edges, Marks, rendered Region boundaries, Point labels, and already placed Text. Region fill interiors are not obstacles. Hidden, fully transparent, or `fill=none` Regions are ignored.
- Labels are placed by descending `layer`, then source creation order within a layer. Each placed label becomes an obstacle for later labels.
- Font sizes are tried at 100%, 90%, 80%, 70%, and 60% of the requested size. For requested sizes of at least 10px, the result never goes below 10px. When the requested size is already below 10px, only that original size is tried.
- If no valid position exists at the permitted sizes, compilation fails with `E_LAYOUT`. Reduce `size`, adjust an explicit coordinate, enlarge the Region, or simplify nearby geometry.

Text measurement and placement use a deterministic Unicode width estimate, a 4px box margin, a fixed candidate order, and fixed refinement rounds. Recompiling identical source and render options therefore produces identical SVG.

## Capability boundary

The language does not provide free points, constraint solving, proof search, tangent constructors, arbitrary equations, ellipses, infinite complements, automatic area/centroid calculations, user functions, loops, conditions, animation, 3-D geometry, or post-creation mutation. Region is limited to the Boolean combination of Circle interiors and closed Path interiors. Model other requests with explicit fixed coordinates and supported constructions, or state that the requested geometry is outside the language.
