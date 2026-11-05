# Margin Aside

Original typewriter lettering selected from the Common/Aside studies, with porous, visibly rubbed ink. Light 300, Medium 500, and Bold 700 are separate real outlines; the specimen does not simulate weight or apply a texture filter.

`master.cjs` draws the proportional worn-print master, with compact letter proportions, bracketed slabs and stroke contrast. Narrow letters, broad m/w, and compact punctuation use their own advances. It feeds `build.py`. The build expands strokes, composes supported Latin accents using the existing Margin font utilities, then adds stable, character-specific clusters of porous ink loss and edge nicks. No Hinge font binaries or third-party font outlines are used.

`public/fonts/margin-aside/` contains the three TTF faces, matching WOFF2 files, optional family CSS, specimen, and a file/coverage manifest. The application has not adopted this family. This is a development font release; the current supported character set is recorded in the manifest. Italics and wider script coverage are not supplied.

## Build

Use Node 22 and Python 3.11+ with the repository's existing pinned font tooling:

```sh
python3 -m venv /tmp/margin-aside-font-tools
/tmp/margin-aside-font-tools/bin/python -m pip install -r design/fonts/margin/requirements.txt
/tmp/margin-aside-font-tools/bin/python design/fonts/margin-aside/build.py
/tmp/margin-aside-font-tools/bin/python design/fonts/margin-aside/verify.py
```

`NODE` can point to a specific Node executable. Builds use a fixed OpenType timestamp and stable per-character wear. Each character keeps the same advance across all weights. Changing weight preserves line lengths. `proof.html` focuses on the Medium direction; `specimen.html` compares the three draft weights.

Release 0.11 adds O/zero differentiation, a protected central zero dot, correctly rotated curly quotes with tapered tails, separate straight quotes, distinct dashes, shorter I slabs, and the requested text kerning pairs. The build keeps stroke wear deterministic; tiny functional marks such as the zero dot stay solid for 16px reading.
