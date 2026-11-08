import { demoDocumentKeys } from "./routes";

function isStaticRoute(pathname: string) {
  // Next 16 exports static RSC payloads next to each HTML document.
  const separator = pathname.lastIndexOf("/");
  const directory = pathname.slice(0, separator);
  const file = pathname.slice(separator + 1);
  const route =
    directory === "" ||
    directory === "/demo" ||
    demoDocumentKeys.some((key) => directory === `/${key}`);
  return (
    route &&
    (file === "index.txt" || /^__next\.[A-Za-z0-9_.$-]+\.txt$/.test(file))
  );
}

/** This module is installed only by portfolio/instrumentation-client.ts, before hydration. */
export function assertDemoRequest(
  input: string | URL,
  method: string,
  origin: string,
) {
  const url = new URL(input, origin);
  if (url.protocol === "blob:") {
    if (url.origin === origin && method === "GET") return;
  } else if (
    url.origin === origin &&
    (method === "GET" || method === "HEAD") &&
    !url.username &&
    !url.password &&
    (url.pathname === "/" ||
      url.pathname === "/demo/" ||
      url.pathname === "/demo" ||
      demoDocumentKeys.some(
        (key) => url.pathname === `/${key}` || url.pathname === `/${key}/`,
      ) ||
      isStaticRoute(url.pathname) ||
      /^\/_next\/static\/[A-Za-z0-9_./~-]+$/.test(url.pathname) ||
      [
        "/icon.svg",
        "/robots.txt",
        "/sitemap.xml",
        "/social-card.png",
        "/fonts/NotoSans-Regular.ttf",
        "/fonts/OFL.txt",
        "/fonts/inter/OFL.txt",
        "/brands/spotify.svg",
        "/brands/apple-music.svg",
        "/brands/photo-open-cursor.svg",
      ].includes(url.pathname))
  )
    return;
  throw new Error(
    `Demo blocked an unexpected backend request (${method} ${url.pathname}). No data was sent.`,
  );
}

/** The development server's own hot-reload channel is the only socket exception. */
export function isDemoHotReloadSocket(input: string, origin: string) {
  if (process.env.NODE_ENV !== "development") return false;
  const page = new URL(origin);
  const socket = new URL(input, origin);
  return (
    socket.host === page.host &&
    socket.protocol === (page.protocol === "https:" ? "wss:" : "ws:") &&
    socket.pathname === "/_next/hmr"
  );
}

export function installDemoNetworkBoundary() {
  const originalFetch = window.fetch.bind(window);
  function denied(error: unknown): never {
    window.dispatchEvent(
      new CustomEvent("margin:demo-network-denied", { detail: String(error) }),
    );
    throw error;
  }
  window.fetch = async (input, init) => {
    try {
      const request = input instanceof Request ? input : null;
      assertDemoRequest(
        request?.url ?? String(input),
        (init?.method ?? request?.method ?? "GET").toUpperCase(),
        window.location.origin,
      );
    } catch (error) {
      denied(error);
    }
    const request = input instanceof Request ? input : null;
    const headers = new Headers(init?.headers ?? request?.headers);
    headers.delete("Authorization");
    return originalFetch(input, {
      ...init,
      headers,
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
  };
  const block = () =>
    denied(
      new Error(
        "Network integrations are disabled in this fictional demo. No data was sent.",
      ),
    );
  window.XMLHttpRequest.prototype.open = block;
  window.WebSocket = new Proxy(window.WebSocket, {
    construct(target, args) {
      if (isDemoHotReloadSocket(String(args[0]), window.location.origin))
        return Reflect.construct(target, args);
      return block();
    },
  });
  window.EventSource = new Proxy(window.EventSource, { construct: block });
  navigator.sendBeacon = block;
}
