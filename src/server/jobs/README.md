# Scheduled work

`types.ts` defines the scheduler boundary only. There is no runtime provider, background worker, or public job endpoint.

When real expiration work is implemented, use authenticated invocations, job-specific validation, bounded payloads, idempotent operations, and resource authorization at creation and execution. Keep provider code inside this server module.
