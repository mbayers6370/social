import { socialRequest } from "@/server/social/http";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return socialRequest(request, "spaceEventOpen", (await params).id);
}
