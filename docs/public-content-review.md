# Public content review

Updated November 4, 2026. This is an internal release record, not customer copy or legal approval. The public documents speak directly to customers in American English. Help describes the authenticated application, not development demonstrations. The policy pages keep a short draft notice without exposing the internal launch checklist.

## Confirmed scope

- The owner confirmed a working `support@margin.social` inbox for support, privacy, safety, review requests, and copyright concerns.
- Margin is independently operated from California. The owner requested that personal identity and home-address details remain unpublished. No incorporated entity, legal operator name, business address, or registered copyright agent has been invented.
- Launch is intended for adults 18 and older in the United States. **No geographic access enforcement was found in the current source.** U.S.-only language describes launch intent; it is not evidence of a working geofence, U.S.-only processing, or an exemption from other laws.
- This change does not deploy the site, accept an agreement, provision services, implement geographic restrictions, or change authentication, retention, or moderation policy enforcement.

## Claim-to-implementation review

All rows concern the current source. The full local verification for release commit `126fc6d` passed before this content change. That evidence is not hosted-provider verification. Only focused public-content checks apply to this edit.

| Customer disclosure | Exact behavior and enforcement | Evidence | Exceptions and release owner |
| --- | --- | --- | --- |
| Mutual friendships and limited audiences | Personal posts, Gallery, On Repeat, and visible Top 4 require self/friend access. Profile introduction is discoverable by eligible signed-in members. Space posts require eligible membership, not necessarily friendship. | `src/server/social/service.ts`, `src/server/member/top-friends.ts`, `src/server/spaces/access.ts`; database authorization regressions | Recipients can save copies; founder report review is a separate boundary. Engineering/security: verify hosted sessions and media access. |
| Daily allowances and time zones | Shared posting constants; saved IANA time zone; deletion-resistant publication ledger; recent usage carried for at least 24 hours after zone changes. | `src/lib/platform-rules.ts`, `src/lib/posting-day.ts`, social/member services; posting and remediation database tests | Fictional demonstration clock differs and is not customer guidance. Engineering: preserve transaction and quota checks. |
| Photo privacy processing, not automated moderation | File/type/dimension checks; decoder re-encoding strips embedded source metadata; private stored original with authorized delivery. No classifier or automated harmful-content review. | `src/server/social/photo.ts`, `src/server/member/photo-visibility.ts`; real-decoder and private-media database tests | Visible faces, addresses, and landmarks remain identifying. Security/operator: verify R2 privacy and access in hosting. |
| Reports and founder enforcement | Founder-only report queue; available reported target access; recorded disposition; post/message/photo removal and deactivation. No unrestricted private-inbox browser. | `src/server/safety/service.ts`, `src/features/safety/moderation-schema.ts`; founder and concurrent-decision regressions | Reported comments have stored references/details, not a dedicated comment-removal action. Operator: confirm response coverage, decision notices, manual appeal handling, urgent escalation, and retention. No SLA or 24/7 promise. |
| Message and Notebook privacy/expiration | Server persistence; no E2EE; 30-day messages and 90-day notes excluded from reads and exports after expiry. | `src/lib/message-policy.ts`, member service, `src/server/jobs/README.md`; communication and retention database tests | Hosted worker installation and health not verified. Operator/engineering: deploy and monitor maintenance, verify deletion and restore behavior. |
| Gallery removal and post deletion | One canonical photo; post deletion preserves other references unless photo deletion chosen; global photo deletion removes placements and denies access before storage cleanup. | social/member services; media lifecycle/database regressions | Archived legacy references can prevent a deletion. Storage cleanup can fail and retry. Upload marker remains for 48 hours plus later sweep. |
| Account downloads and deactivation | Saved-account archive/PDF includes selected available records/media; drafts excluded. Deactivation removes active shared content/access, not complete provider and backup erasure. | `src/features/social/member-data-controls.tsx`, member export, social deactivation; export/database tests | Remaining account, comment, report, review, provider, and backup records require assisted erasure. Operator/legal: establish verification, completion, exceptions, and response handling. |
| Cookies, browser storage, and diagnostics | Clerk/invitation cookies; cosmetic logo playback localStorage marker; tab drafts; no product-analytics or advertising integration; optional sanitized Sentry, no replay. No application DNT-specific behavior found. | `src/components/auth/login-session.ts`, account invitation code, monitoring sanitizer and actual outbound-event tests | Exact hosted cookie inventory, provider logs/regions/contracts, GPC applicability, and required choices not verified. Operator/security/legal: inspect actual deployment. |
| Accessibility | Reading/motion settings, focus handling, keyboard controls, alternatives to dragging; uploaded photographs need not have useful text alternatives. | Shared components/styles and targeted accessibility/browser checks | No complete WCAG audit or conformance claim. Design/engineering: review real assistive technology and known image limitations. |

