export function sourceFingerprint(root: string): string;
export function recordBuild(
  root: string,
  directory: string,
  fingerprint: string,
): void;
export function assertFreshBuild(
  root: string,
  directory: string,
  command?: string,
): void;
export function serverPort(args: string[], fallback?: string | number): number;
export function claimServerPort(
  port: number,
  options?: { directory?: string },
): Promise<() => void>;
