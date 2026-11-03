import { NextResponse, type NextRequest } from "next/server";
import { localMusicAccess } from "@/server/music/local-access";
import { ticketmasterCatalog } from "@/server/spaces/ticketmaster";
import { eventSearchInput } from "@/features/spaces/event-discovery";
import { resourceId } from "@/features/spaces/schema";
import { SocialError } from "@/server/social/errors";

/** Public provider metadata only. No account or Space writes in development. */
export async function GET(request: NextRequest) {
  const denied = localMusicAccess(request);
  if (denied) return denied;
  const params = request.nextUrl.searchParams;
  try {
    if (
      [...params.keys()].some(
        (key) =>
          !["q", "page", "id"].includes(key) || params.getAll(key).length !== 1,
      )
    )
      throw new SocialError(400, "Invalid event search.");
    if (params.has("id"))
      return NextResponse.json(
        {
          event: await ticketmasterCatalog.event(
            resourceId.parse(params.get("id")),
          ),
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    const page = Number(params.get("page") ?? 0);
    if (!Number.isInteger(page) || page < 0 || page >= 50)
      throw new SocialError(400, "Invalid event page.");
    const result = await ticketmasterCatalog.search(
      eventSearchInput.parse(params.get("q") ?? ""),
      page,
    );
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof SocialError
            ? error.message
            : "Event search is temporarily unavailable.",
      },
      {
        status: error instanceof SocialError ? error.status : 400,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
