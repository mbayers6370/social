#!/usr/bin/env python3
"""Focused file/coverage/weight verification for the emitted Aside family."""
import hashlib
import json
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.areaPen import AreaPen
import pathops

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "public/fonts/margin-aside"
manifest = json.loads((OUT / "manifest.json").read_text())
assert [face["weight"] for face in manifest["faces"]] == [300, 500, 700]
advances = None
areas = []
ink_areas = []
for face in manifest["faces"]:
    fonts = []
    for entry in face["files"]:
        path = OUT / entry["path"]
        data = path.read_bytes()
        assert len(data) == entry["bytes"]
        assert hashlib.sha256(data).hexdigest() == entry["sha256"]
        fonts.append(TTFont(path, recalcTimestamp=False, checkChecksums=2))
    ttf, woff = fonts
    cmap = ttf.getBestCmap()
    assert set(cmap) == {ord(c) for c in face["characters"]}
    assert set(range(32, 127)) <= set(cmap)
    assert ttf["hmtx"][cmap[32]] == ttf["hmtx"][cmap[160]]
    assert all(
        ord(c) in cmap for c in "Café Amigável Łódź Göteborg İstanbul €£¥ — … “Hello” ·"
    )
    assert len(ttf.getGlyphOrder()) == face["glyphCount"]
    assert ttf["name"].getDebugName(16) == "Margin Aside"
    assert ttf["name"].getDebugName(17) == face["style"]
    assert ttf["OS/2"].usWeightClass == face["weight"]
    assert ttf["OS/2"].fsType == 0
    assert ttf["post"].isFixedPitch == 0
    assert "GPOS" in ttf
    assert cmap == woff.getBestCmap()
    assert ttf["hmtx"].metrics == woff["hmtx"].metrics
    # Weight changes must not move the text into new lines.
    current = {name: metric[0] for name, metric in ttf["hmtx"].metrics.items()}
    assert len(set(current.values())) > 4
    assert current[cmap[ord("i")]] < current[cmap[ord("m")]]
    if advances is None:
        advances = current
    else:
        assert current == advances
    for name in ttf.getGlyphOrder():
        g = ttf["glyf"][name]
        assert g.compile(ttf["glyf"]) == woff["glyf"][name].compile(woff["glyf"])
        if g.numberOfContours:
            assert g.yMax <= ttf["hhea"].ascent and g.yMin >= ttf["hhea"].descent, (
                face["style"],
                name,
                "vertical clipping",
            )
            assert g.xMin >= 0 and g.xMax <= current[name], (
                face["style"],
                name,
                "advance overflow",
            )
        else:
            assert name in [cmap[32], cmap[160]], (face["style"], name, "blank glyph")
    assert (
        0.75 < face["inkAreaRetained"] < 0.97
    ), "Worn-print ink loss should be visible without erasing the skeleton."

    def outline(char):
        path = pathops.Path()
        ttf.getGlyphSet()[cmap[ord(char)]].draw(path.getPen())
        return path

    capital_o, zero = outline("O"), outline("0")
    ow = capital_o.bounds[2] - capital_o.bounds[0]
    zw = zero.bounds[2] - zero.bounds[0]
    assert 1.10 < ow / zw < 1.16, (face["style"], "O/zero width", ow / zw)
    assert zero.contains(
        (current[cmap[48]] / 2, 336)
    ), "Zero needs a solid central dot."
    assert not capital_o.contains((current[cmap[79]] / 2, 336))
    assert (
        outline("I").bounds[2] - outline("I").bounds[0] < 270
    ), "I serifs are too wide."
    assert current[cmap[45]] < current[cmap[0x2013]] < current[cmap[0x2014]]
    assert current[cmap[0x2013]] == current[cmap[ord("n")]]
    assert current[cmap[0x2014]] == current[cmap[ord("M")]]
    centers = [(outline(ch).bounds[1] + outline(ch).bounds[3]) / 2 for ch in "-–—"]
    assert max(centers) - min(centers) < 3, "Dash centers must align."
    for opening, closing in [("‘", "’"), ("“", "”")]:

        def ink_center(path):
            left, bottom, right, top = path.bounds
            points = [
                y
                for x in range(round(left), round(right) + 1, 4)
                for y in range(round(bottom), round(top) + 1, 4)
                if path.contains((x, y))
            ]
            return sum(points) / len(points)

        assert (
            ink_center(outline(opening)) < ink_center(outline(closing)) - 30
        ), "Curly quotes must face one another."
    required_pairs = {"To", "Th", "Ta", "Te", "Yo", "Wa", "r.", "y.", "f.", "“T", "T”"}
    pairs = {}
    reverse = {name: chr(cp) for cp, name in cmap.items()}
    for lookup in ttf["GPOS"].table.LookupList.Lookup:
        if lookup.LookupType == 2:
            for table in lookup.SubTable:
                if table.Format == 1:
                    for first, records in zip(table.Coverage.glyphs, table.PairSet):
                        for record in records.PairValueRecord:
                            pair = reverse[first] + reverse[record.SecondGlyph]
                            pairs[pair] = record.Value1.XAdvance
    assert required_pairs <= pairs.keys()
    for pair in required_pairs:
        assert pairs[pair] < 0, (face["style"], pair, "missing kern")
        first, second = map(outline, pair)
        second = second.transform(
            1, 0, 0, 1, current[cmap[ord(pair[0])]] + pairs[pair], 0
        )
        overlap = pathops.op(first, second, pathops.PathOp.INTERSECTION)
        assert overlap.area < 1, (face["style"], pair, "kerned outlines touch")
    # Three actual outline weights, rather than metadata-only duplicates.
    name = cmap[ord("n")]
    coords = ttf["glyf"][name].getCoordinates(ttf["glyf"])[0]
    areas.append((ttf["glyf"][name].compile(ttf["glyf"]), len(coords)))
    area_pen = AreaPen(ttf.getGlyphSet())
    ttf.getGlyphSet()[name].draw(area_pen)
    ink_areas.append(abs(area_pen.value))
assert len({data for data, _ in areas}) == 3
assert ink_areas[0] < ink_areas[1] < ink_areas[2]
print(
    "Aside: six files; 303 encoded characters per face; TTF/WOFF2 parity, weights, embedding, metrics, bounds and restrained wear passed."
)
