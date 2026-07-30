# Geometry DSL V0.4 语言协议

## 0. 文档定位

Geometry DSL 用于声明二维几何对象及其绘制外观，并由实现方输出为 SVG、Canvas 或其他二维图形格式。

本文只规定：

- 源语言语法；
- 几何对象的数学语义；
- 样式参数的语言语义；
- 结果顺序、退化情况和错误条件；
- 一份合规实现必须遵守的确定性规则。

本文不规定：

- 词法分析器、AST 或编译流程；
- 求交、样条、区域搜索和标签布局的内部算法；
- 画布尺寸、自动缩放和缓存策略；
- SVG 或 Canvas 的具体输出结构；
- 编辑器、动画和交互行为。

本文中的“必须”和“不得”是合规要求，“可以”表示允许的实现选择，
“应”表示有充分理由时才可偏离的建议。

---

## 1. 设计目标

本协议的目标是用少量、正交、可组合的语法描述常见二维几何图。

核心原则：

1. **几何语义明确**：线段、射线和无限直线不能只靠显示效果区分。
2. **样式就地声明**：样式参数统一写在对象调用的末尾，不设置独立的样式函数。
3. **默认值足够可用**：所有描边对象默认黑色实线，普通图形不必重复写样式。
4. **选项必须命名**：布尔值、可选模式和样式使用命名参数；
   `transform()` 与 `mark()` 的必选操作符直接决定调用签名，固定为
   第二个和第一个位置参数。
5. **定义即不可变**：名称只定义一次，对象创建后不原地修改。
6. **不做含糊推断**：无法唯一确定的几何结果必须报错。
7. **不隐藏几何范围**：求交和投影按照对象真实范围计算，而不是一律使用无限支撑线。
8. **结果顺序确定**：相同源码必须得到相同的几何对象和结果顺序。
9. **基础函数可组合**：不为中点、垂足、三角形、外心等概念分别增加专用函数。
10. **语言保持小型**：协议不包含变量重赋值、循环、条件、用户函数和约束求解。
11. **区域是一等值**：封闭几何的内部可以通过交、并、差组合，不为特定图形增加专用阴影函数。
12. **文字职责分离**：点名继续由 Point 的 `label` 表达，自由文字和区域文字统一由 `text()` 表达。

这是一门独立 DSL。它借用了常见的函数调用、列表和关键字参数写法，但不是 Python 的子集。

---

## 2. 最小语言结构

### 2.1 核心函数

协议定义 15 个核心函数：

```text
point()
along()
line()
circle()
arc()
path()
project()
intersect()
transform()
mark()
text()
inside()
union()
intersection()
difference()
```

它们分别负责：

```text
位置      point, along, project, intersect
直线      line
圆曲线    circle, arc
路径      path
变换      transform
标记      mark
文字      text
区域      inside, union, intersection, difference
```

### 2.2 基础类型

```text
Number
Boolean
String
Color
Enum
None
Point
Line
Circle
Arc
Path
Mark
Text
Region
List
List[T]
```

说明：

- `Number`：有限实数；
- `Boolean`：`true` 或 `false`；
- `String`：双引号字符串；
- `Color`：命名颜色或十六进制颜色；
- `Enum`：具体函数签名预定义的无引号模式值，例如 `ray`、`cw`、`rotate`；
- `None`：唯一值是字面量 `none`，不属于 `Enum`；
- `Point`：二维点；
- `Line`：有方向、有范围的直线类对象；
- `Circle`：完整圆；
- `Arc`：圆的一段；
- `Path`：折线、多边形或确定的样条路径；
- `Mark`：直角、等长、等角、平行等视觉标记；
- `Text`：位于固定坐标或由有限 Region 自动定位的独立文字；
- `Region`：由圆或闭合 Path 的内部经布尔运算组成的有限二维区域；
- `List`：可包含同类或混合值的有序集合；
- `List[T]`：元素全部为 `T` 的列表类型记法。

`List` 本身不是几何对象，不会额外绘制内容。

---

## 3. 词法和基本语法

### 3.1 标识符

标识符格式：

```text
[A-Za-z_][A-Za-z0-9_]*
```

合法示例：

```text
A
AB
outer_circle
petal2
_helper
```

名称必须先定义后使用，并且只能定义一次：

```text
A = point(0, 0)
A = point(1, 2)  # 错误：A 已定义
```

单独的 `_` 是丢弃目标，不创建名称，也不绘制对应结果。

以下字面量和模式名称是保留字，不能作为用户标识符：

```text
true false none

black white gray red orange yellow green cyan blue purple

point along line circle arc path
project intersect transform mark text
inside union intersection difference

segment ray infinite
short long cw ccw
move rotate mirror scale
right equal equal_angle parallel

evenodd nonzero
dot circle square cross
auto above below left right
above_left above_right below_left below_right
start end both
```

同一保留字可以承担多个已声明角色，例如 `circle` 既是函数名也是点
形状，`right` 既可表示标记种类也可表示标签位置；其语法位置和参数
类型足以唯一确定含义。

### 3.2 字面量

源文件必须使用 UTF-8 编码；文件开头可有一个 UTF-8 BOM，实现必须
忽略它。

数字的词法形式：

```text
[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?
```

正负号属于一元运算符，不属于数字词法本身。

```text
12
-3.5
1e-4
true
false
none
"A"
"第一象限"
```

布尔值和空值固定使用小写形式：

```text
true
false
none
```

字符串必须使用双引号，支持以下转义：

```text
\"   双引号
\\   反斜线
\n   换行
\t   制表符
```

字符串不能跨物理行。其他反斜线转义必须报错。字符串内部的 `#`
不是注释起点。

### 3.3 数值表达式

支持：

```text
+  -  *  /
()
```

优先级从高到低：

```text
()
一元 +、-
*、/
+、-
```

同一优先级的二元运算符从左到右结合；连续一元符号从右到左应用。

示例：

```text
M = along(A, B, 1 / 2)
m = 2
n = 3
P = along(A, B, m / (m + n))
```

除数为零、非有限结果和数值溢出必须报错。

### 3.4 赋值与多结果赋值

```text
A = point(0, 0)
AB = line(A, B)
P, Q = intersect(AB, c)
```

多结果数量必须与非 `_` 目标及丢弃目标的总数量一致：

```text
P, _ = intersect(AB, c)
```

如果实际结果数量不匹配，必须报错，不能自动复制、遗漏或随机选取。

任何返回 `List` 的表达式都可以绑定到一个列表名称：

```text
hits = intersect(AB, c)
```

这种写法不执行解构，`hits` 的类型是 `List[Point]`。也可以用逗号目标对列表进行精确解构：

```text
A2, B2 = transform([A, B], rotate, O, 90)
```

### 3.5 列表

```text
edges = [AB, BC, CA]
petals = [petal1, petal2, petal3, petal4]
```

列表：

- 保持元素顺序；
- 不复制其中的对象；
- 不改变对象的可见性和样式；
- 可传给 `transform()`。

### 3.6 注释、空白和换行

`#` 到行末为注释：

```text
A = point(0, 0)  # 圆心
```

函数调用和列表在括号未闭合时可以跨行：

```text
petal = path(
    O,
    A,
    B,
    C,
    closed=true,
    smooth=true,
    fill="#dddddd"
)
```

空格和制表符只用于分隔词法单元，没有缩进语义。字符串之外的
`CRLF` 和 `LF` 都视为换行。

语言不使用分号，一条语句占一个逻辑行。未闭合的 `()` 或 `[]`
内部，物理换行及其前后的空白被忽略；其中的注释仍在物理行末结束。

### 3.7 参数顺序

每个对象调用的参数顺序固定为：

