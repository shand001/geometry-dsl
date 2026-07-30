# Reproduction of the supplied geometry figure.
# ABC is an acute triangle inscribed in the circle; E and F are the
# feet of the altitudes from A and C, and H is the orthocenter.

O = point(0, 0, size=7, color="#222222", label="O", layer=6)
A = point(-0.7814167995, 4.4316348886, size=7, color="#222222", label="A", layer=6)
B = point(-3.8971143170, -2.25, size=7, color="#222222", label="B", layer=6)
C = point(3.8971143170, -2.25, size=7, color="#222222", label="C", layer=6)
D = point(0, -4.5, size=7, color="#222222", label="D", layer=6)

circumcircle = circle(O, 4.5, color="#444444", width=2.5, layer=0)

# Main triangle and its two altitudes.
AB = line(A, B, color="#111111", width=2.8, layer=3)
AC = line(A, C, color="#111111", width=2.8, layer=3)
BC = line(B, C, color="#111111", width=2.8, layer=3)

E = project(A, BC, color="#222222", size=7, label="E", layer=6)
F = project(C, AB, color="#222222", size=7, label="F", layer=6)
AE = line(A, E, color="#111111", width=2.5, layer=3)
CF = line(C, F, color="#111111", width=2.5, layer=3)
H = intersect(AE, CF, pick=0, color="#222222", size=7, label="H", layer=6)

# Additional chords and the central construction in the reference image.
AD = line(A, D, color="#111111", width=2.5, layer=3)
HD = line(H, D, color="#111111", width=2.5, layer=3)

# Dashed auxiliary lines.
AO = line(A, O, dashed=true, color="#111111", width=1.5, layer=1)
OB = line(O, B, dashed=true, color="#111111", width=1.5, layer=1)
OC = line(O, C, dashed=true, color="#111111", width=1.5, layer=1)
OD = line(O, D, dashed=true, color="#111111", width=1.5, layer=1)
BH = line(B, H, dashed=true, color="#111111", width=1.5, layer=1)
BD = line(B, D, dashed=true, color="#111111", width=1.5, layer=1)
CD = line(C, D, dashed=true, color="#111111", width=1.5, layer=1)

# Right-angle marks at the two altitude feet.
mark(right, A, E, B, color="#222222", size=3, layer=7)
mark(right, C, F, A, color="#222222", size=3, layer=7)
