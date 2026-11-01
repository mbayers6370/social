# Isolated OpenMLS feasibility experiment

This Cargo project is a synthetic browser experiment, not production messaging. Nothing in `src/` imports it. It has no application credentials, Clerk enrollment, real users, relay, attachments, push notifications or native app bindings. Generated WASM, tools, advisory data and result files are ignored; synthetic browser contexts are discarded after each run.

## Result and decision

The harness passed seven functional gates across Chromium, Firefox and WebKit: join and bidirectional messages, sender/receiver reload from IndexedDB, a third device and cross-engine commits, device removal, tamper/replay rejection, failing persistence, and corrupted saved state.

The dependency gate is **not cleared**. `cargo audit` of the exact lockfile reports crypto-bigint 0.5.5 ([RUSTSEC-2026-0387](https://rustsec.org/advisories/RUSTSEC-2026-0387.html)), two libcrux-kem 0.0.9 advisories ([RUSTSEC-2026-0331](https://rustsec.org/advisories/RUSTSEC-2026-0331.html), [RUSTSEC-2026-0330](https://rustsec.org/advisories/RUSTSEC-2026-0330.html)), and an unmaintained proc-macro dependency. The compiled WASM dependency tree includes crypto-bigint through the provider's elliptic-curve dependencies; libcrux-kem is optional and absent from that target's active tree. The selected suite uses X25519/Ed25519, but a passing test is not a side-channel reachability analysis. Do not force an incompatible arithmetic upgrade or dismiss the advisory without upstream/provider review. Keep production provider selection on hold.

The project pins OpenMLS **0.9.2**, RustCrypto/basic-credential/traits **0.6.0**, wasm-bindgen **0.2.114**, and a full Cargo.lock. The initial release-list page showed 0.9.0, but the crate index and current advisories identify newer patches. Version 0.9.2 fixes the recent [removed-member external-commit issue](https://github.com/openmls/openmls/security/advisories/GHSA-94v4-rg25-x625) and [rejected-message ratchet issue](https://github.com/openmls/openmls/security/advisories/GHSA-p276-g3f3-wwgh); 0.9.1 fixed the [recursive extension parser issue](https://github.com/openmls/openmls/security/advisories/GHSA-gc79-23g3-8g52). The harness does not independently reproduce every upstream advisory.

## Reproduce

Use an isolated Rust toolchain with the `wasm32-unknown-unknown` target, Node 22, the repository's Playwright dependency and a wasm-bindgen CLI matching the pinned crate. The local run used Rust 1.99.1. No root npm dependency was added for OpenMLS.

```sh
cargo build --locked --manifest-path experiments/openmls/Cargo.toml --target wasm32-unknown-unknown --release
wasm-bindgen --target web --out-dir experiments/openmls/pkg experiments/openmls/target/wasm32-unknown-unknown/release/margin_openmls_feasibility.wasm
PLAYWRIGHT_BROWSERS_PATH="$PWD/.local/openmls-feasibility/browsers" npx playwright install firefox webkit
node experiments/openmls/run-browser-gates.mjs
cargo audit --file experiments/openmls/Cargo.lock --db .local/openmls-feasibility/advisory-db
```

Chromium uses the repository's standard Playwright installation. Firefox and WebKit use binaries in the ignored prototype directory. The runner serves only three allowlisted fixture files on a randomly assigned loopback port. Its relay moves MLS messages between independent browser contexts; secret snapshots never go through the relay. Results go to `.local/openmls-feasibility/results/`. When using `CARGO_TARGET_DIR`, pass that output path to wasm-bindgen instead.

## What the gates establish

The Rust wrapper calls the library's key-package, add/welcome, send/process, remove/merge and storage APIs. It selects MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519 and retains no past epochs. It does not implement its own cipher, ratchet or protocol.

The browser fixture persists library state to IndexedDB before returning ciphertext or accepted plaintext. A failed write freezes that in-memory device so it cannot continue sending from unpersisted state. Reloading both participants successfully resumes message exchange and retains replay rejection. This proves a clean reload with the latest committed snapshot, **not** safe restoration of an old backup or crash consistency for every partial-write boundary.

For removal, a third device joins through WebKit. A removed Firefox device deliberately retains its old state and withholds the removal commit; it cannot read the next epoch. The remaining WebKit device can. After processing the removal, Firefox cannot send, including after reloading. This proves the tested MLS transition, not server enrollment/revocation authorization or deletion of previously decrypted history.

## Remaining gates

Snapshots contain plaintext synthetic private keys. This fixture storage must never be used for real accounts. Production needs encrypted local state, atomic persistence/release semantics, rollback protection, single-writer coordination across tabs/processes, and recovery that enrolls a fresh device rather than reusing an old sender state. Browser-origin compromise can still access plaintext or invoke cryptography; WASM does not remove that threat.

The [upstream platform matrix](https://book.openmls.tech/) still lists browser WASM, iOS and Android as built but untested. This experiment adds evidence for the named desktop browser builds; it does not validate iOS/Android binaries, mobile browsers or interoperability with an independent MLS implementation. Native bindings, independent identity/device verification, key transparency or safety verification, enrollment/recovery authorization, offline commit ordering/forks, reliable delivery, attachment encryption, retention/exports, provider advisories and independent security review remain open.

OpenMLS uses an MIT license; review the complete dependency notices and distribution obligations before shipping. Review the exact core, crypto and storage providers separately: an audit of the MLS core is not an audit of Margin's eventual device and recovery system.
