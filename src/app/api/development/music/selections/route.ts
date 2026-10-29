import { NextResponse, type NextRequest } from "next/server";
import {
  localMusicAccess,
  musicFailure,
  limitLocalMusicChanges,
} from "@/server/music/local-access";
import { changeMusic, readMusic } from "@/server/music/selections";
import { musicChangeSchema } from "@/features/profile/music-schema";

export async function GET(request: NextRequest) {
  const denied = localMusicAccess(request);
  if (denied) return denied;
  if (request.nextUrl.searchParams.size)
    return NextResponse.json(
      { error: "Request not allowed." },
      { status: 400 },
    );
  try {
    return NextResponse.json(
      { tracks: await readMusic() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return musicFailure(error);
  }
}
export async function POST(request: NextRequest) {
  const denied = localMusicAccess(request);
  if (denied) return denied;
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json")
    return NextResponse.json(
      { error: "Request not allowed." },
      { status: 415 },
    );
  try {
    limitLocalMusicChanges();
    // Bodies contain an action and numeric catalogue reference only, never owner/URLs.
    const reader = request.body?.getReader();
    if (!reader)
      return NextResponse.json(
        { error: "Choose a song from the search results." },
        { status: 400 },
      );
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > 512) {
          await reader.cancel();
          return NextResponse.json(
            { error: "Request is too large." },
            { status: 413 },
          );
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    const text = new TextDecoder().decode(bytes);
    let input: unknown;
    try {
      input = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: "Choose a song from the search results." },
        { status: 400 },
      );
    }
    const parsed = musicChangeSchema.safeParse(input);
    if (!parsed.success)
      return NextResponse.json(
        { error: "Choose a song from the search results." },
        { status: 400 },
      );
    return NextResponse.json(
      { tracks: await changeMusic(parsed.data) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return musicFailure(error);
  }
}
