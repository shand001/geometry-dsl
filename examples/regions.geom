# A finite universe containing all four membership regions of two disks.
F1 = point(-6, -4, visible=false)
F2 = point(6, -4, visible=false)
F3 = point(6, 4, visible=false)
F4 = point(-6, 4, visible=false)
frame = path(F1, F2, F3, F4, closed=true, visible=false)
universe = inside(frame)

O1 = point(-1.8, 0, visible=false)
O2 = point(1.8, 0, visible=false)
c1 = circle(O1, 3, fill=none, color=blue, width=2, layer=5)
c2 = circle(O2, 3, fill=none, color=red, width=2, layer=5)
disk1 = inside(c1)
disk2 = inside(c2)

leftOnly = difference(disk1, disk2, fill="#bfdbfe", layer=1)
overlap = intersection(disk1, disk2, fill="#c4b5fd", layer=1)
rightOnly = difference(disk2, disk1, fill="#fecaca", layer=1)
bothOutside = difference(
    universe,
    union(disk1, disk2),
    fill="#f3f4f6",
    layer=0,
)

labelA = text(leftOnly, "A", size=24, layer=10)
labelB = text(overlap, "B", size=24, layer=10)
labelC = text(rightOnly, "C", size=24, layer=10)
labelD = text(bothOutside, "D", size=24, layer=10)
