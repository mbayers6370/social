// Original proportional typewriter master: rounded slabs and dense, worn ink.
// Slab brackets and stroke contrast are drawn into the geometry, before ink wear.
const sw = Number(process.argv[2] || 76);
const hair = sw * 0.62;
const glyphs = {};
const stroke = (d, width = sw) => ({ d, width, fill: false });
const fill = (d) => ({ d, fill: true, shape: true });
const dot = (x, y, r = 34) =>
  fill(
    `M${x + r} ${y} C${x + r} ${y + r * 0.552} ${x + r * 0.552} ${y + r} ${x} ${y + r} C${x - r * 0.552} ${y + r} ${x - r} ${y + r * 0.552} ${x - r} ${y} C${x - r} ${y - r * 0.552} ${x - r * 0.552} ${y - r} ${x} ${y - r} C${x + r * 0.552} ${y - r} ${x + r} ${y - r * 0.552} ${x + r} ${y} Z`,
  );
const foot = (x, y = 0, half = 86) =>
  fill(
    `M${x - half} ${y - 15} H${x + half} V${y + 13} Q${x + sw * 0.42} ${y + 13} ${x + sw * 0.42} ${y + 57} H${x - sw * 0.42} Q${x - sw * 0.42} ${y + 13} ${x - half} ${y + 13} Z`,
  );
const top = (x, y = 470) =>
  fill(
    `M${x - 88} ${y + 17} H${x + sw * 0.5} V${y - 57} H${x - sw * 0.44} Q${x - sw * 0.44} ${y - 12} ${x - 88} ${y - 12} Z`,
  );
