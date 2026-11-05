import { afterEach, expect, it, vi } from "vitest";
import { createHmac, randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
afterEach(() => vi.unstubAllEnvs());
it("accepts an actual Svix signature with the installed Clerk verifier and rejects tampering", async () => {
  const secret = randomBytes(32);
  vi.stubEnv(
    "CLERK_WEBHOOK_SIGNING_SECRET",
    `whsec_${secret.toString("base64")}`,
  );
  const id = "msg_fixture";
  const timestamp = String(Math.floor(Date.now() / 1000));
  const payload = JSON.stringify({
    type: "user.deleted",
    data: { id: "user_fixture", deleted: true },
    object: "event",
  });
  const signature = createHmac("sha256", secret)
    .update(`${id}.${timestamp}.${payload}`)
    .digest("base64");
  const request = (body: string) =>
    new NextRequest("https://margin.example/api/webhooks/clerk", {
      method: "POST",
      body,
      headers: {
        "svix-id": id,
        "svix-timestamp": timestamp,
        "svix-signature": `v1,${signature}`,
      },
    });
  expect((await verifyWebhook(request(payload))).type).toBe("user.deleted");
  await expect(
    verifyWebhook(request(payload.replace("user_fixture", "victim"))),
  ).rejects.toThrow();
});
