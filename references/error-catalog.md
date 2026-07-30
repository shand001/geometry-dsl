# Geometry DSL repair guide

Use the official validator first. Fix the first diagnostic, rerun, then render when the source is valid.

## Compiler failures

| Symptom | Likely cause | Repair |
|---|---|---|
| Reserved word cannot be a name | A target is an enum, color, style value, or function name | Rename `left/right/parallel/start/end` to names such as `hitLeft`, `parallelGuide`, or `arcStart` |
| Name is undefined | Missing prerequisite, typo, wrong case, or a partial example was copied | Define the object earlier and keep construction order explicit |
| Name already defined | Reassignment or multiple alternative examples were combined | Give every result a unique target; keep alternative snippets separate |
| Positional argument after named argument | A required transform/mark operand appears too late | Move every positional operand before `name=value` options |
| Geometry option after style | `kind`, `sweep`, `closed`, `smooth`, `pick`, or similar follows `color`/`visible` | Move geometry options before the first style |
| Wrong argument type/count | The selected overload does not match the values | Check the signature table in `language-reference.md` |
| `pick` out of range or result count mismatch | The assumed intersection topology is wrong | Render the full objects, reason about ranges, and validate the actual number/order |
| Degenerate line/circle/path | Coincident points, collinearity, non-positive radius, or adjacent duplicate path points | Change the construction inputs rather than hiding the error |
| Arc endpoint is not on circle | A visually close fixed point was used | Derive the endpoint from a known intersection or use coordinates that exactly satisfy the circle |
| Mark relation is false | A mark was treated as a constraint | Construct the relation first, then add the mark |
| Open path has fill | The region was not closed | Add `closed=true` or remove the fill |
| `inside` rejects a Path | The Path is open | Set `closed=true`; `inside` cannot infer a finite interior from an open path |
| Region operation has wrong arguments | `union`/`intersection` has fewer than two Regions, `difference` does not have exactly two, or a boundary was passed directly | Wrap a Circle or closed Path with `inside`, then pass the required number of Regions |
| `intersection(c1, c2)` rejects Circles | `intersection` is the Region Boolean operation | Write `intersection(inside(c1), inside(c2))`; use `intersect(c1, c2)` when point results are intended |
| Text overload does not match | A Point was passed to `text`, content is not a String, or coordinates are missing | Use `point(..., label="P")`, `text(x, y, "content")`, or `text(region, "content")` |
| Style does not apply to Region/Text | A Region was given `color`/`width`, or Text was given `fill`/`label_pos` | Use `fill` for Region; use `color` and `size` for Text; consult the style table |
| Unsupported Text/Region operation | `transform`, `project`, `intersect`, or property access was applied to Text/Region | Transform the source shape before `inside`, or use the supported value directly |
| Projection is ambiguous | Multiple target points are equally near | Change the target/range or make the intended construction explicit |
| Infinite intersections | Objects overlap along a portion | Intersect non-coincident objects or select a different construction |
| `E_LAYOUT` | A Text or Point label cannot fit after permitted movement and size reduction | Reduce `size`, move explicit text, enlarge the Region, hide an obstacle, or simplify nearby geometry |

## Compiles, but the picture is wrong

| Visual symptom | Inspect | Typical repair |
|---|---|---|
| Perpendicular foot sticks to an endpoint | Projection target is a segment | Project to an invisible `kind=infinite` support |
| Expected intersection is missing | Segment/ray ranges and argument order | Use the correct real range; do not expand everything blindly |
| The wrong of two intersections was chosen | First-object ordering and `pick` | Swap arguments only deliberately or change `pick` after inspecting |
| Arc travels around the wrong side | `sweep` and endpoint order | Switch `short/long/cw/ccw` or reverse endpoints |
| Filled curve folds over itself | Path point order and `smooth=true` | Reorder/simplify control points or use a non-smooth polygon |
| Construction lines dominate the figure | `visible`, color, width, opacity, layer | Hide helpers or push them behind primary geometry |
| Hidden edges look inconsistent | Occlusion decisions were made edge-by-edge | Establish one depth order and apply dashed styling consistently |
| Label moved farther than expected | Its preferred location conflicts with a visible obstacle | Hide unnecessary helpers, adjust layers/geometry, choose a clearer explicit coordinate, or reduce `size` |
| Label became smaller | No collision-free placement existed at larger permitted sizes | Make more room or set a smaller intended `size`; layout tries 100%, 90%, 80%, 70%, then 60% |
| Region label appears in the wrong component | A disconnected component has greater usable clearance | Split the expression into the intended component or use explicit `text(x, y, ...)` |
| Region fill is missing | The Region retained its default `fill=none`, is empty, or is hidden | Set `fill`, verify Boolean operands, and confirm `visible`/`opacity` |
| Region fill has the wrong holes | Operand order, Path point order, or `fill_rule` is wrong | Check `difference(left, right)`, inspect the closed Path, and choose `evenodd` or `nonzero` deliberately |
| Transformed copies use surprising colors | Style inheritance | Add explicit overrides on `transform` |
| Figure is mathematically valid but unlike the reference | Anchor coordinates or topology are wrong | Match incidences and proportions first; style only after geometry matches |

## Diagnostic loop

1. Save raw source without Markdown fences to a `.geom` file.
2. Run `node scripts/validate_geometry.mjs file.geom`.
3. Fix the first compiler error and repeat until valid.
4. Run `node scripts/render_geometry.mjs file.geom --out /tmp/diagram.png`.
5. Inspect the PNG using the checklist in `visual-qa.md`.
6. Revise geometry, then rerun both commands.

The validator compiles through SVG layout, so an `E_LAYOUT` failure is a validation failure rather than a visual-only warning. Never treat an exit code of `0` as final visual approval.
