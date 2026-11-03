"""Original Margin outline masters. Coordinates are in a 1,000-unit em, y up.

The glyphs are constructed here; no installed or third-party font is a source.
Strokes are expanded and boolean-unioned into ordinary filled font outlines.
"""

from dataclasses import dataclass

import pathops
from fontTools.svgLib.path import parse_path


@dataclass(frozen=True)
class Master:
    family: str
    mono: bool
    strokes: dict[int, float]


MASTERS = (
    Master("Margin Hinge", False, {300: 44, 500: 78, 700: 112}),
    Master("Margin Loose Mono", True, {300: 42, 500: 76, 700: 108}),
)


def curve(d: str) -> pathops.Path:
    p = pathops.Path()
    parse_path(d, p.getPen())
    return p


def ellipse(cx: float, cy: float, rx: float, ry: float) -> pathops.Path:
    k = 0.5522847498
    p = pathops.Path()
    p.moveTo(cx + rx, cy)
    p.cubicTo(cx + rx, cy + k * ry, cx + k * rx, cy + ry, cx, cy + ry)
    p.cubicTo(cx - k * rx, cy + ry, cx - rx, cy + k * ry, cx - rx, cy)
    p.cubicTo(cx - rx, cy - k * ry, cx - k * rx, cy - ry, cx, cy - ry)
    p.cubicTo(cx + k * rx, cy - ry, cx + rx, cy - k * ry, cx + rx, cy)
    p.close()
    return p


def rect(x: float, y: float, w: float, h: float, r: float = 0) -> pathops.Path:
    r = min(r, w / 2, h / 2)
    return curve(
        f"M{x+r} {y} H{x+w-r} Q{x+w} {y} {x+w} {y+r} "
        f"V{y+h-r} Q{x+w} {y+h} {x+w-r} {y+h} "
        f"H{x+r} Q{x} {y+h} {x} {y+h-r} V{y+r} Q{x} {y} {x+r} {y} Z"
    )


def merge(parts: list[pathops.Path]) -> pathops.Path:
    result = pathops.Path()
    for p in parts:
        result = pathops.op(result, p, pathops.PathOp.UNION)
    return result


def transform(p: pathops.Path, xx=1, xy=0, yx=0, yy=1, dx=0, dy=0):
    return p.transform(xx, xy, yx, yy, dx, dy)


