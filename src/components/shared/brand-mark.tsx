/** Geometric rendition of the supplied logo's angled corners, for sharp small sizes. */
export const brandCornerPath = "M0 0H272L226 46H46V226L0 272Z";
// Lowercase m from the project's Margin Hinge Medium outlines.
export const brandMonogramPath =
  "M131 0H53V520H56L133 491V510Q136 511 138 513Q167 533 203 543Q230 551 251 551Q346 551 397 503Q409 492 418 478Q436 499 461 514Q490 533 525 543Q552 551 569 551Q664 551 715 503Q767 454 767 362V0H689V362Q689 420 661 446Q633 473 569 473Q568 473 563 472Q555 471 547 468Q523 461 503 449Q449 414 449 349V0H371V363Q371 421 344 446Q315 473 251 473Q241 473 224 468Q201 461 182 449Q131 414 131 345Z";
export const brandMonogramTransform = "translate(157.5 603) scale(.65 -.65)";

export function BrandMark({
  className,
  width = 36,
  height = 36,
  color = "currentColor",
}: {
  className?: string;
  width?: number;
  height?: number;
  color?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 848 848"
      width={width}
      height={height}
      className={className}
      fill={color}
      aria-hidden="true"
      focusable="false"
    >
      <path d={brandCornerPath} transform="translate(80 80)" />
      <path d={brandMonogramPath} transform={brandMonogramTransform} />
      <path d={brandCornerPath} transform="translate(768 768) rotate(180)" />
    </svg>
  );
}
