/** Temporary interface pause. Event data and domain operations remain intact. */
export const eventSpacesEnabled: boolean = false;

export function spaceIsVisible(space: { kind: string }) {
  return eventSpacesEnabled || space.kind !== "EVENT";
}
