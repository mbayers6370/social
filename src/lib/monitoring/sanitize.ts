import type { ErrorEvent } from "@sentry/nextjs";

const ERROR_TYPES = new Set([
  "Error",
  "TypeError",
  "SyntaxError",
  "RangeError",
  "ReferenceError",
  "URIError",
  "EvalError",
  "AggregateError",
  "UnauthorizedError",
  "ForbiddenError",
  "RateLimitError",
  "MusicError",
  "PhotoPolicyError",
]);
function sourceName(filename: string) {
  const basename = filename.split(/[?#]/)[0].split(/[\\/]/).at(-1) ?? "";
  // Retain public bundle-shaped names, never arbitrary uploaded filenames or paths.
  return /^(?:[a-f0-9]{8,64}|(?:app|pages|main|webpack|framework|polyfills|runtime)(?:-[a-f0-9]{8,64})?)\.(?:js|mjs)$/i.test(
    basename,
  )
    ? basename
    : "source";
}

/** Allowlist diagnostics. Arbitrary context, request bodies, headers and breadcrumbs may contain PII. */
export function sanitizeEvent(event: ErrorEvent): ErrorEvent {
  return {
    type: undefined,
    event_id: event.event_id,
    timestamp: event.timestamp,
    platform: event.platform,
    level: event.level,
    environment: event.environment,
    release: event.release,
    // Error messages can contain arbitrary application data. Keep type and source locations only.
    message: event.message ? "Application error" : undefined,
    exception: event.exception
      ? {
          values: event.exception.values?.slice(0, 5).map((exception) => ({
            // Custom Error.name and function names can contain user-supplied content.
            type: ERROR_TYPES.has(exception.type ?? "")
              ? exception.type
              : "Error",
            value: "[filtered]",
            stacktrace: exception.stacktrace
              ? {
                  frames: exception.stacktrace.frames
                    ?.slice(-40)
                    .map((frame) => ({
                      filename: frame.filename
                        ? sourceName(frame.filename)
                        : undefined,
                      lineno: frame.lineno,
                      colno: frame.colno,
                      in_app: frame.in_app,
                    })),
                }
              : undefined,
          })),
        }
      : undefined,
  };
}
