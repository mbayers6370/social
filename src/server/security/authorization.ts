import "server-only";

export class ForbiddenError extends Error {
  constructor() {
    super("Permission denied");
    this.name = "ForbiddenError";
  }
}

/** Both IDs must come from the verified session and the fetched resource, respectively. */
export function assertOwner(viewerId: string, resourceOwnerId: string) {
  if (!viewerId || !resourceOwnerId || viewerId !== resourceOwnerId)
    throw new ForbiddenError();
}
