# Demo and shared feature modules

The default public experience is composed by `public-demo/`: fictional bootstrapping, isolated local interaction providers, exit/reset behavior and the browser network boundary. Routes in `portfolio/app/` mount this composition; the [main README](../../README.md) documents the visitor experience and excluded services.

Existing Feed, Profile, Gallery, Friends, Messages, Notebook and Spaces components are reused rather than maintained as a second interface. Canonical sample definitions live in `src/fixtures/`; development-only server wrappers retain their guards in `src/server/fixtures/`. Shared preview links/router ports map into `/demo/` only when the separate portfolio build is selected.

Create a directory here only when a feature exists. Colocate presentation, client-safe Zod schemas and feature-specific types. Interactive leaves use `"use client"`; routes and data-loading boundaries stay server-rendered where appropriate. Shared primitives remain feature-neutral; application composition may consume explicit feature contexts and DTOs. Avoid barrel exports that mix server and client modules.

The preserved application keeps queries, authorization, persistence and integration operations in `src/server/<domain>`. Its `src/app/` routes authenticate, call those operations and pass explicit DTOs to feature components. Public-demo adapters return local simulated results; they must never fall through to production fetches. Backend and integration imports are forbidden in the portfolio build. The compile-time demo flag is presentation routing, not an authorization mechanism.