```text
位置几何参数
→ 命名几何参数
→ 命名样式参数
```

例如：

```text
l = line(A, B, kind=ray, color=blue, dashed=true)
```

其中：

- `A, B` 是位置几何参数；
- `kind=ray` 是命名几何参数；
- `color=blue, dashed=true` 是样式参数。

`transform()` 和 `mark()` 的必选操作符属于位置签名参数，不是可选
模式；它们只能出现在各自签名规定的位置。

同一组内的命名参数可以按任意顺序书写。

出现第一个命名参数后，不能再出现位置参数；出现第一个样式参数后，
不能再出现几何参数。

### 3.8 参考语法

以下 EBNF 描述语法骨架；函数重载、参数适用性和类型约束由后续章节规定。

```text
program        = { [ statement ], newline }, [ statement ] ;

statement      = assignment
               | mark_call ;

assignment     = targets, "=", expression ;
targets        = target, { ",", target } ;
target         = identifier | "_" ;

expression     = additive ;
additive       = multiplicative, { ("+" | "-"), multiplicative } ;
multiplicative = unary, { ("*" | "/"), unary } ;
unary          = { "+" | "-" }, postfix ;
postfix        = primary, { ".", attribute_name } ;
attribute_name = "x" | "y" | "kind" | "center" | "radius"
               | "circle" | "start" | "end" | "sweep"
               | "points" | "closed" | "smooth" ;

primary        = number
               | boolean
               | none
               | string
               | color_literal
               | enum_literal
               | identifier
               | call
               | list
               | "(", expression, ")" ;

call           = function_name, "(", [ arguments ], ")" ;
function_name  = "point" | "along" | "line" | "circle" | "arc"
               | "path" | "project" | "intersect" | "transform" | "mark"
               | "text" | "inside" | "union" | "intersection"
               | "difference" ;
mark_call      = "mark", "(", [ arguments ], ")" ;
arguments      = argument, { ",", argument }, [ "," ] ;
argument       = expression
               | identifier, "=", expression ;

list           = "[", [ expression, { ",", expression }, [ "," ] ], "]" ;

color_literal  = "black" | "white" | "gray" | "red" | "orange"
               | "yellow" | "green" | "cyan" | "blue" | "purple" ;

enum_literal   = "segment" | "ray" | "infinite"
               | "short" | "long" | "cw" | "ccw"
               | "move" | "rotate" | "mirror" | "scale"
               | "right" | "equal" | "equal_angle" | "parallel"
               | "evenodd" | "nonzero"
               | "dot" | "circle" | "square" | "cross"
               | "auto" | "above" | "below" | "left" | "right"
               | "above_left" | "above_right"
               | "below_left" | "below_right"
               | "start" | "end" | "both" ;
```

括号内换行、注释、空白和词法细节按第 3.2、3.6 节处理。

语义限制：

- 独立表达式语句只允许 `mark(...)`；
- 普通位置参数不能出现在命名参数之后；
- 一个调用中不能重复同名参数；
- 属性访问只允许协议列出的只读属性；
- 算术运算只接受 `Number`，不能对几何对象直接做 `+`、`-`、`*`、`/`。

---

## 4. 通用样式系统

### 4.1 基本规则

所有创建可绘制对象的核心函数都接受尾部样式参数：

```text
object = function(geometry_args..., style_key=value...)
```

例如：

```text
A = point(0, 0, color=red, size=6)
AB = line(A, B, dashed=true)
c = circle(O, 5, color=yellow, width=2)
p = path(A, B, C, closed=true, fill="#eeeeee")
caption = text(0, 6, "示意图", color=blue)
disk = inside(c, fill="#dbeafe", layer=-1)
```

样式参数：

- 只影响绘制；
- 不影响求交、投影、相等判断和几何标记验证；
- 不允许在对象创建后原地修改；
- 未写时使用该对象类型的默认值。

Circle 和 Path 的 `fill` 只绘制内部，不改变对象的几何集合。求交和
投影始终针对圆周或路径本身，不针对填充。需要把内部作为可组合的
几何值时，必须使用 `inside()` 创建 Region。

### 4.2 通用样式参数

| 参数 | 适用类型 | 类型 | 默认值 | 含义 |
|---|---|---|---:|---|
| `visible` | 全部可绘制类型 | Boolean | `true` | 是否绘制 |
| `color` | Point, Line, Circle, Arc, Path, Mark, Text | Color | `black` | 描边、点、标记或文字的主颜色 |
| `width` | Line, Circle, Arc, Path, Mark | Number | `1` | 描边逻辑宽度，必须大于 0 |
| `dashed` | Line, Circle, Arc, Path, Mark | Boolean | `false` | 是否使用虚线 |
| `opacity` | 全部可绘制类型 | Number | `1` | 不透明度，范围为 `[0, 1]` |
| `layer` | 全部可绘制类型 | Number | `0` | 绘制层级，必须是整数 |

层级越大越晚绘制；层级相同时按照对象在源码中的创建顺序绘制。

### 4.3 类型专用样式参数

| 参数 | 适用类型 | 类型 | 默认值 | 含义 |
|---|---|---|---:|---|
| `fill` | Circle, Path, Region | Color 或 None | `none` | 填充颜色 |
| `fill_rule` | Path | `evenodd` 或 `nonzero` | `evenodd` | 填充规则 |
| `size` | Point, Mark | Number | `4` | 点或标记的逻辑尺寸，必须大于 0 |
| `size` | Text | Number | 渲染选项 `labelSize` | 初始字体像素尺寸，必须大于 0 |
| `shape` | Point | `dot`、`circle`、`square` 或 `cross` | `dot` | 点形状 |
| `label` | Point | `auto`、None 或 String | `auto` | 自动标签、无标签或固定文本 |
| `label_pos` | Point | 本节列出的标签位置 | `auto` | 标签相对位置 |
| `arrow` | Line | None、`start`、`end` 或 `both` | `none` | 箭头位置 |

`label_pos` 支持：

```text
auto
above
below
left
right
above_left
above_right
below_left
below_right
```

`arrow` 的 `start`、`end` 按 Line 参数增大的方向解释。线段对应两个
实际端点；射线的 `start` 是锚点、`end` 是正方向；无限直线分别是
负方向和正方向。非有限端的具体箭头位置由渲染器在裁剪后决定。

不适用于对象类型的样式参数必须报错。例如：

```text
A = point(0, 0, dashed=true)  # 错误
AB = line(A, B, fill=red)     # 错误
area = inside(c, color=red)   # 错误
note = text(0, 0, "说明", width=2)  # 错误
```

### 4.4 默认样式

全部可绘制对象默认：

```text
visible = true
opacity = 1
layer = 0
```

除 Region 外，支持 `color` 的对象默认：

```text
color = black
```

支持描边的 Line、Circle、Arc、Path 和 Mark 还默认：

```text
width = 1
dashed = false
```

因此：

```text
AB = line(A, B)
```

就是一条黑色实线。

点的附加默认值：

```text
size = 4
shape = dot
label = auto
label_pos = auto
```

Mark 的附加默认值：

```text
size = 4
```

圆、路径和 Region 的附加默认值：

```text
fill = none
```

Text 未显式给出 `size` 时使用渲染选项 `labelSize`。Region 只有：

```text
visible = true
fill = none
opacity = 1
layer = 0
```

Region 不描边。其边界需要可见时，应单独绘制作为来源的 Circle 或
Path。

`label=auto` 表示直接绑定到名称的点使用目标名称作为标签：

```text
A = point(0, 0)  # 默认标签为 A
```

### 4.5 颜色

协议内置以下颜色字面量：

```text
black
white
gray
red
orange
yellow
green
cyan
blue
purple
```

它们是以下不透明 sRGB 颜色：

