#!/usr/bin/env python3
"""Build Margin Aside from original rounded typewriter geometry with porous ink wear."""
import hashlib
import json
import math
import os
import random
import subprocess
import sys
import unicodedata
from pathlib import Path

import pathops
from fontTools.fontBuilder import FontBuilder
from fontTools.feaLib.builder import addOpenTypeFeaturesFromString
from fontTools.pens.basePen import BasePen
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "design/fonts/margin"))
from outlines import Drawing, Master, curve, merge, transform
from build import EPOCH, glyph_name, marks, repertoire

OUT = ROOT / "public/fonts/margin-aside"
FAMILY = "Margin Aside"
VERSION = "0.110"
STYLES = {300: ("Light", 61), 500: ("Medium", 94), 700: ("Bold", 124)}
KERN_PAIRS = {
    "To": -32,
    "Th": -28,
    "Ta": -30,
    "Te": -30,
    "Yo": -30,
    "Wa": -20,
    "r.": -28,
    "y.": -24,
    "f.": -24,
    "“T": -28,
    "T”": -30,
    "e’": -20,
    "’s": -14,
    "’v": -16,
}


class Flatten(BasePen):
    """Sample expanded ink boundaries before applying small, stable edge wear."""

    def __init__(self):
        super().__init__(None)
        self.contours = []
        self.points = []

    def _moveTo(self, p):
        self.points = [p]

    def _lineTo(self, p):
        a = self.points[-1]
        count = max(1, math.ceil(math.dist(a, p) / 9))
        self.points.extend(
            (a[0] + (p[0] - a[0]) * i / count, a[1] + (p[1] - a[1]) * i / count)
            for i in range(1, count + 1)
        )

    def _curveToOne(self, a, b, c):
        start = self.points[-1]
        count = max(
            3, math.ceil((math.dist(start, a) + math.dist(a, b) + math.dist(b, c)) / 9)
        )
        for i in range(1, count + 1):
            t = i / count
            u = 1 - t
            self.points.append(
                (
                    u**3 * start[0]
                    + 3 * u * u * t * a[0]
                    + 3 * u * t * t * b[0]
                    + t**3 * c[0],
                    u**3 * start[1]
                    + 3 * u * u * t * a[1]
                    + 3 * u * t * t * b[1]
                    + t**3 * c[1],
                )
            )

    def _qCurveToOne(self, a, b):
        start = self.points[-1]
        count = max(2, math.ceil((math.dist(start, a) + math.dist(a, b)) / 9))
        for i in range(1, count + 1):
            t = i / count
            u = 1 - t
            self.points.append(
                (
                    u * u * start[0] + 2 * u * t * a[0] + t * t * b[0],
                    u * u * start[1] + 2 * u * t * a[1] + t * t * b[1],
                )
            )

    def _closePath(self):
        if math.dist(self.points[0], self.points[-1]) > 0.01:
            self._lineTo(self.points[0])
        self.contours.append(self.points[:-1])

    def _endPath(self):
        self._closePath()


