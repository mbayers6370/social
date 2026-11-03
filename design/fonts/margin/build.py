#!/usr/bin/env python3
"""Build the six original Margin faces from editable geometric masters."""
import hashlib
from datetime import datetime, timezone
import json
import string
import unicodedata
from pathlib import Path

import pathops
from fontTools.feaLib.builder import addOpenTypeFeaturesFromString
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont

from outlines import Drawing, MASTERS, ellipse, merge, rect, transform

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "public/fonts/margin"
VERSION = "0.100"
STYLES = {300: "Light", 500: "Medium", 700: "Bold"}
# A fixed build epoch makes identical sources produce identical font bytes.
EPOCH = int(
    (
        datetime(2026, 11, 2, tzinfo=timezone.utc)
        - datetime(1904, 1, 1, tzinfo=timezone.utc)
    ).total_seconds()
)


def glyph_name(char):
    return f"uni{ord(char):04X}"


def marks(draw, mark, center, top):
    width = max(28, draw.stroke_width * 0.68)
    if mark == "\u0301":
        return draw.stroke(f"M{center-68} {top} L{center+72} {top+120}", width)
    if mark == "\u0300":
        return draw.stroke(f"M{center+68} {top} L{center-72} {top+120}", width)
    if mark == "\u0302":
        return draw.stroke(
            f"M{center-118} {top+5} L{center} {top+104} L{center+118} {top+5}", width
        )
    if mark == "\u030c":
        return draw.stroke(
            f"M{center-118} {top+104} L{center} {top+5} L{center+118} {top+104}", width
        )
    if mark == "\u0303":
        return draw.stroke(
            f"M{center-130} {top+38} Q{center-65} {top+115} {center} {top+55} Q{center+65} {top-5} {center+130} {top+72}",
            width,
        )
    if mark == "\u0308":
        return merge([draw.dot(center - 98, top + 58), draw.dot(center + 98, top + 58)])
    if mark == "\u0307":
        return draw.dot(center, top + 58)
    if mark == "\u030a":
        p = ellipse(center, top + 64, 54, 54)
        p.stroke(width, pathops.LineCap.BUTT_CAP, pathops.LineJoin.ROUND_JOIN, 4)
        p.convertConicsToQuads(0.2)
        return p
    if mark == "\u0304":
        return draw.stroke(f"M{center-123} {top+60} H{center+123}", width)
    if mark == "\u0306":
        return draw.stroke(
            f"M{center-122} {top+110} Q{center} {top-68} {center+122} {top+110}", width
        )
    if mark == "\u0327":
        return draw.stroke(
            f"M{center+10} -4 L{center-32} -75 Q{center+115} -61 {center+63} -156 Q{center+30} -199 {center-65} -161",
            width,
        )
    if mark == "\u0328":
        return draw.stroke(
            f"M{center+65} 0 Q{center-95} -119 {center+21} -168 Q{center+84} -185 {center+112} -153",
            width,
        )
    if mark == "\u030b":
        return merge(
            [
                draw.stroke(f"M{center-111} {top} L{center-15} {top+120}", width),
                draw.stroke(f"M{center+9} {top} L{center+105} {top+120}", width),
            ]
        )
    raise ValueError(mark)


