export const maxLocalBytes: number;
export const retainedVerificationReports: number;

export function inspectLocalStorage(
  root: string,
  options?: { byteLimit?: number },
): { bytes: number; violations: string[] };

export function pruneVerificationReports(root: string, keep?: number): string[];

export function formatBytes(bytes: number): string;
