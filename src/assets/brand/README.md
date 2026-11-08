# margin identity

Use lowercase **margin** in visible copy and metadata. The live wordmark uses the shared Margin Aside heading token. React component/type names retain normal PascalCase conventions.

The original `full-mark.png` and `mark.png` reference files stay local and are excluded from Git because they contain author/account metadata. The application does not import them.

The current logo experiment frames the live lowercase Margin Aside word **margin** with the supplied identity's angled corners, without dots or a separate symbol. Headers and the public footer share this same `BrandLink`. `BrandBrackets` renders crisp SVG corners and also supplies the quiet feed/welcome ending signature. `BrandLink` provides a single accessible name describing its home/feed destination; its corners are decorative.

The original PNGs remain unmodified. `BrandMark` renders a lowercase Margin Hinge m between the two framing marks for browser/home-screen icons. The monogram is embedded as vector outlines, so no external font is needed. Do not stretch or apply lossy transformations to the original artwork.

The current shared palette is Olive `#777536`, Pinkish Cinnamon `#C99B61`, Deep Slate Olive `#282820` and Warm Paper `#EEEDE7`, with Parchment for light labels. The source of truth is `src/styles/tokens.css`; the stylesheet guide documents semantic colors and contrast variants. Header/mobile navigation use the dark navigation surface. The original monogram artwork retains its own colors; do not use those as a substitute for interface tokens.

The public demo pre-renders its transparent `/icon.svg` from `brand-mark` during export, with no runtime icon endpoint or external font request. The following icon routes belong to the preserved full-stack target.

Its browser favicon is a transparent SVG: `/icon?theme=light` uses Blackened Olive and `/icon?theme=dark` uses Citron. Root metadata emits both icon links with matching `prefers-color-scheme` media attributes; `/icon` provides an adaptive fallback. Responses declare SVG content type, nosniff, and revalidation headers. The 180px Apple home-screen PNG is generated statically from the same vector mark in Olive on Parchment through Next’s metadata convention. No account data, remote image fetch, manifest/PWA or service worker is involved. Only the exact `/icon` and `/apple-icon` asset paths are public.

Placement/accessibility references: [NN/g logo placement](https://www.nngroup.com/articles/homepage-design-principles/), [W3C functional images](https://www.w3.org/WAI/tutorials/images/functional/).
