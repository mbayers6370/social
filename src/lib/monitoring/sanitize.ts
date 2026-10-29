import type { ErrorEvent } from "@sentry/nextjs";

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const CREDENTIAL =
  /\b(?:Bearer\s+\S+|(?:sk|pk)_(?:live|test)_\S+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\b/gi;

function safeText(value: string) {
  return value.replace(EMAIL, "[email]").replace(CREDENTIAL, "[credential]");
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
          values: event.exception.values?.map((exception) => ({
            type: exception.type
              ? safeText(exception.type).slice(0, 100)
              : "Error",
            value: "[filtered]",
            stacktrace: exception.stacktrace
              ? {
                  frames: exception.stacktrace.frames?.map((frame) => ({
                    filename: frame.filename
                      ? safeText(
                          frame.filename
                            .split(/[?#]/)[0]
                            .split(/[\\/]/)
                            .at(-1) ?? "source",
                        )
                      : undefined,
                    function: frame.function
                      ? safeText(frame.function)
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
