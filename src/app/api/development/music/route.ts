import { NextResponse, type NextRequest } from "next/server";
import { musicSearchSchema } from "@/features/profile/music-schema";
import { catalogue } from "@/server/music/catalogue";
import { localMusicAccess, musicFailure } from "@/server/music/local-access";

export async function GET(request: NextRequest) {
  const denied = localMusicAccess(request);
  if (denied) return denied;
  const params = request.nextUrl.searchParams;
  const query = musicSearchSchema.safeParse(params.get("q")?.normalize("NFKC"));
  if (
    !query.success ||
    [...params.keys()].some((key) => key !== "q") ||
    params.getAll("q").length !== 1
  )
    return NextResponse.json(
      { error: "Enter a song or artist in 2–80 characters." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  try {
    return NextResponse.json(
      { tracks: await catalogue.search(query.data) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return musicFailure(error);
  }
}