def wear(p, char, stroke_width):
    if not len(p):
        return p
    # Functional punctuation keeps a full ink impression at reading size.
    # Its existing drawing and advance are unchanged; the letters retain wear.
    if char in ",:;‘’“”'\"":
        return p
    seed = int.from_bytes(hashlib.sha256(char.encode()).digest()[:8], "big")
    rng = random.Random(seed)
    pen = Flatten()
    p.draw(pen)
    out = pathops.Path()
    for points in pen.contours:
        if len(points) < 4:
            continue
        arc = [0]
        for i in range(1, len(points) + 1):
            arc.append(arc[-1] + math.dist(points[i - 1], points[i % len(points)]))
        perimeter = arc[-1]
        # Keep small punctuation intact; wear stays shallow in thin Light strokes.
        count = max(1, round(perimeter / 335))
        nicks = [
            (
                rng.uniform(0, perimeter),
                rng.uniform(5, 10),
                rng.uniform(0.12, 0.25) * min(stroke_width, 85),
            )
            for _ in range(count)
        ]
        phase = rng.uniform(0, 2 * math.pi)
        result = []
        for i, (x, y) in enumerate(points):
            before, after = points[i - 1], points[(i + 1) % len(points)]
            dx, dy = after[0] - before[0], after[1] - before[1]
            length = math.hypot(dx, dy) or 1
            nx, ny = -dy / length, dx / length
            if not p.contains((x + nx * 3, y + ny * 3)):
                nx, ny = -nx, -ny
            # A lightly rough ink edge, with a few small chips rather than holes.
            shift = 0.8 * math.sin(x * 0.083 + y * 0.061 + phase) + 0.45 * math.sin(
                x * 0.173 - y * 0.119 + phase
            )
            if perimeter > 160:
                for center, span, depth in nicks:
                    distance = abs(arc[i] - center)
                    distance = min(distance, perimeter - distance)
                    shift += depth * math.exp(-0.5 * (distance / span) ** 2)
            result.append((x + nx * shift, y + ny * shift))
        out.moveTo(*result[0])
        for point in result[1:]:
            out.lineTo(*point)
        out.close()
    out.simplify()
    # Porous, clustered ink loss, guided by the user's distressed-print reference.
    # Most cutouts remain inside strokes; a few meet an edge as rubbed patches.
    left, bottom, right, top = out.bounds
    if right - left > 120 and top - bottom > 230:
        clean_area = out.area
        # Different letters carry different impressions, rather than one uniform filter.
        rate = rng.choice([0.045, 0.075, 0.10, 0.13, 0.17])
        if stroke_width < 80:
            rate *= 0.65
        target = clean_area * rate
        clusters = []
        for _ in range(3):
            for attempt in range(120):
                x = rng.uniform(left + 12, right - 12)
                y = rng.uniform(bottom + 12, top - 12)
                if out.contains((x, y)):
                    clusters.append((x, y))
                    break
        for _ in range(110):
            if clean_area - out.area >= target:
                break
            for attempt in range(80):
                if clusters and rng.random() < 0.65:
                    cx, cy = rng.choice(clusters)
                    x, y = rng.gauss(cx, 32), rng.gauss(cy, 51)
                else:
                    x = rng.uniform(left + 4, right - 4)
                    y = rng.uniform(bottom + 4, top - 4)
                rx = rng.uniform(3, 8)
                ry = rng.uniform(3, 12)
                if all(
                    out.contains(point)
                    for point in [
                        (x - rx - 1, y),
                        (x + rx + 1, y),
                        (x, y - ry - 1),
                        (x, y + ry + 1),
                    ]
                ):
                    hole = curve(
                        f"M{x-rx} {y-ry*.5} L{x-rx*.3} {y-ry} "
                        f"L{x+rx*.7} {y-ry*.6} L{x+rx} {y+ry*.35} "
                        f"L{x+rx*.15} {y+ry} L{x-rx*.8} {y+ry*.6} Z"
                    )
                    out = pathops.op(out, hole, pathops.PathOp.DIFFERENCE)
                    break

    return out


