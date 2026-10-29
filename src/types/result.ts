/** Serializable operation results. Never return raw exceptions, tokens, or database models to clients. */
export type Result<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code:
          | "UNAUTHORIZED"
          | "FORBIDDEN"
          | "INVALID_INPUT"
          | "RATE_LIMITED"
          | "UNAVAILABLE";
        message: string;
      };
    };
