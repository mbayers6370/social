import { chromium, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  mkdirSync,
} from "node:fs";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { createDatabaseAdapter } from "../src/server/database-adapter.ts";
if (process.argv.includes("--help")) {
  console.log(
    "Usage: npm run test:invitations:live. Requires the running localhost:3000 development app, matching test keys, Invite-only/Test mode, Redis, invitation signing and the known local database. Uses marked disposable accounts, official bot-testing tokens and test email addresses, not real inboxes. Removes its own fixtures; never changes provider settings or production.",
  );
  process.exit(0);
}
if (
  process.env.RUN_LIVE_INVITATION_TESTS !== "1" ||
  process.argv.slice(2).length
)
  throw Error("Explicit development invitation verification command required");
mkdirSync(".local/invitation-journey", { recursive: true, mode: 0o700 });
const origin = "http://localhost:3000";
const journal = ".local/invitation-journey/fixtures.json";
const key = process.env.CLERK_SECRET_KEY;
const url = new URL(process.env.DATABASE_URL || "http://invalid");
const local = JSON.parse(readFileSync(".local/database.json", "utf8"));
if (
  !key?.startsWith("sk_test_") ||
  !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_") ||
  url.hostname !== "127.0.0.1" ||
  url.port !== "55432" ||
  url.pathname !== "/margin_local" ||
  url.username !== "margin_runtime" ||
  decodeURIComponent(url.password) !== local.runtime ||
  process.env.NEXT_PUBLIC_APP_URL !== origin ||
  process.env.MARGIN_REGISTRATION_ENABLED !== "1" ||
  process.env.MARGIN_PRIVATE_BACKEND_ENABLED !== "1" ||
  (process.env.INVITATION_LINK_SECRET?.length || 0) < 43 ||
  !process.env.UPSTASH_REDIS_REST_URL ||
  !process.env.UPSTASH_REDIS_REST_TOKEN
)
  throw Error("Verified local development configuration required");
if (existsSync(journal))
  throw Error("Previous fixture journal must be reviewed");
const db = new PrismaClient({ adapter: createDatabaseAdapter(url.href, 2) });
const run = randomBytes(10).toString("hex");
const senderEmail = `margin-inviter-${run}+clerk_test@example.com`;
const recipientEmail = `margin-invitee-${run}+clerk_test@example.com`;
const password = randomBytes(28).toString("base64url") + "Aa7!";
let stage = "preflight",
  browser,
  page,
  sender,
  recipient,
  senderId,
  linkId,
  invitationId;
const checks = {};
const save = () =>
  writeFileSync(
    journal,
    JSON.stringify({
      run,
      sender: sender?.id,
      recipient: recipient?.id,
      senderId,
      linkId,
      invitationId,
    }),
    { mode: 0o600 },
  );
