# 内心与内切圆：三条角平分线共点，该点到三边距离相等
A = point(-3, -2, label_pos=below_left, layer=5)
B = point(3.5, -2, label_pos=below_right, layer=5)
C = point(-0.5, 3, label_pos=above, layer=5)

triangle = path(A, B, C, closed=true, fill="#eff6ff", color="#1f2937", width=2, layer=1)

# 三条角平分线（ratio=1/2 即内角平分方向；射线仅用于求交，裁剪到对边显示）
bisA = line(A, B, C, ratio=1 / 2, kind=ray, visible=false)
bisB = line(B, C, A, ratio=1 / 2, kind=ray, visible=false)
bisC = line(C, A, B, ratio=1 / 2, kind=ray, visible=false)
sBC0 = line(B, C, kind=infinite, visible=false)
sCA0 = line(C, A, kind=infinite, visible=false)
sAB0 = line(A, B, kind=infinite, visible=false)
hitA = intersect(bisA, sBC0, pick=0, visible=false)
hitB = intersect(bisB, sCA0, pick=0, visible=false)
hitC = intersect(bisC, sAB0, pick=0, visible=false)
segA = line(A, hitA, dashed=true, color="#10b981", width=1.2, layer=2)
segB = line(B, hitB, dashed=true, color="#10b981", width=1.2, layer=2)
segC = line(C, hitC, dashed=true, color="#10b981", width=1.2, layer=2)

# 内心 I：平分线交点
I = intersect(bisA, bisB, pick=0, label="I", label_pos=above_right, shape=circle, size=6, color="#059669", layer=5)

# 三边上的垂足（切点）与半径
sAB = line(A, B, kind=infinite, visible=false)
sBC = line(B, C, kind=infinite, visible=false)
sCA = line(C, A, kind=infinite, visible=false)
footAB = project(I, sAB, shape=dot, size=4, color="#d97706", label=none, layer=4)
footBC = project(I, sBC, shape=dot, size=4, color="#d97706", label=none, layer=4)
footCA = project(I, sCA, shape=dot, size=4, color="#d97706", label=none, layer=4)
r1 = line(I, footAB, dashed=true, color="#f59e0b", width=1.2, layer=2)
r2 = line(I, footBC, dashed=true, color="#f59e0b", width=1.2, layer=2)
r3 = line(I, footCA, dashed=true, color="#f59e0b", width=1.2, layer=2)

# 内切圆：圆心 + 圆上一点（切点）
incircle = circle(I, footAB, fill="#fef3c7", color="#d97706", width=2, layer=1)

# 语义标记：角平分（两半边相等）与切点处的直角
mark(equal_angle, B, A, I, I, A, C, color="#10b981", size=5, layer=6)
mark(right, A, footAB, I, color="#d97706", size=4, layer=6)
mark(right, B, footBC, I, color="#d97706", size=4, layer=6)
mark(right, C, footCA, I, color="#d97706", size=4, layer=6)
