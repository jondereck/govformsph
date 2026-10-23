"""Geometric Govforms wordmark. Square o = a form field."""
from pathlib import Path

OUT = Path(__file__).with_name("b-rule.svg")

# x-height 104–200, cap 48–200, stroke 26, baseline 200
XH_TOP, BASE, ST = 104, 200, 26


def ring(cx, cy, r_out, r_in):
    return (
        f"M {cx + r_out} {cy} "
        f"A {r_out} {r_out} 0 1 1 {cx - r_out} {cy} "
        f"A {r_out} {r_out} 0 1 1 {cx + r_out} {cy} Z "
        f"M {cx + r_in} {cy} "
        f"A {r_in} {r_in} 0 1 0 {cx - r_in} {cy} "
        f"A {r_in} {r_in} 0 1 0 {cx + r_in} {cy} Z"
    )


def square_o(x, y, w, h, t, rad):
    """Rounded-rect ring. Outer box at (x,y), wall thickness t."""
    ri = max(rad - t, 2)
    return (
        f"M {x + rad} {y} H {x + w - rad} "
        f"A {rad} {rad} 0 0 1 {x + w} {y + rad} "
        f"V {y + h - rad} "
        f"A {rad} {rad} 0 0 1 {x + w - rad} {y + h} "
        f"H {x + rad} "
        f"A {rad} {rad} 0 0 1 {x} {y + h - rad} "
        f"V {y + rad} "
        f"A {rad} {rad} 0 0 1 {x + rad} {y} Z "
        f"M {x + t + ri} {y + t} H {x + w - t - ri} "
        f"A {ri} {ri} 0 0 1 {x + w - t} {y + t + ri} "
        f"V {y + h - t - ri} "
        f"A {ri} {ri} 0 0 1 {x + w - t - ri} {y + h - t} "
        f"H {x + t + ri} "
        f"A {ri} {ri} 0 0 1 {x + t} {y + h - t - ri} "
        f"V {y + t + ri} "
        f"A {ri} {ri} 0 0 1 {x + t + ri} {y + t} Z"
    )


def letter_g(x):
    # Circular G. Left edge sits on x. Bar is a plain horizontal, no spur.
    ro, ri = 68, 44
    cx, cy = x + ro, 124
    d = (
        f"M {cx + 52} {cy - 54} "
        f"A {ro} {ro} 0 1 0 {cx + 52} {cy + 54} "
        f"L {cx + 34} {cy + 36} "
        f"A {ri} {ri} 0 1 1 {cx + 34} {cy - 36} Z "
        f"M {cx - 6} {cy - 16} H {cx + ro + 8} V {cy + 12} H {cx - 6} Z"
    )
    return d, (cx + ro + 8) - x


def letter_v(x):
    d = (
        f"M {x} {XH_TOP} H {x + 24} L {x + 46} {BASE - 28} "
        f"L {x + 68} {XH_TOP} H {x + 94} L {x + 58} {BASE} H {x + 36} Z"
    )
    return d, 94


def letter_f(x):
    # One shape: tall stem, top flag to the right, crossbar to the right only.
    stem = x
    d = (
        f"M {stem} 30 H {stem + ST + 22} V {30 + ST} H {stem + ST} "
        f"V {BASE} H {stem} Z "
        f"M {stem} 114 H {stem + ST + 34} V {114 + ST} H {stem} Z"
    )
    return d, stem + ST + 34 - x


def letter_r(x):
    # Square shoulder. Reads as r without a stray bowl.
    d = (
        f"M {x} {XH_TOP} H {x + ST} V {BASE} H {x} Z "
        f"M {x} {XH_TOP} H {x + 58} V {XH_TOP + ST} H {x} Z"
    )
    return d, 58


def letter_m(x):
    y, h = XH_TOP, BASE - XH_TOP
    stems = []
    for i in range(3):
        sx = x + i * 46
        stems.append(f"M {sx} {y} H {sx + ST} V {y + h} H {sx} Z")
    bridges = [
        f"M {x} {y} H {x + 46 + ST} V {y + ST} H {x} Z",
        f"M {x + 46} {y} H {x + 92 + ST} V {y + ST} H {x + 46} Z",
    ]
    return " ".join(stems + bridges), 92 + ST


def letter_s(x):
    # Geometric s: top terminal, diagonal spine, bottom terminal.
    d = (
        f"M {x + 18} {XH_TOP} H {x + 70} V {XH_TOP + ST} H {x + 40} "
        f"L {x + 70} {BASE - ST} V {BASE} H {x + 8} V {BASE - ST} "
        f"H {x + 40} L {x + 18} {XH_TOP} Z"
    )
    return d, 70


def main():
    gap = 16
    x = 8
    parts = []
    # G
    d, w = letter_g(x)
    parts.append(d)
    x += w + gap
    # square o
    ow, oh = 78, BASE - XH_TOP
    parts.append(square_o(x, XH_TOP, ow, oh, 22, 14))
    x += ow + gap
    # v
    d, w = letter_v(x)
    parts.append(d)
    x += w + gap
    # f
    d, w = letter_f(x)
    parts.append(d)
    x += w + gap
    # square o
    parts.append(square_o(x, XH_TOP, ow, oh, 22, 14))
    x += ow + gap
    # r m s
    for fn in (letter_r, letter_m, letter_s):
        d, w = fn(x)
        parts.append(d)
        x += w + gap
    width = x + 8
    body = "\n    ".join(
        f'<path fill="#111111" fill-rule="evenodd" d="{p}"/>' for p in parts
    )
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} 256" width="{width}" height="256" role="img" aria-labelledby="title">
  <title id="title">Govforms Rule wordmark</title>
  {body}
</svg>
'''
    OUT.write_text(svg, encoding="utf-8")
    print(f"wrote {OUT} width={width}")


if __name__ == "__main__":
    main()
