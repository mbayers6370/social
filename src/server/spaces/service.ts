import "server-only";
import type {
  SpaceListData,
  SpaceDetails,
  EventSearchPage,
  SpaceComments,
  SpaceInvitationCandidates,
} from "@/features/spaces/contracts";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import type { PrivatePhotoStore } from "@/server/social/photo";
import { ticketmasterCatalog, type EventCatalog } from "./ticketmaster";
import { SocialService } from "@/server/social/service";
import { type SpaceInput, type MemberInput } from "@/features/spaces/schema";
import { SpaceEventService } from "./events";
import { SpaceDirectoryService } from "./directory";
import { SpaceMembershipService } from "./membership";
import { SpacePublicationService } from "./publication";
import { SpacePostQueryService } from "./post-queries";
import { SpaceDiscussionService } from "./discussion";
import { SpaceLifecycleService } from "./lifecycle";

/** Stable public facade over focused Space operations. Each operation retains the
 * same SocialService transaction and authorization boundary. */
export class SpaceService extends SocialService {
  private readonly events: SpaceEventService;
  private readonly directory: SpaceDirectoryService;
  private readonly memberships: SpaceMembershipService;
  private readonly publication: SpacePublicationService;
  private readonly postQueries: SpacePostQueryService;
  private readonly discussion: SpaceDiscussionService;
  private readonly lifecycle: SpaceLifecycleService;

  constructor(
    db: PrismaClient,
    store: PrivatePhotoStore,
    clock: () => Date = () => new Date(),
    catalog: EventCatalog = ticketmasterCatalog,
  ) {
    super(db, store, clock);
    this.events = new SpaceEventService(db, store, clock, catalog);
    this.directory = new SpaceDirectoryService(db, store, clock);
    this.memberships = new SpaceMembershipService(db, store, clock);
    this.publication = new SpacePublicationService(db, store, clock);
    this.postQueries = new SpacePostQueryService(db, store, clock);
    this.discussion = new SpaceDiscussionService(db, store, clock);
    this.lifecycle = new SpaceLifecycleService(db, store, clock);
  }

  async createSpace(subject: string, raw: SpaceInput) {
    return this.directory.createSpace(subject, raw);
  }

  async joinTicketmasterEvent(subject: string, providerId: string) {
    return this.events.joinTicketmasterEvent(subject, providerId);
  }

  async joinEvent(subject: string, id: string) {
    return this.events.joinEvent(subject, id);
  }

  async searchEvents(
    subject: string,
    query: string,
    before?: string,
  ): Promise<EventSearchPage> {
    return this.events.searchEvents(subject, query, before);
  }

  async listSpaces(
    subject: string,
    before?: string,
    includeEvents = true,
  ): Promise<SpaceListData> {
    return this.directory.listSpaces(subject, before, includeEvents);
  }

  async readSpace(subject: string, id: string): Promise<SpaceDetails> {
    return this.directory.readSpace(subject, id);
  }

  async invitationCandidates(
    subject: string,
    spaceId: string,
    rawQuery = "",
  ): Promise<SpaceInvitationCandidates> {
    return this.memberships.invitationCandidates(subject, spaceId, rawQuery);
  }

  async invite(subject: string, spaceId: string, targetId: string) {
    return this.memberships.invite(subject, spaceId, targetId);
  }

  async accept(subject: string, invitationId: string) {
    return this.memberships.accept(subject, invitationId);
  }

  async updateEventSchedule(subject: string, id: string, endsAt: string) {
    return this.directory.updateEventSchedule(subject, id, endsAt);
  }

  async updateSpace(subject: string, id: string, raw: SpaceInput) {
    return this.directory.updateSpace(subject, id, raw);
  }

  async member(subject: string, id: string, raw: MemberInput) {
    return this.memberships.member(subject, id, raw);
  }

  async archive(subject: string, id: string) {
    return this.directory.archive(subject, id);
  }

  async publish(subject: string, id: string, raw: unknown) {
    return this.publication.publish(subject, id, raw);
  }

  protected async publishInTransaction(
    tx: Prisma.TransactionClient,
    subject: string,
    id: string | undefined,
    input: { body: string; photoIds: string[] },
  ) {
    return this.publication.publishInTransaction(tx, subject, id, input);
  }

  /** Reserve every upload, then publish text and all attachments atomically. */
  async publishWithUploads(
    subject: string,
    id: string | undefined,
    raw: unknown,
    files: { bytes: Uint8Array; type: string; description?: string }[],
  ) {
    return this.publication.publishWithUploads(subject, id, raw, files);
  }

  async reusablePhotos(subject: string, spaceId: string, before?: string) {
    return this.publication.reusablePhotos(subject, spaceId, before);
  }

  async posts(subject: string, id: string, before?: string, atPost?: string) {
    return this.postQueries.posts(subject, id, before, atPost);
  }

  async feed(subject: string, before?: string, includeEvents = true) {
    return this.postQueries.feed(subject, before, includeEvents);
  }

  async comments(
    subject: string,
    postId: string,
    after?: string,
    atComment?: string,
  ): Promise<SpaceComments> {
    return this.discussion.comments(subject, postId, after, atComment);
  }

  async comment(subject: string, postId: string, raw: unknown) {
    return this.discussion.comment(subject, postId, raw);
  }

  async deleteSpace(subject: string, id: string) {
    return this.lifecycle.deleteSpace(subject, id);
  }

  /** Trusted maintenance entry point; access is denied at the deadline even before this runs. */
  async expireSpaces(limit = 20, signal?: AbortSignal) {
    return this.lifecycle.expireSpaces(limit, signal);
  }
}
