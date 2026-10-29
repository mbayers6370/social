import { brandIcon } from "@/server/brand-icon";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";
export const dynamic = "force-static";
export default function Icon() {
  return brandIcon(size);
}