| 名称 | 十六进制值 |
|---|---|
| `black` | `#000000` |
| `white` | `#ffffff` |
| `gray` | `#808080` |
| `red` | `#ff0000` |
| `orange` | `#ffa500` |
| `yellow` | `#ffff00` |
| `green` | `#008000` |
| `cyan` | `#00ffff` |
| `blue` | `#0000ff` |
| `purple` | `#800080` |

因此可以直接写：

```text
AB = line(A, B, color=yellow)
```

任意颜色使用字符串形式的十六进制值：

```text
AB = line(A, B, color="#f4c542")
shape = path(A, B, C, closed=true, fill="#334455cc")
```

允许格式：

```text
"#RGB"
"#RGBA"
"#RRGGBB"
"#RRGGBBAA"
```

十六进制数字不区分大小写。颜色字符串只接受上述格式，以避免不同
渲染环境对颜色名解释不一致。

短格式的每个十六进制位按重复一次展开，例如 `#3af8` 等于
`#33aaff88`。颜色自身的 alpha 与对象 `opacity` 相乘；`opacity`
同时作用于描边、填充、点、标记、箭头和文字。

### 4.6 样式继承

普通几何构造产生的新对象使用类型默认样式，再应用显式样式参数。
`text()` 和所有 Region 构造函数遵守同一规则；Region 布尔运算不
继承其操作数的样式。

`transform()` 是唯一默认继承源对象样式的函数：

```text
petal1 = path(A, B, C, closed=true, fill=yellow, color=red)
petal2 = transform(petal1, rotate, O, 90)
```

`petal2` 继承 `petal1` 的填充和描边。显式参数覆盖继承值：

```text
petal3 = transform(petal1, rotate, O, 180, fill=blue)
```

对列表变换时，每个结果分别继承其对应源对象的样式，随后应用统一的显式覆盖值。

列表上的显式样式必须适用于列表中的每个结果类型；只要有一个元素不适用，整个调用就必须报错。

---

## 5. `point()`：坐标点

### 5.1 签名

```text
point(Number x, Number y, styles...) -> Point
point(Point source, styles...) -> Point
```

第二个重载在与 `source` 相同的坐标创建一个新的可绘制点实例。它适合显示属性访问得到的点，或为已有点创建不同外观；不会修改源点。

### 5.2 示例

```text
A = point(0, 0)
B = point(8, 0, color=blue)
C = point(3, 6, label="顶点 C", label_pos=above)
A_copy = point(A, color=red, label=none)
```

坐标属于几何世界坐标，不是像素坐标。

### 5.3 错误条件

- 缺少坐标；
- 坐标不是有限 `Number`；
- `source` 不是 `Point`；
- 使用未知或不适用的样式参数。

`point()` 必须提供固定坐标；自由点和约束点属于协议范围外：

```text
A = point()  # 错误
```

---

## 6. `along()`：有向比例点

### 6.1 签名

```text
along(Point A, Point B, Number t, styles...) -> Point
```

数学定义：

```text
P = A + t(B - A)
```

参数含义：

```text
t = 0       P 与 A 重合
t = 1       P 与 B 重合
0 < t < 1   P 在线段 AB 内
t = 0.5     P 是 AB 的中点
t > 1       P 越过 B
t < 0       P 位于 A 的反向一侧
```

### 6.2 示例

```text
M = along(A, B, 0.5)
P = along(A, B, 2 / 5)
Q = along(A, B, 1.2, visible=false)
```

如果：

```text
AP : PB = m : n
```

则：

```text
P = along(A, B, m / (m + n))
```

中点、内分点、外分点和沿方向延长点统一使用 `along()` 表达，无需增加：

```text
midpoint()
divide()
ratio_point()
extension_point()
```

### 6.3 错误条件

- `A` 与 `B` 重合；
- `t` 不是有限数；
- 参数类型错误。

---

## 7. `line()`：直线类对象

`line()` 的重载只由位置几何参数的数量和类型决定。`kind`、`angle`、`ratio`、`extend` 和任何样式参数都不能用于猜测另一个重载。

### 7.1 两点确定方向

```text
line(
    Point A,
    Point B,
    kind=segment,
    extend=0,
    styles...
) -> Line
```

示例：

```text
AB = line(A, B)
r = line(A, B, kind=ray, arrow=end)
l = line(A, B, kind=infinite, dashed=true)
AE = line(A, B, extend=3, dashed=true)
```

所有 `Line` 都保存有向参数式：

```text
X(t) = A + t(B - A)
```

`kind` 决定有效参数范围：

| `kind` | 参数范围 | 几何含义 |
|---|---|---|
| `segment` | `0 ≤ t ≤ 1 + extend / distance(A, B)` | A 到有效终点的线段 |
| `ray` | `t ≥ 0` | 从 A 经过 B 的射线 |
| `infinite` | `t ∈ R` | 经过 A、B 的无限直线 |

默认是 `segment`。

`extend` 表示从 `B` 沿 `A → B` 方向继续延长的世界坐标长度：

```text
effective_end = B + normalize(B - A) × extend
```

要求：

```text
extend ≥ 0
```

`extend` 只适用于 `kind=segment`。它改变线段的真实几何终点和求交范围，不是单纯的显示效果。

### 7.2 过点按参考方向作线

```text
line(
    Point P,
    Line reference,
    angle=0,
    kind=infinite,
    styles...
) -> Line
```

含义：

- 经过 `P`；
- 以 `reference` 的有向方向为基准；
- 逆时针旋转 `angle` 度。

设旋转后的单位方向为 `D`，其参数式为：

```text
X(s) = P + sD
```

射线使用 `s ≥ 0`，无限直线使用 `s ∈ R`。该 `s` 也是求交排序参数。

示例：

```text
parallel = line(P, AB)
perpendicular = line(P, AB, angle=90)
oblique = line(P, AB, angle=-30, kind=ray)
```

此重载只允许：

```text
kind=ray
kind=infinite
```

因为只有一个锚点和一个方向，无法唯一确定有限线段的长度。

### 7.3 角方向内插

```text
line(
    Point V,
    Point A,
    Point C,
    ratio=Number,
    kind=ray,
    styles...
) -> Line
```

`ratio` 是没有默认值的必填命名参数。

含义：

- `V` 是顶点；
- 第一条方向是 `V → A`；
- 第二条方向是 `V → C`；
- `ratio` 表示从第一条方向转向第二条方向的比例。

示例：

```text
bisector = line(B, A, C, ratio=0.5)
third1 = line(B, A, C, ratio=1 / 3)
third2 = line(B, A, C, ratio=2 / 3)
```

方向规则：

1. 取从 `V → A` 到 `V → C` 的最小有向转角 `δ`，其中 `-180° < δ ≤ 180°`；
2. 将 `V → A` 旋转 `ratio × δ`；
3. 结果方向以 `V` 为起点。

结果将方向单位化，并使用：

```text
X(s) = V + sD
```

射线使用 `s ≥ 0`，无限直线使用 `s ∈ R`。该 `s` 也是求交排序参数。

`ratio` 必须满足：

```text
0 ≤ ratio ≤ 1
```

当两条角边在角度容差内反向时方向不唯一，必须报错。

此重载只允许 `kind=ray` 或 `kind=infinite`。

### 7.4 范围就是几何语义

`Line` 的显示范围与几何计算范围完全一致。

```text
AB = line(A, B)
```

求交和投影只使用线段 `AB`。

需要无限支撑线时必须明确创建：

```text
supportAB = line(A, B, kind=infinite, visible=false)
```

需要越过 B 的有限线段时，可以直接写延长长度：

```text
AE = line(A, B, extend=3, dashed=true)
```

也可以按比例先构造新端点：