class Drawing:
    def __init__(self, master: Master, weight: int):
        self.master = master
        self.mono = master.mono
        self.stroke_width = master.strokes[weight]
        self.weight = weight

    def stroke(self, d: str, width: float | None = None, rounded=False):
        p = curve(d)
        p.stroke(
            width or self.stroke_width,
            pathops.LineCap.ROUND_CAP if rounded else pathops.LineCap.BUTT_CAP,
            pathops.LineJoin.ROUND_JOIN,
            4,
        )
        p.convertConicsToQuads(0.2)
        return p

    def ring(self, cx, cy, rx, ry):
        p = ellipse(cx, cy, rx, ry)
        p.stroke(
            self.stroke_width, pathops.LineCap.BUTT_CAP, pathops.LineJoin.ROUND_JOIN, 4
        )
        p.convertConicsToQuads(0.2)
        return p

    def dot(self, cx, cy):
        size = max(48, self.stroke_width * 1.04)
        if self.mono:
            return rect(cx - size / 2, cy - size / 2, size, size, size * 0.18)
        return ellipse(cx, cy, size / 2, size / 2)

    def width(self, char):
        if self.mono:
            return 620
        if char == " ":
            return 300
        if char in "ilI!|.,:;'`":
            return 250
        if char in "ftjr()[]{}":
            return 390
        if char == "m":
            return 820
        if char in "MW":
            return 860
        if char == "w":
            return 800
        if char in "ABCDEFGHKNOPQRSUVXYZ":
            return 680
        if char in "JL":
            return 540
        if char == "T":
            return 620
        return 600

    def lower(self, ch):
        w = self.width(ch)
        # The proportional master has circular bowls. Mono has squarer bowls,
        # narrowed m arches, a stepped g and footed i/l within the same cell.
        l, r, mid = 92, w - 92, w / 2
        lo, hi = 8, 512
        parts = []
        if ch in "opqbd":
            if self.mono:
                parts.append(
                    self.stroke(
                        f"M{l} 260 C{l} 448 {l+20} {hi} {mid} {hi} C{r-20} {hi} {r} 448 {r} 260 C{r} 72 {r-20} {lo} {mid} {lo} C{l+20} {lo} {l} 72 {l} 260 Z"
                    )
                )
            else:
                parts.append(self.ring(mid - 4, 260, (r - l) / 2, 252))
            if ch in "bd":
                x = l if ch == "b" else r
                parts.append(self.stroke(f"M{x} 0 V730"))
            if ch in "pq":
                x = l if ch == "p" else r
                parts.append(self.stroke(f"M{x} -208 V520"))
        elif ch == "a":
            if self.mono:
                parts += [
                    self.stroke(
                        f"M{l+2} 438 C{l+8} 500 {mid-12} 512 {r-55} 500 Q{r} 480 {r} 390 V0"
                    ),
                    self.stroke(
                        f"M{r} 280 H{l+120} Q{l} 280 {l} 140 Q{l} 8 {mid-30} 8 Q{r} 8 {r} 185"
                    ),
                ]
            else:
                parts += [
                    self.stroke(f"M{l+4} 430 C210 530 435 552 {r} 378 V0"),
                    self.stroke(
                        f"M{r} 300 L245 244 C140 221 84 178 108 93 C137 -10 351 -17 {r} 142"
                    ),
                ]
        elif ch in "nmh":
            parts.append(self.stroke(f"M{l} 0 V{730 if ch == 'h' else 520}"))
            if ch == "m":
                c1, c2 = (l + mid) / 2, (mid + r) / 2
                parts += [
                    self.stroke(
                        f"M{l} 345 C{l} 485 {c1-30} 512 {c1} 512 Q{mid} 512 {mid} 363 V0"
                    ),
                    self.stroke(
                        f"M{mid} 349 C{mid} 485 {c2-20} 512 {c2} 512 Q{r} 512 {r} 362 V0"
                    ),
                ]
            else:
                parts.append(
                    self.stroke(
                        f"M{l} 340 C{l+32} 490 {mid-40} 512 {mid+16} 512 Q{r} 512 {r} 340 V0"
                    )
                )
        elif ch == "r":
            # The short shoulder leaves an open counter rather than a full n arch.
            parts += [
                self.stroke(f"M{l} 0 V520"),
                self.stroke(f"M{l} 350 Q{l+25} 504 {r-6} 506 L{r+20} 493"),
            ]
        elif ch == "g":
            if self.mono:
                parts += [
                    self.stroke(
                        f"M{r} 260 C{r} 450 {r-25} 512 {mid} 512 C{l+20} 512 {l} 450 {l} 260 C{l} 75 {l+30} 24 {mid} 24 Q{r} 24 {r} 260 Z"
                    ),
                    self.stroke(
                        f"M{r} 520 V30 Q{r} -75 {r-72} -150 Q{r-125} -204 {mid-10} -204 H{l}"
                    ),
                ]
            else:
                parts += [
                    self.ring(mid - 10, 269, (r - l) / 2 - 2, 242),
                    self.stroke(f"M{r} 520 V-20 C{r} -238 204 -253 101 -145"),
                ]
        elif ch == "c":
            parts.append(
                self.stroke(
                    f"M{r-2} 420 C{r-84} 548 {l} 566 {l} 260 C{l} -42 {r-84} -28 {r} 93"
                )
            )
        elif ch == "e":
            if self.mono:
                parts.append(
                    self.stroke(
                        f"M{l} 271 H{r} C{r} 442 {r-45} 512 {mid} 512 C{l+60} 512 {l} 452 {l} 260 C{l} 51 {l+71} 8 {mid+4} 8 Q{r-48} 8 {r} 104"
                    )
                )
            else:
                parts.append(
                    self.stroke(
                        f"M{l+3} 226 L{r} 304 C{r-12} 461 {r-72} 512 {mid-5} 512 C{l+50} 512 {l} 432 {l} 260 C{l} 49 {l+100} 8 {mid+20} 8 Q{r-50} 8 {r} 109"
                    )
                )
        elif ch == "s":
            parts.append(
                self.stroke(
                    f"M{r-7} 424 C{r-65} 553 {l+32} 541 {l+10} 403 C{l-12} 266 {r} 285 {r} 139 C{r} -27 {l+75} -36 {l} 98"
                )
            )
        elif ch == "u":
            parts.append(
                self.stroke(
                    f"M{l} 520 V183 Q{l} 8 {mid-14} 8 Q{r} 8 {r} 183 V520 M{r} 180 V0"
                )
            )
        elif ch in "vy":
            parts.append(self.stroke(f"M{l-3} 520 L{mid} 20 L{r+3} 520"))
            if ch == "y":
                parts.append(self.stroke(f"M{mid} 20 Q{mid-42} -188 {l+8} -208"))
        elif ch == "w":
            parts.append(
                self.stroke(f"M{l-8} 520 L{l+106} 8 L{mid} 390 L{r-106} 8 L{r+8} 520")
            )
        elif ch == "x":
            parts.append(self.stroke(f"M{l} 520 L{r} 0 M{r} 520 L{l} 0"))
        elif ch == "z":
            parts.append(self.stroke(f"M{l} 500 H{r} L{l} 20 H{r}"))
        elif ch == "k":
            parts.append(
                self.stroke(f"M{l} 0 V730 M{r} 520 L{l+8} 213 M{mid-22} 312 L{r+5} 0")
            )
        elif ch in "ilj":
            x = mid
            if self.mono:
                if ch == "i":
                    parts.append(self.stroke(f"M{l+30} 500 H{x} V20 M{l-4} 20 H{r+4}"))
                elif ch == "l":
                    parts.append(self.stroke(f"M{l+30} 710 H{x} V20 H{r-10}"))
                else:
                    parts.append(
                        self.stroke(
                            f"M{l+24} 500 H{r-24} V-62 Q{r-24} -208 {mid-35} -208 H{l}"
                        )
                    )
            elif ch == "j":
                parts.append(self.stroke(f"M{x+25} 520 V-83 Q{x+25} -208 51 -193"))
            else:
                parts.append(self.stroke(f"M{x} 0 V{730 if ch == 'l' else 520}"))
            if ch != "l":
                parts.append(
                    self.dot(
                        (
                            (r - 24)
                            if self.mono and ch == "j"
                            else x + (25 if ch == "j" else 0)
                        ),
                        684,
                    )
                )
        elif ch == "t":
            x = mid - 22
            parts.append(
                self.stroke(f"M{x} 685 V149 Q{x} 8 {r+10} 33 M{l-18} 480 H{r+28}")
            )
        elif ch == "f":
            x = mid - 15
            parts.append(
                self.stroke(f"M{x} 0 V574 Q{x} 760 {r+22} 699 M{l-16} 485 H{r+12}")
            )
        else:
            raise ValueError(f"No lowercase master for {ch!r}")
        result = merge(parts)
        if not self.mono and ch in "nmr":
            # A shallow diagonal at the stem top is the repeating Hinge gesture.
            t = self.stroke_width
            cut = curve(f"M{l-t/2-2} 522 L{l+t/2+2} 522 L{l+t/2+2} {522-t*.4} Z")
            result = pathops.op(result, cut, pathops.PathOp.DIFFERENCE)
        return result, w

    def upper(self, ch):
        w = self.width(ch)
        l, r, m = 100, w - 100, w / 2
        if ch in "OQ":
            if self.mono:
                d = f"M{l} 360 C{l} 642 {l+30} 712 {m} 712 C{r-30} 712 {r} 642 {r} 360 C{r} 78 {r-30} 8 {m} 8 C{l+30} 8 {l} 78 {l} 360 Z"
            else:
                d = f"M{l} 360 C{l} 555 {l+48} 712 {m} 712 C{r-48} 712 {r} 555 {r} 360 C{r} 165 {r-48} 8 {m} 8 C{l+48} 8 {l} 165 {l} 360 Z"
            if ch == "Q":
                d += f" M{m+25} 147 L{r+35} -73"
        elif ch == "A":
            d = f"M{l-10} 0 L{m} 720 L{r+10} 0 M{l+65} 263 L{r-65} {304 if not self.mono else 263}"
        elif ch == "B":
            d = f"M{l} 0 V710 H{m+14} Q{r} 710 {r} 540 Q{r} 365 {m+8} 365 H{l} M{m+8} 365 Q{r+13} 365 {r+13} 187 Q{r+13} 10 {m+4} 10 H{l}"
        elif ch == "C":
            d = f"M{r} 597 C{r-95} 789 {l} 752 {l} 360 C{l} -32 {r-95} -69 {r} 123"
        elif ch == "D":
            d = f"M{l} 10 V710 H{m-13} C{r} 710 {r} 572 {r} 360 C{r} 148 {r} 10 {m-13} 10 H{l} Z"
        elif ch == "E":
            d = f"M{r+8} 710 H{l} V10 H{r+8} M{l} 350 L{r-20} {395 if not self.mono else 350}"
        elif ch == "F":
            d = f"M{l} 0 V710 H{r+8} M{l} 365 L{r-20} {410 if not self.mono else 365}"
        elif ch == "G":
            d = f"M{r} 604 C{r-100} 800 {l} 751 {l} 360 C{l} -40 {r} -60 {r} 196 V337 H{m+4}"
        elif ch == "H":
            d = f"M{l} 0 V720 M{r} 0 V720 M{l} 340 L{r} {386 if not self.mono else 340}"
        elif ch == "I":
            d = f"M{m} 0 V720" + (
                f" M{l-7} 710 H{r+7} M{l-7} 10 H{r+7}" if self.mono else ""
            )
        elif ch == "J":
            d = f"M{r} 720 V197 Q{r} 10 {m-5} 10 Q{l-8} 10 {l-8} 162"
        elif ch == "K":
            d = f"M{l} 0 V720 M{r+10} 720 L{l} 310 M{m-18} 437 L{r+20} 0"
        elif ch == "L":
            d = f"M{l} 720 V10 H{r+25}"
        elif ch == "M":
            d = f"M{l} 0 V720 L{m} 263 L{r} 720 V0"
        elif ch == "N":
            d = f"M{l} 0 V720 L{r} 0 V720"
        elif ch == "P":
            d = f"M{l} 0 V710 H{m+12} Q{r} 710 {r} 508 Q{r} 311 {m+12} 311 H{l}"
        elif ch == "R":
            d = f"M{l} 0 V710 H{m+12} Q{r} 710 {r} 508 Q{r} 311 {m+12} 311 H{l} M{m-8} 311 L{r+25} 0"
        elif ch == "S":
            d = f"M{r} 598 C{r-80} 787 {l} 753 {l} 559 C{l} 364 {r} 394 {r} 188 C{r} -42 {l+85} -39 {l-2} 134"
        elif ch == "T":
            d = f"M{l-18} 710 H{r+18} M{m} 710 V0"
        elif ch == "U":
            d = f"M{l} 720 V227 Q{l} 8 {m} 8 Q{r} 8 {r} 227 V720"
        elif ch == "V":
            d = f"M{l-5} 720 L{m} 0 L{r+5} 720"
        elif ch == "W":
            d = f"M{l-10} 720 L{l+115} 0 L{m} 482 L{r-115} 0 L{r+10} 720"
        elif ch == "X":
            d = f"M{l-4} 720 L{r+4} 0 M{r+4} 720 L{l-4} 0"
        elif ch == "Y":
            d = f"M{l-8} 720 L{m} 362 L{r+8} 720 M{m} 362 V0"
        elif ch == "Z":
            d = f"M{l-5} 710 H{r+5} L{l-5} 10 H{r+5}"
        else:
            raise ValueError(f"No uppercase master for {ch!r}")
        return self.stroke(d), w

    def digit(self, ch):
        w = 620 if self.mono else 610
        l, r, m = 106, w - 106, w / 2
        paths = {
            "0": f"M{l} 360 C{l} 642 {l+35} 712 {m} 712 C{r-35} 712 {r} 642 {r} 360 C{r} 78 {r-35} 8 {m} 8 C{l+35} 8 {l} 78 {l} 360 Z",
            "1": f"M{l+10} 573 L{m+33} 710 V10 M{l+8} 10 H{r+5}",
            "2": f"M{l} 546 C{l} 788 {r} 770 {r} 548 C{r} 375 {l} 272 {l} 10 H{r+8}",
            "3": f"M{l+3} 615 C{m+2} 804 {r} 715 {r} 553 Q{r} 362 {m-19} 362 M{m-19} 362 Q{r+12} 362 {r+12} 188 C{r+12} -28 {l+32} -46 {l-5} 112",
            "4": f"M{r-44} 0 V710 L{l-5} 222 H{r+34}",
            "5": f"M{r} 710 H{l+17} V398 C{l+108} 480 {r} 420 {r} 205 C{r} -35 {l+49} -44 {l-4} 104",
            "6": f"M{r-5} 631 C{m+54} 792 {l} 684 {l} 313 V207 C{l} -59 {r} -56 {r} 201 C{r} 431 {l+91} 444 {l} 280",
            "7": f"M{l-15} 710 H{r+10} L{m-44} 0",
            "8": f"M{l+8} 542 C{l+8} 765 {r-8} 765 {r-8} 542 C{r-8} 332 {l+8} 332 {l+8} 542 Z M{l} 188 C{l} 422 {r} 422 {r} 188 C{r} -54 {l} -54 {l} 188 Z",
            "9": f"M{l+5} 89 C{m-54} -72 {r} 36 {r} 407 V513 C{r} 779 {l} 776 {l} 519 C{l} 289 {r-91} 276 {r} 440",
        }
        return self.stroke(paths[ch]), w

    def symbol(self, ch):
        w = self.width(ch)
        l, r, m = 100, w - 100, w / 2
        if ch in " \u00a0":
            return pathops.Path(), 620 if self.mono else 300
        if ch in ".,;:!?":
            dot = self.dot(m, 40)
            if ch == ".":
                return dot, w
            if ch == ",":
                return (
                    merge(
                        [
                            dot,
                            self.stroke(
                                f"M{m+8} 40 Q{m+8} -78 {m-54} -102",
                                self.stroke_width * 0.72,
                            ),
                        ]
                    ),
                    w,
                )
            if ch == ":":
                return merge([dot, self.dot(m, 420)]), w
            if ch == ";":
                return (
                    merge(
                        [
                            self.dot(m, 420),
                            dot,
                            self.stroke(
                                f"M{m+8} 40 Q{m+8} -78 {m-54} -102",
                                self.stroke_width * 0.72,
                            ),
                        ]
                    ),
                    w,
                )
            if ch == "!":
                return merge([dot, self.stroke(f"M{m} 190 V720")]), w
            return (
                merge(
                    [
                        dot,
                        self.stroke(
                            f"M{l} 570 C{l} 785 {r} 759 {r} 555 C{r} 403 {m} 408 {m} 220"
                        ),
                    ]
                ),
                w,
            )
        if ch in "'\"`‘’‚“”„":
            low = ch in "‚„"
            y = 150 if low else 710
            xs = [m] if ch not in '"“”„' else [m - 90, m + 90]
            if ch in "'\"":
                return (
                    merge(
                        [
                            self.stroke(f"M{x} {y} V{y-156}", self.stroke_width * 0.8)
                            for x in xs
                        ]
                    ),
                    w,
                )
            direction = -1 if ch in "‘“`" else 1
            return (
                merge(
                    [
                        self.stroke(
                            f"M{x+direction*35} {y} Q{x-direction*30} {y-60} {x} {y-153}",
                            self.stroke_width * 0.8,
                        )
                        for x in xs
                    ]
                ),
                w,
            )
        d = {
            "-": f"M{l} 290 H{r}",
            "_": f"M{l-10} -105 H{r+10}",
            "/": f"M{l} -95 L{r} 785",
            "\\": f"M{l} 785 L{r} -95",
            "|": f"M{m} -175 V795",
            "+": f"M{l} 315 H{r} M{m} 100 V530",
            "=": f"M{l} 200 H{r} M{l} 425 H{r}",
            "<": f"M{r} 570 L{l} 310 L{r} 50",
            ">": f"M{l} 570 L{r} 310 L{l} 50",
            "(": f"M{r-10} 800 C{l-10} 632 {l-10} 55 {r-10} -120",
            ")": f"M{l+10} 800 C{r+10} 632 {r+10} 55 {l+10} -120",
            "[": f"M{r} 790 H{l+25} V-110 H{r}",
            "]": f"M{l} 790 H{r-25} V-110 H{l}",
            "{": f"M{r} 790 Q{m} 790 {m} 590 V460 Q{m} 340 {l} 340 Q{m} 340 {m} 220 V90 Q{m} -110 {r} -110",
            "}": f"M{l} 790 Q{m} 790 {m} 590 V460 Q{m} 340 {r} 340 Q{m} 340 {m} 220 V90 Q{m} -110 {l} -110",
            "*": f"M{m} 720 V330 M{l-5} 615 L{r+5} 435 M{r+5} 615 L{l-5} 435",
            "#": f"M{m-62} 730 L{l+15} -10 M{r-18} 730 L{m+57} -10 M{l-10} 480 H{r+10} M{l-25} 230 H{r-5}",
            "^": f"M{l+12} 420 L{m} 720 L{r-12} 420",
            "~": f"M{l} 300 Q{m-90} 430 {m} 330 Q{m+90} 230 {r} 360",
            "$": f"M{r-15} 605 C{r-98} 768 {l} 735 {l} 552 C{l} 365 {r} 390 {r} 185 C{r} -31 {l+70} -29 {l-4} 124 M{m} -105 V805",
            "&": f"M{r+15} 0 L{l+55} 510 C{l-20} 696 {m+60} 796 {m+72} 586 C{m+82} 409 {l} 358 {l} 181 C{l} -60 {r} -12 {r} 246 V302",
            "£": f"M{r} 620 C{r-109} 811 {l+50} 705 {l+50} 514 V90 Q{l+50} 10 {l-5} 10 H{r+20} M{l-22} 342 H{r-38}",
            "€": f"M{r} 609 C{r-150} 825 {l+48} 655 {l+48} 360 C{l+48} 65 {r-150} -105 {r} 111 M{l-10} 445 H{r-35} M{l-10} 270 H{r-35}",
            "¥": f"M{l} 720 L{m} 380 L{r} 720 M{m} 380 V0 M{l} 280 H{r} M{l} 120 H{r}",
            "×": f"M{l} 530 L{r} 90 M{r} 530 L{l} 90",
            "−": f"M{l} 310 H{r}",
        }.get(ch)
        if d:
            return self.stroke(d), w
        if ch == "%":
            return (
                merge(
                    [
                        self.stroke(f"M{l-15} -5 L{r+15} 725"),
                        self.ring(l + 50, 565, 75, 112),
                        self.ring(r - 50, 155, 75, 112),
                    ]
                ),
                w,
            )
        if ch == "@":
            return (
                merge(
                    [
                        self.stroke(
                            f"M{r+4} 105 C{r-130} -30 {l-35} 52 {l-35} 336 C{l-35} 626 {r+50} 663 {r+50} 371 V209 Q{r+50} 130 {r-37} 143 V417 M{r-37} 268 C{r-37} 462 {m-90} 470 {m-90} 269 C{m-90} 74 {r-37} 86 {r-37} 268 Z",
                            self.stroke_width * 0.74,
                        )
                    ]
                ),
                w,
            )
        if ch == "÷":
            return (
                merge(
                    [self.stroke(f"M{l} 310 H{r}"), self.dot(m, 555), self.dot(m, 65)]
                ),
                w,
            )
        raise ValueError(f"No symbol master for {ch!r}")
