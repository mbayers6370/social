/** Server-side scheduling boundary only. Phase 1 deliberately has no implementation. */
export interface JobScheduler {
  schedule(request: {
    name: string;
    payload: unknown;
    runAt: Date;
    idempotencyKey: string;
  }): Promise<{ id: string }>;
  cancel(id: string): Promise<void>;
}