// Contrast comes from wide vertical strokes and quieter top/bottom strokes.
function bowl(l, r, b = 5, t = 468) {
  const mid = (l + r) / 2,
    cy = (b + t) / 2,
    rx = (r - l) / 2;
  const il = l + sw * 0.92,
    ir = r - sw * 0.92,
    ib = b + hair,
    it = t - hair;
  return fill(
    `M${l} ${cy} C${l} ${t - 75} ${l + 37} ${t} ${mid} ${t} C${r - 37} ${t} ${r} ${t - 75} ${r} ${cy} C${r} ${b + 75} ${r - 37} ${b} ${mid} ${b} C${l + 37} ${b} ${l} ${b + 75} ${l} ${cy} Z M${il} ${cy} C${il} ${ib + 55} ${il + 20} ${ib} ${mid} ${ib} C${ir - 20} ${ib} ${ir} ${ib + 55} ${ir} ${cy} C${ir} ${it - 55} ${ir - 20} ${it} ${mid} ${it} C${il + 20} ${it} ${il} ${it - 55} ${il} ${cy} Z`,
  );
}
// Elliptical O contrasts with the flatter-sided numeral bowl.
function roundBowl(cx, cy, rx, ry) {
  const k = 0.5522847498,
    ix = rx - sw * 0.92,
    iy = ry - hair;
  return fill(
    `M${cx + rx} ${cy} C${cx + rx} ${cy + k * ry} ${cx + k * rx} ${cy + ry} ${cx} ${cy + ry} C${cx - k * rx} ${cy + ry} ${cx - rx} ${cy + k * ry} ${cx - rx} ${cy} C${cx - rx} ${cy - k * ry} ${cx - k * rx} ${cy - ry} ${cx} ${cy - ry} C${cx + k * rx} ${cy - ry} ${cx + rx} ${cy - k * ry} ${cx + rx} ${cy} Z M${cx + ix} ${cy} C${cx + ix} ${cy - k * iy} ${cx + k * ix} ${cy - iy} ${cx} ${cy - iy} C${cx - k * ix} ${cy - iy} ${cx - ix} ${cy - k * iy} ${cx - ix} ${cy} C${cx - ix} ${cy + k * iy} ${cx - k * ix} ${cy + iy} ${cx} ${cy + iy} C${cx + k * ix} ${cy + iy} ${cx + ix} ${cy + k * iy} ${cx + ix} ${cy} Z`,
  );
}
function add(ch, parts) {
  let width = /[A-Z]/.test(ch) ? 650 : 570;
  if ("il".includes(ch)) width = 330;
  if (ch === "I") width = 310;
  if (ch === "T") width = 600;
  if (ch === "0") width = 590;
  if (ch === "j") width = 370;
  if ("ft".includes(ch)) width = 430;
  if (ch === "r") width = 450;
  if (ch === "m") width = 800;
  if (ch === "w") width = 750;
  if (ch === "M") width = 770;
  if (ch === "W") width = 800;
  if (" .,:;!".includes(ch)) width = ch === " " ? 285 : 210;
  if ("'’‘".includes(ch)) width = 180;
  if ('"“”'.includes(ch)) width = 350;
  if ("()".includes(ch)) width = 300;
  if (ch === "-") width = 300;
  if (ch === "–") width = 570;
  if (ch === "—") width = 770;
  if (ch === "…") width = 630;
  if (ch === "\u00a0") width = 285;
  const stretch = "wMW".includes(ch) ? 1.22 : 1;
  const bearingShift =
    {
      r: -8,
      f: -6,
      t: -4,
      ".": -20,
      ",": -16,
      "’": -8,
      "”": -4,
      "‘": 8,
      "“": 4,
    }[ch] || 0;
  glyphs[ch] = { width, stretch, bearingShift, parts };
}
for (const ch of "abcdefghijklmnopqrstuvwxyz") {
  let p = [];
  const s = (d, w) => p.push(stroke(d, w));
  const l = 133,
    r = 487,
    m = 310;
  if ("obdpq".includes(ch)) {
    p.push(bowl(105, 515));
    if ("bd".includes(ch)) {
      const x = ch === "b" ? l : r;
      s(`M${x} 24 V654`);
      p.push(foot(x), top(x, 673));
    }
    if ("pq".includes(ch)) {
      const x = ch === "p" ? l : r;
      s(`M${x} -175 V449`);
      p.push(foot(x, -199), top(x));
    }
  } else if (ch === "a") {
    // A compact double-storey typewriter a, with a stout right stem and flat foot.
    s("M145 379 C145 504 484 526 484 349 V24");
    p.push(bowl(105, 495, 4, 273), foot(484, 0, 73));
    s("M446 251 H322", hair);
    p.push(dot(148, 380, sw * 0.43));
  } else if ("nhm".includes(ch)) {
    s(`M${l} 24 V${ch === "h" ? 654 : 449}`);
    p.push(foot(l), top(l, ch === "h" ? 673 : 470));
    if (ch === "m") {
      // Broad, unequal arches give m a proportional, printed rhythm.
      s(
        "M133 294 C133 414 207 466 277 466 Q390 466 390 309 V24 M390 303 C390 421 452 460 524 460 Q650 460 650 309 V24",
        sw * 0.9,
      );
      p.push(foot(390, 0, 78), foot(650, 0, 86));
    } else {
      s("M133 291 C133 416 220 467 316 467 Q487 467 487 304 V24");
      p.push(foot(487));
    }
  } else if (ch === "r") {
    s("M202 24 V449 M202 280 C202 410 317 516 460 428");
    p.push(foot(202, 0, 132), top(202), dot(457, 425, sw * 0.48));
  } else if (ch === "g") {
    p.push(bowl(105, 515, 18, 468));
    s("M482 450 V-23 C482 -207 267 -232 145 -139", sw * 0.91);
    p.push(dot(145, -139, sw * 0.42));
  } else if (ch === "c") {
    s("M487 372 C422 535 129 516 129 235 C129 -38 426 -40 498 91");
    p.push(dot(485, 378, sw * 0.46));
  } else if (ch === "e") {
    s(
      "M138 239 H493 C493 411 423 468 316 468 C195 468 129 382 129 232 C129 66 187 4 318 4 Q444 4 494 96",
    );
    // The level bar and broad horizontal terminal distinguish this from Hinge.
  } else if (ch === "s") {
    s(
      "M476 380 C428 508 137 512 137 361 C137 226 487 266 487 115 C487 -45 190 -37 133 92",
      sw * 0.87,
    );
    s("M476 369 V457 M133 7 V109", hair);
  } else if (ch === "u") {
    s("M133 450 V168 Q133 5 299 5 Q487 5 487 189 V450 M487 182 V24");
    p.push(top(133), top(487), foot(487));
  } else if ("vy".includes(ch)) {
    s("M119 450 L310 21 L501 450");
    p.push(top(119), top(501));
    if (ch === "y") {
      s("M310 21 Q267 -191 147 -188", sw * 0.8);
      p.push(dot(147, -187, sw * 0.4));
    }
  } else if (ch === "w") {
    s("M104 450 L195 20 L310 331 L426 20 L516 450", sw * 0.85);
    p.push(top(104), top(516));
  } else if (ch === "x") {
    s("M137 450 L482 24 M482 450 L137 24");
    p.push(foot(137), foot(482), top(137), top(482));
  } else if (ch === "z") {
    s("M136 451 H487 L136 19 H487", sw * 0.81);
    s("M136 382 V466 M487 4 V89", hair);
  } else if (ch === "k") {
    s("M145 24 V654 M488 450 L151 166 M328 315 L489 24");
    p.push(foot(145), foot(489), top(145, 673), top(488));
  } else if (ch === "i") {
    s("M319 24 V449");
    p.push(top(319), foot(310, 0, 140), dot(319, 619, sw * 0.45));
  } else if (ch === "l") {
    s("M309 24 V654");
    p.push(top(309, 673), foot(309, 0, 141));
  } else if (ch === "j") {
    s("M401 450 V-59 Q401 -207 191 -188");
    p.push(top(401), dot(401, 619, sw * 0.45), dot(190, -187, sw * 0.42));
  } else if (ch === "t") {
    s("M282 615 V131 Q282 -1 431 22 Q479 31 498 78", sw * 0.9);
    s("M117 451 H466", hair);
  } else if (ch === "f") {
    s("M271 24 V534 Q271 726 455 664");
    s("M122 451 H475", hair);
    p.push(foot(271, 0, 128), dot(453, 663, sw * 0.44));
  }
  add(ch, p);
}
for (const ch of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
  const l = 133,
    r = 487,
    m = 310,
    p = [];
  const s = (d, w) => p.push(stroke(d, w));
  const paths = {
    A: "M116 24 L310 670 L504 24 M188 251 H431",
    B: "M140 24 V652 H317 Q493 652 493 499 Q493 348 314 348 H140 M314 348 Q510 348 510 177 Q510 18 315 18 H140",
    C: "M488 559 C410 745 126 710 126 334 C126 -33 411 -47 499 113",
    D: "M140 24 V652 H290 C503 652 503 530 503 335 C503 136 503 18 290 18 H140 Z",
    E: "M493 652 H145 V18 H493 M145 341 H450",
    F: "M145 24 V652 H493 M145 341 H450",
    G: "M488 563 C413 751 126 706 126 334 C126 -30 494 -39 494 163 V304 H338",
    H: "M137 24 V652 M483 24 V652 M137 336 H483",
    I: "M310 24 V652",
    J: "M452 652 V181 Q452 18 290 18 Q132 18 132 151",
    K: "M141 24 V652 M493 652 L146 267 M322 434 L497 24",
    L: "M145 652 V18 H499",
    M: "M105 24 V652 L310 242 L515 652 V24",
    N: "M137 24 V652 L483 24 V652",
    O: "",
    P: "M145 24 V652 H310 Q502 652 502 465 Q502 286 310 286 H145",
    Q: "M333 126 Q433 -44 537 -55",
    R: "M145 24 V652 H310 Q502 652 502 465 Q502 286 310 286 H145 M315 286 L506 24",
    S: "M488 564 C422 742 130 705 130 515 C130 332 496 375 496 171 C496 -34 192 -36 127 117",
    T: "M110 652 H510 M310 652 V24",
    U: "M135 652 V204 Q135 18 310 18 Q485 18 485 204 V652",
    V: "M118 652 L310 24 L502 652",
    W: "M95 652 L200 24 L310 446 L420 24 L525 652",
    X: "M127 652 L493 24 M493 652 L127 24",
    Y: "M114 652 L310 320 L506 652 M310 320 V24",
    Z: "M127 652 H493 L127 18 H493",
  };
  if (ch === "O") p.push(roundBowl(310, 336, 270, 335));
  if (ch === "Q") p.push(bowl(101, 519, 1, 671));
  if (paths[ch]) s(paths[ch], "MW".includes(ch) ? sw * 0.86 : sw);
  if ("AHKMNX".includes(ch)) {
    for (const x of [ch === "M" ? 105 : l, ch === "M" ? 515 : r]) {
      p.push(foot(x));
      if (ch !== "A") p.push(top(x, 673));
    }
  }
  if ("BEFPRL".includes(ch)) p.push(foot(145), top(145, 673));
  if (ch === "R") p.push(foot(506));
  if (ch === "I")
    p.push(
      foot(310, 0, 119.3),
      top(310, 673),
      stroke("M190.7 673 H429.3", hair),
    );
  if (ch === "J") p.push(top(452, 673), dot(132, 151, sw * 0.4));
  if (ch === "T") {
    p.push(foot(310, 0, 131));
    s("M110 596 V675 M510 596 V675", hair);
  }
  if ("UVWXY".includes(ch)) p.push(top(119, 673), top(501, 673));
  if (ch === "Y") p.push(foot(310));
  if ("CGS".includes(ch)) s("M488 553 V668", hair);
  if (ch === "S") s("M127 13 V131", hair);
  if ("ELZ".includes(ch)) s("M493 2 V93", hair);
  if ("EFZ".includes(ch)) s("M493 579 V674", hair);
  if ("EF".includes(ch)) s("M450 290 V391", hair);
  add(ch, p);
}
const digits = {
  0: "M133 334 C133 599 169 669 310 669 C451 669 487 599 487 334 C487 69 451 1 310 1 C169 1 133 69 133 334 Z",
  1: "M154 537 L319 668 V24 M149 1 H493",
  2: "M129 516 C129 737 489 736 489 520 C489 355 133 261 133 20 H493 V95",
  3: "M135 571 C262 747 491 697 491 518 Q491 342 309 342 M309 342 Q505 342 505 169 C505 -41 165 -35 124 116",
  4: "M438 24 V667 L113 207 H518",
  5: "M488 652 H145 V374 C252 448 490 405 490 191 C490 -34 170 -37 124 109",
  6: "M480 587 C301 759 132 633 132 293 V193 C132 -57 490 -53 490 189 C490 403 239 423 132 265",
  7: "M127 582 V652 H496 L254 24",
  8: "M310 346 C91 346 103 667 310 667 C517 667 529 346 310 346 C64 346 80 1 310 1 C540 1 556 346 310 346 Z",
  9: "M137 83 C315 -76 490 32 490 364 V484 C490 734 132 733 132 488 C132 272 387 255 490 412",
};
for (const ch of "0123456789") {
  if (ch === "0") {
    const centreDot = {
      ...dot(310, 336, Math.max(32, sw * 0.29)),
      protected: true,
    };
    add(ch, [bowl(72.5, 547.5, 1, 671), centreDot]);
  } else add(ch, [stroke(digits[ch], sw * 0.91)]);
}
const dotParts = (x = 310, y = 28) => [dot(x, y, sw * 0.44)];
add(" ", []);
add("\u00a0", []);
add(".", dotParts());
add(",", [...dotParts(309, 34), stroke("M329 20 Q319 -59 261 -88", hair)]);
add(":", [...dotParts(310, 32), ...dotParts(310, 370)]);
add(";", [
  ...dotParts(310, 32),
  ...dotParts(310, 370),
  stroke("M330 16 Q320 -63 262 -91", hair),
]);
add("!", [stroke("M310 664 V237", sw * 0.91), ...dotParts()]);
add("?", [
  stroke(
    "M130 528 C130 741 486 731 486 533 C486 416 311 403 311 287 V234",
    sw * 0.88,
  ),
  ...dotParts(),
]);
add("-", [stroke("M200 258 H420", hair)]);
add("–", [stroke("M50 258 H570", hair)]);
add("—", [stroke("M-45 258 H665", hair)]);
add("…", [
  dot(150, 28, sw * 0.36),
  dot(310, 28, sw * 0.36),
  dot(470, 28, sw * 0.36),
]);
// Comma-shaped closing marks; opening marks are exact 180-degree reversals.
const quoteHead = (cx) => {
  const r = Math.max(30, sw * 0.35),
    c = r * 0.3,
    y = 650;
  return fill(
    `M${cx - r + c} ${y - r} H${cx + r - c} Q${cx + r} ${y - r} ${cx + r} ${y - r + c} V${y + r - c} Q${cx + r} ${y + r} ${cx + r - c} ${y + r} H${cx - r + c} Q${cx - r} ${y + r} ${cx - r} ${y + r - c} V${y - r + c} Q${cx - r} ${y - r} ${cx - r + c} ${y - r} Z`,
  );
};
const commaQuote = (cx) => [
  quoteHead(cx),
  fill(
    `M${cx + 26} 637 Q${cx + 38} 590 ${cx - 38} 548 Q${cx + 6} 605 ${cx - 25} 631 Z`,
  ),
];
const rotateQuote = (parts, cx) =>
  parts.map((part) => ({ ...part, matrix: [-1, 0, 0, -1, cx * 2, 1232] }));