def repertoire(draw):
    glyphs = {}
    for char in string.ascii_lowercase:
        glyphs[char] = draw.lower(char)
    for char in string.ascii_uppercase:
        glyphs[char] = draw.upper(char)
    for char in string.digits:
        glyphs[char] = draw.digit(char)
    for char in string.punctuation + " \u00a0‘’‚“”„£€¥×÷−":
        glyphs[char] = draw.symbol(char)
    # Precomposed Latin-1 and Latin Extended-A, including dotted/dotless i.
    supported_marks = set(
        "\u0300\u0301\u0302\u0303\u0304\u0306\u0307\u0308\u030a\u030b\u030c\u0327\u0328"
    )
    for point in range(0xC0, 0x180):
        char = chr(point)
        decomp = unicodedata.normalize("NFD", char)
        if (
            len(decomp) != 2
            or decomp[0] not in glyphs
            or decomp[1] not in supported_marks
        ):
            continue
        base, mark = decomp
        if base == "i":
            # Accented i replaces the dot rather than stacking a mark above it.
            p, w = draw.lower("l")
            p = pathops.op(p, rect(-100, 530, 1000, 400), pathops.PathOp.DIFFERENCE)
        else:
            p, w = glyphs[base]
        # The gap remains clear even at Bold; uppercase marks share the same ceiling.
        top = 788 if base.isupper() else 600
        accent = marks(draw, mark, w / 2, top)
        left, _, right, _ = accent.bounds
        if left < 16 or right > w - 16:
            scale = min(1, (w - 32) / (right - left))
            accent = transform(accent, xx=scale, dx=w / 2 - (left + right) * scale / 2)
        glyphs[char] = (merge([p, accent]), w)
    for char, base in [
        ("Ø", "O"),
        ("ø", "o"),
        ("Ł", "L"),
        ("ł", "l"),
        ("Đ", "D"),
        ("đ", "d"),
        ("Ð", "D"),
    ]:
        p, w = glyphs[base]
        slash = (
            draw.stroke(f"M85 70 L{w-85} 650", draw.stroke_width * 0.65)
            if char in "ØøŁł"
            else draw.stroke(f"M65 360 H{w-90}", draw.stroke_width * 0.65)
        )
        glyphs[char] = (merge([p, slash]), w)
    for char, base in [
        ("Æ", ("A", "E")),
        ("æ", ("a", "e")),
        ("Œ", ("O", "E")),
        ("œ", ("o", "e")),
    ]:
        (a, aw), (b, bw) = [glyphs[c] for c in base]
        width = 620 if draw.mono else aw + bw - 170
        # Ligature outlines fit their advance, including the mono cell.
        scale = width / (aw + bw - 80)
        glyphs[char] = (
            merge(
                [transform(a, xx=scale), transform(b, xx=scale, dx=(aw - 80) * scale)]
            ),
            width,
        )
    p, w = glyphs["p"]
    glyphs["þ"] = (merge([p, draw.stroke("M92 0 V730")]), w)
    p, w = glyphs["P"]
    glyphs["Þ"] = (merge([transform(p, yy=0.72, dy=65), draw.stroke("M100 0 V720")]), w)
    width = 620 if draw.mono else 620
    glyphs["ß"] = (
        draw.stroke(
            f"M105 0 V521 C105 787 {width-100} 780 {width-100} 569 Q{width-100} 441 314 355 C{width-50} 314 {width-50} 5 290 28"
        ),
        width,
    )
    p, w = draw.lower("l")
    glyphs["ı"] = (
        pathops.op(p, rect(-100, 530, 1000, 400), pathops.PathOp.DIFFERENCE),
        w,
    )
    p, w = glyphs["s"]
    glyphs["ſ"] = (draw.stroke(f"M{w/2} 0 V563 Q{w/2} 755 {w-72} 704"), w)
    # Punctuation with proportional widths in Hinge and a fixed cell in Loose Mono.
    for char, factor in [("–", 0.78), ("—", 1.2)]:
        width = 620 if draw.mono else round(1000 * factor)
        glyphs[char] = (draw.stroke(f"M75 290 H{width-75}"), width)
    width = 620 if draw.mono else 850
    glyphs["…"] = (merge([draw.dot(width * x, 40) for x in [0.22, 0.5, 0.78]]), width)
    for char, letter in [("©", "C"), ("®", "R")]:
        p, _ = glyphs[letter]
        glyphs[char] = (
            merge(
                [
                    draw.ring(310, 360, 235, 300),
                    transform(p, xx=0.5, yy=0.5, dx=140, dy=180),
                ]
            ),
            620,
        )
    degree_width = 620 if draw.mono else 400
    glyphs["°"] = (draw.ring(degree_width / 2, 620, 90, 90), degree_width)
    for char, base in [("¡", "!"), ("¿", "?")]:
        p, w = glyphs[base]
        glyphs[char] = (transform(p, xx=-1, yy=-1, dx=w, dy=520), w)
    # Expose the original accents as spacing marks, too.
    for char, mark in [
        ("´", "\u0301"),
        ("¨", "\u0308"),
        ("¯", "\u0304"),
        ("¸", "\u0327"),
    ]:
        width = 620 if draw.mono else 400
        glyphs[char] = (marks(draw, mark, width / 2, 600), width)
    width = 620 if draw.mono else 300
    glyphs["·"] = (draw.dot(width / 2, 300), width)
    glyphs["•"] = (ellipse(width / 2, 300, 70, 70), width)
    for char, direction in [("«", -1), ("»", 1)]:
        width = 620 if draw.mono else 600
        paths = []
        for x in [width / 2 - 85, width / 2 + 85]:
            paths.append(
                draw.stroke(
                    f"M{x-direction*64} 445 L{x+direction*64} 280 L{x-direction*64} 115",
                    draw.stroke_width * 0.78,
                )
            )
        glyphs[char] = (merge(paths), width)
    p, w = glyphs["c"]
    glyphs["¢"] = (
        merge([p, draw.stroke(f"M{w/2} -90 V640", draw.stroke_width * 0.6)]),
        w,
    )
    glyphs["‑"] = glyphs["-"]
    return glyphs


