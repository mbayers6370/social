import {
  MINIMUM_AGE,
  POSTING_RULE_SUMMARY,
  POSTING_EDIT_RULE,
  POSTING_EXCLUSIONS,
  POSTING_TIME_ZONE,
} from "@/lib/platform-rules";
import type { PublicDocumentData } from "./public-document";
import { publicSiteDetails } from "./site-details";
const postingPoints = [
  POSTING_RULE_SUMMARY,
  POSTING_EDIT_RULE,
  POSTING_EXCLUSIONS,
  `Calendar days currently run midnight to midnight in ${POSTING_TIME_ZONE}.`,
  "A link pasted into regular post text counts as a link-containing post too.",
];
const temporaryContact = `${publicSiteDetails.supportEmail} is a temporary placeholder and is not a monitored inbox. Do not send private information there. A working contact address must be confirmed before the beta opens.`;
export const publicDocuments = {
  "why-margin": {
    title: "A little room for a different kind of social.",
    intro: "Friendship has a place in your day. It doesn’t need the whole day.",
    sections: [
      {
        id: "enough",
        title: "A place to catch up, then carry on.",
        paragraphs: [
          "There is something lovely about knowing what a friend has noticed. A walk they took. A sentence they kept. The small things that rarely make it into a phone call.",
          "margin starts there: people you know, sharing a little of their everyday lives. A chronological feed with an end, and room to put your phone away.",
        ],
      },
      {
        id: "boundaries",
        title: "Some things are better with edges.",
        paragraphs: [
          "A small daily allowance makes room to choose what to share. A twenty-photo gallery asks what you want to keep. Posts and messages are intended to disappear after thirty days, so the everyday doesn’t have to become a permanent record.",
          "These are design choices, not promises about how a person will feel. You decide what a useful place for connection looks like in your life.",
        ],
      },
      {
        id: "conversation",
        title: "Leave space for the conversation.",
        paragraphs: [
          "A post is a beginning. Its conversation can open alongside it, giving the words and the people replying their own room. The feed waits where you left it.",
        ],
      },
      {
        id: "about",
        title: "About margin",
        paragraphs: [
          "margin is an independent project in development, exploring a smaller, more deliberate social space. The name is a reminder to leave something unfilled.",
          "The platform is called margin. Its legal operator and official domain are still being confirmed. There is no claim here that an incorporated company has been formed.",
        ],
        links: [{ label: "The practical details", href: "/how-it-works" }],
      },
    ],
  },
  "how-it-works": {
    title: "How margin works",
    intro: "A few clear boundaries. Plenty of room within them.",
    sections: [
      {
        id: "preview",
        title: "Where things stand",
        paragraphs: [
          "margin is in development. The local application lets you explore the feed, conversations, messages, profile and gallery with fictional accounts. It does not deliver social posts or messages to real people.",
          "The rules below describe the intended beta. Creation allowances work in the local composer. Editing and deleting posts are not available in this preview; real account eligibility, delivery and deletion still need connected verification.",
        ],
      },
      {
        id: "friends",
        title: "Friends, in chronological order",
        paragraphs: [
          "Posts are intended for accepted friends and appear newest first. The local preview supports sample friend requests and removal; requests and posts are not delivered to real accounts.",
        ],
      },
      {
        id: "posting",
        title: "Your daily allowance",
        paragraphs: [
          "A regular post contains words or a still photograph, without a link.",
        ],
        points: postingPoints,
      },
      {
        id: "thirty-days",
        title: "Thirty days for the everyday",
        paragraphs: [
          "Posts and private messages are intended to leave normal views after thirty days. Visibility and permanent deletion are different operations.",
          "The current local preview hides expired posts. It does not permanently erase content on a schedule, and message expiration is not implemented. Backup, report-preservation and deletion deadlines must be finalized before launch.",
        ],
        links: [{ label: "Content & data retention", href: "/retention" }],
      },
      {
        id: "gallery",
        title: "Twenty photographs to keep",
        paragraphs: [
          "The gallery holds up to twenty still photographs. Three can be featured in the top row. Move a photograph by its handle, keyboard or move controls.",
          "A gallery photograph is intended to remain until you remove or replace it. Removing it from the gallery does not remove the photograph from a post that uses it. The local gallery and device photographs reset on refresh; no upload reaches cloud storage.",
        ],
      },
      {
        id: "media",
        title: "Photographs and words",
        paragraphs: [
          "Still JPEG, PNG and WebP images are supported. Video, animated images, motion photos and video embeds are not permitted. Music selections link out to listening services; margin has no music player.",
        ],
      },
      {
        id: "eligibility",
        title: "For adults",
        paragraphs: [
          `The initial minimum signup age is ${MINIMUM_AGE}. Registration is not open. Age eligibility must be enforced in the real account flow before invitations begin.`,
        ],
        links: [
          { label: "Community Guidelines", href: "/community-guidelines" },
          { label: "Help with the details", href: "/help" },
        ],
      },
    ],
  },
  help: {
    title: "A little help",
    intro: "The useful details, in one place.",
    sections: [
      {
        id: "posting",
        title: "How much can I post?",
        paragraphs: [
          "The local composer enforces creation limits. Editing and deletion controls are not available in this preview.",
        ],
        points: postingPoints,
      },
      {
        id: "expiration",
        title: "What happens after thirty days?",
        paragraphs: [
          "Posts and messages are intended to disappear from normal views after thirty days. In this preview, expired posts are hidden; scheduled permanent deletion and message expiry are not active. An export or a copy saved by another person would have its own lifetime.",
        ],
        links: [{ label: "Read the retention draft", href: "/retention" }],
      },
      {
        id: "gallery",
        title: "Can I keep a photograph?",
        paragraphs: [
          "The gallery has twenty places, with three featured photographs. Gallery removal preserves any posts that use the photograph. Local device images stay in your browser tab and reset on refresh.",
        ],
      },
      {
        id: "account",
        title: "Who can join, and how do I sign in?",
        paragraphs: [
          `margin is intended for people ${MINIMUM_AGE} and older. Registration is not open. Managed sign-in, session policies and age enforcement need verification before the beta opens. Never send a password, authentication code or recovery code to support.`,
        ],
      },
      {
        id: "notifications",
        title: "What appears in notifications?",
        paragraphs: [
          "The bell opens sample comments, replies and friendship activity. Open an item to mark it read, or use Mark all as read. Replies open the related conversation and expand the relevant thread.",
          "Settings lets you choose activity categories. Likes are optional and grouped. You can accept or decline sample friend requests in notifications. Read states and preferences last for this tab; push, email and real delivery are not connected.",
        ],
      },
      {
        id: "managing-friends",
        title: "How do I add or remove a friend?",
        paragraphs: [
          "Find a Profile using search, open their profile and choose Add friend. A request must be accepted before you become friends. Profile → Friends shows your friends, received requests and sent requests. You can accept, decline or cancel a request there.",
          "Choose Friends on someone’s profile or in your friends list to review removal. Confirming hides their friend-only posts and photographs from this preview; existing messages remain. This uses fictional profiles, sends nothing and resets on refresh. Real friendship storage and cross-account permissions are not connected.",
        ],
      },
      {
        id: "privacy-safety",
        title: "Privacy & safety",
        paragraphs: [
          "The intended post audience is accepted friends. Name and username discovery should not grant access to private posts. The local sample demonstrates the policy, not real account protection.",
          "Blocking, muting, message permissions and moderation reporting are not connected yet. Do not use this preview to exchange sensitive information.",
        ],
        links: [
          { label: "Community Guidelines", href: "/community-guidelines" },
          { label: "Privacy draft", href: "/privacy" },
        ],
      },
      {
        id: "your-data",
        title: "Can I download or delete my data?",
        paragraphs: [
          "Settings offers a JSON download of your local profile, locally shared posts, gallery descriptions, local comments and likes, song selection and preferences. It excludes image files, per-screen message history and account/security data.",
          "Real account export, account deletion and deletion of hosted data are not available yet. Refresh clears in-memory social changes but does not erase a saved local music selection.",
        ],
        links: [{ label: "Your data", href: "/your-data" }],
      },
      {
        id: "report",
        title: "Report a problem",
        paragraphs: [
          "For a bug report, include the screen, what you expected, what happened and your browser/device. Remove personal information from screenshots. Do not attach private messages, session tokens or credentials.",
          temporaryContact,
        ],
      },
      {
        id: "appeals",
        title: "Appeals",
        paragraphs: [
          "There is no live moderation or appeals service in this preview. Before moderation begins, margin must publish a working contact route, explain restriction reasons and establish how to ask for a review. No appeal can be submitted through this page yet.",
        ],
      },
      {
        id: "accessibility",
        title: "Reading and moving comfortably",
        paragraphs: [
          "Settings offers larger text and reduced motion. Native zoom remains available. Gallery move buttons provide an alternative to dragging; conversation controls work without gestures.",
        ],
        links: [{ label: "Accessibility draft", href: "/accessibility" }],
      },
    ],
  },
  contact: {
    title: "Get in touch",
    intro: "Questions, feedback, and the things we could make clearer.",
    sections: [
      {
        id: "support",
        title: "Support",
        paragraphs: [
          temporaryContact,
          "margin is the public-facing platform name. The official domain, legal operator and support process remain to be confirmed. No message is collected or sent by this page.",
        ],
      },
      {
        id: "feedback",
        title: "What to include",
        paragraphs: [
          "A brief description and the page involved are usually enough to start. For account, safety or copyright concerns, use the appropriate process once it is published. Do not include passwords, verification codes, private messages or sensitive photographs.",
        ],
        links: [
          { label: "Browse Help", href: "/help" },
          { label: "Copyright draft", href: "/copyright" },
        ],
      },
    ],
  },
  join: {
    title: "margin is coming soon.",
    intro: "A little space for you and your people is taking shape.",
    sections: [
      {
        id: "availability",
        title: "Registration isn’t open yet",
        paragraphs: [
          "There is no waitlist or email collection on this page. Invitations and the final account terms will be available when the essentials are ready.",
          `The initial minimum signup age is ${MINIMUM_AGE}. The operator identity, support contact, age controls, retention behavior and policy language must be confirmed before signup opens.`,
        ],
        links: [
          { label: "How margin will work", href: "/how-it-works" },
          { label: "Why margin", href: "/why-margin" },
        ],
      },
    ],
  },
  "your-data": {
    title: "Your data",
    intro: "Know what you can take with you, and what removal means.",
    sections: [
      {
        id: "local-download",
        title: "Download the local preview",
        paragraphs: [
          "In local development, Settings can download your profile, locally created posts, gallery descriptions, selected music and reading preferences as JSON. It does not include image files, messages held by the Messages screen, sign-in records or other people’s profiles.",
          "This is a preview-data download, not an account archive from the server.",
        ],
      },
      {
        id: "account-export",
        title: "Account export",
        paragraphs: [
          "An authenticated export of a real account is not implemented. The final flow must verify the requesting account, scope its contents and provide secure, temporary delivery. Its format, available records and timing must be published before launch.",
        ],
      },
      {
        id: "delete-account",
        title: "Account deletion",
        paragraphs: [
          "There is no real account-deletion endpoint in this preview. Settings identifies that control as unavailable. Refreshing the page is not an account deletion request and does not delete the local database’s saved song.",
          "Before accounts open, deletion must cover the identity service, database and private media, with documented treatment of backups and any lawful retention exceptions. Deletion deadlines remain under review.",
        ],
        links: [
          { label: "Retention draft", href: "/retention" },
          { label: "Contact status", href: "/contact" },
        ],
      },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    intro:
      "A draft account of what the preview handles, and what a live service still needs to define.",
    draft: true,
    sections: [
      {
        id: "operator",
        title: "Who operates margin",
        paragraphs: [
          "margin is the platform name. The legal operator, address, jurisdictional details and official domain are not finalized. Those details and a working privacy contact must be confirmed before this policy takes effect.",
          temporaryContact,
        ],
      },
      {
        id: "preview-data",
        title: "Information in this preview",
        paragraphs: [
          "The local application uses fictional profiles and relationships. Social text, comments, likes, device photographs and interface preferences remain in this browser tab and reset on refresh. Device photo files are not uploaded. The separately configured local music database retains selected song metadata until changed or removed.",
          "Live music searches send the entered song/artist query from the server to Apple’s catalogue. Artwork is fetched through the image optimizer. Apple Music and Spotify links open external services, whose own policies apply.",
        ],
      },
      {
        id: "services",
        title: "Connected services",
        paragraphs: [
          "Managed authentication, private media storage, caching and error monitoring are integration foundations. Their use depends on configured services; no hosting region, processor contract, retention duration or international-transfer arrangement has been approved by this draft.",
          "When Clerk is configured, it manages sign-in/session information. When Sentry is configured, the application filters outgoing events to remove identity, request bodies, headers, cookies, query strings, breadcrumbs and arbitrary messages. Recording sessions, product analytics and ad tracking are not implemented. Provider-side settings still need verification.",
        ],
      },
      {
        id: "purposes",
        title: "Use and disclosure",
        paragraphs: [
          "The planned service needs information to run accounts, deliver authorized content, protect access and investigate reported problems. The final policy must identify collected categories, specific purposes, recipients, retention and applicable rights. This draft does not authorize sale, targeted advertising or additional uses of personal data.",
        ],
      },
      {
        id: "choices",
        title: "Your choices and requests",
        paragraphs: [
          "A local JSON download is available in Settings. Real account access, correction, export and deletion requests are not connected. A verified request process, response timing and applicable California and other privacy disclosures must be reviewed before launch. This draft does not claim CCPA applicability or compliance.",
        ],
        links: [
          { label: "Your data", href: "/your-data" },
          { label: "Content & retention", href: "/retention" },
          { label: "Cookies", href: "/cookies" },
        ],
      },
      {
        id: "age",
        title: "Age eligibility",
        paragraphs: [
          `The initial service is intended for adults ${MINIMUM_AGE} and over. Age eligibility controls and a procedure for handling underage accounts remain launch requirements.`,
        ],
      },
      {
        id: "changes",
        title: "Before this becomes effective",
        paragraphs: [
          "Confirm the operator, replace the temporary contact, inventory actual service/data flows, settle retention and review the legal language. An effective date and a policy-change notice process must then be published.",
        ],
      },
    ],
  },
  terms: {
    title: "Terms of Service",
    intro:
      "Proposed rules for using margin. This draft is not an active agreement.",
    draft: true,
    sections: [
      {
        id: "accounts",
        title: "Accounts and eligibility",
        paragraphs: [
          `The initial minimum age is ${MINIMUM_AGE}. Use accurate account information, keep authentication/recovery methods secure, and do not impersonate other people. Real signup and verified age controls are not open in this preview.`,
        ],
      },
      {
        id: "posting",
        title: "Posting boundaries",
        points: postingPoints,
        links: [{ label: "How it works", href: "/how-it-works" }],
      },
      {
        id: "content",
        title: "Your content",
        paragraphs: [
          "Share only material you have the right to share. The intended policy is for authors to retain their rights. Any limited license needed to store, display and deliver content must be written precisely and reviewed before these terms take effect.",
          "Video, animated images, motion photos and video embeds are prohibited. Copyright and community reporting processes must be working before public uploads begin.",
        ],
      },
      {
        id: "conduct",
        title: "Respect the people here",
        paragraphs: [
          "Do not harass, threaten, exploit, impersonate, expose private information, send spam or attempt unauthorized access. The Community Guidelines explain the proposed boundaries.",
        ],
        links: [
          { label: "Community Guidelines", href: "/community-guidelines" },
        ],
      },
      {
        id: "retention",
        title: "Expiration and copies",
        paragraphs: [
          "Thirty-day visibility does not guarantee removal from another person’s screenshots, downloads or exports. Permanent deletion schedules, backup handling and report preservation are not finalized.",
        ],
        links: [{ label: "Retention draft", href: "/retention" }],
      },
      {
        id: "review",
        title: "Terms still requiring review",
        paragraphs: [
          "The contracting operator, jurisdiction, content license, service changes, moderation and appeal process, account closure, consumer rights and any liability/dispute provisions need legal review. No arbitration, liability waiver or incorporated-entity status is invented by this draft.",
        ],
      },
    ],
  },
  "community-guidelines": {
    title: "Community Guidelines",
    intro:
      "Make room for other people. Respect their boundaries as well as your own.",
    draft: true,
    sections: [
      {
        id: "respect",
        title: "Treat people with care",
        points: [
          "No harassment, credible threats, hateful abuse or targeted intimidation.",
          "No impersonation, doxxing, or sharing another person’s private information without permission.",
          "No exploitation, sexual abuse material or non-consensual intimate content.",
          "No spam, fraud, malicious links or attempts to compromise accounts.",
        ],
      },
      {
        id: "sharing",
        title: "Share responsibly",
        paragraphs: [
          "Have the rights and consent needed for what you post. Still photographs and words are welcome within the platform’s rules; video, animated images, motion photos and video embeds are not permitted. Follow the daily posting allowance.",
        ],
        links: [{ label: "Posting rules", href: "/how-it-works#posting" }],
      },
      {
        id: "moderation",
        title: "Reports and review",
        paragraphs: [
          "Reporting, moderation decisions and appeals are not operational in this preview. Before beta invitations, margin must provide an accessible reporting route, escalation procedures, reviewer access restrictions and a way to challenge decisions. No moderation service level is promised by this draft.",
        ],
        links: [
          { label: "Reporting and appeals status", href: "/help#report" },
        ],
      },
    ],
  },
  retention: {
    title: "Content & Data Retention",
    intro:
      "Disappearing from a screen and being permanently deleted are different things.",
    draft: true,
    sections: [
      {
        id: "posts",
        title: "Posts and conversations",
        paragraphs: [
          "The intended beta removes posts and their conversations from ordinary views after thirty days. Today, a local clock filters expired posts from the preview. It does not schedule a server deletion or erase private media.",
          "The permanent-deletion deadline, failure/retry behavior and treatment of comments must be finalized and verified before this becomes a live promise.",
        ],
      },
      {
        id: "messages",
        title: "Private messages",
        paragraphs: [
          "Private messages are intended to expire after thirty days. The current Messages screen is a browser-only simulation; expiry and server delivery are not implemented. The final policy must define whether timing is per message or conversation, and how both participants’ views and exports behave.",
        ],
      },
      {
        id: "gallery",
        title: "Gallery photographs",
        paragraphs: [
          "Gallery photographs are intended to remain until removed or replaced. A gallery change does not delete a post that references the same image. Shared image references must be checked before private files are deleted. Device selections in the local preview last only for the current tab session.",
        ],
      },
      {
        id: "saved-music",
        title: "Saved music",
        paragraphs: [
          "The local database keeps your selected song’s catalogue metadata until you replace or remove it. Refreshing the page does not delete that selection. No music audio is stored.",
        ],
      },
      {
        id: "backups",
        title: "Backups, reports and exceptions",
        paragraphs: [
          "No hosted backup schedule or legal-hold policy has been approved. A launch policy must specify backup rotation, restore/redeletion handling, restricted preservation of reported content, the legal basis for exceptions and deletion deadlines. None is implied to disappear instantly.",
        ],
      },
      {
        id: "copies",
        title: "Exports and other copies",
        paragraphs: [
          "A downloaded archive or copy kept by another person is separate from margin’s storage. Automatic expiration cannot remove screenshots or copies held outside the service. Account export and deletion workflows need their own published scope and timing.",
        ],
        links: [{ label: "Your data", href: "/your-data" }],
      },
    ],
  },
  copyright: {
    title: "Copyright Policy",
    intro: "Share work you own, or have permission to share.",
    draft: true,
    sections: [
      {
        id: "rights",
        title: "Respect creators",
        paragraphs: [
          "Do not upload photographs, writing or other material without the rights or permission required. Attribution alone does not establish permission.",
        ],
      },
      {
        id: "notices",
        title: "Reporting a concern",
        paragraphs: [
          "A working copyright contact and complaint process must be published before uploads open. The temporary support address is not a designated agent or an operational notice destination. Do not send notices to it.",
          "The reviewed process must explain how to identify a work and the disputed material, provide contact details and submit the statements/signature required by applicable law. No complaint can be filed on this page yet.",
        ],
      },
      {
        id: "process",
        title: "Requirements before launch",
        paragraphs: [
          "Confirm the operator and applicable law; determine and complete any required designated-agent registration; publish the correct notice contact, removal and counter-notice process, repeat-infringer policy and review/escalation procedures. This draft does not claim DMCA safe-harbor eligibility.",
        ],
        links: [{ label: "Contact status", href: "/contact" }],
      },
    ],
  },
  cookies: {
    title: "Cookies & Preferences",
    intro: "Explain what is used before asking people to choose.",
    draft: true,
    sections: [
      {
        id: "current",
        title: "The current preview",
        paragraphs: [
          "Social preferences and interactions are kept in memory, not localStorage or sessionStorage. Saved music is in the isolated local database. Local device photographs use temporary browser references. No advertising or product-analytics integration is implemented.",
        ],
      },
      {
        id: "authentication",
        title: "Authentication and essential storage",
        paragraphs: [
          "When configured, Clerk manages its own session/authentication cookies. The final deployed service needs an exact cookie/storage inventory, including provider, purpose, lifetime and scope. Build tools and development cookies should not be presented as production tracking.",
        ],
      },
      {
        id: "preferences",
        title: "Choices before new tracking",
        paragraphs: [
          "There is no consent banner or nonessential-tracking switch because those integrations do not exist in the preview. Before adding any, review applicable consent/opt-out requirements and build real controls. This draft does not assert that no consent obligations could apply.",
        ],
        links: [{ label: "Privacy draft", href: "/privacy" }],
      },
    ],
  },
  accessibility: {
    title: "Accessibility Statement",
    intro:
      "margin should leave room for different ways of reading and interacting.",
    draft: true,
    sections: [
      {
        id: "support",
        title: "What the interface supports",
        paragraphs: [
          "Keyboard controls and visible focus, semantic headings and labels, dialog focus management, reduced-motion alternatives and native browser zoom are part of the interface. Settings offers larger text. Dragging has explicit move-button alternatives.",
        ],
      },
      {
        id: "verification",
        title: "What still needs verification",
        paragraphs: [
          "Component tests are not a claim of accessibility conformance. Screen-reader combinations, text spacing, 200% text resizing, narrow reflow, mobile virtual keyboards and real-device behavior need manual review. No WCAG certification is claimed.",
        ],
      },
      {
        id: "contact",
        title: "Tell us what gets in the way",
        paragraphs: [
          "A working accessibility contact must be confirmed before launch. A useful report describes the page, task and assistive technology involved; share only information you are comfortable providing.",
          temporaryContact,
        ],
        links: [{ label: "Contact status", href: "/contact" }],
      },
    ],
  },
} satisfies Record<string, PublicDocumentData>;
