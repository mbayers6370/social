import { socialRequest } from "@/server/social/http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return socialRequest(request, "spaceFeed");
}
