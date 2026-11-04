export function isolatedEnvironment(
  source: Readonly<Record<string, string | undefined>>,
  example?: string,
): Record<string, string | undefined>;
export function localTestPort(): Promise<number>;