function check(condition, label) {
  if (!condition) throw Error(label);
  checks[label] = true;
}
async function api(method, path, body) {
  const r = await fetch(`https://api.clerk.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
    redirect: "error",
  });
  if (!r.ok) throw Error(`Clerk status ${r.status}`);
  if (r.status === 204) return null;
  const data = await r.json();
  return path.startsWith("/invitations?") && Array.isArray(data)
    ? { data }
    : data;
}
async function login(p, email) {
  await p.goto(`${origin}/sign-in`);
  await p.locator('input[name="identifier"]').fill(email);
  await p.getByRole("button", { name: "Continue", exact: true }).click();
  await p.locator('input[name="password"]').fill(password);
  await p.getByRole("button", { name: "Continue", exact: true }).click();
  await Promise.race([
    p.waitForURL((u) => u.pathname === "/app", { timeout: 30000 }),
    p
      .locator('input[autocomplete="one-time-code"]')
      .first()
      .waitFor({ timeout: 30000 }),
  ]).catch(() => {});
  const code = p.locator('input[autocomplete="one-time-code"]').first();
  if (await code.isVisible().catch(() => false)) {
    await code.fill("424242");
    const verify = p.getByRole("button", { name: /^(Continue|Verify)$/ });
    if (await verify.isVisible().catch(() => false)) await verify.click();
  }
  await p.waitForURL((u) => u.pathname === "/app", { timeout: 40000 });
}
try {
  const instance = await api("GET", "/instance");
  check(instance.environment_type === "development", "developmentInstance");
  console.log(
    JSON.stringify({
      configuration: {
        developmentKeys: true,
        localDatabase: true,
        registrationLocalOnly: true,
        redisConfigured: true,
        invitationSigningConfigured: true,
      },
    }),
  );
  const testing = await api("POST", "/testing_tokens");
  const fapi = Buffer.from(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.split("_").slice(2).join("_"),
    "base64",
  )
    .toString()
    .replace(/\$$/, "");
  if (!fapi.endsWith(".clerk.accounts.dev"))
    throw Error("Development frontend required");
  browser = await chromium.launch();
  const senderContext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const recipientContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const anonymous = await browser.newContext();
  for (const context of [senderContext, recipientContext]) {
    context.setDefaultTimeout(20000);
    context.setDefaultNavigationTimeout(45000);
    await context.route(`https://${fapi}/v1/**`, async (route) => {
      const target = new URL(route.request().url());
      target.searchParams.set("__clerk_testing_token", testing.token);
      await route.continue({ url: target.href });
    });
  }
  const s = await senderContext.newPage();
  page = s;
  const policyResponse = s.waitForResponse(
    (r) => new URL(r.url()).pathname === "/v1/environment" && r.ok(),
  );
  await s.goto(`${origin}/sign-in`);
  const policy = await (await policyResponse).json();
  check(
    policy.auth_config?.test_mode === true &&
      policy.user_settings?.sign_up?.mode === "restricted",
    "inviteOnlyAndTestMode",
  );
  stage = "sender-fixture";
  sender = await api("POST", "/users", {
    email_address: [senderEmail],
    password,
    private_metadata: { margin_invitation_journey: run },
  });
  save();
  const issuer = await db.user.create({
    data: {
      clerkId: sender.id,
      account: {
        create: {
          status: "ACTIVE",
          displayName: "Invitation test sender",
          username: `sender_${run.slice(0, 16)}`,
          invitationsRemaining: 3,
          invitationAllowanceGrantedAt: new Date(),
          onboardedAt: new Date(),
          ageConfirmedAt: new Date(),
          emailVerifiedAt: new Date(),
        },
      },
    },
  });
  senderId = issuer.id;
  save();
  stage = "sender-login";
  await login(s, senderEmail);
  stage = "issue-via-friends";
  await s.goto(`${origin}/app/friends`);
  await s.getByRole("button", { name: "Invite someone", exact: true }).click();
  const dialog = s.getByRole("dialog", { name: "A small circle starts here." });
  await expect(dialog.getByText(/3 of 3 invitations remaining/)).toBeVisible();
  await dialog.getByRole("button", { name: "Copy link", exact: true }).click();
  const linkField = dialog.getByLabel("Your invitation link");
  await expect(linkField).toBeVisible();
  const linkUrl = await linkField.inputValue();
  const link = await db.invitationLink.findFirstOrThrow({
    where: { createdBy: senderId },
  });
  linkId = link.id;
  save();
  check(
    link.maxRedemptions === 1 && !link.community && link.acceptedCount === 0,
    "personalSingleSeat",
  );
  check(link.expiresAt - link.createdAt === 30 * 86400000, "thirtyDayDeadline");
  check(
    (await db.account.findUniqueOrThrow({ where: { userId: senderId } }))
      .invitationsRemaining === 2,
    "allowanceConsumedAtIssue",
  );
  await s.screenshot({ path: ".local/invitation-journey/share-desktop.png" });
  stage = "preview-safe";
  const a = await anonymous.newPage();
  await a.goto(linkUrl);
  await anonymous.request.head(linkUrl);
  check(
    (await db.invitationLink.findUniqueOrThrow({ where: { id: linkId } }))
      .acceptedCount === 0 &&
      (await db.invitation.count({ where: { linkId } })) === 0,
    "previewDoesNotClaimOrSend",
  );
  check(
    !(await anonymous.cookies()).some((c) => c.name === "margin_invitation"),
    "previewDoesNotSetClaimCookie",
  );
  const p = await recipientContext.newPage();
  page = p;
  stage = "recipient-email";
  await p.goto(linkUrl);
  await p.getByLabel("Your email address").fill(recipientEmail);
  await p
    .getByRole("button", { name: "Email my invitation", exact: true })
    .click();
  await expect(
    p.getByRole("status").getByText(/Check your inbox/),
  ).toBeVisible();
  await p.screenshot({ path: ".local/invitation-journey/email-mobile.png" });
  const claim = await db.invitation.findFirstOrThrow({
    where: { linkId, email: recipientEmail },
  });
  invitationId = claim.id;
  save();
  check(
    Boolean(claim.clerkInvitationId) &&
      claim.expiresAt.getTime() === link.expiresAt.getTime(),
    "individualProviderInvitationBound",
  );
  stage = "provider-ticket";
  const remote = (
    await api(
      "GET",
      `/invitations?query=${encodeURIComponent(recipientEmail)}&limit=100`,
    )
  ).data.find((x) => x.id === claim.clerkInvitationId);
  check(
    Boolean(remote?.url) &&
      remote.public_metadata?.marginInvitationId === claim.id,
    "providerTicketAvailable",
  );
  await p.goto(remote.url);
  await expect(
    p.getByRole("heading", { name: "Your invitation is here." }),
  ).toBeVisible();
  const claimUrl = p.url();
  await s.goto(claimUrl);
  await expect(
    s.getByRole("heading", { name: "Use your invited account." }),
  ).toBeVisible();
  check(
    !(await senderContext.cookies()).some(
      (c) => c.name === "margin_invitation",
    ),
    "wrongAccountDoesNotClaim",
  );
  await p.getByRole("button", { name: "Continue to account setup" }).click();
  await p.waitForURL((u) => u.pathname === "/sign-up");
  const cookie = (await recipientContext.cookies()).find(
    (c) => c.name === "margin_invitation",
  );
  check(
    cookie?.httpOnly &&
      cookie.sameSite === "Lax" &&
      cookie.expires - Date.now() / 1000 <= 1801 &&
      cookie.expires - Date.now() / 1000 > 1700,
    "thirtyMinuteClaimCookie",
  );
  stage = "provider-signup";
  await p.locator('input[name="password"]').fill(password, { timeout: 30000 });
  const confirm = p.locator('input[name="confirmPassword"]');
  if (await confirm.isVisible().catch(() => false))
    await confirm.fill(password);
  await p.getByRole("button", { name: /^(Continue|Create account)$/ }).click();
  await p.waitForURL((u) => u.pathname === "/onboarding", { timeout: 45000 });
  const users = await api(
    "GET",
    `/users?email_address=${encodeURIComponent(recipientEmail)}`,
  );
  recipient = users.find((u) =>
    u.email_addresses.some((e) => e.email_address === recipientEmail),
  );
  check(
    recipient?.public_metadata?.marginInvitationId === claim.id,
    "providerSignupThroughInvitation",
  );
  save();
  stage = "onboarding";
  await p
    .getByLabel("Your name", { exact: true })
    .fill("Invitation test recipient");
  await p
    .getByLabel("Username", { exact: true })
    .fill(`invitee_${run.slice(0, 16)}`);
  await p.getByRole("checkbox", { name: "I am 18 or older." }).check();
  await p.getByRole("button", { name: "Save profile", exact: true }).click();
  await p.waitForURL((u) => u.pathname === "/app", { timeout: 30000 });
  await expect(
    p.getByRole("heading", { name: "Invitation test recipient", exact: true }),
  ).toBeVisible();
  await expect(
    p.getByRole("button", { name: "Check approval status" }),
  ).toHaveCount(0);
  const account = await db.account.findFirstOrThrow({
    where: { user: { clerkId: recipient.id } },
  });
  check(
    account.status === "ACTIVE" &&
      account.invitationsRemaining === 3 &&
      Boolean(account.invitationAllowanceGrantedAt),
    "automaticActivationWithThreeInvitations",
  );
  check(
    (await db.invitationLink.findUniqueOrThrow({ where: { id: linkId } }))
      .acceptedCount === 1,
    "singleRedemption",
  );
  check(
    (await db.invitation.findUniqueOrThrow({ where: { id: claim.id } }))
      .claimedBy === recipient.id,
    "claimLinkedToSubject",
  );
  check(
    (await db.friendship.count({
      where: { OR: [{ lowId: senderId }, { highId: senderId }] },
    })) === 0,
    "noAutomaticFriendship",
  );
  stage = "member-entry";
  await expect(
    p.getByRole("heading", { name: "Invitation test recipient", exact: true }),
  ).toBeVisible();
  await p.goto(`${origin}/app/friends`);
  await p.getByRole("button", { name: "Invite someone", exact: true }).click();
  await expect(
    p.getByRole("dialog").getByText(/3 of 3 invitations remaining/),
  ).toBeVisible();
  await p.keyboard.press("Escape");
  stage = "private-post-fixture";
  const publish = await senderContext.request.post(
    `${origin}/api/posts/publish`,
    {
      headers: { Origin: origin },
      data: { body: `Private invitation journey ${run}`, photoIds: [] },
    },
  );
  check(publish.status() === 201, "privatePostCreated");
  const post = await db.post.findFirstOrThrow({ where: { ownerId: senderId } });
  const privateRead = () =>
    recipientContext.request.get(`${origin}/api/posts/${post.id}`);
  check((await privateRead()).status() === 404, "nonFriendPostDenied");
  stage = "request-friend";
  await p.goto(`${origin}/app?person=${senderId}`);
  await expect(p.getByRole("article")).toHaveCount(0);
  await p.getByRole("button", { name: "Add friend", exact: true }).click();
  await expect(p.getByText("Request sent", { exact: true })).toBeVisible();
  check((await privateRead()).status() === 404, "pendingFriendPostDenied");
  const pending = await db.friendship.findFirstOrThrow({
    where: { requesterId: account.userId },
  });
  check(pending.status === "PENDING", "explicitRequestPending");
  stage = "mutual-accept";
  page = s;
  await s.goto(`${origin}/app/friends`);
  await s.getByRole("tab", { name: "Requests", exact: true }).click();
  await s.getByRole("button", { name: "Accept request", exact: true }).click();
  await expect
    .poll(
      async () =>
        (
          await db.friendship.findUniqueOrThrow({
            where: {
              lowId_highId: { lowId: pending.lowId, highId: pending.highId },
            },
          })
        ).status,
    )
    .toBe("ACCEPTED");
  const acceptedRead = await privateRead();
  console.log(JSON.stringify({ acceptedReadStatus: acceptedRead.status() }));
  check(acceptedRead.status() === 200, "acceptedFriendCanRead");
  await p.goto(`${origin}/app?person=${senderId}`);
  await expect(p.getByRole("article")).toContainText(
    `Private invitation journey ${run}`,
  );
  const anonymousRead = await anonymous.request.get(
    `${origin}/api/posts/${post.id}`,
    { maxRedirects: 0 },
  );
  check(
    anonymousRead.status() === 307 &&
      new URL(anonymousRead.headers().location).origin ===
        `https://${fapi.replace(".clerk.accounts.dev", ".accounts.dev")}` &&
      new URL(anonymousRead.headers().location).pathname === "/sign-in" &&
      !(await anonymousRead.text()).includes(
        `Private invitation journey ${run}`,
      ),
    "anonymousPostDenied",
  );
  stage = "used-link";
  await a.goto(linkUrl);
  await expect(a.getByText(/already been used.*new invitation/)).toBeVisible();
  await expect(a.getByLabel("Your email address")).toHaveCount(0);
  check(
    (
      await anonymous.request.post(
        `${origin}/api${new URL(linkUrl).pathname}`,
        {
          headers: { Origin: origin },
          data: { email: `other-${run}+clerk_test@example.com` },
        },
      )
    ).status() === 410,
    "usedLinkCannotSendAgain",
  );
  console.log(
    JSON.stringify({
      passed: true,
      checks,
      services: {
        clerk: "real development",
        redis: "real development",
        postgres: "real local",
        emailDelivery: "provider ticket, no inbox",
        botProtection:
          "official Clerk testing token in automated contexts only",
        browser: "real Chromium desktop/mobile viewports",
      },
    }),
  );
} catch (error) {
  console.log(
    JSON.stringify({
      passed: false,
      stage,
      failure: error.constructor.name,
      assertion: /^[a-zA-Z][a-zA-Z0-9]+$/.test(error.message)
        ? error.message
        : "Browser or database assertion; credentials and URLs withheld",
      checks,
    }),
  );
  if (page) {
    await page
      .screenshot({
        path: ".local/invitation-journey/failure.png",
        fullPage: true,
      })
      .catch(() => {});
    console.log(
      JSON.stringify({
        heading: await page
          .locator("h1")
          .allTextContents()
          .catch(() => []),
        alerts: await page
          .getByRole("alert")
          .allTextContents()
          .catch(() => []),
      }),
    );
  }
  process.exitCode = 1;
} finally {
  await browser?.close();
  // Recover a provider-created recipient if an assertion interrupted journal capture.
  if (sender && !recipient) {
    const found = await api(
      "GET",
      `/users?email_address=${encodeURIComponent(recipientEmail)}`,
    );
    recipient = found.find(
      (u) =>
        u.email_addresses.some((e) => e.email_address === recipientEmail) &&
        u.public_metadata?.marginInvitationId === invitationId,
    );
    if (recipient) save();
  }
  if (sender) {
    const proof = await api("GET", `/users/${sender.id}`);
    if (proof.private_metadata?.margin_invitation_journey !== run)
      throw Error("Unmarked sender cleanup refused");
    if (recipient) {
      const proof = await api("GET", `/users/${recipient.id}`);
      if (
        !proof.email_addresses.some(
          (e) => e.email_address === recipientEmail,
        ) ||
        proof.public_metadata?.marginInvitationId !== invitationId
      )
        throw Error("Unmarked recipient cleanup refused");
    }
    const localSender = await db.user.findUnique({
      where: { clerkId: sender.id },
    });
    if (localSender) {
      senderId = localSender.id;
      const invitations = await db.invitation.findMany({
        where: { createdBy: senderId },
      });
      for (const invite of invitations) {
        if (!invite.clerkInvitationId) continue;
        const matches = (
          await api(
            "GET",
            `/invitations?query=${encodeURIComponent(invite.clerkInvitationId)}&limit=100`,
          )
        ).data;
        const remote = matches.find((i) => i.id === invite.clerkInvitationId);
        if (remote?.status === "pending")
          await api("POST", `/invitations/${remote.id}/revoke`);
      }
      await db.invitation.deleteMany({ where: { createdBy: senderId } });
      await db.invitationLink.deleteMany({ where: { createdBy: senderId } });
    }
    await db.user.deleteMany({
      where: {
        clerkId: { in: [sender.id, ...(recipient ? [recipient.id] : [])] },
      },
    });
    if (recipient) await api("DELETE", `/users/${recipient.id}`);
    await api("DELETE", `/users/${sender.id}`);
    if (existsSync(journal)) unlinkSync(journal);
    console.log(
      "Marked disposable identities, invitations and local data removed.",
    );
  }
  await db.$disconnect();
}
