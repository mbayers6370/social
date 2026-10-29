/** Opaque IDs for local UI records/history, never authentication credentials.
 * getRandomValues remains available on HTTP LAN origins, unlike randomUUID.
 */
export function createLocalId(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}
