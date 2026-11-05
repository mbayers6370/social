import { memberRequest } from "@/server/member/http";
export const runtime = "nodejs";
export const GET = (request: Request) =>
  memberRequest(request, "moderationReports");
