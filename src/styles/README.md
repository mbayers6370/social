# Stylesheet conventions

`globals.css` owns Tailwind layers, base typography, native fields, focus, and global motion preferences. `application.css` is the single ordered feature-style manifest; it loads shared components before their consumers. `tokens.css` defines the palette, type scale, spacing, and shared layout geometry.

Each full selector has one owning stylesheet. Keep its responsive, interaction, and reduced-motion variants together. Feature-specific contextual selectors belong with that feature. Run `npm run styles:check` to catch repeated imports, orphan stylesheets, and conflicting ownership.

## Shared design rules

- Body copy, forms, labels, and controls use Inter. Headings and the wordmark use Caudex.
- Entry text and labels start at 1rem. Small notes share 0.75rem, 400-weight Inter, 1.5 line height, and `--note-foreground`.
- Use spacing tokens: related details 8px, groups 24px, sections 32px, and larger breaks 48px.
- Divider lines inside cards and menus run edge to edge; inset the content instead of the line.
- Interactive controls retain at least 44px targets, visible keyboard focus, and reduced-motion alternatives.
- Photographs use the shared 12px radius. Preserve full photographs in uncropped viewers and maintain aspect ratios.

## Palette and branding

Parchment `#FAF9F6`, Ink `#30383D`, Citron `#B9C65A`, and Blackened Olive `#454D24` are the base palette. Navigation uses Olive with Parchment labels; selected mobile destinations use Citron icons and labels without a background highlight. Notification dots use Citron.

Shared home links use the lowercase Caudex wordmark and angled framing marks. Mobile uses a smaller wordmark. Browser and Apple icons use only the two framing marks. Original brand artwork remains unmodified.

## Component ownership

`SectionTitle` and `SectionMotif` align section labels and decorative icons. Shared avatars own their initial crop and circular frame. `PostCard`, `PostFooter`, and `PostCardSkeleton` share post geometry; Conversation is a labeled trailing footer action, and owner Edit stays beside it on profile posts. Post cards omit the Friends audience label.

Profile uses a sticky identity/details rail and a single recent-post stream from 72rem when space permits. Narrow windows and larger reading preferences stack the content. Edit profile lives in the header menu. Mobile profile content begins 24px below the navigation.

Mobile navigation contains Feed, Messages, and Profile with matching icon spaces. Its row is 52px high, plus shell padding and the device safe area. Search, Notifications, and the hamburger account menu sit in the header; desktop uses the profile avatar. The menu and notifications share mutually exclusive state. The hamburger morphs to a close icon with a reduced-motion alternative.

Messages uses a white page canvas and white inbox previews with thin neutral-gray borders. Hover uses a cool gray; selection is highlighted only on desktop. Keep these page styles separate from the conversation's warm background, message bubbles, fonts, and composer layout.

The selected desktop feed post and conversation share geometry tokens. The post is muted without dimming photographs. Profile conversations use an inline flip; mobile conversations use a full-screen flip. Forms and metadata stay outside the independently scrolling discussion.

Public pages retain their full footer. Its logo row is light; its link and copyright rows use Blackened Olive. Application utility links remain in the account menu and Settings, with a compact desktop footer.
