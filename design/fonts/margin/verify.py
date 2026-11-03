#!/usr/bin/env python3
"""Check emitted font behavior/contracts, independent of the drawing code."""
import hashlib
import json
from pathlib import Path

from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "public/fonts/margin"


def verify():
    manifest = json.loads((OUT / "manifest.json").read_text())
    assert len(manifest["faces"]) == 6, "Expected two families, each with three faces."
    family_weights = {}
    coverage = None
    for face in manifest["faces"]:
        family_weights.setdefault(face["family"], set()).add(face["weight"])
        paths = [OUT / entry["path"] for entry in face["files"]]
        for entry, path in zip(face["files"], paths):
            data = path.read_bytes()
            assert len(data) == entry["bytes"], path.name
            assert hashlib.sha256(data).hexdigest() == entry["sha256"], path.name
        ttf, woff = [
            TTFont(path, recalcTimestamp=False, checkChecksums=2) for path in paths
        ]
        cmap = ttf.getBestCmap()
        expected = {ord(c) for c in face["characters"]}
        assert set(cmap) == expected
        assert expected.issuperset(range(32, 127)), "Printable ASCII must be complete."
        assert all(
            ord(c) in cmap
            for c in "Café Amigável Łódź Göteborg İstanbul €£¥ — … “Hello” ·"
        )
        assert len(ttf.getGlyphOrder()) == face["glyphCount"]
        assert ttf["head"].unitsPerEm == 1000
        assert abs(ttf["head"].fontRevision - float(manifest["version"])) < 0.001
        assert ttf["OS/2"].usWeightClass == face["weight"]
        assert ttf["post"].isFixedPitch == int(face["fixedPitch"])
        assert ttf["name"].getDebugName(16) == face["family"]
        assert ttf["name"].getDebugName(17) == face["style"]
        assert ttf["OS/2"].fsType == 0, "The custom fonts must permit embedding."
        assert not {"fvar", "gvar"}.intersection(
            ttf.keys()
        ), "These are static weight faces."
        assert cmap == woff.getBestCmap()
        assert ttf["hmtx"].metrics == woff["hmtx"].metrics
        for name in ttf.getGlyphOrder():
            glyph = ttf["glyf"][name]
            assert glyph.compile(ttf["glyf"]) == woff["glyf"][name].compile(
                woff["glyf"]
            )
            if glyph.numberOfContours:
                assert glyph.yMax <= ttf["hhea"].ascent, (face, name, "top clipping")
                assert glyph.yMin >= ttf["hhea"].descent, (
                    face,
                    name,
                    "bottom clipping",
                )
                assert glyph.xMin >= -1, (face, name, "negative left bound")
                assert glyph.xMax <= ttf["hmtx"][name][0] + 1, (
                    face,
                    name,
                    "advance overflow",
                )
            elif name not in {cmap[32], cmap[160]}:
                raise AssertionError(f"Unexpected blank glyph: {name}")
        advances = {v[0] for v in ttf["hmtx"].metrics.values()}
        if face["fixedPitch"]:
            assert advances == {
                620
            }, "Loose Mono must retain equal advances in every weight."
            assert "GPOS" not in ttf, "Pair kerning must not break the mono grid."
        else:
            assert len(advances) > 3
            assert ttf["hmtx"][cmap[ord("i")]][0] < ttf["hmtx"][cmap[ord("m")]][0]
            assert "GPOS" in ttf, "Hinge's kerning feature must be available."
        if coverage is None:
            coverage = expected
        assert (
            coverage == expected
        ), "Every weight/family must share character coverage."
        ttf.close()
        woff.close()
    assert all(weights == {300, 500, 700} for weights in family_weights.values())
    print(
        f"Verified 6 faces / 12 font files: {len(coverage)} characters each; metadata, checksums, bounds, spacing, kerning and TTF/WOFF2 outline parity passed."
    )


if __name__ == "__main__":
    verify()
