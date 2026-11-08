# Margin Hinge and Margin Loose Mono

These are retained design studies. The current public demo and preserved application use [Margin Aside](../margin-aside/README.md) for headings and post text, with Inter for other UI text. The Hinge-derived browser monogram is an outline, not a runtime Hinge font dependency.

Original editable outline masters for the two selected Margin lettering concepts.
These are working font families, developed from the visual studies rather than extracted from an existing typeface.
No Caudex, Neurath, Amigável, system-font outlines, or third-party font binaries are used in the build.

Each family has three upright faces: **Light 300**, **Medium 500**, and **Bold 700**.
Hinge has proportional spacing, angled crossbars, diagonal shoulder cuts, and pair kerning. Apostrophes, quotation marks, commas, periods and ellipses use compact punctuation advances in the editable master and both exported formats.
Loose Mono uses a **620-unit advance for every character**, including spaces and punctuation; it has no pair kerning.
The three weights use the same metrics within each family, so switching weight preserves line lengths.

## Files

- `outlines.py`: original geometric construction of lowercase, uppercase, numbers and symbols.
- `build.py`: accents, repertoire, OpenType naming/metrics/features and TTF/WOFF2 output.
- `requirements.txt`: isolated Python build-tool versions; no application dependency changes.
- `verify.py`: file-integrity, coverage, geometry, metadata, metric and format-parity checks.
- `../../../public/fonts/margin/`: the six TTF files, six WOFF2 files, optional CSS, manifest and standalone specimen.

## Build and verify

From the repository root, using Python 3.11 or later:

```sh
python3 -m venv .local/font-tools
.local/font-tools/bin/python -m pip install -r design/fonts/margin/requirements.txt
.local/font-tools/bin/python design/fonts/margin/build.py
.local/font-tools/bin/python design/fonts/margin/verify.py
```

A fixed OpenType epoch and disabled timestamp recalculation make unchanged sources reproducible.
The generated manifest records the exact character repertoire, weight, byte size and SHA-256 of every face.
The build uses fontTools and Skia PathOps to expand the original master geometry into ordinary filled, quadratic TrueType outlines.
The resulting fonts have no dependency on those tools at runtime.

## Review

Serve the public directory locally, independently of application authentication:

```sh
python3 -m http.server 8766 --bind 127.0.0.1 --directory public
```

Open <http://localhost:8766/fonts/margin/specimen.html>.
The specimen loads all six real WOFF2 faces, offers editable text and size, and includes TTF/WOFF2 download links.
It sends no data to external services. It is a static font-package specimen, not an application route.

To use a face in a web project, load `public/fonts/margin/fonts.css`, then select `font-family: "Margin Hinge"` or `"Margin Loose Mono"` and weight `300`, `500` or `700`.
The application does **not** import this stylesheet; its Inter/Caudex typography is unchanged.
For later Next.js integration, use `next/font/local` with the desired WOFF2 sources and weights.

## Development release 0.1

This first family release has 303 encoded characters plus the missing-glyph box per face.
Coverage includes printable ASCII, supported Latin-1/Latin Extended-A precomposed accents, curly quotes, dashes, currencies and common punctuation; see `manifest.json` for the exact repertoire.
There are no italics, variable-font axes, script-specific shaping or manual small-size hinting in this release.
Unsupported characters use the host's fallback font. Non-Latin scripts and arbitrary combining-mark sequences are outside the current repertoire.
Proof text at the intended display size before applying a family to dense reading or interface copy.

These are custom Margin project assets. This package does not assign a public redistribution license.
The Noto Sans OFL in the existing public fonts folder applies to Noto Sans only.
