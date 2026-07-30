# 生命种子：中心圆 + 六个旋转 60° 的等圆，透镜花瓣由区域交运算生成
O = point(0, 0, visible=false)
P = point(3, 0, visible=false)

c0 = circle(O, 3, color="#64748b", width=1.5, layer=3)
c1 = circle(P, 3, color="#64748b", width=1.5, layer=3)
c2 = transform(c1, rotate, O, 60)
c3 = transform(c1, rotate, O, 120)
c4 = transform(c1, rotate, O, 180)
c5 = transform(c1, rotate, O, 240)
c6 = transform(c1, rotate, O, 300)

# 六片花瓣：中心圆盘与各卫星圆盘的交集
petal1 = intersection(inside(c0), inside(c1), fill="#fecdd3", opacity=0.85, layer=1)
petal2 = intersection(inside(c0), inside(c2), fill="#fed7aa", opacity=0.85, layer=1)
petal3 = intersection(inside(c0), inside(c3), fill="#fef08a", opacity=0.85, layer=1)
petal4 = intersection(inside(c0), inside(c4), fill="#bbf7d0", opacity=0.85, layer=1)
petal5 = intersection(inside(c0), inside(c5), fill="#bfdbfe", opacity=0.85, layer=1)
petal6 = intersection(inside(c0), inside(c6), fill="#ddd6fe", opacity=0.85, layer=1)

# 花心（七个圆盘交于唯一一点，无面积，改用实心小圆点缀）
core = circle(O, 0.9, fill="#fbbf24", color="#d97706", width=1.5, layer=2)

# 外框：经过六个卫星圆心的圆
outer = circle(O, 6, color="#334155", width=2, layer=4)
