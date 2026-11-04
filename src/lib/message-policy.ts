/** Measured from creation; reads deny expired entries even if maintenance is delayed. */
export const MESSAGE_LIFETIME_DAYS = 30;
export const NOTEBOOK_LIFETIME_DAYS = 90;

export function messageCutoff(now: Date, notebook = false) {
  return new Date(
    now.getTime() -
      (notebook ? NOTEBOOK_LIFETIME_DAYS : MESSAGE_LIFETIME_DAYS) * 86_400_000,
  );
}
