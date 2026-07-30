# 一个挥手的人
# 所有结构点隐藏，只绘制最终图形

# 头部与耳朵
HC = point(0, 6.8, visible=false)
HR = point(1.35, 6.8, visible=false)
head = circle(HC, HR, fill="#f2bd8f", color="#573d32", width=3, layer=3)

LEC = point(-1.35, 6.75, visible=false)
LER = point(-1.68, 6.75, visible=false)
REC = point(1.35, 6.75, visible=false)
RER = point(1.68, 6.75, visible=false)
left_ear = circle(LEC, LER, fill="#f1ae73", color="#573d32", width=2, layer=2)
right_ear = circle(REC, RER, fill="#f2bd8f", color="#573d32", width=2, layer=2)

# 头发
HT = point(0, 8.15, visible=false)
HL = point(-1.1662332537, 7.48, visible=false)
HRT = point(1.1662332537, 7.48, visible=false)
hair_left = arc(head, HL, HT, sweep=short, color="#3a2925", width=10, layer=4)
hair_right = arc(head, HT, HRT, sweep=short, color="#3a2925", width=10, layer=4)

# 眼睛、鼻子和笑脸
eye_left = point(-0.48, 7.0, size=7, color="#2b211f", label=none, layer=5)
eye_right = point(0.48, 7.0, size=7, color="#2b211f", label=none, layer=5)
N1 = point(0, 6.87, visible=false)
N2 = point(-0.10, 6.55, visible=false)
nose = line(N1, N2, color="#b87459", width=2, layer=5)

MC = point(0, 6.42, visible=false)
ML = point(-0.55, 6.42, visible=false)
MR = point(0.55, 6.42, visible=false)
mouth_circle = circle(MC, ML, visible=false)
mouth = arc(mouth_circle, ML, MR, sweep=ccw, color="#a33f46", width=3, layer=5)

# 颈部
NLT = point(-0.42, 5.65, visible=false)
NRT = point(0.42, 5.65, visible=false)
NRB = point(0.48, 5.05, visible=false)
NLB = point(-0.48, 5.05, visible=false)
neck = path(NLT, NRT, NRB, NLB, closed=true, fill="#f2bd8f", color="#573d32", width=2, layer=2)

# 上衣
SL = point(-1.65, 5.15, visible=false)
SR = point(1.65, 5.15, visible=false)
WR = point(1.38, 2.25, visible=false)
WL = point(-1.38, 2.25, visible=false)
shirt = path(SL, SR, WR, WL, closed=true, smooth=true, fill="#4d83d1", color="#27496f", width=3, layer=2)

# 衣领
CL = point(-0.55, 5.15, visible=false)
CB = point(0, 4.65, visible=false)
CR = point(0.55, 5.15, visible=false)
collar = path(CL, CB, CR, color=white, width=4, layer=4)

# 左臂自然下垂
LA1 = point(-1.58, 4.78, visible=false)
LA2 = point(-2.15, 3.25, visible=false)
LA3 = point(-2.05, 1.85, visible=false)
left_sleeve = line(LA1, LA2, color="#4d83d1", width=20, layer=1)
left_arm = line(LA2, LA3, color="#f2bd8f", width=15, layer=1)
LH_R = point(-1.82, 1.85, visible=false)
left_hand = circle(LA3, LH_R, fill="#f2bd8f", color="#573d32", width=2, layer=3)

# 右臂挥手
RA1 = point(1.58, 4.8, visible=false)
RA2 = point(2.6, 5.35, visible=false)
RA3 = point(3.05, 6.65, visible=false)
right_sleeve = line(RA1, RA2, color="#4d83d1", width=20, layer=1)
right_arm = line(RA2, RA3, color="#f2bd8f", width=15, layer=1)
RH_R = point(3.32, 6.65, visible=false)
right_hand = circle(RA3, RH_R, fill="#f2bd8f", color="#573d32", width=2, layer=3)

# 挥动线
W1C = point(3.12, 6.75, visible=false)
W1S = point(3.12, 7.35, visible=false)
W1E = point(3.6396152423, 6.45, visible=false)
wave_circle1 = circle(W1C, W1S, visible=false)
wave1 = arc(wave_circle1, W1S, W1E, sweep=short, color="#4d83d1", width=3, layer=1)
W2C = point(3.2, 6.75, visible=false)
W2S = point(3.2, 7.75, visible=false)
W2E = point(4.0479976411, 6.22, visible=false)
wave_circle2 = circle(W2C, W2S, visible=false)
wave2 = arc(wave_circle2, W2S, W2E, sweep=short, color="#4d83d1", width=3, layer=1)

# 裤子
PL = point(-1.35, 2.4, visible=false)
PR = point(1.35, 2.4, visible=false)
PRB = point(1.05, 0.95, visible=false)
PM = point(0, 1.3, visible=false)
PLB = point(-1.05, 0.95, visible=false)
pants = path(PL, PR, PRB, PM, PLB, closed=true, fill="#263b5c", color="#17263d", width=3, layer=2)

# 双腿
LL1 = point(-0.68, 1.15, visible=false)
LL2 = point(-0.78, -1.15, visible=false)
RL1 = point(0.68, 1.15, visible=false)
RL2 = point(0.82, -1.15, visible=false)
left_leg = line(LL1, LL2, color="#f2bd8f", width=18, layer=1)
right_leg = line(RL1, RL2, color="#f2bd8f", width=18, layer=1)

# 鞋子
LS1 = point(-1.18, -1.18, visible=false)
LS2 = point(-0.45, -1.18, visible=false)
LS3 = point(-0.38, -1.58, visible=false)
LS4 = point(-1.28, -1.58, visible=false)
left_shoe = path(LS1, LS2, LS3, LS4, closed=true, smooth=true, fill="#e8a33a", color="#68451d", width=3, layer=3)

RS1 = point(0.48, -1.18, visible=false)
RS2 = point(1.18, -1.18, visible=false)
RS3 = point(1.28, -1.58, visible=false)
RS4 = point(0.38, -1.58, visible=false)
right_shoe = path(RS1, RS2, RS3, RS4, closed=true, smooth=true, fill="#e8a33a", color="#68451d", width=3, layer=3)
