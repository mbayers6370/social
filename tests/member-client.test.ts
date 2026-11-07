import { expect, it, vi } from "vitest";
import {
  MemberRequestError,
  requestMember,
  requestMemberIdentity,
} from "@/features/social/member-client";
import type { MemberIdentity } from "@/features/social/member-contracts";
import { memberPerson } from "@/lib/member-person";

const identity: MemberIdentity = {
  person: memberPerson("member-one", {
    displayName: "Margin Member",
    portraitPhotoId: "portrait-one",
  }),
  username: "margin_member",
  bio: "",
  portraitPhotoId: "portrait-one",
  usernameChangedAt: null,
  galleryVersion: 1,
  preferences: {
    readingSize: "standard",
    motion: "system",
    notifyComments: true,
    notifyLikes: false,
    notifyFriends: true,
    notifyMessages: true,
    messagingEnabled: true,
  },
};
const client = (response: () => Response) => ({
  request: vi.fn(async () => response()),
  href: (url: string) => url,
  photoSrc: (id: string) => id,
  preview: false,
});

it("accepts live identity responses including authenticated portrait URLs", async () => {
  await expect(
    requestMemberIdentity(
      client(() => Response.json(identity)),
      "/api/member/context",
    ),
  ).resolves.toEqual(identity);
});

it.each([
  ["GET", false],
  ["PATCH", true],
  ["PUT", true],
])(
  "rejects a malformed %s identity response with uncertain=%s",
  async (method, uncertain) => {
    const request = requestMemberIdentity(
      client(() => Response.json(null)),
      "/api/member/context",
      { method },
    );
    await expect(request).rejects.toBeInstanceOf(MemberRequestError);
    await expect(request).rejects.toMatchObject({ status: 502, uncertain });
  },
);

it.each([401, 403, 503])(
  "preserves HTTP %s errors for account recovery",
  async (status) => {
    await expect(
      requestMemberIdentity(
        client(() =>
          Response.json({ error: "Account unavailable" }, { status }),
        ),
        "/api/member/context",
      ),
    ).rejects.toMatchObject({ status, message: "Account unavailable" });
  },
);

it("continues to allow no-content responses for ordinary member mutations", async () => {
  await expect(
    requestMember(
      client(() => new Response(null, { status: 204 })),
      "/api/member/friends",
      { method: "DELETE" },
    ),
  ).resolves.toBeNull();
});
