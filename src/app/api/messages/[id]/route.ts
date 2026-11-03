import { memberRequest } from "@/server/member/http";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return memberRequest(request, "conversation", (await params).id);
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return memberRequest(request, "messageSend", (await params).id);
}
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return memberRequest(request, "conversationHide", (await params).id);
}
