# 空间几何线框图的二维投影

# 顶点：A、B、C、D 为底部投影，E、F 为上层顶点，G 为辅助点
A = point(0, 0, label_pos=below_left, size=4)
B = point(6, 0, label_pos=below_right, size=4)
C = point(8, 2.1, label_pos=right, size=4)
D = point(3, 2.1, label_pos=left, size=4)
E = point(3.25, 5.25, label_pos=above_left, size=4)
F = point(8, 6.45, label_pos=above, size=4)
G = along(B, C, 0.55, label_pos=below_right, size=4)

# 外轮廓与可见棱
AB = line(A, B, width=2)
BC = line(B, C, width=2)
CD = line(C, D, width=2)
DA = line(D, A, dashed=true, width=1.4, opacity=0.85)
DE = line(D, E, dashed=true, width=1.4, opacity=0.85)
EF = line(E, F, width=2)
FC = line(F, C, width=2)
EB = line(E, B, width=2)
BG = line(B, G, width=2)
AE = line(A, E, width=2)
BF = line(B, F, width=2)

# 内部及被遮挡棱线
DB = line(D, B, dashed=true, width=1.4, opacity=0.85)
EC = line(E, C, dashed=true, width=1.4, opacity=0.85)
DG = line(D, G, dashed=true, width=1.4, opacity=0.85)

# 坐标轴：x 轴向左下，y 轴向右，z 轴向上
X0 = point(-2.0, -1.55, visible=false)
Y0 = point(9.2, 0.67, visible=false)
Z0 = point(3.0, 2.1, visible=false)
x_axis = line(A, X0, kind=ray, arrow=end, width=1.5)
y_axis = line(G, Y0, kind=ray, arrow=end, width=1.5)
z_axis = line(Z0, point(3.0, 7.3, visible=false), kind=ray, arrow=end, width=1.5)

# 轴标签用独立点放置，避免改变线框顶点标签
x_label = point(-2.15, -1.8, label="x", label_pos=below_left, visible=true, size=1)
y_label = point(10.65, 0.0, label="y", label_pos=right, visible=true, size=1)
z_label = point(3.0, 7.45, label="z", label_pos=above, visible=true, size=1)
