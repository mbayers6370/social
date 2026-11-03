import { memberRequest } from "@/server/member/http";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return memberRequest(request, "conversationExport", (await params).id);
}
