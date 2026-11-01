# Account flows and limited launch

## Implemented in the development website

The welcome header, hero and closing invitation link to `/sign-up`; Sign in links to `/sign-in`. The retired `/join` URL redirects to signup. Coming-soon messaging is removed from those entry points. The invitation field is disabled when registration/authentication configuration is missing, with an explicit unavailable state. Local profile setup and account-free exploration use direct development links, with one brief preview notice. Sign-in and signup cards share a centered responsive frame, expanding the page for taller forms. Clerk’s configured sign-in form disables automatic signup transfer; invitations still require the server gate and provider restrictions described below.

Account controls sit outside the mobile-only utility section, making them visible in both desktop and mobile menus. Managed sign-out uses Clerk’s session-ending method and redirects to welcome; local exit uses a full navigation to discard tab memory. Sign-out remains a quiet, direct action with busy and retry states, rather than a destructive confirmation. Provider-level sign-out tests mock Clerk; live session revocation remains unverified here.

- Edit Profile exposes a portrait pencil. The existing picker chooses an owned photograph or validates a new JPEG/PNG/WebP. Using a new gallery photograph observes the shared daily allowance and requires a replacement at twenty. Replacement preserves photographs used by older posts; deleting a photograph removes its portrait reference too.
- `/sign-in`, `/sign-up` and `/onboarding` share the restrained composer surfaces. A fresh local profile clears seeded posts, friendships, media, interactions, conversations and notifications. The empty feed offers a personal invitation.
- Menus and Settings expose sign-in/security controls and sign-out (or exit preview). Public/help/legal logo links return signed-in visitors to `/`; public visitors retain the public destination.
- Own comments can be edited with an Edited note or deleted into a tombstone. Replies retain their parent reference. The local boundary rejects edits to another author’s comments and restoration after deletion.
- Profile, post, comment and conversation reports are saved in tab memory, disclosed as local, and listed in Settings. Existing blocks can be managed there. A block does not restore an old friendship on unblock.
- Settings exports selected categories: profile/music, posts, photographs/gallery, comments/likes, friends/requests/blocks, conversations, Notebook, drafts, notifications/preferences and saved reports. A conversation header starts with only that conversation selected. ZIP contains readable PDF, JSON and selected original media; standalone PDF embeds JSON and media attachments. JSON alone contains records only. Embedded JSON preserves Unicode unsupported by the PDF font. Owned profile portraits are included even when outside the active gallery. Missing selected originals fail visibly rather than silently producing an incomplete archive.

These are local preview flows. Data lasts for the tab’s provider lifetime, not refresh. No browser storage was added. The export explicitly excludes unconnected hosted authentication and server account records; it is not a complete real-account export or an erasure request. Real account erasure remains unavailable. Production `/` is still the public website; the authenticated feed loader is a separate integration prerequisite.

## Invitation enforcement foundations

Registration remains off unless `MARGIN_REGISTRATION_ENABLED=1`. The migration adds hashed, expiring invitation records, account onboarding/age-confirmation timestamps, invitation quotas (default zero), and safety reports. It has **not been applied** by this change.

The invitation server action verifies a high-entropy code through a bounded Redis gate and stores it in a short-lived HTTP-only cookie. Onboarding verifies the Clerk subject and verified email, optionally binds the invitation to that email, and claims the code in a serializable transaction. Claimed invitations can be retried only by the same subject. A claim creates a PENDING account and never activates it. Deactivated accounts are rejected. Application social access still requires the existing active-account gate. A user must not be activated until onboarding is complete.

Clerk may create an authentication identity before application onboarding. Configure Clerk’s registration restrictions and disable unwanted signup paths in staging; an app page by itself cannot restrict Clerk’s external registration API. An uninvited Clerk identity does not grant an active Margin account. Public metadata is written only by the server action; it does not bypass the account gate.

`POST /api/invitations` requires the private-backend gate, verified identity, active account, same-origin mutation protection, rate limit and an atomic positive quota decrement. Codes expire in seven days and are returned only when created. Budget starts at zero; operators decide allocations. No email delivery was added.

After approved migration/provider configuration, an operator can provision the initial code with Node 22:

```sh
umask 077
node --experimental-strip-types --env-file-if-exists=.env scripts/create-invitation.mjs > .local/first-invitation.txt
```

An optional `MARGIN_INVITATION_EMAIL` environment variable binds it to a verified address. Treat the output as a credential, share it privately, and remove the local copy when no longer needed. Do not run this command in logging CI. No code was issued while implementing this change.

## Safety and remaining live integration

`POST /api/reports` uses the private backend’s auth/origin/rate boundaries. The service verifies an active actor, target identity and readable unexpired post audience, rejects self reports, and stores minimal target references plus the chosen reason and optional details. Only profile/post reports have live server models. Comment/message live report submissions are rejected until real participant authorization exists. The fixture UI intentionally saves reports locally instead of sending fixture IDs as real content.

Before inviting real users: connect the authenticated app loader and all mutations; implement authorized persistent comment/message models and their exports; provide restricted reviewer tooling, report handling/appeal procedures and retention; connect full account access and erasure; verify Clerk recovery/session controls and invitation-claim concurrency in staging. No production database, provider settings or deployment was changed. Legal drafts remain pending review.

## Evidence

Focused local tests cover photo ownership and full-gallery replacement, comment ownership/edit/tombstones, fresh onboarding, selected export isolation, invitation digest/expiry/replay checks, message navigation state, and export download activation. A generated PDF was reopened to verify pagination and lossless attachments, then rendered with macOS PDFKit for visual inspection (Poppler was unavailable). Desktop and mobile browser checks cover onboarding, portrait selection and selected JSON download. Provider/DB concurrency and real Clerk registration are not established by these local tests.
