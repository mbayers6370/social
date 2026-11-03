import { socialRequest } from "@/server/social/http";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return socialRequest(request, "spaceInvite", (await params).id);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return socialRequest(request, "spaceInviteCandidates", (await params).id);
}
