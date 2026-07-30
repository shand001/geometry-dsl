# 欧拉线：外心 O、重心 G、垂心 H 三点共线
A = point(-3, -2, label_pos=below_left, layer=5)
B = point(3, -2, label_pos=below_right, layer=5)
C = point(1, 2.5, label_pos=above, layer=5)

AB = line(A, B, color="#1f2937", width=2, layer=2)
BC = line(B, C, color="#1f2937", width=2, layer=2)
CA = line(C, A, color="#1f2937", width=2, layer=2)

# 外接圆与外心 O
circum = circle(A, B, C, dashed=true, color="#9ca3af", width=1.5, layer=0)
O = point(circum.center, label="O", label_pos=below_left, shape=circle, size=6, color="#8b5cf6", layer=5)

# 三条中线与重心 G
mA = along(B, C, 1 / 2, visible=false)
mB = along(C, A, 1 / 2, visible=false)
mC = along(A, B, 1 / 2, visible=false)
medA = line(A, mA, dashed=true, color="#10b981", width=1, opacity=0.7, layer=1)
medB = line(B, mB, dashed=true, color="#10b981", width=1, opacity=0.7, layer=1)
medC = line(C, mC, dashed=true, color="#10b981", width=1, opacity=0.7, layer=1)
G = along(A, mA, 2 / 3, label="G", label_pos=below, shape=square, size=6, color="#059669", layer=5)

# 三条高与垂心 H
sAB = line(A, B, kind=infinite, visible=false)
sBC = line(B, C, kind=infinite, visible=false)
sCA = line(C, A, kind=infinite, visible=false)
footA = project(A, sBC, visible=false)
footB = project(B, sCA, visible=false)
footC = project(C, sAB, visible=false)
altA = line(A, footA, dashed=true, color="#3b82f6", width=1, opacity=0.7, layer=1)
altB = line(B, footB, dashed=true, color="#3b82f6", width=1, opacity=0.7, layer=1)
altC = line(C, footC, dashed=true, color="#3b82f6", width=1, opacity=0.7, layer=1)
H = intersect(altA, altB, pick=0, label="H", label_pos=right, shape=cross, size=6, color="#2563eb", layer=5)

# 垂足处的直角标记
mark(right, A, footA, B, color="#3b82f6", size=4, layer=3)
mark(right, B, footB, C, color="#3b82f6", size=4, layer=3)
mark(right, C, footC, A, color="#3b82f6", size=4, layer=3)

# 欧拉线
euler = line(O, H, kind=infinite, color="#dc2626", width=1.5, layer=1)
