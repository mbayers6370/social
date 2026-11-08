import type { PortraitCrop } from "@/lib/portrait-crop";
import "server-only";
import { SpaceService } from "@/server/spaces/service";
import { SocialError } from "@/server/social/errors";
import { memberPostDraftInput } from "@/features/social/member-schema";
import type {
  MemberIdentity,
  MemberConversation,
} from "@/features/social/member-contracts";
import { containsPostLink } from "@/lib/platform-rules";
import { recordPublication } from "@/server/social/posting-allowance";
import { MemberProfileService } from "./profile";
import { MemberGalleryService } from "./gallery";
import { MemberMessageService } from "./messages";
import { MemberActivityService } from "./activity";
import { MemberAccountDataService } from "./account-data";
import { unavailable } from "./selectors";

/** Public member facade; focused modules reuse the canonical social authorization,
 * serializable transactions, locks and media lifecycle. */
export class MemberService extends SpaceService {
  private readonly profiles = new MemberProfileService(
    this.db,
    this.store,
    this.clock,
  );
  private readonly gallery = new MemberGalleryService(
    this.db,
    this.store,
    this.clock,
  );
  private readonly messages = new MemberMessageService(
    this.db,
    this.store,
    this.clock,
  );
  private readonly activity = new MemberActivityService(
    this.db,
    this.store,
    this.clock,
  );
  private readonly accountData = new MemberAccountDataService(
    this.db,
    this.store,
    this.clock,
  );

  async postingAllowance(subject: string) {
    return this.transaction(async (tx) => {
      const actor = await this.actor(tx, subject);
      return this.dailyPostAllowance(tx, actor, this.clock());
    });
  }

  async editPersonalPost(subject: string, id: string, body: string) {
    return this.transaction(async (tx) => {
      const actor = await this.actor(tx, subject);
      await this.lock(tx, [actor]);
      const post = await tx.post.findFirst({
        where: {
          id,
          ownerId: actor,
          deletedAt: null,
          expiresAt: { gt: this.clock() },
        },
        select: {
          id: true,
          ownerId: true,
          spaceId: true,
          createdAt: true,
          _count: { select: { photos: true } },
        },
      });
      if (!post) throw unavailable();
      if (!body.trim() && !post._count.photos)
        throw new SocialError(400, "Write a thought before saving.");
      const hasLink = containsPostLink({ body });
      if (post.spaceId) {
        if (body.trim().length > 2000)
          throw new SocialError(
            400,
            "Space posts can contain up to 2,000 characters.",
          );
        await this.postAudience(tx, actor, post, true);
      } else await this.quota(tx, actor, hasLink, post.createdAt, id);
      const updated = await tx.post.update({
        where: { id },
        data: { body: body.trim(), hasLink },
      });
      await recordPublication(tx, updated);
      return { saved: true };
    });
  }

  async publishPersonal(
    subject: string,
    raw: unknown,
    files: { bytes: Uint8Array; type: string; description: string }[] = [],
  ) {
    const input = memberPostDraftInput.parse(raw);
    if (!input.body && !input.photoIds.length && !files.length)
      throw new SocialError(400, "Write a post or choose a photograph.");
    if (files.length)
      return this.publishWithUploads(subject, undefined, input, files);
    return this.transaction((tx) =>
      this.publishInTransaction(tx, subject, undefined, input),
    );
  }

  async personalPhotos(subject: string, before?: string) {
    return this.gallery.personalPhotos(subject, before);
  }

  async identity(subject: string): Promise<MemberIdentity> {
    return this.profiles.identity(subject);
  }

  async updateProfile(subject: string, raw: unknown) {
    return this.profiles.updateProfile(subject, raw);
  }

  async updatePreferences(subject: string, raw: unknown) {
    return this.profiles.updatePreferences(subject, raw);
  }

  async updateUsername(subject: string, raw: unknown) {
    return this.profiles.updateUsername(subject, raw);
  }

  async setPortrait(
    subject: string,
    photoId: string | null,
    crop?: PortraitCrop,
  ) {
    return this.profiles.setPortrait(subject, photoId, crop);
  }

  async portrait(subject: string, ownerId: string) {
    return this.profiles.portrait(subject, ownerId);
  }

  async uploadGallery(
    subject: string,
    bytes: Uint8Array,
    type: string,
    description = "Photograph",
    replacementPhotoId?: string,
  ) {
    return this.gallery.uploadGallery(
      subject,
      bytes,
      type,
      description,
      replacementPhotoId,
    );
  }

  async arrangeGallery(subject: string, raw: unknown) {
    return this.gallery.arrangeGallery(subject, raw);
  }

  async music(subject: string, raw: unknown) {
    return this.profiles.music(subject, raw);
  }

  async topFriends(subject: string, query = "", before?: string) {
    return this.profiles.topFriends(subject, query, before);
  }

  async updateTopFriends(subject: string, raw: unknown) {
    return this.profiles.updateTopFriends(subject, raw);
  }

  async contacts(subject: string, query = "", before?: string) {
    return this.profiles.contacts(subject, query, before);
  }

  async threads(subject: string, before?: string) {
    return this.messages.threads(subject, before);
  }

  async conversation(
    subject: string,
    contact: string,
    before?: string,
  ): Promise<MemberConversation> {
    return this.messages.conversation(subject, contact, before);
  }

  async sendMessage(subject: string, contact: string, raw: unknown) {
    return this.messages.sendMessage(subject, contact, raw);
  }

  async exportConversation(subject: string, contact: string) {
    return this.messages.exportConversation(subject, contact);
  }

  async readConversation(subject: string, contact: string, through?: string) {
    return this.messages.readConversation(subject, contact, through);
  }

  async hideConversation(subject: string, contact: string) {
    return this.messages.hideConversation(subject, contact);
  }

  /** Atomic bounded erasure, including notifications that reference message IDs.
   * SKIP LOCKED makes overlapping maintenance invocations safe. */
  async expireMessages(limit = 100) {
    return this.messages.expireMessages(limit);
  }

  async like(subject: string, postId: string, liked: boolean) {
    return this.activity.like(subject, postId, liked);
  }

  async notifications(subject: string, before?: string, includeEvents = true) {
    return this.activity.notifications(subject, before, includeEvents);
  }

  async readNotifications(subject: string, id?: string) {
    return this.activity.readNotifications(subject, id);
  }

  async safety(subject: string) {
    return this.accountData.safety(subject);
  }

  async exportAccount(subject: string) {
    return this.accountData.exportAccount(subject);
  }
}
