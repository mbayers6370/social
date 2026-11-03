import { memberRequest } from "@/server/member/http";
export const runtime = "nodejs";
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return memberRequest(request, "like", (await params).id);
}
