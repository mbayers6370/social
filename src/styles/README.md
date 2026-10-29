# Stylesheet conventions

`globals.css` owns Tailwind layers, base typography, native fields, focus, and global motion preferences. `application.css` is the single ordered feature-style manifest; it loads shared components before their consumers. `tokens.css` defines the palette, type scale, spacing, and shared layout geometry.

Each full selector has one owning stylesheet. Keep its responsive, interaction, and reduced-motion variants together. Feature-specific contextual selectors belong with that feature. Run `npm run styles:check` to catch repeated imports, orphan stylesheets, and conflicting ownership.

## Shared design rules

- Body copy, forms, labels, and controls use Inter. Headings and the wordmark use Caudex. Section headings use title case, such as Recent Posts and Your Photographs; body copy remains in sentence case.
- Entry text and labels start at 1rem. Small notes share 0.75rem, 400-weight Inter, 1.5 line height, and `--note-foreground`.
- Use spacing tokens: related details 8px, groups 24px, sections 32px, and larger breaks 48px.
- Divider lines inside cards and menus run edge to edge; inset the content instead of the line.
- Action buttons use the shared `--radius-control` (8px), including icon buttons. Avatars and status dots remain circular; message bubbles and photographs retain their own shapes. Messages use the envelope icon; post conversations use the speech bubble.
- Interactive controls retain at least 44px targets, visible keyboard focus, and reduced-motion alternatives.
- Dropdowns and selection lists inset their rounded hover/focus surfaces by `--menu-inset`; hover fills never meet the menu shell edge.
- Photographs use the shared 12px radius. Preserve full photographs in uncropped viewers and maintain aspect ratios.

## Palette and branding

Parchment `#FAF9F6`, Ink `#30383D`, Citron `#B9C65A`, and Blackened Olive `#454D24` are the base palette. Navigation uses Olive with Parchment labels; selected mobile destinations use Citron icons and labels without a background highlight. Notification dots use Citron.

Shared home links use the lowercase Caudex wordmark and angled framing marks. Mobile uses a smaller wordmark. Browser and Apple icons use only the two framing marks. Original brand artwork remains unmodified.

## Surface hierarchy

Use Citron for invitations and primary actions. The feed composer uses a warm-white card with an Inter body prompt and a Citron photograph button outlined in Blackened Olive, with a matching olive icon. The profile’s New Post control uses the same soft green as its section header, with a darker olive border and text. Desktop file dropping starts the photograph flow after validation and allowance checks; an image description remains required. Use `--surface-heading` for the identity band on standalone feed posts and populated profile-section headers; keep writing and photographs on the warm card surface. Do not add another tinted band to every post inside a profile's existing reading stream.

Empty gallery and recent-post sections use a heading, divider and useful copy without another enclosing card. On Repeat keeps its card and soft-green title band in both empty and populated states. Menus use the shared inset and rounded control shape, including their focus/hover states. Device photograph selection keeps one real keyboard-operable native input over a branded olive/paper surface, with a visible filename and choose/change action. Do not advertise drag-and-drop without implementing it.

## Component ownership

`SectionTitle` and `SectionMotif` align section labels and decorative icons. Shared avatars own their initial crop and circular frame. `PostCard`, `PostFooter`, and `PostCardSkeleton` share post geometry; Conversation is a labeled trailing footer action, and owner Edit stays beside it on profile posts. Post cards omit the Friends audience label.

Profile uses a sticky identity/details rail and a single recent-post stream from 72rem when space permits. Narrow windows and larger reading preferences stack the content. Edit profile is available in the header menu and beside Settings as an icon button on your own profile. Friendship controls are reserved for other profiles. Mobile profile content begins 24px below the navigation. Portrait, name and handle share the first row; the bio sits beneath, followed by compact friendship, message and safety actions. Friends is a two-person status icon; Add friend and Message retain accessible names. Unfriend lives in the overflow menu. Relationship feedback occupies its own line below the complete action row. Inaccessible galleries explain the friendship requirement and omit View More. Profile overflow uses a mobile action sheet and a desktop anchored menu; destructive actions require confirmation.

Mobile navigation contains Feed, Messages, and Profile with matching icon spaces. Its row is 52px high, plus shell padding and the device safe area. Search, Notifications, and the hamburger account menu sit in the header; desktop uses the profile avatar. The menu and notifications share mutually exclusive state. The hamburger morphs to a close icon with a reduced-motion alternative. Its navigation panel is portalled outside profile/card stacking contexts and positioned against the header trigger.

Gallery keeps the existing natural-proportion featured layout on mobile and uses a denser three-column More Photographs grid. Desktop browsing uses uniform, centered 3:2 thumbnail crops: three larger featured images above five smaller columns. Full-photo viewers always show the uncropped image. Load the first three browsing photographs eagerly and defer the rest.

Arrange and Add Photograph open a compact editor with three featured slots and rounded-square thumbnails for the other photographs. Mobile uses the same scrim, rounded top, bottom anchoring, safe-area padding, Cancel, and focus-trapped modal behavior as profile sheets; desktop uses a centered modal with six additional-photo columns. Content scrolls internally while the selection controls and Done/Cancel stay visible. Dragging scrolls that internal viewport, never the page behind it; keyboard and tap controls remain alternatives.

Edits are drafts until Done: reorder, feature, add, replacement, and confirmed deletion commit together after ownership, capacity, current-gallery and daily allowance checks. Cancel, Escape, the close button, and outside dismissal discard gallery edits. The photo picker uses one compact footer with Cancel on the left and Use Photograph on the right, linked to the upload form. Its description field is explicitly labeled as alt text and explains its screen-reader purpose. Gallery additions use the shared photo allowance without consuming a post slot or automatically publishing to Feed. Gray out Feature photograph when three featured slots are filled; leave Unfeature available. Saving closes the editor without a redundant success message. Show a single Delete photograph action; omit Remove from gallery. Full-gallery replacement retains the old photo in its library and posts and explains that distinction. Deletion removes owned image attachments, gallery entries, photo library entries and draft references while retaining post text and conversations. Changes remain tab-local; no server or fixture asset is deleted, and sample data returns on refresh.

Messages uses a white page canvas and white inbox previews with thin neutral-gray borders. Hover uses a cool gray; selection is highlighted only on desktop. On desktop, header, message panels and footer fit within the viewport; inbox and history scroll internally. Keep these page styles separate from the conversation's warm background, message bubbles, fonts, and composer layout. Show one responsive Local preview notice, with details on demand; keep explanatory paragraphs out of the message history. Unsent message drafts live in the tab-level provider across navigation and clear on refresh. The viewer’s one-way Notebook stays pinned above other inbox conversations. Its book icon uses the same circular avatar shape and responsive sizes as other threads. Entries use the regular outgoing message bubbles, spacing and timestamp grouping. New notebook entries also stay in tab memory across navigation and clear on refresh; they are never sent to a recipient.

The selected desktop feed post and conversation share geometry tokens. The post is muted without dimming photographs. Profile conversations use an inline flip; mobile conversations use a full-screen flip. Forms and metadata stay outside the independently scrolling discussion.

Public pages retain their full footer. Its logo row is light; its link and copyright rows use Blackened Olive. Application utility links remain in the account menu and Settings, with a compact desktop footer.
