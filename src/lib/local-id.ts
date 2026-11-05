function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

/** Random record/history IDs, never authentication credentials.
 * getRandomValues remains available on HTTP LAN origins, unlike randomUUID.
 */
export function createLocalId(): string {
  return hex(globalThis.crypto.getRandomValues(new Uint8Array(16)));
}

/** UUID v4 idempotency keys for APIs that require UUID-formatted request IDs. */
export function createRequestId(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const value = hex(bytes);
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}
