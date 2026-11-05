# Margin ink rules

Three reusable dividers: `dry` (default), `ribbon`, and `smudge`. Each keeps clean straight ends, its original worn texture, and two tiny stray flecks. Width changes the length without stretching the grain. Color follows the parent text color.

```tsx
import { InkRule } from "@/components/ui/ink-rule";

<InkRule />
<InkRule variant="ribbon" width="60%" />
<InkRule variant="smudge" width={240} style={{ color: "#454D24" }} />
<InkRule decorative className="my-6" />
```

Use the semantic separator for a section break. Use `decorative` when the line is only visual. `className`, `style`, and normal div attributes are supported. The component works on the server and client without a JavaScript runtime of its own.

Artwork lives beside the component in `src/components/ui/ink-rule/`. The shared stylesheet is loaded once by the application's CSS manifest. Relative SVG URLs are bundled into hashed static assets, so the masks do not require changes to authentication rules.

Site dividers use the shared `--divider-mask` token in `src/styles/tokens.css`,
set to Dry Ink. Each original rule keeps its own color and its 1px layout space;
the artwork paints over that space without changing content spacing or width.
`src/styles/rules.css` handles the top/bottom dividers, while existing feed and
navigation pseudo-elements use the same token. Card/control outlines and check
marks retain their own geometry.

Regenerate the nine component pieces and three responsive masks from the original editable geometry:

```sh
node design/ink-rules/build.mjs
```

All three variants are shown in the development component workbench at `/design-system`. Existing page dividers can adopt the component individually.
