# Feature modules

Create a directory here only when a feature exists. Colocate its presentation, shared Zod schemas, and feature-specific types. Interactive leaves use `"use client"`; layouts and routes stay server-rendered.

Keep queries, authorization, and business operations in `src/server/<domain>`. App routes call those operations and pass explicit DTOs into feature components. Shared UI never imports feature modules. Avoid barrel exports that mix server and client modules.