```text
E = along(A, B, 1.5, visible=false)
AE = line(A, E, dashed=true)
```

### 7.5 错误条件

- 确定方向的两点重合；
- `kind` 不是允许值；
- `extend` 小于 0；
- 对射线或无限直线使用 `extend`；
- 在方向重载中使用 `kind=segment`；
- 角的顶点与任一边点重合；
- 角的两条边在角度容差内反向；
- `ratio` 超出 `[0, 1]`；
- `angle` 不是有限数。

---

## 8. `circle()`：圆

### 8.1 圆心和半径

```text
circle(Point center, Number radius, styles...) -> Circle
```

```text
c = circle(O, 5)
```

要求：

```text
radius > length_epsilon
```

### 8.2 圆心和圆上一点

```text
circle(Point center, Point on_circle, styles...) -> Circle
```

```text
c = circle(O, A, color=blue)
```

半径是 `distance(O, A)`。

### 8.3 三点确定圆

```text
circle(Point A, Point B, Point C, styles...) -> Circle
```

```text
c = circle(A, B, C, fill=none)
```

结果是经过三个点的唯一圆。

### 8.4 错误条件

- 半径小于或等于本次构造的长度容差；
- 圆心与圆上一点重合；
- 三点存在重复；
- 三点共线或在规定容差内近似共线。

---

## 9. `arc()`：圆弧

### 9.1 签名

```text
arc(
    Circle circle,
    Point start,
    Point end,
    sweep=short,
    styles...
) -> Arc
```

`sweep` 支持：

```text
short  从 start 到 end 的短弧
long   从 start 到 end 的长弧
cw     从 start 到 end 的顺时针弧
ccw    从 start 到 end 的逆时针弧
```

示例：

```text
minor = arc(c, A, B)
major = arc(c, A, B, sweep=long)
clockwise = arc(c, A, B, sweep=cw, dashed=true)
```

构造时先验证 `start` 和 `end` 到圆心的距离与半径之差不超过本次
操作的长度容差，然后按各自的圆心方向得到规范端点：

```text
canonical(P) = center
             + radius × normalize(P - center)
```

Arc 保存并使用规范端点；`Arc.start` 和 `Arc.end` 也返回这些规范
端点。传入的 Point 对象本身不被修改，规范端点不会单独绘制。

当端点在角度容差内互为直径两端时：

- `cw` 和 `ccw` 仍然唯一；
- `short` 和 `long` 无法区分，必须报错。

### 9.2 错误条件

- 起点或终点不在指定圆的长度容差内；
- 规范起点与规范终点重合；
- `sweep` 非法；
- 半圆使用 `short` 或 `long`。

完整圆必须使用 `circle()`，不能用起终点相同的 `arc()` 表示。

---

## 10. `path()`：折线、多边形和样条

### 10.1 签名

```text
path(
    Point p1,
    Point p2,
    ...,
    closed=false,
    smooth=false,
    styles...
) -> Path
```

### 10.2 折线

```text
polyline = path(A, B, C)
```

依次连接：

```text
A → B → C
```

### 10.3 多边形

```text
triangle = path(A, B, C, closed=true)
```

依次连接：

```text
A → B → C → A
```

三角形、多边形和四边形统一使用 `path()` 表达，无需增加专用函数。

### 10.4 平滑路径和规范参数

```text
curve = path(A, B, C, D, smooth=true)
shape = path(A, B, C, D, closed=true, smooth=true)
```

为了使几何结果跨实现一致，平滑路径固定使用：

```text
开放路径：centripetal Catmull–Rom spline
闭合路径：closed centripetal Catmull–Rom spline
参数 α = 0.5
```

曲线依次通过所有给定点。每一段从 `P1` 到 `P2`，相邻点为
`P0, P1, P2, P3`。定义：

```text
t0 = 0
t1 = t0 + distance(P0, P1)^α
t2 = t1 + distance(P1, P2)^α
t3 = t2 + distance(P2, P3)^α
t  = t1 + u × (t2 - t1),  0 ≤ u ≤ 1

A1 = ((t1-t)/(t1-t0))P0 + ((t-t0)/(t1-t0))P1
A2 = ((t2-t)/(t2-t1))P1 + ((t-t1)/(t2-t1))P2
A3 = ((t3-t)/(t3-t2))P2 + ((t-t2)/(t3-t2))P3

B1 = ((t2-t)/(t2-t0))A1 + ((t-t0)/(t2-t0))A2
B2 = ((t3-t)/(t3-t1))A2 + ((t-t1)/(t3-t1))A3

C(u) = ((t2-t)/(t2-t1))B1 + ((t-t1)/(t2-t1))B2
```

开放路径使用线性外推的虚拟端点：

```text
p0     = 2p1 - p2
p(n+1) = 2pn - p(n-1)
```

闭合路径按首尾循环取相邻控制点，不创建虚拟端点。

控制点、开闭状态和上述数学曲线共同构成 `Path` 的几何语义。实现方可以选择不同的内部求值方法，但不能改变曲线。

Path 的规范进度不按弧长计算。设路径共有 `m` 段，第 `i` 段从
0 开始编号，段内参数为 `u`，则：

```text
progress = (i + u) / m
```

折线路径的 `u` 是线段的线性参数；平滑路径的 `u` 是上述公式中的
参数。闭合路径的起点进度为 `0`，回到起点的终值 `1` 不作为新的点。

### 10.5 错误条件

- 开放路径少于两个控制点；
- 闭合路径少于三个控制点；
- 平滑路径少于三个控制点；
- 相邻控制点在长度容差内重合；闭合路径还将末点和首点视为相邻；
- 开放路径使用非 `none` 填充；
- 参数类型错误。

自相交路径允许存在。填充默认使用：

```text
fill_rule=evenodd
```

---

## 11. `project()`：最近点投影

### 11.1 签名

```text
project(Point P, target, styles...) -> Point
```

`target` 可以是：

```text
Line
Circle
Arc
Path
```

统一定义：

> 返回 `target` 的实际几何范围内距离 `P` 最近的唯一点。

### 11.2 投影到 Line

```text
D = project(P, AB)
```

- 对无限直线，结果是通常的正交投影；
- 对射线，如果正交投影落在反向延长线上，结果是射线起点；
- 对线段，如果正交投影在线段外，结果是最近端点。

因此，若需要到支撑线的垂足，必须使用无限直线：

```text
supportAB = line(A, B, kind=infinite, visible=false)
D = project(P, supportAB)
```

### 11.3 投影到 Circle

```text
T = project(P, c)
```

设圆心为 `O`、半径为 `r`：

```text
T = O + normalize(P - O) × r
```

### 11.4 投影到 Arc 或 Path

```text
N = project(P, arcAB)
Q = project(P, curve)
```

结果必须是整个目标范围内的全局最近点，不能只返回实现算法遇到的第一个局部最近点。

先合并距离不超过长度容差的同位置候选点；同一个 Path 点由多个参数
到达不构成多解。合并后，若多个不同候选点到 `P` 的距离之差不超过
本次操作的长度容差，则视为并列最近点并报错。唯一结果必须位于目标
上；数值实现允许的误差按第 19 节判断。

唯一结果若在长度容差内等于目标的有限端点或 Path 控制点，返回该
输入坐标；有多个时选择目标规范参数最小者。否则返回数学最近点。

### 11.5 错误条件

- `P` 与目标圆的圆心重合；
- 存在多个等距的全局最近点；
- 目标类型不受支持；
- 目标退化。

---

## 12. `intersect()`：求交

### 12.1 签名

返回全部交点：

```text
intersect(object1, object2, styles...) -> List[Point]
```

选择一个排序后的交点：

