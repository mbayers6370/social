import { publicSiteDetails } from "@/features/public-site/site-details";

/** Navigate only to an invitation in this app, never a pasted external destination. */
export function invitationDestination(value: string, origin: string) {
  try {
    const url = new URL(value.trim(), origin);
    if (
      (url.origin !== origin &&
        url.origin !== `https://${publicSiteDetails.domain}`) ||
      url.username ||
      url.password ||
      url.hash ||
      !/^\/invite\/(?:claim\/)?[A-Za-z0-9_-]{43}$/.test(url.pathname)
    )
      return null;
    if (url.search) {
      const ticket = url.searchParams.get("__clerk_ticket");
      if (
        !url.pathname.startsWith("/invite/claim/") ||
        [...url.searchParams.keys()].length !== 1 ||
        !ticket ||
        ticket.length > 4096 ||
        !/^[A-Za-z0-9._-]+$/.test(ticket)
      )
        return null;
    }
    return url.pathname + url.search;
  } catch {
    return null;
  }
}
