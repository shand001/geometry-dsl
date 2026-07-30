# Geometry DSL V0.4 文档中的基础几何示例
O = point(0, 0)
A = point(0, 6)
B = point(6, 0)
C = point(0, -6)
D = point(-6, 0)

outer = circle(O, A, color="#222222", width=3)
vertical = line(C, A, dashed=true, color=gray)
horizontal = line(D, B, dashed=true, color=gray)
L, R = intersect(horizontal, outer, visible=false)

M = along(O, B, 0.5)
N = along(O, A, 0.5)
K = along(O, B, 0.72, visible=false)

diamond = path(A, B, C, D, closed=true, color="#444444", width=2)
petal1 = path(
    O, N, A, K,
    closed=true,
    smooth=true,
    fill="#dddddd",
    color="#555555",
    opacity=0.75
)
petal2 = transform(petal1, rotate, O, 90)
petal3 = transform(petal1, rotate, O, 180)
petal4 = transform(petal1, rotate, O, 270)
petals = [petal1, petal2, petal3, petal4]

arcAB = arc(outer, A, B, sweep=short, width=4)
arcBC = arc(outer, B, C, sweep=short, width=4)
arcCD = arc(outer, C, D, sweep=short, width=4)
arcDA = arc(outer, D, A, sweep=short, width=4)

diagonal = line(A, B, visible=false)
F = project(O, diagonal, label="F")
OF = line(O, F, dashed=true, color=gray)

parallel_guide = line(M, diagonal, kind=infinite, dashed=true, color="#aaaaaa")
perpendicular_guide = line(N, diagonal, angle=90, kind=infinite, dashed=true, color="#aaaaaa")
bisector = line(O, A, B, ratio=0.5, dashed=true, color=gray)
E = intersect(bisector, outer, pick=0, label="E", color=red)
OE = line(O, E, dashed=true, color=red)

OA = line(O, A, visible=false)
OB = line(O, B, visible=false)
mark(equal, OA, OB)
mark(right, A, O, B)
mark(equal_angle, A, O, E, E, O, B)
mark(parallel, parallel_guide, diagonal)
