# 五角星：星形边的交点恰为黄金分割点，围成内五边形
V0 = point(0, 4, visible=false)
V1 = point(-3.804226, 1.236068, visible=false)
V2 = point(-2.351141, -3.236068, visible=false)
V3 = point(2.351141, -3.236068, visible=false)
V4 = point(3.804226, 1.236068, visible=false)

# 外接圆与外五边形（淡色衬底）
circum = circle(V0, V1, V2, dashed=true, color="#94a3b8", width=1.2, opacity=0.6, layer=0)
s0 = line(V0, V1, color="#cbd5e1", width=1.2, layer=0)
s1 = line(V1, V2, color="#cbd5e1", width=1.2, layer=0)
s2 = line(V2, V3, color="#cbd5e1", width=1.2, layer=0)
s3 = line(V3, V4, color="#cbd5e1", width=1.2, layer=0)
s4 = line(V4, V0, color="#cbd5e1", width=1.2, layer=0)

# 星形边（隐藏，仅用于求交点）
e0 = line(V0, V2, visible=false)
e1 = line(V2, V4, visible=false)
e2 = line(V4, V1, visible=false)
e3 = line(V1, V3, visible=false)
e4 = line(V3, V0, visible=false)

# 星形本体：单条闭合路径 + evenodd 填充
star = path(V0, V2, V4, V1, V3, closed=true, fill_rule=evenodd, fill="#fde68a", color="#f59e0b", width=2, layer=1)

# 五个交点即内五边形顶点
q1 = intersect(e0, e2, pick=0, visible=false)
q2 = intersect(e2, e4, pick=0, visible=false)
q3 = intersect(e4, e1, pick=0, visible=false)
q4 = intersect(e1, e3, pick=0, visible=false)
q5 = intersect(e3, e0, pick=0, visible=false)

inner = path(q1, q5, q4, q3, q2, closed=true, fill="#fbbf24", color="#b45309", width=1.5, layer=2)
