/** Geometric rendition of the supplied logo's angled corners, for sharp small sizes. */
export const brandCornerPath = "M0 0H272L226 46H46V226L0 272Z";

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
      <path d={brandCornerPath} transform="translate(768 768) rotate(180)" />
    </svg>
  );
}