```text
intersect(object1, object2, pick=index, styles...) -> Point
```

`pick` 使用从 0 开始的索引。

示例：

```text
P, Q = intersect(AB, c)
P, _ = intersect(AB, c)
P = intersect(AB, c, pick=0)
Q = intersect(AB, c, pick=1, color=red)
hits = intersect(AB, c, visible=false)
```

赋值给单个目标且未使用 `pick` 时，目标类型是 `List[Point]`：

```text
hits = intersect(AB, c)
```

列表中的交点仍使用传入样式，但由于没有逐点目标名称，`label=auto` 不显示标签。

使用逗号目标时执行列表解构，目标数量必须与结果数量一致：

```text
P, Q = intersect(AB, c)
```

### 12.2 支持组合

`intersect()` 支持：

```text
Line   × Line
Line   × Circle
Circle × Circle
Line   × Arc
Circle × Arc
Arc    × Arc
Line   × Path
Circle × Path
Arc    × Path
Path   × Path
```

参数顺序可以交换，但结果排序以第一个对象为基准，所以交换参数可能改变结果顺序。

### 12.3 范围规则

求交使用对象的实际范围：

- 线段只包含两个端点之间；
- 射线只包含起点及正方向；
- 无限直线包含整个参数轴；
- 圆包含完整圆周；
- 圆弧只包含指定弧段；
- 路径只包含其实际线段或样条。

### 12.4 结果规范化和去重

求交先针对两个对象的数学几何集合求解。候选点必须同时位于两个
对象的实际范围内；边界归属按第 19 节的长度容差判断。

相切点、共享端点或多段路径在同一点产生的重复结果，必须合并。
两个候选点的距离不超过本次操作的长度容差时属于同一组。

在分组前，如果任一对象的有限端点或 Path 控制点到另一个对象的
距离不超过长度容差，该输入坐标也作为候选点。这样，共享边界的
规范结果不依赖求根算法是否恰好返回输入坐标。

每个候选点同时记录它在第一个和第二个对象上的规范参数。每组使用
以下确定规则选择返回坐标：

1. 如果组内包含某个输入对象的端点或 Path 控制点坐标，选择规范
   参数二元组最小的那个；仍相同时按 `x`、`y` 升序选择；
2. 否则选择规范参数二元组最小的求解结果；仍相同时按 `x`、`y`
   升序选择。

返回的 Point 是新的结果对象，不是输入端点的别名。数值坐标无需
逐位相同，但必须满足第 19.4 节的合规误差。

对象完全重合，或存在重合线段、弧段、路径区段时，会产生无穷多个交点；此时不返回有限列表，必须报错。

### 12.5 确定性排序

交点按照第一个对象的有向参数升序排列：

| 第一个对象 | 排序参数 |
|---|---|
| Line | 该线的参数 `t` |
| Circle | 从正 x 轴开始逆时针的角度 `[0°, 360°)` |
| Arc | 从 `start` 沿 `sweep` 前进的归一化进度 `[0, 1]` |
| Path | 第 10.4 节定义的规范进度 `[0, 1)` |

先完成去重，再按第一个对象的参数、第二个对象的参数、`x`、`y`
依次升序排序。这四项构成完整排序键。

### 12.6 结果数量

不使用 `pick` 并进行列表解构时：

```text
P, Q = intersect(AB, c)
```

左侧目标数量必须等于实际交点数量。

使用 `pick` 时：

- `pick` 必须是整数；
- `pick` 必须位于结果范围内；
- 先完成确定性排序，再选择结果。

---

## 13. `transform()`：几何变换

`transform()` 作用于：

```text
Point
Line
Circle
Arc
Path
List
```

每次调用只执行一种变换。

### 13.1 平移

```text
transform(object, move, dx, dy, styles...) -> SameType
```

```text
A2 = transform(A, move, 3, 2)
shape2 = transform(shape, move, -1, 4)
```

### 13.2 旋转

```text
transform(object, rotate, Point center, angle, styles...) -> SameType
```

```text
A2 = transform(A, rotate, O, 60)
shape2 = transform(shape, rotate, O, 90)
```

正角度表示逆时针，单位为度。

### 13.3 轴对称

```text
transform(object, mirror, Line axis, styles...) -> SameType
```

```text
A2 = transform(A, mirror, axis)
shape2 = transform(shape, mirror, axis)
```

`axis` 的 `kind` 不影响对称轴；其支撑直线用于变换。

### 13.4 缩放

```text
transform(object, scale, Point center, Number factor, styles...) -> SameType
```

```text
shape2 = transform(shape, scale, O, 1.5)
```

要求：

```text
factor > 0
```

缩放因子只允许正数。

### 13.5 列表变换

```text
triangle2 = transform([AB, BC, CA], rotate, O, 60)
```

列表必须是非空、非嵌套的，并且每个元素都是 `transform()` 支持的
几何类型。结果保持原顺序，每个元素分别变换；结果对象也按该顺序
获得创建顺序。

### 13.6 变换后的范围和方向

变换保持 `Line.kind`：

- 线段变换后仍是线段；
- 射线变换后仍是射线；
- 无限直线变换后仍是无限直线。

线段变换其实际两端点并重新使用第 7.1 节的 `t`；射线和无限直线
变换锚点及方向，再将方向单位化并使用第 7.2、7.3 节的 `s`。

Arc 的起点、终点和支撑圆一起变换。轴对称时，`cw` 与 `ccw`
互换；`short` 和 `long` 保持不变。其他变换保持 `sweep`。

### 13.7 错误条件

- 一次调用包含多个变换模式；
- 变换模式非法；
- 参数类型或数量错误；
- 缩放因子小于或等于 0；
- 变换结果退化。

多个变换必须显式串联：

```text
s1 = transform(shape, rotate, O, 30)
s2 = transform(s1, move, 2, 1)
```

执行顺序由数据依赖明确决定。

---

## 14. `mark()`：教学几何标记

`mark()` 创建视觉标记，但不创建或修改几何约束。

标记必须与已经成立的几何关系一致；关系不成立时必须报错。

`mark()` 可以作为独立语句，也可以绑定到名称：

```text
mark(right, A, B, C)
right_mark = mark(right, A, B, C)
```

### 14.1 直角

```text
mark(right, Point A, Point B, Point C, styles...) -> Mark
```

在 `∠ABC` 的顶点 `B` 处画直角标记，并验证角度为 90°。

角度取两条射线之间的非反身小角，范围为 `[0°, 180°]`。

```text
mark(right, A, O, B, color=blue)
```

### 14.2 等长

```text
mark(equal, Line segment1, Line segment2, styles...) -> Mark
```

两个参数必须都是 `kind=segment` 的有限线段，并且实际几何长度相等。描边宽度、虚线和其他显示样式不参与比较。

```text
mark(equal, OA, OB)
```

### 14.3 等角

```text
mark(
    equal_angle,
    A1, V1, B1,
    A2, V2, B2,
    styles...
) -> Mark
```

中间点是角顶点：

```text
mark(equal_angle, A, O, E, E, O, B)
```

两个角都按非反身小角比较，范围为 `[0°, 180°]`。

### 14.4 平行

```text
mark(parallel, Line line1, Line line2, styles...) -> Mark
```

验证两条线的方向平行，然后绘制相同的平行标记。方向相同或相反都视为平行。

### 14.5 错误条件

- 目标几何关系不成立；
- 角或线段退化；
- `equal` 的目标不是有限线段；
- 标记种类、参数数量或类型错误。

---

## 15. `text()`：独立文字

`text()` 创建与 Point 无关的文字对象。Point 名称继续使用 `label` 和
`label_pos`，协议不提供 `text(Point, String)` 重载。

### 15.1 固定位置