class AsideDrawing(Drawing):
    def __init__(self, weight):
        super().__init__(
            Master(FAMILY, False, {w: s for w, (_, s) in STYLES.items()}), weight
        )
        self.geometry = json.loads(
            subprocess.check_output(
                [
                    os.environ.get("NODE", "node"),
                    str(Path(__file__).with_name("master.cjs")),
                    str(self.stroke_width),
                ],
                text=True,
            )
        )
        self.protected_ink = {}

    def original(self, char):
        data = self.geometry["glyphs"].get(char)
        if data is None:
            return super().symbol(char)
        parts = []
        protected = []
        for part in data["parts"]:
            p = curve(part["d"])
            if part.get("fill") and not part.get("shape"):
                # Dots share the face's optical weight without becoming blobs in Bold.
                factor = (self.stroke_width / 76) ** 0.48
                x0, y0, x1, y1 = p.bounds
                cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
                p = transform(
                    p, xx=factor, yy=factor, dx=cx * (1 - factor), dy=cy * (1 - factor)
                )
            elif not part.get("fill"):
                width = part.get("width", self.stroke_width)
                p.stroke(
                    width, pathops.LineCap.BUTT_CAP, pathops.LineJoin.ROUND_JOIN, 4
                )
                p.convertConicsToQuads(0.2)
            if part.get("transform"):
                dx, dy = map(
                    float,
                    part["transform"]
                    .removeprefix("translate(")
                    .removesuffix(")")
                    .split(),
                )
                p = transform(p, dx=dx, dy=dy)
            if part.get("matrix"):
                p = p.transform(*part["matrix"])
            if part.get("protected"):
                protected.append(p)
            parts.append(p)
        p = merge(parts)
        if len(p):
            stretch = data.get("stretch", 1)
            p = transform(p, xx=stretch)
            left, _, right, _ = p.bounds
            scale = min(1, (data["width"] - 40) / (right - left))
            offset = (
                data["width"] / 2
                - (left + right) * scale / 2
                + data.get("bearingShift", 0)
            )
            p = transform(p, xx=scale, dx=offset)
            if protected:
                self.protected_ink[char] = transform(
                    merge(protected), xx=stretch * scale, dx=offset
                )
        return p, data["width"]

    def lower(self, char):
        return self.original(char)

    def upper(self, char):
        return self.original(char)

    def digit(self, char):
        return self.original(char)

    def symbol(self, char):
        return self.original(char)

    def dot(self, cx, cy):
        size = 66 * (self.stroke_width / 76) ** 0.48
        return curve(
            f"M{cx-size*.48} {cy-size*.42} L{cx+size*.5} {cy-size*.31} "
            f"L{cx+size*.38} {cy+size*.64} L{cx-size*.61} {cy+size*.51} Z"
        )


