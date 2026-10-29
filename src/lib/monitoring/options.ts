import type { BrowserOptions, ErrorEvent, EventHint } from "@sentry/nextjs";
import { sanitizeEvent } from "@/lib/monitoring/sanitize";

export const monitoringOptions = {
  enabled: process.env.NODE_ENV === "production",
  // Error monitoring only for this foundation. No replay, logs, or request-span payloads.
  tracesSampleRate: 0,
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: false,
    databaseQueryData: false,
    queues: false,
    stackFrameVariables: false,
    frameContextLines: 0,
    graphQL: { document: false, variables: false },
    genAI: { inputs: false, outputs: false },
    mcp: { inputs: false, outputs: false },
  },
  tracePropagationTargets: [],
  sendClientReports: false,
  integrations: (defaults) =>
    defaults.filter(
      (integration) =>
        !/session|conversation|replay|profil/i.test(integration.name),
    ),
  beforeSendLog: () => null,
  beforeSend: (event: ErrorEvent, hint: EventHint) => {
    hint.attachments = [];
    return sanitizeEvent(event);
  },
  beforeBreadcrumb: () => null,
} satisfies BrowserOptions;