```text
text(Number x, Number y, String content, styles...) -> Text
```

```text
title = text(0, 6, "集合关系", size=28)
formula = text(3, -2, "A ∩ B", color=purple)
```

`(x, y)` 是首选文字中心，使用与几何对象相同的世界坐标。文字默认
居中对齐。为了避开可见几何和其他文字，渲染器可以在不超过初始字号
两倍的屏幕像素半径内移动最终中心；首选位置没有冲突时不得移动。
首选坐标参与自动画布范围计算。

`content` 作为纯 Unicode 文本绘制，不解释为 SVG、HTML 或其他标记；
输出后端必须正确转义目标格式中的特殊字符。

### 15.2 Region 自动位置

```text
text(Region region, String content, styles...) -> Text
```

```text
label_overlap = text(overlap, "B", size=24)
```

渲染器必须在 Region 内寻找能容纳完整文字框、远离区域边界并尽量
避开其他可见对象的位置。Region 有多个不连通部分时只放置一次文字，
选择可用净空最大的部分；不得给每个部分复制文字。

文字框必须连同 4px 安全间距完整位于目标 Region 内。空间不足时按
初始字号的 `100%`、`90%`、`80%`、`70%`、`60%` 依次尝试，但不得
缩到 10px 以下；初始字号小于 10px 时只尝试原字号。全部失败必须
报告 `E_LAYOUT`，不能把文字移到区域外或静默省略。

### 15.3 错误条件

- 参数数量或类型错误；
- Region 为空或没有足够空间容纳文字；
- 所有允许字号都无法取得合法且不冲突的位置；
- 使用 Text 不支持的样式。

Text 不支持属性访问、`project()`、`intersect()` 或 `transform()`。

---

## 16. Region：内部和布尔运算

Region 是可填充、可组合的二维区域。它保存区域表达式，不描绘来源
对象的边界，也不把 Circle 或 Path 的 `fill` 当作几何输入。

### 16.1 `inside()`：封闭对象内部

```text
inside(Circle source, styles...) -> Region
inside(Path source, styles...) -> Region
```

```text
disk = inside(c)
polygon_area = inside(polygon, fill="#dbeafe")
```

Circle 产生精确圆盘。Path 必须有 `closed=true`；直线路径使用其多边形
边界，平滑路径使用协议规定的样条边界，自相交 Path 的内部遵守来源
Path 的 `fill_rule`。来源对象的 `visible`、`fill`、`opacity` 和其他
视觉样式不影响 Region；`fill_rule` 是决定 Path 内部的唯一例外。

### 16.2 `union()`：并集

```text
union(Region first, Region second, Region..., styles...) -> Region
```

至少接受两个 Region：

```text
either = union(A, B)
all_three = union(A, B, C, fill="#bfdbfe")
```

### 16.3 `intersection()`：交集

```text
intersection(Region first, Region second, Region..., styles...) -> Region
```

至少接受两个 Region：

```text
overlap = intersection(A, B, fill="#c4b5fd")
```

`intersection()` 返回区域交集；现有 `intersect()` 始终返回几何边界
的交点。二者不得互相替代或根据参数猜测另一种语义。

### 16.4 `difference()`：差集

```text
difference(Region left, Region right, styles...) -> Region
```

只接受两个 Region，结果是 `left` 中扣除 `right` 的部分：

```text
left_only = difference(A, B, fill="#bfdbfe")
```

无限补集没有隐含画布边界，因此协议不提供 `complement()`。需要外部
区域时，必须先用闭合 Path 显式创建有限全集，再写：

```text
outside = difference(universe, union(A, B))
```

### 16.5 组合、边界和错误条件

Region 运算可任意嵌套：

```text
result = difference(intersection(A, union(B, C)), D, fill=blue)
```

空 Region 是合法结果，只是不产生填充；若交给 `text(region, ...)`
自动定位，则因无法放置文字而报布局错误。可见的 Region 参与自动
画布范围；隐藏的来源 Circle 或 Path 仍为该 Region 提供
有限边界。`inside()` 使用来源边界框，`union()` 合并操作数边界框，
`intersection()` 使用操作数边界框的交集，`difference()` 使用左操作数
边界框；空边界不扩展画布。实现可以使用 SVG mask 或等价机制，但
圆形边界必须保持精确圆弧，不能转换成可见折线近似。

以下情况必须报错：

- `inside()` 的 Path 没有 `closed=true`；
- `union()` 或 `intersection()` 少于两个 Region；
- `difference()` 不是恰好两个 Region；
- 操作数类型错误；
- 使用 Region 不支持的样式。

Region 不支持属性访问、`project()`、`intersect()` 或 `transform()`。
需要变换 Region 时，应先变换来源 Circle 或 Path，再调用 `inside()`。

---

## 17. 属性访问

属性只读，不是函数，也不创建新的几何关系或可绘制对象。几何类型
的属性返回对象内部保存的几何值；若要单独绘制，必须再调用相应的
构造函数。

协议支持以下只读属性：

```text
Point.x          -> Number
Point.y          -> Number

Line.kind        -> segment | ray | infinite

Circle.center    -> Point
Circle.radius    -> Number

Arc.circle       -> Circle
Arc.start        -> Point
Arc.end          -> Point
Arc.sweep        -> short | long | cw | ccw

Path.points      -> List[Point]
Path.closed      -> Boolean
Path.smooth      -> Boolean
```

示例：

```text
center_ref = c.center
O = point(c.center)
r = c.radius
```

属性不能赋值：

```text
c.radius = 5  # 错误
```

将一个已有值绑定到新名称只创建只读别名，不复制几何对象，也不
额外绘制一份。

---

## 18. 可见性、名称和绘制顺序

### 18.1 默认可见

以下对象在创建时默认可见：

```text
Point
Line
Circle
Arc
Path
Mark
Text
Region
```

辅助对象必须显式隐藏：

```text
support = line(A, B, kind=infinite, visible=false)
```

### 18.2 丢弃结果

`_` 表示不绑定且不绘制该结果：

```text
P, _ = intersect(AB, c)
```

如果同一个几何点已经由其他对象显式创建或绘制，丢弃结果不会影响那些对象。

### 18.3 别名

```text
O2 = c.center
```

`O2` 是 Circle 内部 Point 值的别名：

- 不额外绘制；
- 不更改原标签；
- 不能附加新样式。

需要一个独立可绘制点时，使用 `point(Point)` 显式创建：

```text
O = point(c.center, color=red)
```

### 18.4 自动标签

直接由点函数结果绑定的名称可用于 `label=auto`：

```text
A = point(0, 0)
M = along(A, B, 0.5)
P = intersect(AB, c, pick=0)
```

默认标签分别是 `A`、`M`、`P`。

多结果赋值分别使用各自目标名称。

函数返回的点列表如果整体绑定到一个列表名称，其中的点没有逐点目标名称，因此 `label=auto` 不显示标签。对该列表进行多目标解构时，每个点使用对应目标名称。

Point 的 `label_pos` 是文字的首选锚点。显式方向允许在初始字号两倍
的屏幕像素半径内微调；`auto` 必须尝试八个方向，评分相同时优先
`above_right`，以保持默认行为。

### 18.5 绘制顺序与统一文字布局

语句按源码顺序求值。表达式、函数实参和列表元素按从左到右、由内到
外的顺序求值；对象在其构造调用完成时取得创建顺序。命名参数的书写
顺序不改变调用语义，但其中表达式的求值仍按源码顺序。

绘制顺序先按 `layer` 升序，再按创建顺序：

```text
background = circle(O, 5, fill="#eeeeee", layer=-1)
AB = line(A, B, layer=1)
```

