# Margin interface direction

## Status and purpose

Welcome-page direction implemented November 5, 2026 following the owner's supplied Jodi Neufeld Design homepage reference. The owner specified one continuous hero on desktop and mobile: centered headline, introduction and primary action on Deep Slate Olive with Parchment text and no background photograph. The former separate finite-feed demonstration is now removed. The November 6 copy revision leads with “A feed that ends. Imagine.”, followed by the full social-space introduction and then the invitation button. The feed demo and its flip controls are removed; the extra Why Margin link beside the feed is removed. Existing content, product behavior, typography and semantic color variables remain authoritative.

The reference contributes a clear sequence of introduction, demonstration, explanation and next step, with varied section proportions and deliberate changes of surface. Its annotations describe conversion goals; the screenshot provides no evidence of conversion performance. Margin's goal is informed interest in a social media website and an understandable invitation process.

## Welcome page sequence

The November 6 refinement keeps the centered Ink hero and gives its next line a concrete explanation: “A private social space for the people you actually know. Invite-only. Three posts a day. No ads, no algorithm.” The primary action is “Membership by invitation” (`/how-it-works`); “See how it feels” sits beneath it and scrolls to the public messages preview. Both hero actions are centered; mobile introductory copy uses body size. The link targets the message illustration itself. Header logo brackets use Olive.

The “All caught up.” feed section, desktop card stack and flip controls are removed. The “Less audience. More friends.” message band uses the same light cream background as the page with Ink text, without a preface, afterword caption, date label or trailing message time. On its first viewport entry, the final incoming message follows a 1.2-second typing ellipsis and a gentle 320ms arrival. Its space is reserved to avoid page movement. System and account reduced-motion preferences show the complete conversation immediately; full message text remains in server markup and available without JavaScript. All arrow text links share the hero link’s `--text-control` size and 1.5 line height, becoming bold on hover and keyboard focus. Open How it works with the full-width beach image, bottom-aligned crop and vertically centered medium-weight white caption “Nothing more to catch up on. Somewhere better to be.” without shadow or fade. Its three unnumbered off-white cards use Olive headings, with Ink body text and links. The commitments strip stays Ink. On mobile it loops slowly on one line without visible controls; reduced-motion settings use a stationary, manually scrollable line. Keep mobile words vertically centered in a 64px band. Pause on focus, press or supported hover. Desktop stays static. Use “Three photos a day. A gallery of twenty.” as the gallery heading, omit the explanation and photograph captions, and follow it directly with the closing invitation. The founder note and portrait remain exclusively in About. Omit the separate privacy-summary section from Welcome.

The closing invitation remains Cinnamon. Place the private waitlist after the “For the people” heading and invitation explanation. Omit the closing invitation link and use a compact 20px gap before the waitlist. Retain the small invitation-news helper note below the form. The list records an email and consent timestamp, creates no account and promises no guaranteed invitation. Do not imply automatic email delivery. Signed-out navigation includes the logo, two information links, Sign in and the invitation action, wrapping on small screens. Signed-in visitors retain member navigation. The footer explicitly labels Explore, Support, Legal and Your information. Testimonials remain absent until real member quotes are supplied.

## Reusable visual and organizational principles

1. **Give every section a job.** Introduce, demonstrate, explain or enable an action. Merge passages that answer the same question. A title and description alone rarely justify a large colored banner.
2. **Use one alignment system.** Welcome uses a 1120px content grid shared by its header, features, gallery and footer. Full-width surfaces may contain a centered content grid. Align section copy, visuals and actions to its recurring edges; keep paragraphs at a comfortable reading measure instead of stretching them across the page.
3. **Build rhythm with proportion.** Alternate an opening composition, image-and-copy splits, a compact statement band and a closing invitation. Use consistent spacing tokens within that variation. Section height follows its content rather than a fixed viewport height.
4. **Let color communicate a role.** Use the shared palette and semantic interaction variants. Use the neutral Warm Paper background (`#EEEDE7`), Deep Slate Olive ink and contrast surfaces (`#282820`), Olive actions (`#777536`) and Cinnamon emphasis (`#C99B61`) through semantic variables. Muted Olive marks hover and selected conversation states. Olive on dark surfaces uses the lighter `#99964E` variant with Ink labels inside filled actions. Preserve white feeds and off-white cards. A large color change should mark a meaningful transition; not every section needs a different fill.
5. **Keep type roles recognizable.** Preserve Margin Aside headings, Inter explanations and controls, and the established post font within examples. Make page purpose clear with headings and scale. Do not add Support, Legal, Explore or similar eyebrow labels above page titles.
6. **Show the social experience.** Use the existing feed, conversation, messages and gallery examples to substantiate nearby copy. Keep public examples fictional and separate from private member data. A screenshot or decorative illustration must not replace an existing usable demonstration.
7. **Make actions explain their destination.** Give each section a clear next step only when useful. Repeat an action at a different decision point when justified, without placing the same call to action after every paragraph. Retain accurate Sign in, membership and invitation wording.
8. **Use frames purposefully.** Cards group objects or contain interactive examples; bands mark transitions; rules separate related content. Signature brackets use the shared brand artwork at a few meaningful framing points, with space around them. Avoid adding brackets to every section.
9. **Design the mobile reading order first.** The heading, explanation, example and relevant action must make sense in document order. Desktop may pair them in columns. On phones, stack without fixed heights, tiny text, obscured content or sideways scrolling; preserve comfortable targets and visible focus.
10. **Provide a calm ending.** Explain what happens next, then let the page finish. Avoid urgency, invented popularity, manufactured testimonials or extra sections added merely to lengthen the page.

## Applying the principles beyond Welcome

Share typography, grid logic, spacing, surface roles, framing and action hierarchy across pages. Adapt the sequence to the task:

- **Why Margin:** a clear premise, supporting reasons, then a route to How it works.
- **How it works:** a practical progression through invitations and social features, with examples near their explanation.
- **Help and policies:** a clear title, short introduction and findable content sections. Keep instructions and policy wording direct; illustrations and promotional bands should not interrupt a reading task. Preserve draft legal status and existing operational disclosures.
- **Signed-in pages:** a concise page identity, task controls and content. Spaces, Messages and profiles should inherit the visual language while keeping their useful application layouts. Do not import the welcome page's long promotional sequence into everyday tasks.

## Implementation acceptance criteria

- Preserve current copy, destinations, invitation restrictions and demo interactions unless a separate change is approved.
- Keep the feed/conversation demo keyboard-operable with its existing focus restoration and reduced-motion behavior.
- Verify actual local Welcome and its signed-in header state, narrow mobile, desktop and enlarged text. Ensure all content remains readable without entrance animations.
- Check text, controls and focus indicators against their final surfaces, especially Cinnamon and Deep Slate Olive sections. Existing palette checks are useful but do not establish the accessibility of a new composition.
- Check image crops and captions, consistent content edges, section spacing and the mobile reading order. Do not infer usability or conversion results from visual inspection alone.
- Reuse canonical components and styles; replace superseded layout rules rather than layering overrides. Keep these principles and the implemented-style documentation aligned when the design changes.
