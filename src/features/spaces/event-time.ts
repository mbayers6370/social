/** Resolve an entered wall clock in its explicit zone; never guess through a DST gap/fold. */
export function eventTimeCandidates(local: string, timeZone: string): string[] {
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(local)) return [];
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const display = (date: Date) => {
    const parts = Object.fromEntries(
      formatter.formatToParts(date).map((p) => [p.type, p.value]),
    );
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  };
  const utc = Date.parse(`${local}:00Z`);
  if (!Number.isFinite(utc)) return [];
  const candidates = new Set<string>();
  for (const shift of [-86400_000, 0, 86400_000]) {
    const sample = utc + shift;
    const offset = Date.parse(`${display(new Date(sample))}:00Z`) - sample;
    const candidate = new Date(utc - offset);
    if (display(candidate) === local) candidates.add(candidate.toISOString());
  }
  return [...candidates].sort();
}
export function eventLocalValue(instant: string, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(instant))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