统一文字布局在全部对象完成求值、画布尺寸和世界坐标变换确定之后
执行，覆盖 Point 标签、固定位置 Text 和 Region Text。布局优先级按
`layer` 从高到低，同层按创建顺序；已经放置的文字是后续文字的
障碍物。最终绘制仍按前述从低层到高层的顺序。

文字必须避开可见且有效透明度大于 0 的线、圆周、圆弧、Path 边线、
点、Mark、有填充 Region 的边界和已经布局的文字。Region 的纯色
内部不是障碍物，目标 Region 的边界始终是约束。`visible=false` 或
`opacity=0` 的对象不参与避让。

所有文字使用 4px 安全间距。固定 Text 和显式 Point 锚点在首选位置
无冲突时不得移动；需要移动时不得超过初始字号两倍的屏幕像素半径。
字号按第 15.2 节的序列缩小，仍无法放置时报告布局错误。候选生成、
文字宽度估算和评分必须是确定性的，同一实现重复渲染相同源码不得
依赖随机数产生不同位置。

自动缩放、裁剪和实际候选搜索属于渲染实现，不改变几何对象或 Region
的数学语义。

---

## 19. 坐标、角度和容差

### 19.1 坐标系

```text
x 向右为正
y 向上为正
角度逆时针为正
角度单位为度
```

本文中的 `distance(P, Q)` 是欧氏距离，`normalize(V)` 是
`V / length(V)`；只有长度大于本次操作容差的向量才能单位化。

数值角度在使用前按 binary64 运算规范化到 `[0°, 360°)`：

```text
normalized(a) = a - 360 × floor(a / 360)
```

若舍入得到 `360`，改为 `0`。角度差始终取圆周上的最小绝对差。

### 19.2 数值

`Number` 使用 IEEE 754 binary64。十进制字面量转换以及每一步
`+`、`-`、`*`、`/` 运算都使用 round-to-nearest、ties-to-even。
正零和负零在语言语义中都是 `0`。

所有输入数值和几何结果必须有限。内部算法可以使用更高精度，但最终
可观察结果必须与本节规则相容。

无限直线由：

```text
kind=infinite
```

表达，而不是用无限数值表达。

### 19.3 局部容差

每次几何构造、谓词、投影、求交或标记验证独立计算局部容差。只使用
本次操作直接参与的对象、结果候选及几何参数，不使用场景中的其他
对象。

```text
G = max(
    1,
    参与对象和结果的固有长度,
    本次调用直接构造或比较的点间距离,
    本次调用中具有长度量纲的几何参数绝对值
)

C = max(
    1,
    参与对象、候选和结果定义点的 |x| 和 |y|
)
```

固有长度是线段的实际长度、Circle 或 Arc 的半径，以及 Path 各段
端点间距离的最大值；Point 的固有长度为 `0`。射线和无限直线只用
于确定方向的两个定义点之间的距离。对象经过变换或其他构造后，使用
其当前的实际定义数据。

长度容差：

```text
length_epsilon = max(G × 1e-9, C × 1e-15)
```

第一项控制几何尺度上的相对误差，第二项只补偿大坐标下 binary64 的
表示精度。样式参数、列表中未参与本次判断的元素以及无关对象不进入
`G` 或 `C`。

容差是协议常量，不能根据视口、缩放级别或实现偏好调整。

角度容差：

```text
angle_epsilon = 1e-7 degree
```

基本判断统一为：

| 判断 | 规则 |
|---|---|
| 两点重合 | 两点距离 `≤ length_epsilon` |
| 两个长度相等 | 长度差绝对值 `≤ length_epsilon` |
| 点位于对象上 | 点到对象数学集合的距离 `≤ length_epsilon` |
| 方向平行、垂直或角度相等 | 最小角度差 `≤ angle_epsilon` |
| 参数位于有限边界内 | 对应几何点到边界的越界距离 `≤ length_epsilon` |

三点共线、对象重合、相切、共享端点、退化判断、结果去重和
`mark()` 验证都由这些基本规则导出。处于容差边界内时，必须选择
“重合、位于边界、相切或关系成立”这一侧，不能由实现随机决定。

容差比较不建立可传递的全局等价关系。每次操作只比较其原始输入，
不得把一次近似相等传播成对其他对象的永久修改。

### 19.4 规范结果和数值误差

容差用于分类、边界判断和结果合并，不修改输入对象。函数创建的新
结果可以按其数学定义产生新坐标；其中 Arc 端点和求交结果分别遵守
第 9.1、12.4 节的规范化规则，投影结果遵守第 11.4 节。

对唯一的数学结果，Point 坐标与该结果的距离必须不超过本次操作的
`length_epsilon`，并且结果到其声称所属几何集合的距离也不得超过
该容差。角度计算的误差不得超过 `angle_epsilon`。

这些误差界限是实现算法的上限，不授权实现返回一个已知更差的近似值。

---

## 20. 确定性、错误和合规

### 20.1 必须报错的情况

一份合规实现至少应检测：

- 语法不完整；
- 未定义名称；
- 名称重复定义；
- 参数数量或类型错误；
- 未知参数；
- 几何参数出现在样式参数之后；
- 未知或不适用的样式参数；
- 非有限数和除零；
- 退化几何对象；
- 不唯一的投影；
- 无穷多个交点；
- 求交结果数量不匹配；
- `pick` 越界；
- 不真实的几何标记；
- 开放 Path 用于 `inside()`；
- Region 布尔运算的操作数数量或类型错误；
- Text 或 Point 标签在允许移动和缩放范围内仍无法完成布局。

### 20.2 禁止静默处理

实现不得：

- 忽略拼错的参数；
- 自动交换用户写错的参数；
- 随机选择多个合法结果之一；
- 把线段自动当作无限直线；
- 除协议明确规定的新结果规范化外，将输入点吸附到圆、线或路径；
- 因为绘制方便而改变几何对象；
- 自动复制或丢弃多结果；
- 把 Region Text 静默放到目标 Region 外；
- 因布局失败而静默省略、复制或无限缩小文字。

### 20.3 错误信息

错误信息至少应包含：

```text
源码位置
相关对象或参数
错误原因
```

文字布局失败的错误码固定为 `E_LAYOUT`。其他错误码和展示格式由
实现方决定，不属于语言协议。

包含任何错误的源码都是无效程序，协议不规定其绘制输出。实现可以
在发现首个错误后继续分析，以报告更多诊断，但这些诊断不得改变已经
报告的错误原因。

### 20.4 合规结果

对于相同源码，合规实现必须一致地给出：

- 源码有效或无效；
- 每个名称的值类型；
- 几何结果的种类、数量和顺序；
- 容差分类产生的拓扑结论；
- Region 的布尔结构和有限边界；
- 可绘制对象的可见性、样式值和绘制顺序；
- 文字布局成功或失败，以及同一实现重复渲染时的最终位置和字号。

数值坐标和角度按第 19.4 节比较，不要求浮点位模式或内部算法相同。
SVG、Canvas 的元素结构、无限对象的视口裁剪、虚线图案、字体文件和
候选搜索算法不属于合规比较；最终布局必须满足第 15、18 节规定的
边界、避让、移动和缩放约束。

同一实现重复处理相同源码时，不得依赖随机数、散列表遍历顺序或并发
完成顺序改变可观察结果。

实现可以提供扩展模式，但在 V0.4 模式下，未知函数、参数、属性和
枚举值必须报错，不能自动解释为扩展。

---

## 21. 完整示例

以下两个示例合计覆盖全部 15 个核心函数。

### 21.1 圆内四叶花窗

下面的示例覆盖基础几何的 10 个核心函数。

