import "server-only";
export class SocialError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
export const unavailable = () => new SocialError(404, "Not found");
