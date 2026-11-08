# Margin custom fonts — development release 0.1

**Margin Hinge** and **Margin Loose Mono**, each in Light (300), Medium (500), and Bold (700).
TTF files can be installed on desktop systems. WOFF2 files are the matching web faces.
`fonts.css` is an optional, self-hosted `@font-face` stylesheet, scoped by the explicit family names.
These families are retained design studies. The current demo and full-stack interface load Margin Aside through `next/font/local`; body copy and forms use Inter. The browser monogram retains an outlined Hinge-derived m without loading the Hinge font files.

The editable masters and rebuild instructions are in `design/fonts/margin/` at the repository root.
`manifest.json` lists character coverage, weights and file checksums. The standalone `specimen.html` compares all six faces with real text and download links.

Use `python3 -m http.server 8766 --bind 127.0.0.1 --directory public` from the repository root to view <http://localhost:8766/fonts/margin/specimen.html> without application authentication.

These are initial upright font families with Latin character coverage; they do not contain italics, variable axes or manual hinting.
No third-party font outlines are used, and no public redistribution license is assigned.
The parent directory's Noto Sans OFL does not apply to these fonts.