## Legal and operational gates before publication as final

1. Have qualified California counsel determine the contracting operator disclosure and appropriate business/agent contact without publishing a home address unnecessarily. Keeping a person out of the copy does not create an entity or limit personal liability.
2. Review CalOPPA separately from CCPA/CPRA applicability and thresholds, other U.S. state privacy/consumer rules, required disclosures, request timing, DNT/GPC treatment, and any rights or appeals process. Do not claim small size or U.S. geofencing removes all obligations.
3. Confirm and implement the U.S. launch restriction at the trusted edge/server boundary, decide its exact scope and treatment of uncertain location/VPNs, and test it. No geofence was added in this content task.
4. Verify the hosted vendor inventory: actual hosting, Clerk, PostgreSQL, private R2, Upstash, optional Sentry, music catalog, and support email provider; processing locations, contracts, log retention, and exact cookies. Avoid unnecessary optional tracking.
5. Approve backup rotation and deletion completion targets, report/review/security/account retention schedules, narrow lawful holds, restoration/redeletion, and complete Clerk/account erasure. Draft pages deliberately do not invent fixed deadlines.
6. Verify inbox delivery and manual workflows for privacy requests, inaccessible-account support, reports, accessibility, and review requests. The owner confirmed the inbox works; this edit did not send test mail or promise a service level. Resolve lawful notices and data verification securely.
7. Review/register a U.S. DMCA designated agent if pursuing Section 512 protection, publish the required contact, and implement compliant notice, counter-notice, notice-to-uploader, reinstatement, and repeat-infringer processes. The support inbox is not claimed to be a registered agent. No safe-harbor eligibility is promised.
8. Review the proposed limited content license, availability and liability provisions, service changes/closure, and dispute terms. No arbitrary damages cap, indemnity, arbitration, class-action waiver, exclusive venue, or blanket surrender of rights was added. Draft disclaimer wording is not a legal shield.
9. Review adult eligibility, suspected underage-account handling, and child-safety reporting obligations. An 18+ declaration is not verified age assurance or a complete child-safety process.
10. Set approved effective dates and a valid acceptance/notice/version-record process only after legal and operational sign-off. The public draft notice remains until then; these pages are not a completed launch approval.

## Primary sources consulted

Reviewed November 4, 2026. These identify questions for qualified review; they do not establish which laws apply or certify compliance. No source text was copied into a policy.

- [FTC: Protecting Personal Information](https://www.ftc.gov/business-guidance/resources/protecting-personal-information-guide-business): inventory, minimization, restricted access, retention, and incident planning.
- [California Attorney General: CCPA](https://oag.ca.gov/privacy/ccpa): applicability, rights, and business obligations need factual review.
- [California Attorney General: privacy policy and Do Not Track guidance](https://www.oag.ca.gov/news/press-releases/attorney-general-kamala-d-harris-issues-guide-privacy-policies-and-do-not-track): CalOPPA disclosures are a separate review topic.
- [U.S. Copyright Office: Section 512](https://www.copyright.gov/512/) and [designated agents](https://www.copyright.gov/dmca-directory/): conditional safe harbors, notices, counter-notices, agent publication, and registration.
- [FTC: COPPA FAQs](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions): the page points to the amended rule; adult-only intent does not resolve actual-knowledge situations.
- [W3C: WCAG 2.2](https://www.w3.org/TR/WCAG22/): assessment reference, not certification.
