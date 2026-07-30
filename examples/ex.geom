O = point(0, 0, label="O", label_pos=above, shape=circle, size=7, color=purple, layer=5)
A = point(-2.4, -2.4, label_pos=below_left, layer=5)
B = point(2.4, -2.4, label_pos=below_right, layer=5)
C = point(2.4, 2.4, label_pos=above_right, layer=5)
D = point(-2.4, 2.4, label_pos=above_left, layer=5)
top = point(0, 4.4, label="N", label_pos=above, shape=circle, size=5, color=orange, layer=5)
rightPoint = point(4.4, 0, label="E", label_pos=right, shape=square, size=5, color=orange, layer=5)

squareShape = path(
    A, B, C, D,
    closed=true,
    smooth=false,
    fill="#eaf2ff",
    fill_rule=nonzero,
    color=blue,
    width=2,
    layer=1,
)
AB = line(A, B, color=gray, width=2, layer=3)
BC = line(B, C, color=gray, width=2, layer=3)
CD = line(C, D, color=gray, width=2, layer=3)
DA = line(D, A, color=gray, width=2, layer=3)

outer = circle(O, 4.4, fill=none, color=purple, width=2, layer=0)
throughVertices = circle(A, B, C, fill=none, color=blue, width=1.5, dashed=true, opacity=0.55, layer=2)
core = circle(O, 1.15, fill="#fff7ed", color=orange, width=1.5, layer=2)
centerCopy = point(outer.center.x + 0.65, outer.center.y + 0.65, label="K", label_pos=above_right, shape=cross, size=5, color=purple, layer=5)
radiusValue = outer.radius
quarter = arc(outer, top, rightPoint, sweep=short, color=orange, width=4, layer=4)

P = point(-3.2, 1.4, label="P", label_pos=left, shape=cross, size=6, color=red, layer=5)
supportAB = line(A, B, kind=infinite, dashed=true, color=gray, width=1, opacity=0.45, layer=2)
F = project(P, supportAB, label="F", label_pos=below_left, shape=square, color=red, size=6, layer=5)
drop = line(P, F, dashed=true, color=red, width=1.5, layer=3)
guide = line(F, supportAB, angle=90, kind=infinite, dashed=true, color=cyan, width=1.2, opacity=0.7, layer=2)
lower, upper = intersect(guide, outer, label=none, shape=circle, color=orange, size=7, layer=5)
T = intersect(guide, outer, pick=1, label="T", label_pos=above_left, shape=dot, color=orange, size=5, layer=5)

M = along(A, B, 1 / 2, label="M", label_pos=below, shape=square, color=red, size=6, layer=5)
edgeList = [AB, BC, CD, DA]
axisRay = line(O, top, kind=ray, arrow=both, dashed=true, color=cyan, width=1.2, layer=2)
rotatedRay = transform(axisRay, rotate, O, 30, arrow=end, color=green, width=1.2, opacity=0.75, layer=2)
bisector = line(B, A, C, ratio=1 / 2, kind=ray, arrow=end, color=yellow, width=1.2, opacity=0.8, layer=2)
scaledOuter = transform(outer, scale, O, 0.68, dashed=true, color=green, width=1, opacity=0.45, layer=2)
translatedP = transform(P, move, 0, -2.2, label="Q", label_pos=below_left, shape=square, size=5, color=orange, layer=5)
mirroredP = transform(P, mirror, axisRay, label="P2", label_pos=right, shape=cross, size=6, color=red, layer=5)

mark(right, A, B, C, color=red, size=5, layer=6)
mark(equal, AB, CD, color=purple, size=3, layer=6)
mark(equal_angle, D, A, B, B, C, D, color=orange, size=5, layer=6)
mark(parallel, BC, DA, color=green, size=3, layer=6)