def make_face(master, weight):
    draw = Drawing(master, weight)
    raw = repertoire(draw)
    order = [".notdef"] + [glyph_name(c) for c in sorted(raw, key=ord)]
    glyphs = {}
    metrics = {}
    # A visible missing-glyph box; unsupported characters never silently become blanks.
    raw_notdef = merge(
        [draw.stroke("M90 0 V700 H510 V0 Z"), draw.stroke("M90 0 L510 700")]
    )
    for name, (p, advance) in [(".notdef", (raw_notdef, 620))] + [
        (glyph_name(c), raw[c]) for c in sorted(raw, key=ord)
    ]:
        p.simplify()
        pen = TTGlyphPen(None)
        p.draw(Cu2QuPen(pen, max_err=0.65, reverse_direction=True))
        g = pen.glyph()
        glyphs[name] = g
        metrics[name] = (round(advance), round(p.bounds[0]) if len(p) else 0)
    style = STYLES[weight]
    slug = master.family.lower().replace(" ", "-")
    fb = FontBuilder(1000, isTTF=True)
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap({ord(c): glyph_name(c) for c in raw})
    fb.setupGlyf(glyphs)
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=1000, descent=-280, lineGap=0)
    # RIBBI names keep OS style linking predictable; typographic names group all weights.
    legacy_family = master.family if weight == 700 else f"{master.family} {style}"
    fb.setupNameTable(
        {
            "familyName": legacy_family,
            "styleName": "Bold" if weight == 700 else "Regular",
            "typographicFamily": master.family,
            "typographicSubfamily": style,
            "fullName": f"{master.family} {style}",
            "psName": f"{master.family.replace(' ','')}-{style}",
            "uniqueFontIdentifier": f"Margin:{master.family}:{style}:{VERSION}",
            "version": f"Version {VERSION}",
            "manufacturer": "Margin",
            "designer": "Margin custom type studies",
            "description": "Original geometric outlines developed for the Margin Hinge and Loose Mono concepts. Development release.",
            "copyright": "Copyright 2026 Margin. Custom project font assets.",
            "licenseDescription": "Custom Margin project assets. No third-party font outlines are included. No public redistribution license is assigned by this package.",
        }
    )
    selection = (1 << 7) | ((1 << 5) if weight == 700 else (1 << 6))
    fb.setupOS2(
        version=4,
        sTypoAscender=1000,
        sTypoDescender=-280,
        sTypoLineGap=0,
        usWinAscent=1000,
        usWinDescent=280,
        usWeightClass=weight,
        usWidthClass=5,
        fsSelection=selection,
        fsType=0,
        sxHeight=520,
        sCapHeight=720,
        xAvgCharWidth=(
            620 if master.mono else round(sum(v[1] for v in raw.values()) / len(raw))
        ),
    )
    fb.setupPost(isFixedPitch=int(master.mono))
    fb.font.recalcTimestamp = False
    fb.font["head"].created = EPOCH
    fb.font["head"].modified = EPOCH
    fb.font["head"].fontRevision = float(VERSION)
    fb.font["head"].macStyle = 1 if weight == 700 else 0
    if not master.mono:
        pairs = {
            "AV": -55,
            "AW": -35,
            "AY": -45,
            "AT": -25,
            "FA": -25,
            "LT": -35,
            "LV": -25,
            "LY": -35,
            "PA": -35,
            "Ta": -40,
            "Te": -35,
            "To": -40,
            "Tu": -20,
            "Va": -25,
            "Ve": -20,
            "Vo": -25,
            "Wa": -18,
            "Wo": -18,
            "Ya": -40,
            "Ye": -40,
            "Yo": -40,
            "ry": -10,
        }
        features = (
            "feature kern {\n"
            + "\n".join(
                f"pos {glyph_name(a)} {glyph_name(b)} {v};"
                for (a, b), v in pairs.items()
            )
            + "\n} kern;"
        )
        addOpenTypeFeaturesFromString(fb.font, features)
    OUT.mkdir(parents=True, exist_ok=True)
    filename = f"{slug}-{style.lower()}"
    ttf = OUT / f"{filename}.ttf"
    fb.save(ttf)
    font = TTFont(ttf, recalcTimestamp=False)
    font.flavor = "woff2"
    font.save(OUT / f"{filename}.woff2")
    return {
        "family": master.family,
        "style": style,
        "weight": weight,
        "fixedPitch": master.mono,
        "glyphCount": len(order),
        "files": [
            {
                "path": p.name,
                "sha256": hashlib.sha256(p.read_bytes()).hexdigest(),
                "bytes": p.stat().st_size,
            }
            for p in [ttf, OUT / f"{filename}.woff2"]
        ],
        "characters": "".join(sorted(raw, key=ord)),
    }


if __name__ == "__main__":
    results = [make_face(m, w) for m in MASTERS for w in STYLES]
    (OUT / "manifest.json").write_text(
        json.dumps(
            {"version": VERSION, "unitsPerEm": 1000, "faces": results},
            ensure_ascii=False,
            indent=2,
        )
        + "\n"
    )
    print(
        "Built",
        len(results),
        "faces:",
        ", ".join(
            f"{r['family']} {r['style']} ({r['glyphCount']} glyphs)" for r in results
        ),
    )
