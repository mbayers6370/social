/** Deploy as a route on margin.social/* in front of the Render custom domain.
 * The incoming Request.cf value is supplied by Cloudflare, never the browser.
 * No IP, country, token, URL or account data is logged or stored by this worker. */
const regionEdge = {
  async fetch(request, environment) {
    if (!/^[A-Za-z0-9_-]{43,128}$/.test(environment.MARGIN_EDGE_SECRET ?? ""))
      return new Response("Margin is temporarily unavailable.", {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      });
    const headers = new Headers(request.headers);
    headers.set("x-margin-edge-token", environment.MARGIN_EDGE_SECRET);
    headers.set("x-margin-country", request.cf?.country ?? "XX");
    // Do not follow redirects with the private origin credential attached.
    const response = await fetch(
      new Request(request, { headers, redirect: "manual" }),
    );
    const outgoing = new Response(response.body, response);
    outgoing.headers.delete("x-margin-edge-token");
    outgoing.headers.delete("x-margin-country");
    return outgoing;
  },
};
export default regionEdge;
