# 勾股定理：3-4-5 直角三角形，三边上的正方形面积 9 + 16 = 25
A = point(0, 0, label_pos=below_left, layer=5)
B = point(4, 0, label_pos=below_right, layer=5)
C = point(0, 3, label_pos=above_left, layer=5)

# 三边向外作正方形
D1 = point(4, -4, visible=false)
D2 = point(0, -4, visible=false)
sqAB = path(A, B, D1, D2, closed=true, fill="#dbeafe", color="#3b82f6", width=1.5, layer=0)

E1 = point(-3, 3, visible=false)
E2 = point(-3, 0, visible=false)
sqAC = path(A, C, E1, E2, closed=true, fill="#dcfce7", color="#22c55e", width=1.5, layer=0)

F1 = point(3, 7, visible=false)
F2 = point(7, 4, visible=false)
sqBC = path(B, C, F1, F2, closed=true, fill="#ede9fe", color="#8b5cf6", width=1.5, layer=0)

# 三角形本体
triangle = path(A, B, C, closed=true, fill="#fef3c7", color="#d97706", width=2, layer=1)

# 正方形面积标注（自动在区域内部居中）
areaAB = text(inside(sqAB), "16", size=30, color="#1d4ed8", layer=5)
areaAC = text(inside(sqAC), "9", size=24, color="#15803d", layer=5)
areaBC = text(inside(sqBC), "25", size=30, color="#6d28d9", layer=5)

# 直角标记
mark(right, B, A, C, color="#dc2626", size=6, layer=6)
