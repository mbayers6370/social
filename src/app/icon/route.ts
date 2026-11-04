import { brandSvgIcon } from "@/server/brand-icon";

export const runtime = "nodejs";

export function GET(request: Request) {
  const theme = new URL(request.url).searchParams.get("theme");
  return brandSvgIcon(theme === "light" || theme === "dark" ? theme : "system");
}
