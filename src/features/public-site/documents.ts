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
const previewStatus =
  "Margin is in development. Account setup begins with an invitation code. The application preview uses fictional people; its social interactions do not reach real accounts.";
const policyStatus =
  "This is a draft for review, with no effective date. Proposed rules describe the service being developed; they are not a claim that every feature or operational process is live.";

export const publicDocuments = {
  "why-margin": {
    category: "Explore",
    title: "Friendship, with room around it.",
    intro:
      "A place for the people in your life. And a little more space for life itself.",
    summary: [
      "Friends, rather than an audience.",
      "A chronological feed with a finish.",
      "In development. Registration is not open yet.",
    ],
    sections: [
      {
        id: "enough",
        title: "Catch up. Then carry on.",
        paragraphs: [
          "A friend found a café. Someone finally finished that book. There is a photograph from a walk you would have liked. Ordinary things, made interesting because of who shared them.",
          "Margin is being built around that feeling: keeping up with people you know, without making keeping up a second occupation. The feed runs newest first and has an end. When you reach it, you can leave.",
        ],
      },
      {
        id: "boundaries",
        title: "A little less is a choice.",
        paragraphs: [
          "A small daily posting allowance asks you to choose what is worth sharing. A gallery with twenty places asks which photographs you want to keep. Still images and words leave room to linger without another video starting.",
          "The intended thirty-day life of a post keeps the everyday moving. Photographs you choose for your gallery can stay. Expiration, permanent deletion and copies saved by other people are different things; the retention draft explains those boundaries.",
          "These choices will not suit everyone. If you want to publish all day, build a public audience or keep every update forever, Margin’s limits may feel too small. That tradeoff is part of the idea.",
        ],
        links: [{ label: "The practical boundaries", href: "/how-it-works" }],
      },
      {
        id: "conversation",
        title: "The good part happens between people.",
        paragraphs: [
          "A post can become a conversation. A photograph can become a plan for Saturday. The conversation has its own space, and messages give friends somewhere to continue.",
          "Your profile is a small introduction: a few words, photographs you have chosen and the music you keep returning to. It is a place for someone to recognise you, rather than a page to keep performing for.",
        ],
      },
      {
        id: "about",
        title: "About margin",
        paragraphs: [
          "Margin is an independent project exploring a smaller, more deliberate social space. The name is a reminder to leave something unfilled.",
          previewStatus,
          "The product is taking shape through a working local preview. Private account services, support and moderation processes, and final policies still need to be ready before people are invited in. There is no launch date or waitlist to announce yet.",
          "Margin is the platform name. The legal operator, official domain and working contact details have not been confirmed. Those details will need to be clear before registration opens.",
        ],
      },
    ],
    related: [
      { label: "How Margin works", href: "/how-it-works" },
      { label: "Join Margin", href: "/sign-up" },
    ],
  },
  "how-it-works": {
    category: "Explore",
    title: "How margin works",
    intro: "A few clear boundaries. Plenty of room within them.",
    summary: [
      "Three regular posts, or one link post, per day.",
      "Twenty gallery photographs, with three featured.",
      "A working local preview; real accounts are not open.",
    ],
    sections: [
      {
        id: "preview",
        title: "Where things stand",
        paragraphs: [
          previewStatus,
          "You can explore posting, conversations, messages, friendships, profiles and the gallery in the local application. Most changes last only in the current browser tab and reset on refresh. A separately configured music selection can persist. The examples on the public landing page are illustrations only.",
          "The boundaries below describe the planned experience. Real account delivery, scheduled deletion, reporting and account-wide data controls still need launch verification.",
        ],
      },
      {
        id: "friends",
        title: "Your people, newest first",
        paragraphs: [
          "The intended audience for posts and gallery photographs is accepted friends. A request has to be accepted; finding a profile or sending a request does not make someone a friend.",
          "The feed shows friends’ posts in chronological order, newest first. Your own posts live on your profile. A clear ending tells you when there is nothing else to catch up on.",
          "The preview lets you try these relationships with sample profiles. It is not a connection to another person’s account.",
        ],
      },
      {
        id: "posting",
        title: "Choose a little to share",
        paragraphs: [
          "A regular post can contain words or still photographs. Adding a link, including a link pasted into the text, changes that day’s allowance.",
        ],
        points: postingPoints,
      },
      {
        id: "conversations",
        title: "A post is the beginning",
        paragraphs: [
          "Choose the speech-bubble icon on a post to open its conversation. Read the replies, add a thought or respond to someone. Returning brings you back to the post.",
          "Messages have a separate inbox. The preview also includes a Notebook for notes to yourself. Sample messages, notes and drafts stay local; they are not delivered to anyone. A live message-retention and notebook policy has not been finalised.",
        ],
      },
      {
        id: "thirty-days",
        title: "Thirty days for the everyday",
        paragraphs: [
          "Posts and private messages are intended to leave ordinary views after thirty days. That is the proposed product boundary, rather than a promise that every copy disappears at that moment.",
          "The preview hides expired posts. Scheduled permanent deletion and message expiry are not running in the preview. A gallery photograph can outlive a post that uses it, and an exported copy or screenshot has a separate lifetime.",
        ],
        links: [
          { label: "Understand expiration and deletion", href: "/retention" },
        ],
      },
      {
        id: "gallery",
        title: "Twenty photographs to keep",
        paragraphs: [
          "Your gallery holds up to twenty still photographs, with three featured. Choose Arrange to feature or move photographs. Dragging, keyboard controls and tap controls offer different ways to organise them. Done saves the changes; Cancel leaves the gallery as it was.",
          "Adding a photograph directly to Gallery uses your photo allowance without publishing a feed post. Replacing a gallery photograph does not erase its appearances elsewhere. Delete photograph is different: in the preview, it removes that image from your gallery, posts and drafts while keeping post text and conversations.",
        ],
      },
      {
        id: "media",
        title: "Words, photographs and a little music",
        paragraphs: [
          "Still JPEG, PNG and WebP photographs are supported. Add an image description for people using screen readers. The current limit is 8 MB, with additional checks on dimensions and file contents. Export HEIC or HEIF images as JPEG or PNG first.",
          "Video, animated images, motion photos and video embeds are not permitted. On Repeat lets you choose music for your profile and opens listening services when selected; Margin has no music player.",
        ],
      },
      {
        id: "eligibility",
        title: "For adults",
        paragraphs: [
          `The initial minimum signup age is ${MINIMUM_AGE}. Registration is not open. Account eligibility and age controls must be verified before invitations begin.`,
        ],
        links: [
          { label: "Community Guidelines", href: "/community-guidelines" },
          { label: "Help with the details", href: "/help" },
        ],
      },
    ],
    related: [
      { label: "Why Margin", href: "/why-margin" },
      { label: "A little help", href: "/help" },
      { label: "Your data", href: "/your-data" },
    ],
  },
  help: {
    category: "Support",
    title: "A little help",
    intro:
      "Find your way around, put something right, or understand what happens next.",
    summary: [
      "These instructions describe the local preview.",
      "Changes usually reset when the page refreshes.",
      "A live support and reporting service is not open yet.",
    ],
    sections: [
      {
        id: "posting",
        title: "How much can I post?",
        paragraphs: [
          "Choose New Post, add your words or photographs and select Publish. If you reach a limit, the composer explains which allowance is used. Cancel preserves your draft while you stay in this tab. Nothing is sent to real friends.",
        ],
        points: postingPoints,
      },
      {
        id: "edit-post",
        title: "Can I edit or delete a post?",
        paragraphs: [
          "Open your profile, find the post and choose Edit. Saving changes keeps the post’s original date, expiry and conversation. The posting and photograph allowances are checked again before the change is saved.",
          "Deleting a post removes its text and conversation from the local preview but preserves photographs kept in Gallery. Deleting the photograph itself has wider effects; read the confirmation before continuing. Preview changes reset on refresh.",
        ],
      },
      {
        id: "expiration",
        title: "What happens after thirty days?",
        paragraphs: [
          "The planned feed gives posts a thirty-day life. Expired posts are hidden in the preview, but scheduled permanent erasure and message expiry are not active. A saved gallery photograph, screenshot or export does not automatically disappear with a post.",
        ],
        links: [{ label: "Read the retention draft", href: "/retention" }],
      },
      {
        id: "gallery",
        title: "How do I organise my photographs?",
        paragraphs: [
          "Your profile shows a gallery preview. Open the gallery to browse, add a photograph or choose Arrange. You have twenty places and three featured positions. If all featured positions are full, unfeature one photograph before featuring another.",
          "Arrange keeps changes as a draft until you choose Done. Cancel or closing the editor discards that draft. Move controls and keyboard actions are available alongside dragging.",
          "Delete photograph removes that image from your local gallery, post attachments and drafts. It keeps the surrounding post text and conversation. Replacing a gallery entry only changes the gallery selection. Neither action deletes one of the original sample image files.",
        ],
      },
      {
        id: "photo-problem",
        title: "Why won’t my photograph attach?",
        points: [
          "Choose a still JPEG, PNG or WebP file of 8 MB or less. HEIC and HEIF need to be exported first; video, motion photos and animated images are not supported.",
          "Use an image no larger than 10,000 pixels on either side and 40 megapixels in total. If a file cannot be verified, export a fresh copy as JPEG or PNG.",
          "Add an image description. Describe what is visible; put the story you want to tell in the post itself.",
          "Check your remaining daily photograph allowance and gallery capacity. The composer or picker explains which limit needs attention.",
        ],
      },
      {
        id: "account",
        title: "Who can join, and how do I sign in?",
        paragraphs: [
          `Margin is intended for people ${MINIMUM_AGE} and older. Start at Join Margin with an invitation code. Live registration depends on the connected account service. The sample identity in the local application is not a real signed-in account.`,
          "When accounts become available, use the official sign-in flow. Never send a password, verification code or recovery code to someone claiming to provide support.",
        ],
      },
      {
        id: "profile",
        title: "How do I change my profile?",
        paragraphs: [
          "Choose Edit profile beside your profile details or in the account menu. Edit your name and bio, then Save changes. Cancel or Escape discards the draft. Username changes live separately in Settings.",
          "Usernames use 3–24 letters, numbers or underscores, start with a letter and are saved in lowercase. The preview checks sample-name availability and applies a seven-day change cooldown. Those checks are local; they do not reserve a username for a future account.",
        ],
      },
      {
        id: "managing-friends",
        title: "How do I add or remove a friend?",
        paragraphs: [
          "Use Find a Profile, open a profile and choose Add friend. Profile → Friends shows accepted friends, received requests and sent requests. You can accept, decline or cancel a request there.",
          "To remove a friend, use Unfriend in their profile’s options or the removal control in Friends, then confirm. Their friend-only content becomes unavailable in the preview; existing sample messages remain. Removing a friend is different from deleting a conversation or erasing a copy they already saved.",
        ],
      },
      {
        id: "messages",
        title: "What happens to messages and drafts?",
        paragraphs: [
          "Open Messages and choose a conversation. The preview’s Send control adds a message to this tab’s conversation history. It does not send a message to another account.",
          "Messages, unsent drafts and Notebook notes stay in this tab across navigation. Refresh clears them. You can include available conversations, drafts and notes in a download from Settings, or export a conversation from its header.",
        ],
      },
      {
        id: "notifications",
        title: "What appears in notifications?",
        paragraphs: [
          "The bell shows sample comments, replies and friendship activity. Opening an item marks it read and takes you to the related content. Mark all as read clears the unread state for this tab.",
          "Settings lets you choose activity categories, including optional grouped likes. These preferences and read states are local. Push notifications, email notifications and delivery to another person are not connected.",
        ],
      },
      {
        id: "privacy-safety",
        title: "Who can see what I share?",
        paragraphs: [
          "The intended audience for posts and gallery photographs is accepted friends. Searching for a name or seeing a profile introduction should not grant access to that person’s posts. Requests awaiting acceptance do not count as friendship.",
          "The preview illustrates those boundaries using fictional accounts. It is not a place to exchange sensitive information. Reporting, real moderation and appeals are not operational; a safety control marked unavailable cannot protect a real account.",
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
          "In Settings, Download preview data creates a JSON file containing your local profile, posts, gallery descriptions, comments, likes, friendships, selected music and preferences. Image files, messages, message drafts, unpublished post drafts and server account records are excluded.",
          "Real account export and full account erasure are not connected to the preview. Refresh clears in-memory changes; it does not remove a separately saved music selection from the local database.",
        ],
        links: [{ label: "Your data", href: "/your-data" }],
      },
      {
        id: "report",
        title: "Report a problem",
        paragraphs: [
          "A useful bug report says which page you used, what you were trying to do, what happened and which browser or device was involved. Include the visible error wording if there is one. Remove personal information from screenshots and leave out messages, credentials and recovery codes.",
          temporaryContact,
        ],
        links: [{ label: "Contact and reporting status", href: "/contact" }],
      },
      {
        id: "appeals",
        title: "Can I appeal a decision?",
        paragraphs: [
          "There is no live moderation or appeals service in this preview. Before moderation starts, Margin needs a working review route, clear reasons for restrictions and an explanation of what can be challenged. No appeal can be submitted through this page yet.",
        ],
      },
      {
        id: "accessibility",
        title: "Can I make reading more comfortable?",
        paragraphs: [
          "Settings offers larger text and reduced motion in the local application. Your browser’s zoom remains available. Use Tab to move between controls and Escape to close dialogs. Gallery move controls provide an alternative to dragging; conversations can be opened without a swipe.",
        ],
        links: [{ label: "Accessibility statement", href: "/accessibility" }],
      },
    ],
    related: [
      { label: "Contact", href: "/contact" },
      { label: "How Margin works", href: "/how-it-works" },
      { label: "Your data", href: "/your-data" },
    ],
  },
  contact: {
    category: "Support",
    title: "Get in touch",
    intro: "A question, a rough edge, or something we could explain better.",
    summary: [
      "Support is not accepting messages yet.",
      "This page does not collect or send information.",
      "Never share passwords or verification codes.",
    ],
    sections: [
      {
        id: "support",
        title: "The current contact status",
        paragraphs: [
          temporaryContact,
          "Margin is the platform name. Its official domain, legal operator and support process still need to be confirmed. There is no form, live chat or monitored contact route on this page. When a route opens, this page will explain what it handles and what information is needed.",
        ],
      },
      {
        id: "feedback",
        title: "For a question or a bug",
        paragraphs: [
          "Check Help first for posting limits, photographs, friendships and local-preview behaviour. If you are preparing feedback, a short account of the task and the problem is enough to start.",
        ],
        points: [
          "The page or feature involved, and what you expected to happen.",
          "What happened instead, including any error wording.",
          "Your browser and device, plus steps that reproduce the problem.",
          "A screenshot only when useful, with private information removed.",
        ],
        links: [{ label: "Browse Help", href: "/help" }],
      },
      {
        id: "safety",
        title: "For a safety concern",
        paragraphs: [
          "A live safety-reporting service is not available yet. Do not send harmful, intimate or sensitive material to the placeholder address. The final reporting route must explain what evidence is needed, who can review it and how to ask for another review.",
          "Margin is not an emergency service. If someone is in immediate danger, use an appropriate local emergency service rather than waiting for a platform response.",
        ],
        links: [
          { label: "Community Guidelines", href: "/community-guidelines" },
        ],
      },
      {
        id: "data-copyright",
        title: "For privacy or copyright questions",
        paragraphs: [
          "Privacy requests and copyright notices need their own verified handling processes. Neither process is accepting submissions through this page. Do not send identity documents, complete account archives or legal notices to the temporary address.",
        ],
        links: [
          { label: "Your data", href: "/your-data" },
          { label: "Copyright draft", href: "/copyright" },
        ],
      },
    ],
    related: [
      { label: "A little help", href: "/help" },
      { label: "Privacy draft", href: "/privacy" },
    ],
  },
  "your-data": {
    category: "Legal",
    title: "Your data",
    intro:
      "What you can take with you. What you can change. What leaving should mean.",
    summary: [
      "A local preview download is available in Settings.",
      "It is not a full account archive.",
      "Full account export and erasure are not available yet.",
    ],
    sections: [
      {
        id: "local-download",
        title: "Download the local preview",
        paragraphs: [
          "Choose Settings → Download preview data. The file is JSON: a structured text format you can keep or inspect. It contains the current tab’s preview information rather than a history of everything you have done.",
          "Included information covers your profile, locally shared posts, gallery descriptions, your local comments and likes, friendship states, selected music, notification preferences and reading preferences. Other people’s complete profiles are not included.",
        ],
        points: [
          "Image files and the contents of linked websites are excluded.",
          "Message history, message drafts and Notebook notes are excluded.",
          "Unpublished post drafts, authentication details and server account records are excluded.",
        ],
      },
      {
        id: "correction",
        title: "Change what people see",
        paragraphs: [
          "In the preview, Edit profile changes your name and bio. Settings handles username changes. Your posts can be edited or deleted, and your gallery can be rearranged or updated. These are local controls, rather than an account-wide correction request.",
          "A name change does not create a new identity, and removing a friendship is not the same as erasing a copy someone has already saved.",
        ],
        links: [
          { label: "Help with profiles and posts", href: "/help#profile" },
        ],
      },
      {
        id: "account-export",
        title: "A real account archive",
        paragraphs: [
          "An authenticated export of a real account is not available to preview users. Before accounts open, the service needs to explain which records and media an archive contains, how ownership is checked and how the download is delivered securely.",
          "A shared conversation can contain information about more than one person. The final export process needs to explain that boundary and any information it cannot include, along with the applicable request process and timing.",
        ],
      },
      {
        id: "delete-account",
        title: "Leaving and account deletion",
        paragraphs: [
          "The preview does not offer full real-account erasure. Its Delete account control is unavailable. Refreshing clears in-memory changes; it does not delete a separately saved song from the local database or constitute a deletion request.",
          "Deactivating access is different from erasing an account. Before accounts open, the final deletion process needs to cover identity records, posts, media, provider-held information, backups and any justified retention exceptions.",
          "Deletion timing, identity checks, confirmation and a working request contact remain to be confirmed. No universal response deadline or instant removal from every copy is promised by this page.",
        ],
      },
      {
        id: "copies",
        title: "Copies outside Margin",
        paragraphs: [
          "A person may have saved a screenshot, downloaded a photograph or kept an export. Those copies have their own lifetime. Removing content from Margin cannot reach back into another person’s device or erase copies held outside the service.",
        ],
        links: [
          { label: "Retention draft", href: "/retention" },
          { label: "Contact status", href: "/contact" },
        ],
      },
    ],
    related: [
      { label: "Privacy draft", href: "/privacy" },
      { label: "Retention draft", href: "/retention" },
      { label: "Cookies and preferences", href: "/cookies" },
    ],
  },
  privacy: {
    category: "Legal",
    title: "Privacy Policy",
    intro:
      "A clear account of information, access and choices. The details here are still being reviewed before launch.",
    draft: true,
    summary: [
      "The social preview uses fictional accounts.",
      "Connected services depend on local configuration.",
      "A final operator, data inventory and request process are still required.",
    ],
    review: [
      "Legal operator, address, official domain and privacy contact.",
      "Launch regions, applicable rights and legal grounds for each use of data.",
      "Actual service providers, storage locations and transfer arrangements.",
      "Retention periods, request handling, incident notices and effective date.",
    ],
    sections: [
      {
        id: "operator",
        title: "Who is responsible",
        paragraphs: [
          policyStatus,
          "Margin is the platform name. The legal operator, address and official domain are not finalised. A working privacy contact and any jurisdiction-specific representative details must be confirmed before this policy takes effect.",
          temporaryContact,
        ],
      },
      {
        id: "preview-data",
        title: "Information in the current preview",
        paragraphs: [
          "The local application starts with fictional profiles, posts and relationships. Text you add, selected device photographs, comments, likes, friendships, message drafts, Notebook notes and interface preferences are held locally for the current tab. Refresh resets that in-memory state. The development music configuration can separately save song selections in a local database.",
          "Selecting a device photograph in the preview creates a temporary browser reference; it does not upload the file to a hosted social account. Public-page photographs are supplied illustrations, rather than private user uploads.",
          "A website visit still involves ordinary web requests. Whether a host or configured service retains connection information, such as an IP address or diagnostic log, must be established in the deployed-service inventory. A browser-only social preview is not a claim that no information ever reaches a server.",
        ],
      },
      {
        id: "account-information",
        title: "Information a live account would need",
        paragraphs: [
          "The planned service needs account and sign-in information; a profile and username; posts, photographs and descriptions; friendship and blocking relationships; and the information needed to deliver conversations and messages. Support or safety requests may create separate records.",
          "These are proposed categories, not permission to collect every possible field. The final notice must identify the information actually collected, its source, whether it is required, the purpose of each use and the legal grounds that apply in the launch regions.",
        ],
      },
      {
        id: "audience",
        title: "Who would see your content",
        paragraphs: [
          "Posts and gallery photographs are intended for accepted friends. Pending requests and profile discovery do not grant that audience. Messages are intended for their participants. The exact visibility of names, usernames, portraits and other profile details must be settled before accounts open.",
          "Friendship permissions do not prevent a recipient from taking a screenshot or keeping a copy. Authorised safety review, support access and any lawful disclosure also need explicit rules and access controls. This draft does not describe the product as end-to-end encrypted.",
        ],
      },
      {
        id: "purposes",
        title: "Why information would be used",
        paragraphs: [
          "The proposed purposes are to operate accounts, deliver content to its authorised audience, apply the product’s limits, prevent misuse and respond to requests. Any additional purpose needs its own explanation before it begins.",
          "No advertising or product-analytics integration is implemented in the preview. This draft does not authorise selling personal information, creating advertising profiles or using private conversations for targeting. The final policy must describe actual commercial and measurement practices rather than rely on those features being absent today.",
        ],
      },
      {
        id: "services",
        title: "Service providers and external links",
        paragraphs: [
          "When configured, Clerk handles sign-in and session information. PostgreSQL stores configured persistent records. Private-media storage, rate limiting and error monitoring are conditional integrations whose hosted settings and access still require review.",
          "When Sentry is configured, application-side filtering removes identity fields, request bodies, headers, cookies, query strings, breadcrumbs and arbitrary messages from outgoing events. This filtering is one safeguard, not a guarantee about every provider’s collection or retention. Session replay is not implemented.",
          "Live music searches send the entered song or artist query from the server to Apple’s catalogue. Artwork can be requested through the image optimiser. Choosing an Apple Music or Spotify link takes you to that service, where its own terms and privacy policy apply.",
          "The final notice must name the providers actually used, explain their purposes and identify relevant storage regions and international-transfer arrangements. This draft makes no approved hosting-location claim.",
        ],
      },
      {
        id: "retention",
        title: "How long information stays",
        paragraphs: [
          "The intended thirty-day life of a post or message concerns ordinary visibility. Permanent erasure, gallery photographs, account records, reports and backups need separate retention rules. Scheduled erasure and message expiry are not running in the public preview.",
          "The final policy must give actual periods or meaningful criteria for each category, explain justified exceptions and describe what happens when a backup is restored. No immediate deletion from every system or every recipient’s copy is promised.",
        ],
        links: [{ label: "Content and data retention", href: "/retention" }],
      },
      {
        id: "choices",
        title: "Your choices and requests",
        paragraphs: [
          "You can explore local profile changes and select account preview categories to download as a PDF, JSON or an archive with original photographs in Settings. Full account access, correction, export, objection and erasure processes are not open through the preview.",
          "Available rights depend on where you live and the service’s actual circumstances. Before launch, the policy must explain the applicable rights, identity checks, request and complaint routes, response periods and any permitted exceptions. This draft does not claim that a particular privacy law applies, or that Margin already complies with it.",
        ],
        links: [
          { label: "Your data", href: "/your-data" },
          { label: "Cookies and preferences", href: "/cookies" },
        ],
      },
      {
        id: "age",
        title: "Age and safety",
        paragraphs: [
          `The initial service is intended for adults ${MINIMUM_AGE} and over. Age controls and procedures for handling suspected underage accounts remain launch requirements. An adults-only policy does not settle every child-safety or privacy obligation.`,
          "Private content can still cause harm if shared without consent. The service needs a working reporting route and a documented approach to restricted evidence, reviewer access and review requests before live moderation begins.",
        ],
      },
      {
        id: "changes",
        title: "Changes and effective date",
        paragraphs: [
          "This draft has no effective date. Before it becomes an active policy, the operator must confirm the actual data flows, resolve the open points and complete legal and operational review. Material changes then need a clear notice process, with any consent or choices required for the change.",
        ],
      },
    ],
    related: [
      { label: "Your data", href: "/your-data" },
      { label: "Retention", href: "/retention" },
      { label: "Cookies", href: "/cookies" },
    ],
  },
  terms: {
    category: "Legal",
    title: "Terms of Service",
    intro:
      "The proposed ground rules for a small social space. This draft is not an active agreement.",
    draft: true,
    summary: [
      "Registration and acceptance of final terms are not open.",
      "Authors are intended to retain their content rights.",
      "Operator, licence and legal provisions still require review.",
    ],
    review: [
      "Contracting operator, launch regions and age/eligibility checks.",
      "A precise content licence and treatment of external services.",
      "Moderation, appeals, account closure and service-change procedures.",
      "Applicable consumer protections, governing law and dispute provisions.",
    ],
    sections: [
      {
        id: "accounts",
        title: "Accounts and eligibility",
        paragraphs: [
          policyStatus,
          `The initial minimum age is ${MINIMUM_AGE}. The proposed rules ask you to provide accurate account details, keep access and recovery methods secure and use your own identity without impersonating another person.`,
          "Accounts are not open through the public site. Looking at the website or trying a fictional preview is not presented here as acceptance of a final account agreement. The contracting operator and a clear acceptance process must be established before signup.",
        ],
      },
      {
        id: "posting",
        title: "Posting boundaries",
        paragraphs: [
          "The product is deliberately small. These shared rules describe the current posting allowance and the intended account experience.",
        ],
        points: postingPoints,
        links: [{ label: "How it works", href: "/how-it-works" }],
      },
      {
        id: "content",
        title: "Your content and your rights",
        paragraphs: [
          "The intended approach is for you to retain the rights you have in your writing and photographs. Sharing something on Margin should not transfer ownership of it to the platform.",
          "Operating the service would require limited permission to store, process and display content to its intended audience, and to make necessary delivery copies. The final licence must define its scope, duration and what happens on deletion, including justified retention exceptions. No complete content licence is created by this draft.",
          "Share only material you own, have permission to use or are otherwise entitled to share. Respect the privacy and consent of people appearing in photographs. Attribution is not a substitute for the rights needed to upload someone else’s work.",
        ],
        links: [{ label: "Copyright draft", href: "/copyright" }],
      },
      {
        id: "conduct",
        title: "Respect the people here",
        paragraphs: [
          "The proposed rules prohibit harassment, credible threats, exploitation, hateful abuse, impersonation, exposing private information, spam, fraud and attempts to gain unauthorised access.",
          "Do not bypass posting limits, interfere with other people’s accounts, or use automation to extract private content or relationships. Still photographs and words are supported; video, animated images, motion photos and video embeds are not permitted.",
        ],
        links: [
          { label: "Community Guidelines", href: "/community-guidelines" },
        ],
      },
      {
        id: "audience",
        title: "Audience and shared conversations",
        paragraphs: [
          "The proposed audience for posts and gallery photographs is accepted friends. A recipient can still save or share a copy outside Margin. Do not treat a limited audience as a guarantee that content can never leave it.",
          "Messages and post conversations can involve more than one person. The final terms must explain participants’ access, removal and report handling without granting unrestricted access to other people’s private material.",
        ],
      },
      {
        id: "retention",
        title: "Expiration, removal and copies",
        paragraphs: [
          "Posts and private messages are intended to leave ordinary views after thirty days. That does not mean that every backup, safety record, screenshot or downloaded copy is erased at the same instant.",
          "Gallery selection, deleting a post, deleting a photograph and closing an account have different effects. Final retention schedules and any lawful exceptions must be published before these become live promises.",
        ],
        links: [
          { label: "Retention draft", href: "/retention" },
          { label: "Your data", href: "/your-data" },
        ],
      },
      {
        id: "moderation",
        title: "Restrictions and review",
        paragraphs: [
          "The proposed approach is to restrict content or accounts when necessary to address rule violations, protect people or comply with applicable obligations. The final rules need to explain possible actions, notice, urgent exceptions and how a person can ask for a review.",
          "Reporting, moderation and appeals are not operational in the preview. A working process, reviewer permissions and evidence-retention rules must be in place before the service depends on them. No response time or particular enforcement outcome is promised here.",
        ],
      },
      {
        id: "external-services",
        title: "External services and availability",
        paragraphs: [
          "Links to music services and other websites open services run by other organisations. Those services have their own access requirements, terms and privacy practices. Margin does not provide an in-app music player.",
          "The product is in development. Availability, supported devices, pricing and launch regions have not been finalised. Final terms need an appropriate service-change and closure process, including notice and access to data where required.",
        ],
      },
      {
        id: "review",
        title: "What remains to be settled",
        paragraphs: [
          "The contracting operator, applicable law, content licence, account closure, consumer protections and liability and dispute provisions require qualified legal review. No arbitration clause, blanket liability waiver, incorporated-company status or surrender of mandatory rights is invented by this draft.",
          "A final effective date and a clear way to accept the reviewed terms are required before accounts open.",
        ],
      },
    ],
    related: [
      { label: "Community Guidelines", href: "/community-guidelines" },
      { label: "Privacy draft", href: "/privacy" },
      { label: "Copyright draft", href: "/copyright" },
    ],
  },
  "community-guidelines": {
    category: "Support",
    title: "Community Guidelines",
    intro:
      "Make room for other people. Respect their boundaries as well as your own.",
    draft: true,
    summary: [
      "These are proposed boundaries for the community.",
      "A small audience still deserves care and consent.",
      "Live reporting and appeals are not operational yet.",
    ],
    review: [
      "A working reporting route and urgent-escalation process.",
      "Reviewer access, evidence handling and retention.",
      "Decision notices, appeal handling and enforcement consistency.",
    ],
    sections: [
      {
        id: "respect",
        title: "Treat people with care",
        paragraphs: [
          "Disagreement and an awkward conversation are part of being around other people. Targeted cruelty, intimidation and attempts to make someone unsafe are different. A friendship connection is not permission to cross a boundary.",
        ],
        points: [
          "No harassment, credible threats, hateful abuse or targeted intimidation.",
          "No impersonation, doxxing, stalking or sharing someone’s private information without permission.",
          "No exploitation, sexual abuse material or non-consensual intimate content, including threats to share it.",
          "No fraud, spam, malicious links or attempts to compromise accounts.",
        ],
      },
      {
        id: "sharing",
        title: "Share responsibly",
        paragraphs: [
          "Have the rights and consent needed for what you share. Consider whether someone expected a photograph or conversation to remain private before passing it on. Cropping out a name does not always make a person unidentifiable.",
          "Words and still photographs are welcome within the product’s limits. Video, animated images, motion photos and video embeds are not permitted. Do not evade daily allowances by repeatedly reposting, creating extra accounts or using automation.",
        ],
        links: [{ label: "Posting rules", href: "/how-it-works#posting" }],
      },
      {
        id: "boundaries",
        title: "Let a boundary be a boundary",
        paragraphs: [
          "A declined request, an unanswered message or a removed friendship is not an invitation to keep trying through another account. Do not recruit other people to contact or pressure someone on your behalf.",
          "Access to a friend’s content is given for that relationship. Do not collect private posts, copy their gallery into another service or publish private conversations to embarrass them.",
        ],
      },
      {
        id: "moderation",
        title: "Reports and review",
        paragraphs: [
          "The preview can save a report in this tab, and you can review or download your saved reports in Settings. Reports are not delivered to a reviewer. Live moderation decisions and appeals are not operational. The final reporting route must explain how to identify the relevant content without sending unnecessary private material.",
          "Before invitations begin, Margin needs restricted reviewer access, a way to handle urgent risks, a record of reasons for decisions and a route to challenge mistakes. A report should not automatically become a permanent copy of every related conversation.",
          "The eventual response may depend on the seriousness and context of the conduct. Possible actions and any exceptions to notice must be published before enforcement begins. No moderation service level is promised by this draft.",
        ],
        links: [
          { label: "Reporting and appeals status", href: "/help#report" },
        ],
      },
      {
        id: "immediate-danger",
        title: "If someone is in immediate danger",
        paragraphs: [
          "Margin is not an emergency service, and the preview has no live response team. Use an appropriate local emergency service when immediate help is needed. Do not wait for a platform report to receive attention.",
        ],
      },
    ],
    related: [
      { label: "Help and reporting", href: "/help#report" },
      { label: "Contact status", href: "/contact" },
      { label: "Terms draft", href: "/terms" },
    ],
  },
  retention: {
    category: "Legal",
    title: "Content & Data Retention",
    intro:
      "A post can leave the feed before its last stored copy is erased. Here is how those lifetimes differ.",
    draft: true,
    summary: [
      "Thirty days is the intended life of posts and messages in ordinary views.",
      "Gallery photographs have a separate lifetime.",
      "Final erasure, backup and exception schedules remain under review.",
    ],
    review: [
      "Exact clocks and schedules for posts, comments, messages and Notebook.",
      "Permanent-erasure deadlines and recovery from failed deletion.",
      "Backup rotation, restoration controls and restricted safety/legal holds.",
      "Account, provider and security-record retention.",
    ],
    sections: [
      {
        id: "posts",
        title: "Posts and their conversations",
        paragraphs: [
          "The intended experience gives a post thirty days in ordinary views. Its conversation belongs with it. The local preview filters expired posts, but it is not running a scheduled permanent-erasure service.",
          "Expiry checks and deletion routines are being developed, but a live cleanup schedule has not been verified. The final policy needs a precise visibility clock, erasure deadline and treatment of comments when a post expires or is deleted.",
        ],
      },
      {
        id: "messages",
        title: "Messages and Notebook",
        paragraphs: [
          "Private messages are intended to expire after thirty days. The preview’s messages are a local simulation; delivery and expiry for real participants are not active.",
          "The final policy must explain whether timing is measured per message or conversation, how both participants’ views behave and what an export includes. Notebook is a separate notes-to-self feature. Its live retention period has not been decided and should not be assumed to match messages or last forever.",
        ],
      },
      {
        id: "gallery",
        title: "Gallery photographs",
        paragraphs: [
          "Photographs selected for Gallery are intended to stay until you remove or replace them. An image can be referenced by both a post and the gallery, so a post expiring does not necessarily remove the photograph from Gallery.",
          "Replacing a gallery selection only changes that selection. Delete photograph is a broader action: in the local preview it removes image references from your posts, gallery and drafts while preserving post text and conversations. Files selected from your device remain temporary browser references in this preview.",
          "Hosted photo erasure needs to handle storage failures, outstanding references and any retained versions. The final schedule and completion status remain to be verified.",
        ],
      },
      {
        id: "saved-music",
        title: "Profiles, preferences and saved music",
        paragraphs: [
          "Most preview profile and preference changes reset on refresh. A separately configured local database retains selected song metadata until it is changed or removed. No music audio is stored by that feature.",
          "For real accounts, identity, profile details, relationships and security records will need their own retention periods. Closing access to an account and erasing all account information are separate operations.",
        ],
      },
      {
        id: "backups",
        title: "Backups, reports and exceptions",
        paragraphs: [
          "No hosted backup schedule or legal-hold policy has been approved. The final policy must explain backup rotation, what happens after restoration and how erased or expired content is kept out of ordinary access.",
          "A safety investigation or applicable legal obligation may justify retaining a restricted record. The reasons, scope, permitted access and duration need to be defined. This draft does not create an indefinite exception for all reported content.",
        ],
      },
      {
        id: "copies",
        title: "Downloads and other copies",
        paragraphs: [
          "A screenshot, saved photograph or downloaded archive is outside the ordinary feed’s lifetime. Automatic expiry cannot erase copies held by other people or outside the service.",
          "The final account export and deletion processes need published scope, identity checks and timing. The selectable preview download includes available local records and selected photographs; it does not include hosted account records or make a deletion request.",
        ],
        links: [{ label: "Your data", href: "/your-data" }],
      },
    ],
    related: [
      { label: "Your data", href: "/your-data" },
      { label: "Privacy draft", href: "/privacy" },
      { label: "Help with photographs", href: "/help#gallery" },
    ],
  },
  copyright: {
    category: "Legal",
    title: "Copyright Policy",
    intro:
      "Share work you own, have permission to use, or are otherwise entitled to share.",
    draft: true,
    summary: [
      "Giving credit is not the same as having permission.",
      "A copyright complaint route is not open yet.",
      "The operator and applicable notice process need legal review.",
    ],
    review: [
      "Applicable law and any designated-agent registration.",
      "A working notice destination and required notice information.",
      "Removal notices, counter-notices and repeat-infringer procedures.",
    ],
    sections: [
      {
        id: "rights",
        title: "Respect creators",
        paragraphs: [
          "Photographs, writing, artwork and music can carry rights belonging to someone else. Before uploading or reproducing a work, make sure you have the permission or other legal entitlement needed for that use. Naming the creator or finding a file online does not by itself establish that permission.",
          "The proposed approach is for authors to retain their rights in their own content. Any permission Margin needs to store and display it belongs in a precise, reviewed content licence. Access to a music catalogue or artwork feed is not a general licence to republish its contents.",
        ],
      },
      {
        id: "notices",
        title: "If you believe your work has been copied",
        paragraphs: [
          "There is no operational copyright-notice destination on this page. The temporary support address is not a designated agent and must not be used to send a legal notice.",
          "A future complaint process should make it possible to identify the original work and the disputed material without publicly exposing private account content. Required contact information, statements and signatures depend on the applicable process and must be explained before submissions open.",
        ],
        points: [
          "Keep a reference to the work you believe is yours and where the disputed material appears.",
          "Do not collect unrelated private conversations or circulate the disputed material more widely.",
          "Do not submit a notice to a placeholder contact or assume it starts a legal response period.",
        ],
      },
      {
        id: "mistakes",
        title: "If your content is removed by mistake",
        paragraphs: [
          "The reviewed process needs to explain how an uploader is notified, how to challenge a mistaken identification and when a formal counter-notice is appropriate. A counter-notice can have legal consequences; a generic support reply should not be presented as its equivalent.",
          "No counter-notice form, reinstatement deadline or outcome is promised by this draft.",
        ],
      },
      {
        id: "process",
        title: "Before uploads open",
        paragraphs: [
          "The operator must confirm the applicable law and complete any required designated-agent registration, then publish the correct notice contact, notice and counter-notice procedure, repeat-infringer policy and escalation process. This draft does not claim DMCA safe-harbour eligibility.",
        ],
        links: [
          { label: "Contact status", href: "/contact" },
          {
            label: "U.S. Copyright Office: Section 512 resources",
            href: "https://www.copyright.gov/512/",
          },
        ],
      },
    ],
    related: [
      { label: "Terms draft", href: "/terms" },
      { label: "Community Guidelines", href: "/community-guidelines" },
    ],
  },
  cookies: {
    category: "Legal",
    title: "Cookies & Preferences",
    intro:
      "What stays in your browser, what depends on a connected service, and which details are still being checked.",
    draft: true,
    summary: [
      "Preview social state is held in tab memory.",
      "Configured sign-in can use essential session cookies.",
      "No advertising or product-analytics integration is implemented.",
    ],
    review: [
      "A deployed cookie and browser-storage inventory.",
      "Providers, purposes, lifetimes and first/third-party scope.",
      "Any required consent, withdrawal and regional opt-out controls.",
    ],
    sections: [
      {
        id: "current",
        title: "The current preview",
        paragraphs: [
          "Social interactions and reading preferences are held in memory rather than localStorage or sessionStorage. Refresh resets them. Device photographs use temporary browser references. A separately saved music selection belongs to the local database, rather than browser storage.",
          "The public page’s sample conversation is an illustration. Opening it does not create a social account or send a message. No advertising or product-analytics integration is implemented in the preview.",
        ],
      },
      {
        id: "authentication",
        title: "Sign-in and essential storage",
        paragraphs: [
          "When configured, Clerk manages session and authentication cookies. The final deployed service needs an exact inventory identifying each cookie or storage mechanism, who provides it, why it is used and how long it lasts.",
          "Development tooling and browser caching should be distinguished from production tracking. No claim that every future cookie is essential is made by this draft.",
        ],
      },
      {
        id: "browser-choices",
        title: "Your browser controls",
        paragraphs: [
          "Your browser lets you manage cookies and site data. Blocking essential sign-in storage may prevent an account session from working. Clearing browser data does not, by itself, submit an account-deletion request or erase information held by a service provider.",
          "In the current local preview, refreshing resets in-memory social changes. It does not remove a separately persisted music selection from the local database.",
        ],
      },
      {
        id: "preferences",
        title: "Before any optional tracking",
        paragraphs: [
          "The preview has no consent banner or nonessential-tracking switch because those integrations are not implemented. Their absence is not a conclusion that consent obligations could never apply.",
          "Before introducing optional measurement or advertising, Margin needs to explain the actual data flow and provide any consent, withdrawal or opt-out controls required in the regions it serves. A visual switch must correspond to a working choice.",
        ],
        links: [{ label: "Privacy draft", href: "/privacy" }],
      },
    ],
    related: [
      { label: "Privacy draft", href: "/privacy" },
      { label: "Your data", href: "/your-data" },
    ],
  },
  accessibility: {
    category: "Legal",
    title: "Accessibility Statement",
    intro: "Room for different ways of reading, navigating and taking part.",
    draft: true,
    summary: [
      "Keyboard access, larger text and reduced motion are part of the interface.",
      "Gallery controls offer alternatives to dragging.",
      "Independent conformance verification is still outstanding.",
    ],
    review: [
      "A defined audit scope and accessibility conformance target.",
      "Manual screen-reader, zoom, reflow and real-device checks.",
      "A working feedback route and a process for addressing barriers.",
    ],
    sections: [
      {
        id: "support",
        title: "Reading and navigation",
        paragraphs: [
          "The interface uses semantic headings and labels, visible keyboard focus and dialog focus management. Your browser’s zoom remains available. The local application’s Settings offers larger text and a reduced-motion preference, and system reduced-motion preferences are respected.",
          "Use Tab and Shift+Tab to move between controls. Enter or Space activates buttons. Escape closes supported dialogs and returns focus to the control that opened them. Post conversations can be opened with a button rather than a gesture.",
        ],
      },
      {
        id: "photographs",
        title: "Photographs and alternatives to dragging",
        paragraphs: [
          "The photograph picker asks for a description of what is visible for people using screen readers. Captions and post text can provide the story around the photograph. Gallery arrangement includes keyboard and explicit move controls alongside dragging.",
          "Public landing-page photographs are static illustrations with text alternatives. They do not open a viewer or require precise pointer actions.",
        ],
      },
      {
        id: "verification",
        title: "What still needs review",
        paragraphs: [
          "Accessibility is an ongoing responsibility. Component checks and intended behaviour do not establish conformance across a complete service. No WCAG conformance or certification is claimed by this draft.",
          "The review scope still needs to include screen-reader and browser combinations, text spacing, enlarged text, narrow reflow, contrast in all states, mobile keyboards, error recovery and real-device use. The target standard and known limitations must be published after an appropriate assessment.",
        ],
        links: [
          {
            label: "W3C: Web Content Accessibility Guidelines 2.2",
            href: "https://www.w3.org/TR/WCAG22/",
          },
        ],
      },
      {
        id: "contact",
        title: "Tell us what gets in the way",
        paragraphs: [
          "A working accessibility contact must be confirmed before launch. A useful report describes the page, the task you were trying to complete and the barrier you encountered. Browser or assistive-technology details can help, but only share information you are comfortable providing.",
          temporaryContact,
        ],
        links: [{ label: "Contact status", href: "/contact" }],
      },
    ],
    related: [
      { label: "Help", href: "/help#accessibility" },
      { label: "Contact status", href: "/contact" },
    ],
  },
} satisfies Record<string, PublicDocumentData>;