const singleClosing = commaQuote(310);
const doubleClosing = [...commaQuote(240), ...commaQuote(420)];
add("’", singleClosing);
add("‘", rotateQuote(singleClosing, 310));
add("”", doubleClosing);
add("“", rotateQuote(doubleClosing, 330));
add("'", [stroke("M310 678 V559", hair)]);
add('"', [stroke("M225 678 V559 M395 678 V559", hair)]);
add("(", [stroke("M412 688 Q145 336 412 -115", hair * 1.12)]);
add(")", [stroke("M208 688 Q475 336 208 -115", hair * 1.12)]);
add("/", [stroke("M138 -81 L482 700", hair)]);
add("&", [
  stroke(
    "M515 88 L220 452 C85 628 324 763 423 608 C526 449 121 342 121 174 C121 -50 438 -41 527 205 L567 328 M457 328 H594",
    sw * 0.83,
  ),
]);
add("@", [
  stroke(
    "M414 182 V434 C346 540 198 448 198 309 C198 159 414 135 414 325 M414 434 V198 Q566 89 579 320 C603 710 56 704 56 320 C56 -25 439 -96 575 83",
    hair,
  ),
]);
add("#", [
  stroke(
    "M236 -16 L300 669 M401 -16 L465 669 M99 231 H528 M119 438 H548",
    hair,
  ),
]);
process.stdout.write(
  JSON.stringify({
    id: "aside",
    name: "Margin Aside",
    stroke: sw,
    space: 285,
    glyphs,
  }),
);
