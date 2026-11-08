import {
  brandCornerPath,
  brandMonogramPath,
  brandMonogramTransform,
} from "@/components/shared/brand-mark";

export const dynamic = "force-static";
/** Pre-render the existing Margin mark; the portfolio has no runtime icon handler. */
export function GET() {
  return new Response(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 848 848" width="32" height="32" fill="#454D24"><style>@media(prefers-color-scheme:dark){svg{fill:#B9C65A}}</style><path d="${brandCornerPath}" transform="translate(80 80)"/><path d="${brandMonogramPath}" transform="${brandMonogramTransform}"/><path d="${brandCornerPath}" transform="translate(768 768) rotate(180)"/></svg>`,
    { headers: { "Content-Type": "image/svg+xml; charset=utf-8" } },
  );
}
