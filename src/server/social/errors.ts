import "server-only";
export class SocialError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export const unavailable = () => new SocialError(404, "Not found");
