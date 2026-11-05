// Original Margin ink rules. Regenerate the nine mask assets with this file.
import fs from "node:fs";
import { fileURLToPath } from "node:url";
const out = fileURLToPath(
  new URL("../../src/components/ui/ink-rule/", import.meta.url),
);
fs.mkdirSync(out, { recursive: true });
const styles = [
  { id: "dry", name: "Dry ink", half: 0.68, rough: 0.26, pores: 12 },
  { id: "ribbon", name: "Ribbon", half: 1.45, rough: 0.4, pores: 27 },
  { id: "smudge", name: "Smudge", half: 2.5, rough: 0.7, pores: 45 },
];
const svg = (w, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} 16" width="${w}" height="16">${body}</svg>`;
for (const s of styles) {
  let seed = 4821;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const edge = (x) =>
    s.rough *
    (Math.sin((x * Math.PI) / 80) +
      0.45 * Math.sin((x * Math.PI) / 8) +
      0.15 * Math.sin((x * Math.PI) / 2));
  let d = "M0 " + (8 - s.half);
  for (let x = 1; x <= 160; x++) d += ` L${x} ${8 - s.half + edge(x)}`;
  d += " L160 " + (8 + s.half);
  for (let x = 159; x >= 0; x--)
    d += ` L${x} ${8 + s.half + edge(x + 160) * 0.65}`;
  d += " Z";
  for (let i = 0; i < s.pores; i++) {
    const x = 5 + rand() * 150,
      y = 8 + (rand() - 0.5) * s.half * 1.4,
      r = 0.2 + rand() * 0.4;
    d += ` M${x + r} ${y} a${r} ${r} 0 1 0 ${-2 * r} 0 a${r} ${r} 0 1 0 ${2 * r} 0 Z`;
  }
  const ghost =
    s.id === "smudge"
      ? `<path d="M0 11.6 Q35 12.5 75 11.7 T160 11.6" fill="none" stroke="black" stroke-width=".65" opacity=".12"/>`
      : "";
  fs.writeFileSync(
    `${out}/${s.id}-middle.svg`,
    svg(160, `${ghost}<path fill="black" fill-rule="evenodd" d="${d}"/>`),
  );
  const edgePath = (right = false) => {
    const points = [];
    for (let x = 0; x <= 24; x++)
      points.push(`${x} ${8 - s.half + edge(x - 24) * (x / 24)}`);
    for (let x = 24; x >= 0; x--)
      points.push(`${x} ${8 + s.half + edge(x - 24) * 0.65 * (x / 24)}`);
    const speck = right
      ? `<circle cx="10" cy="${8 - s.half - 2.1}" r=".4" opacity=".32"/>`
      : `<circle cx="7" cy="${8 + s.half + 2.2}" r=".45" opacity=".38"/>`;
    return `<path d="M${points.join(" L")} Z" fill="black"/><g fill="black">${speck}</g>`;
  };
  fs.writeFileSync(`${out}/${s.id}-left.svg`, svg(24, edgePath()));
  fs.writeFileSync(
    `${out}/${s.id}-right.svg`,
    svg(24, `<g transform="translate(24 0) scale(-1 1)">${edgePath(true)}</g>`),
  );
}

// Responsive masks share the original fixed-size caps and repeating grain.
// No viewBox: the pattern stays in CSS pixels rather than stretching with width.
for (const { id } of styles) {
  const part = (name) =>
    fs
      .readFileSync(`${out}/${id}-${name}.svg`, "utf8")
      .replace(/^<svg[^>]*>/, "")
      .replace(/<\/svg>$/, "");
  const responsive = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="16"><defs><pattern id="grain" x="24" width="160" height="16" patternUnits="userSpaceOnUse">${part("middle")}</pattern><mask id="middle" maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="16"><rect x="24" width="100%" height="16" fill="white"/><g transform="translate(-24 0)"><svg x="100%" width="24" height="16"><rect width="24" height="16" fill="black"/></svg></g></mask></defs><rect width="100%" height="16" fill="url(#grain)" mask="url(#middle)"/><svg width="24" height="16">${part("left")}</svg><g transform="translate(-24 0)"><svg x="100%" width="24" height="16">${part("right")}</svg></g></svg>`;
  fs.writeFileSync(`${out}/${id}-rule.svg`, responsive);
}