```text
# 基础点
O = point(0, 0)
A = point(0, 6)
B = point(6, 0)
C = point(0, -6)
D = point(-6, 0)

# 外圆
outer = circle(O, A, color="#222222", width=3)

# 十字骨架：默认线段，样式直接写在对象末尾
vertical = line(C, A, dashed=true, color=gray)
horizontal = line(D, B, dashed=true, color=gray)

# 求交遵守线段范围；两个交点按 D → B 的参数顺序排列
L, R = intersect(horizontal, outer, visible=false)

# 比例点
M = along(O, B, 0.5)
N = along(O, A, 0.5)
K = along(O, B, 0.72, visible=false)

# 菱形
diamond = path(
    A, B, C, D,
    closed=true,
    color="#444444",
    width=2
)

# 一片花瓣及其旋转副本
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

# 圆弧
arcAB = arc(outer, A, B, sweep=short, width=4)
arcBC = arc(outer, B, C, sweep=short, width=4)
arcCD = arc(outer, C, D, sweep=short, width=4)
arcDA = arc(outer, D, A, sweep=short, width=4)

# 投影到线段 diagonal
diagonal = line(A, B, visible=false)
F = project(O, diagonal, label="F")
OF = line(O, F, dashed=true, color=gray)

# 过点作平行线和垂线
parallel_guide = line(
    M, diagonal,
    kind=infinite,
    dashed=true,
    color="#aaaaaa"
)

perpendicular_guide = line(
    N, diagonal,
    angle=90,
    kind=infinite,
    dashed=true,
    color="#aaaaaa"
)

# ∠AOB 的内部角平分射线
bisector = line(
    O, A, B,
    ratio=0.5,
    dashed=true,
    color=gray
)

# 射线与圆只有一个有效交点
E = intersect(bisector, outer, pick=0, label="E", color=red)
OE = line(O, E, dashed=true, color=red)

# 有限线段用于等长标记
OA = line(O, A, visible=false)
OB = line(O, B, visible=false)

mark(equal, OA, OB)
mark(right, A, O, B)
mark(equal_angle, A, O, E, E, O, B)
mark(parallel, parallel_guide, diagonal)
```

### 21.2 两圆四区域

下面的示例覆盖 V0.4 新增的 5 个核心函数。四个区域使用互不依赖的
不透明颜色；外部区域以显式闭合 Path 为有限全集。圆周和区域分别
绘制，因此 Region 填充不会隐式增加或改变边界描边。

```text
# 有限全集
F1 = point(-6, -4, visible=false)
F2 = point(6, -4, visible=false)
F3 = point(6, 4, visible=false)
F4 = point(-6, 4, visible=false)
frame = path(F1, F2, F3, F4, closed=true, visible=false)
universe = inside(frame)

# 两个圆及其内部
O1 = point(-1.8, 0, visible=false)
O2 = point(1.8, 0, visible=false)
c1 = circle(O1, 3, color=blue, width=2, layer=1)
c2 = circle(O2, 3, color=red, width=2, layer=1)
disk1 = inside(c1)
disk2 = inside(c2)

# 四个互不重叠的区域
both = union(disk1, disk2)
outside = difference(
    universe, both,
    fill="#f3f4f6",
    layer=-2
)
left_only = difference(
    disk1, disk2,
    fill="#bfdbfe",
    layer=-1
)
overlap = intersection(
    disk1, disk2,
    fill="#c4b5fd",
    layer=-1
)
right_only = difference(
    disk2, disk1,
    fill="#fecaca",
    layer=-1
)

# 自动放在各 Region 内净空最大的可用位置
label_A = text(left_only, "A", size=24, layer=2)
label_B = text(overlap, "B", size=24, layer=2)
label_C = text(right_only, "C", size=24, layer=2)
label_D = text(outside, "D", size=24, layer=2)
```

---

## 22. 常用图形写法

### 22.1 三角形

```text
A = point(0, 0)
B = point(6, 0)
C = point(2, 4)
triangle = path(A, B, C, closed=true)
```

### 22.2 中点

```text
M = along(A, B, 0.5)
```

### 22.3 垂足

投影到线段：

```text
D = project(C, AB)
```

投影到无限支撑线：

```text
support = line(A, B, kind=infinite, visible=false)
D = project(C, support)
```

### 22.4 平行线和垂线

```text
parallel = line(P, AB)
perpendicular = line(P, AB, angle=90)
```

### 22.5 角平分线

```text
bisector = line(B, A, C, ratio=0.5)
```

### 22.6 外接圆

```text
circumcircle = circle(A, B, C)
O = point(circumcircle.center)
```

### 22.7 两个交点中只取一个

```text
P = intersect(AB, c, pick=0)
```

### 22.8 有限延长

```text
E = along(A, B, 1.5, visible=false)
extended = line(A, E, dashed=true)
```

---

## 23. 能力边界

### 23.1 协议范围

- 固定坐标点；
- 中点、内分点和外分点；
- 线段、射线和无限直线；
- 平行线、垂线和任意旋转方向线；
- 角平分线和角多等分线；
- 圆和三点外接圆；
- 短弧、长弧、顺时针弧和逆时针弧；
- 折线、多边形和固定 Catmull–Rom 样条；
- 点到线、圆、弧和路径的最近点；
- 线、圆、弧和路径之间的求交；
- 平移、旋转、轴对称和正比例缩放；
- 直角、等长、等角和平行标记；
- 独立自由文字和 Point 标签的统一避让布局；
- 圆盘、闭合 Path 内部及 Region 的交、并、差；
- 颜色、虚线、宽度、透明度、填充、标签和图层。

### 23.2 协议范围外

- 无坐标自由点；
- 约束求解；
- 自动证明；
- 切线专用构造；
- 任意函数曲线和隐式方程曲线；
- 椭圆和圆锥曲线；
- 多行富文本段落和自动尺寸标注；
- 无限补集、Region 面积、周长和边界提取；
- Region 的投影、求交点和直接几何变换；
- 自动计算并公开 Region 的质心或标签点；
- 用户自定义函数；
- 循环和条件语句；
- 动画和交互；
- 三维几何；
- 变量重赋值和对象原地修改。

扩展协议可以增加新几何类型或新构造函数，但不应改变本文已经定义的调用含义。

---

## 24. 最终最小协议

```text
# 点
A = point(x, y)
O = point(c.center)
P = along(A, B, t)
D = project(P, target)
P, Q = intersect(object1, object2)
P = intersect(object1, object2, pick=0)

# 直线类对象
AB = line(A, B)
extendedAB = line(A, B, extend=3)
rayAB = line(A, B, kind=ray)
supportAB = line(A, B, kind=infinite)
parallel = line(P, AB)
perpendicular = line(P, AB, angle=90)
bisector = line(B, A, C, ratio=0.5)

# 圆和圆弧
c1 = circle(O, radius)
c2 = circle(O, A)
c3 = circle(A, B, C)
a = arc(c1, A, B, sweep=short)

# 路径
polyline = path(A, B, C)
polygon = path(A, B, C, closed=true)
curve = path(A, B, C, D, smooth=true)

# 变换
copy = transform(object, rotate, O, 60)

# 标记
mark(right, A, B, C)

# 区域
disk = inside(c1)
polygon_area = inside(polygon)
either = union(disk, polygon_area)
overlap = intersection(disk, polygon_area)
disk_only = difference(disk, polygon_area)

# 自由文字和区域文字
title = text(0, 6, "示意图")
area_label = text(overlap, "A ∩ B")

# 样式始终位于对象调用末尾
yellow_dash = line(
    A, B,
    kind=ray,
    dashed=true,
    color=yellow,
    width=2
)
```

协议核心可以概括为：

```text
用少量函数构造明确的几何对象，
用尾部命名参数描述对象外观，
用显式范围和确定顺序消除歧义。
```
