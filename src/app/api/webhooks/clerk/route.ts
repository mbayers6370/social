import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { NextRequest } from "next/server";
import { getDb } from "@/server/db";
import { AccountErasureService } from "@/server/account/erasure";
import { privatePhotoStore } from "@/server/social/photo";
import { boundedBody, privateHeaders } from "@/server/social/http";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  if (!process.env.CLERK_WEBHOOK_SIGNING_SECRET)
    return new Response(null, { status: 503, headers: privateHeaders });
  let event;
  try {
    // Bound the signed body before the official verifier consumes it.
    const bytes = await boundedBody(request, 65_536);
    event = await verifyWebhook(
      new NextRequest(request.url, {
        method: "POST",
        headers: request.headers,
        body: new Uint8Array(bytes),
      }),
    );
  } catch {
    return new Response(null, { status: 400, headers: privateHeaders });
  }
  try {
    if (event.type === "user.deleted") {
      if (!event.data.id)
        return new Response(null, { status: 400, headers: privateHeaders });
      await new AccountErasureService(getDb(), privatePhotoStore).request(
        event.data.id,
        true,
      );
    }
    return new Response(null, { status: 204, headers: privateHeaders });
  } catch {
    // Non-2xx makes Clerk retry; never acknowledge an uncommitted deletion intent.
    return new Response(null, { status: 503, headers: privateHeaders });
  }
}
