// Opt-in development integration checks. No production keys, public signup or real email.
import { spawnSync } from "node:child_process";
import { chromium } from "@playwright/test";
import { randomBytes, createHash } from "node:crypto";
import {
  readFileSync,
  writeFileSync,
  unlinkSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { completeAccountOnboarding } from "../src/server/account/service.ts";
if (process.argv.includes("--help")) {
  console.log(
    "Usage: npm run test:auth:live -- [--help]\nRequires Node 22, a running localhost:3000 server, test-mode Clerk keys, Invite-only, Redis and the known migrated local database. Creates/deletes disposable fixtures; never opens registration.",
  );
  process.exit(0);
}
if (process.env.RUN_LIVE_AUTH_TESTS !== "1" || process.argv.slice(2).length > 0)
  throw Error("Explicit live-auth test command required");
mkdirSync(".local/auth-activation", { recursive: true, mode: 0o700 });
if (existsSync(".local/auth-activation/fixture-ids.json"))
  throw Error(
    "An earlier fixture journal remains. Review and remove those marked test identities before another run.",
  );
const key = process.env.CLERK_SECRET_KEY;
const pub = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
if (
  !key?.startsWith("sk_test_") ||
  !pub?.startsWith("pk_test_") ||
  process.env.MARGIN_REGISTRATION_ENABLED === "1"
)
  throw Error("Test keys and closed registration are required");
let u;
let localSecrets;
try {
  u = new URL(process.env.DATABASE_URL);
  localSecrets = JSON.parse(readFileSync(".local/database.json", "utf8"));
} catch {
  throw Error("Known local runtime database configuration required");
}
if (
  u.hostname !== "127.0.0.1" ||
  u.port !== "55432" ||
  u.pathname !== "/margin_local" ||
  u.username !== "margin_runtime" ||
  decodeURIComponent(u.password) !== localSecrets.runtime
)
  throw Error("Known local runtime database required");
const run = randomBytes(12).toString("hex");
const email = `margin-auth-${run}+clerk_test@example.com`;
const password = randomBytes(28).toString("base64url") + "aA7!";
const code = randomBytes(32).toString("base64url");
const digest = createHash("sha256").update(code).digest("hex");
const fixtureIds = [];
let browser;
let stage = "preflight";
const checks = {};
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: u.href, max: 2 }),
});
async function api(method, path, body) {
  const r = await fetch(`https://api.clerk.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
    redirect: "error",
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const codes = (d.errors ?? [])
      .map((e) => e.code)
      .filter((c) => /^[a-z_]{1,80}$/.test(c));
    throw Error(`Provider request rejected (${r.status}; ${codes.join(",")})`);
  }
  return d;
}
function ensure(value) {
  if (!value) throw Error("Expected authentication outcome was not observed");
}
function pass(name) {
  checks[name] = true;
  console.log(JSON.stringify({ check: name, passed: true }));
}
async function signIn(
  page,
  wrong = false,
  credential = password,
  rejectedPassword = "wrong-" + randomBytes(12).toString("hex"),
) {
  await page.goto("http://localhost:3000/sign-in", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page
    .locator('input[name="identifier"]')
    .fill(email, { timeout: 20000 });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.locator('input[name="password"]').waitFor({ timeout: 12000 });
  if (wrong) {
    await page.locator('input[name="password"]').fill(rejectedPassword);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page
      .getByText(/password is incorrect|incorrect password/i)
      .first()
      .waitFor({ timeout: 10000 });
    pass("incorrect_password_rejected");
  }
  await page.locator('input[name="password"]').fill(credential);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await Promise.race([
    page.waitForFunction(() => Boolean(window.Clerk?.session), {
      timeout: 15000,
    }),
    page
      .locator('input[autocomplete="one-time-code"]')
      .first()
      .waitFor({ timeout: 15000 }),
  ]).catch(() => {});
  const otp = page.locator('input[autocomplete="one-time-code"]').first();
  if (await otp.isVisible().catch(() => false)) {
    await otp.fill("424242");
    const button = page.getByRole("button", { name: /^(Continue|Verify)$/ });
    if (await button.isVisible().catch(() => false)) await button.click();
  }
  await page.waitForFunction(
    () => Boolean(window.Clerk?.session && window.Clerk?.user),
    { timeout: 20000 },
  );
  return page.evaluate(async () => ({
    id: window.Clerk.session.id,
    userId: window.Clerk.user.id,
    token: await window.Clerk.session.getToken({ skipCache: true }),
  }));
}
try {
  const instance = await api("GET", "/instance");
  ensure(instance.environment_type === "development");
  browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  const response = page.waitForResponse(
    (r) => new URL(r.url()).pathname === "/v1/environment" && r.ok(),
    { timeout: 30000 },
  );
  await page.goto("http://localhost:3000/sign-in", {
    waitUntil: "domcontentloaded",
  });
  const policy = await (await response).json();
  ensure(policy.auth_config?.test_mode === true);
  pass("development_test_mode_confirmed");
  ensure(policy.user_settings?.sign_up?.mode === "restricted");
  pass("provider_invite_only_confirmed");
  await page.waitForFunction(
    () => window.Clerk?.status === "ready" && window.Clerk.client,
    { timeout: 20000 },
  );
  const uninvited = await page.evaluate(
    async ({ email, password }) => {
      try {
        await window.Clerk.client.signUp.create({
          emailAddress: email,
          password,
        });
        return { denied: false, codes: [] };
      } catch (error) {
        return {
          denied: true,
          codes:
            error.errors
              ?.map((e) => e.code)
              .filter((c) => /^[a-z_]{1,80}$/.test(c)) ?? [],
        };
      }
    },
    { email: `uninvited-${run}+clerk_test@example.com`, password },
  );
  console.log(JSON.stringify({ uninvitedSignupErrorCodes: uninvited.codes }));
  ensure(
    uninvited.denied && uninvited.codes.includes("sign_up_mode_restricted"),
  );
  pass("direct_provider_signup_without_invitation_rejected");
  stage = "create_disposable_identity";
  const user = await api("POST", "/users", {
    email_address: [email],
    email_address_identification_status: ["reserved"],
    password,
    private_metadata: { margin_auth_test: run },
  });
  fixtureIds.push(user.id);
  writeFileSync(
    ".local/auth-activation/fixture-ids.json",
    JSON.stringify({ run, ids: fixtureIds }),
    { mode: 0o600 },
  );
  ensure(user.email_addresses[0].verification?.status !== "verified");
  pass("unverified_fixture_created_without_email_delivery");
  stage = "real_browser_password_sign_in";
  const first = await signIn(page, true);
  ensure(first.userId === user.id);
  ensure((await api("GET", `/sessions/${first.id}`)).status === "active");
  pass("real_browser_password_sign_in");
  stage = "verify_primary_email";
  if (process.env.UPSTASH_REDIS_REST_URL) {
    const denied = await fetch("http://localhost:3000/api/auth/session", {
      headers: { Authorization: `Bearer ${first.token}` },
    });
    ensure(denied.status === 403);
    pass("unverified_primary_email_denied_by_real_application");
  }
  if (
    (await api("GET", `/users/${user.id}`)).email_addresses[0].verification
      ?.status !== "verified"
  ) {
    await page.evaluate(async () => {
      const email = window.Clerk.user.primaryEmailAddress;
      await email.prepareVerification({ strategy: "email_code" });
      await email.attemptVerification({ code: "424242" });
    });
  }
  ensure(
    (await api("GET", `/users/${user.id}`)).email_addresses[0].verification
      ?.status === "verified",
  );
  pass("real_provider_email_code_verification");
  stage = "canonical_local_account";
  await db.invitation.create({
    data: { digest, email, expiresAt: new Date(Date.now() + 600000) },
  });
  ensure(
    (
      await completeAccountOnboarding(
        db,
        { subject: user.id, verifiedEmail: email },
        {
          name: "Disposable authentication test",
          username: `auth_${run.slice(0, 16)}`,
          bio: "",
        },
        code,
      )
    ).status === "PENDING",
  );
  const row = await db.user.findUniqueOrThrow({
    where: { clerkId: user.id },
    include: { account: true },
  });
  ensure(row.account.status === "PENDING");
  const approval = spawnSync(
    process.execPath,
    [
      "--import",
      "./scripts/register-typescript.mjs",
      "--conditions=react-server",
      "--experimental-strip-types",
      "scripts/activate-account.mjs",
      "--clerk-id",
      user.id,
      "--confirm-activation",
    ],
    {
      env: { ...process.env, MARGIN_PRIVATE_BACKEND_ENABLED: "1" },
      encoding: "utf8",
      timeout: 20000,
    },
  );
  ensure(approval.status === 0);
  ensure(
    (await db.account.findUniqueOrThrow({ where: { userId: row.id } }))
      .status === "ACTIVE",
  );
  pass("live_clerk_subject_linked_and_operator_cli_activation_verified");
  stage = "application_session_probe";
  const probe = await page.request.get(
    "http://localhost:3000/api/auth/session",
    { headers: { Authorization: `Bearer ${first.token}` } },
  );
  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    ensure(probe.status() === 503);
    pass("application_fails_closed_without_redis");
  } else {
    ensure(probe.status() === 200);
    pass("real_application_session_probe");
  }
  stage = "second_browser_context";
  const context2 = await browser.newContext();
  const page2 = await context2.newPage();
  const second = await signIn(page2);
  ensure(second.userId === user.id && second.id !== first.id);
  ensure((await api("GET", `/sessions/${first.id}`)).status === "active");
  pass("independent_real_browser_sessions");
  stage = "sign_out_click";
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  stage = "sign_out_redirect";
  await page.waitForURL("**/welcome", { timeout: 20000 });
  stage = "sign_out_provider_state";
  const logoutState = (await api("GET", `/sessions/${first.id}`)).status;
  const otherState = (await api("GET", `/sessions/${second.id}`)).status;
  console.log(JSON.stringify({ logoutState, otherState }));
  ensure(["ended", "revoked", "removed"].includes(logoutState));
  ensure(otherState === "active");
  pass("real_sign_out_ends_only_current_browser_session");
  stage = "signed_out_token_replay";
  ensure(
    JSON.parse(Buffer.from(first.token.split(".")[1], "base64url").toString())
      .exp >
      Date.now() / 1000,
  );
  ensure(
    (
      await fetch("http://localhost:3000/api/auth/session", {
        headers: { Authorization: `Bearer ${first.token}` },
      })
    ).status === 401,
  );
  pass("unexpired_signed_out_token_rejected_by_real_application");
  stage = "token_expiration";
  const exp = JSON.parse(
    Buffer.from(second.token.split(".")[1], "base64url").toString(),
  ).exp;
  let wait = exp * 1000 + 7000 - Date.now();
  ensure(wait > 0 && wait < 80000);
  console.log(
    JSON.stringify({ waitingForTokenExpirySeconds: Math.ceil(wait / 1000) }),
  );
  while (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, Math.min(wait, 30000)));
    wait = exp * 1000 + 7000 - Date.now();
  }
  ensure((await api("GET", `/sessions/${second.id}`)).status === "active");
  ensure(
    (
      await fetch("http://localhost:3000/api/auth/session", {
        headers: { Authorization: `Bearer ${second.token}` },
      })
    ).status === 401,
  );
  pass("real_expired_token_rejected_while_provider_session_remains_active");
  const refreshed = await page2.evaluate(() =>
    window.Clerk.session.getToken({ skipCache: true }),
  );
  ensure(refreshed && refreshed !== second.token);
  ensure(
    (
      await fetch("http://localhost:3000/api/auth/session", {
        headers: { Authorization: `Bearer ${refreshed}` },
      })
    ).status === 200,
  );
  pass("real_token_refresh_restores_verified_access");
  stage = "remote_revocation";
  await api("POST", `/sessions/${second.id}/revoke`);
  ensure((await api("GET", `/sessions/${second.id}`)).status === "revoked");
  ensure(
    (
      await fetch("http://localhost:3000/api/auth/session", {
        headers: { Authorization: `Bearer ${refreshed}` },
      })
    ).status === 401,
  );
  pass("real_remote_revocation_rejects_unexpired_token");
  stage = "password_recovery";
  const recoveryContext = await browser.newContext();
  const recovery = await recoveryContext.newPage();
  await recovery.goto("http://localhost:3000/welcome", {
    waitUntil: "domcontentloaded",
  });
  await recovery.waitForFunction(() => window.Clerk?.status === "ready", {
    timeout: 20000,
  });
  const newPassword = randomBytes(28).toString("base64url") + "bB8!";
  const reset = await recovery.evaluate(
    async ({ email, password }) => {
      const signIn = window.Clerk.client.signIn;
      await signIn.create({
        strategy: "reset_password_email_code",
        identifier: email,
      });
      let rejected = false;
      try {
        await signIn.attemptFirstFactor({
          strategy: "reset_password_email_code",
          code: "000000",
          password,
        });
      } catch {
        rejected = true;
      }
      const result = await signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code: "424242",
        password,
      });
      if (result.status !== "complete" || !result.createdSessionId)
        return { complete: false, rejected };
      await window.Clerk.setActive({ session: result.createdSessionId });
      return { complete: true, rejected };
    },
    { email, password: newPassword },
  );
  ensure(reset.complete && reset.rejected);
  pass("real_recovery_code_rejection_and_success");
  await recovery.waitForFunction(
    () => Boolean(window.Clerk?.session && window.Clerk?.user),
    { timeout: 20000 },
  );
  ensure(await recovery.evaluate((id) => window.Clerk.user.id === id, user.id));
  ensure(
    (await db.user.findUniqueOrThrow({ where: { clerkId: user.id } })).id ===
      row.id,
  );
  pass("real_password_recovery_preserves_canonical_account_identity");
  stage = "recovered_credentials";
  const postRecovery = await (await browser.newContext()).newPage();
  const recovered = await signIn(postRecovery, true, newPassword, password);
  ensure(recovered.userId === user.id);
  pass("old_password_rejected_and_recovered_password_works");
  stage = "database_deactivation";
  await db.account.update({
    where: { userId: row.id },
    data: { status: "DEACTIVATED" },
  });
  ensure(
    (
      await fetch("http://localhost:3000/api/auth/session", {
        headers: { Authorization: `Bearer ${recovered.token}` },
      })
    ).status === 403,
  );
  pass("real_database_deactivation_blocks_existing_clerk_session");
  stage = "disabled_provider_identity";
  await api("POST", `/users/${user.id}/ban`);
  ensure(
    (
      await fetch("http://localhost:3000/api/auth/session", {
        headers: { Authorization: `Bearer ${recovered.token}` },
      })
    ).status === 401,
  );
  pass("real_banned_provider_identity_denied");

  console.log(JSON.stringify({ completed: true, checks }));
} catch (error) {
  console.error(
    JSON.stringify({
      failedStage: stage,
      error: error.message?.startsWith("Provider request rejected")
        ? error.message
        : "Authentication check failed; provider/browser details withheld",
      errorKind: ["Error", "TypeError", "TimeoutError"].includes(error.name)
        ? error.name
        : "Other",
      completedChecks: checks,
    }),
  );
  process.exitCode = 1;
} finally {
  let clean = true;
  for (const id of fixtureIds) {
    try {
      const user = await api("GET", `/users/${id}`);
      ensure(user.private_metadata?.margin_auth_test === run);
      await db.user.deleteMany({ where: { clerkId: id } });
      await api("DELETE", `/users/${id}`);
    } catch {
      clean = false;
    }
  }
  try {
    await db.invitation.deleteMany({ where: { digest } });
  } catch {
    clean = false;
  }
  await db.$disconnect().catch(() => {
    clean = false;
    process.exitCode = 1;
  });
  await browser?.close().catch(() => {
    clean = false;
    process.exitCode = 1;
  });
  if (clean) {
    try {
      unlinkSync(".local/auth-activation/fixture-ids.json");
    } catch {}
  } else {
    process.exitCode = 1;
  }
  console.log(JSON.stringify({ testFixtureCleanupComplete: clean }));
  writeFileSync(
    ".local/auth-activation/live-clerk-result.json",
    JSON.stringify(
      { checks, cleanupComplete: clean, passed: !process.exitCode },
      null,
      2,
    ),
  );
}
