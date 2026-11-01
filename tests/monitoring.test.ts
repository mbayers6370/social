// @vitest-environment node
import * as Sentry from "@sentry/nextjs";
import type { BrowserOptions } from "@sentry/nextjs";
import { expect, it } from "vitest";
import { monitoringOptions } from "@/lib/monitoring/options";

type Transport = ReturnType<NonNullable<BrowserOptions["transport"]>>;
type Envelope = Parameters<Transport["send"]>[0];

it("filters sensitive data from the actual SDK's outbound event envelope", async () => {
  const envelopes: Envelope[] = [];
  Sentry.init({
    ...monitoringOptions,
    enabled: true,
    dsn: "https://public@example.com/1",
    defaultIntegrations: false,
    transport: () => ({
      send: async (envelope: Envelope) => {
        envelopes.push(envelope);
        return { statusCode: 200 };
      },
      flush: async () => true,
    }),
  });
  try {
    Sentry.withScope((scope) => {
      scope.setUser({
        email: "sensitive@example.com",
        ip_address: "192.0.2.1",
        id: "private-user",
      });
      scope.setExtra("password", "sensitive-password");
      scope.setContext("private", { token: "sensitive-token" });
      scope.addBreadcrumb({ message: "sensitive-navigation" });
      scope.addAttachment({
        filename: "private.txt",
        data: "sensitive-attachment",
      });
      scope.addEventProcessor((event) => ({
        ...event,
        exception: {
          values: [
            {
              type: "sensitive-custom-error",
              value: "sensitive-message",
              stacktrace: {
                frames: [
                  {
                    filename:
                      "https://example.com/sensitive-upload.js?token=sensitive-query",
                    function: "sensitive-function",
                    lineno: 12,
                  },
                ],
              },
            },
          ],
        },
        request: {
          url: "https://example.com/?token=sensitive-query",
          headers: {
            Authorization: "Bearer sensitive-auth",
            Cookie: "session=sensitive-cookie",
          },
          data: "sensitive-body",
        },
      }));
      Sentry.captureException(
        new Error("sensitive-message sensitive@example.com"),
      );
    });
    await Sentry.flush(2000);
    const serialized = JSON.stringify(envelopes);
    expect(envelopes.length).toBeGreaterThan(0);
    expect(serialized).toContain("[filtered]");
    expect(serialized).not.toMatch(
      /sensitive-|sensitive@example\.com|192\.0\.2\.1|private-user|private\.txt/,
    );
    expect(
      envelopes.some((envelope) =>
        envelope[1].some((item) => item[0].type === "attachment"),
      ),
    ).toBe(false);
    expect(monitoringOptions.dataCollection.userInfo).toBe(false);
    expect(monitoringOptions.dataCollection.httpBodies).toEqual([]);
    expect(
      monitoringOptions.integrations([
        { name: "BrowserSession" },
        { name: "ConversationId" },
        { name: "GlobalHandlers" },
      ]),
    ).toEqual([{ name: "GlobalHandlers" }]);
  } finally {
    await Sentry.close();
  }
});