def make_face(weight, style, stroke):
    draw = AsideDrawing(weight)
    raw = repertoire(draw)
    # Preserve Aside's distinctive punctuation rather than the shared utility variants.
    for char in "–—…":
        raw[char] = draw.original(char)
    # Use the actual dotless i, keeping the original i stem and dotless serif footprint.
    p, w = draw.original("i")
    from outlines import rect

    raw["ı"] = (pathops.op(p, rect(-100, 550, 1000, 400), pathops.PathOp.DIFFERENCE), w)
    raw["\u00a0"] = raw[" "]
    # Accented i keeps i's serifs, rather than borrowing the curled l's foot.
    for char in list(raw):
        decomposition = unicodedata.normalize("NFD", char)
        if len(decomposition) == 2 and decomposition[0] == "i":
            p, w = raw["ı"]
            accent = marks(draw, decomposition[1], w / 2, 600)
            raw[char] = (merge([p, accent]), w)
    order = [".notdef"] + [glyph_name(c) for c in sorted(raw, key=ord)]
    notdef = merge([draw.stroke("M90 0 V700 H510 V0 Z"), draw.stroke("M90 0 L510 700")])
    glyphs = {}
    metrics = {}
    clean_area = 0
    worn_area = 0
    for name, (p, advance), char in [(".notdef", (notdef, 620), "□")] + [
        (glyph_name(c), raw[c], c) for c in sorted(raw, key=ord)
    ]:
        if len(p):
            p.simplify()
            clean_area += p.area
            p = wear(p, char, stroke)
            if char in draw.protected_ink:
                p = merge([p, draw.protected_ink[char]])
            worn_area += p.area
            # Keep all weights within stable advances, including wide serif terminals.
            left, _, right, _ = p.bounds
            if left < 10 or right > advance - 10:
                scale = min(1, (advance - 20) / (right - left))
                p = transform(p, xx=scale, dx=advance / 2 - (left + right) * scale / 2)
        pen = TTGlyphPen(None)
        p.draw(Cu2QuPen(pen, max_err=0.45, reverse_direction=True))
        glyphs[name] = pen.glyph()
        metrics[name] = (round(advance), round(p.bounds[0]) if len(p) else 0)
    fb = FontBuilder(1000, isTTF=True)
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap({ord(c): glyph_name(c) for c in raw})
    fb.setupGlyf(glyphs)
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=1020, descent=-290, lineGap=0)
    fb.setupNameTable(
        {
            "familyName": FAMILY if weight == 700 else f"{FAMILY} {style}",
            "styleName": "Bold" if weight == 700 else "Regular",
            "typographicFamily": FAMILY,
            "typographicSubfamily": style,
            "fullName": f"{FAMILY} {style}",
            "psName": f"MarginAside-{style}",
            "uniqueFontIdentifier": f"Margin:Aside:{style}:{VERSION}",
            "version": f"Version {VERSION}",
            "manufacturer": "Margin",
            "designer": "Margin custom type studies",
            "description": "Original rounded typewriter lettering with porous, worn-print ink. Development release.",
            "copyright": "Copyright 2026 Margin. Custom project font assets.",
            "licenseDescription": "Custom Margin project assets. No third-party font outlines are included. No public redistribution license is assigned.",
        }
    )
    fb.setupOS2(
        version=4,
        sTypoAscender=1020,
        sTypoDescender=-290,
        sTypoLineGap=0,
        usWinAscent=1020,
        usWinDescent=290,
        usWeightClass=weight,
        usWidthClass=5,
        fsSelection=(1 << 7) | ((1 << 5) if weight == 700 else (1 << 6)),
        fsType=0,
        sxHeight=470,
        sCapHeight=673,
        xAvgCharWidth=round(sum(v[1] for v in raw.values()) / len(raw)),
    )
    fb.setupPost(isFixedPitch=0)
    fb.font.recalcTimestamp = False
    fb.font["head"].created = EPOCH
    fb.font["head"].modified = EPOCH
    fb.font["head"].fontRevision = float(VERSION)
    fb.font["head"].macStyle = 1 if weight == 700 else 0
    addOpenTypeFeaturesFromString(
        fb.font,
        "feature kern {\n"
        + "\n".join(
            f"pos {glyph_name(a)} {glyph_name(b)} {amount};"
            for (a, b), amount in KERN_PAIRS.items()
        )
        + "\n} kern;",
    )
    ttf = OUT / f"margin-aside-{style.lower()}.ttf"
    fb.save(ttf)
    woff = TTFont(ttf, recalcTimestamp=False)
    woff.flavor = "woff2"
    woff.save(ttf.with_suffix(".woff2"))
    files = [ttf, ttf.with_suffix(".woff2")]
    return {
        "family": FAMILY,
        "style": style,
        "weight": weight,
        "fixedPitch": False,
        "glyphCount": len(order),
        "characters": "".join(sorted(raw, key=ord)),
        "inkAreaRetained": round(worn_area / clean_area, 5),
        "files": [
            {
                "path": p.name,
                "bytes": p.stat().st_size,
                "sha256": hashlib.sha256(p.read_bytes()).hexdigest(),
            }
            for p in files
        ],
    }


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    faces = [make_face(w, style, stroke) for w, (style, stroke) in STYLES.items()]
    (OUT / "manifest.json").write_text(
        json.dumps(
            {"version": VERSION, "unitsPerEm": 1000, "faces": faces},
            ensure_ascii=False,
            indent=2,
        )
        + "\n"
    )
    print(
        "Built:",
        ", ".join(
            f"{f['style']} ({f['glyphCount']} glyphs; {f['inkAreaRetained']:.1%} ink retained)"
            for f in faces
        ),
    )
