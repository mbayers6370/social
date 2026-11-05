import {
  MINIMUM_AGE,
  POSTING_RULE_SUMMARY,
  POSTING_EDIT_RULE,
  POSTING_EXCLUSIONS,
} from "@/lib/platform-rules";
import {
  MESSAGE_LIFETIME_DAYS,
  NOTEBOOK_LIFETIME_DAYS,
} from "@/lib/message-policy";
import type { PublicDocumentData } from "./public-document";
import { publicSiteDetails } from "./site-details";

const postingPoints = [
  POSTING_RULE_SUMMARY,
  POSTING_EDIT_RULE,
  POSTING_EXCLUSIONS,
  "Your posting day runs from midnight to midnight in your account’s saved time zone. Changing time zones does not give you a fresh allowance; recent usage carries forward for at least 24 hours.",
  "A link pasted into your post text counts as a link-containing post, too.",
];
const supportContact =
  "Email " +
  publicSiteDetails.supportEmail +
  ". Never send your password, verification codes, recovery codes, or identity documents in an initial message.";
const photoProcessing =
  "Your uploaded photographs are checked for supported file type, size, and dimensions, then re-encoded with embedded source metadata removed. These technical and privacy checks are not automated content moderation: they do not determine whether an image is safe, lawful, or appropriate. Visible details in a photograph can still identify you or reveal a location.";
const messagePrivacy =
  "Your messages are stored on our servers and are not end-to-end encrypted. Your Notebook is for notes to yourself. Reporting a message can make the reported message available to the founder for a safety review; it does not open your entire inbox to other members.";
const removalScope =
  "Deactivation ends your account access and removes your posts, Gallery placements, friendships, and messages from the active service. Your photographs become unavailable and are queued for storage cleanup. It does not automatically erase your sign-in identity with Clerk, every remaining account or safety record, or backups. Email support for a complete account-erasure request.";

export const publicDocuments = {
  "why-margin": {
    category: "Explore",
    title: "Friendship, with room around it.",
    intro:
      "A place for the people in your life. And a little more space for life itself.",
    summary: [
      "Keep up with friends, without performing for an audience.",
      "Read a feed that runs newest first and has an end.",
      "Share a little, then get back to your day.",
    ],
    sections: [
      {
        id: "enough",
        title: "Catch up. Then carry on.",
        paragraphs: [
          "A friend found a café. Someone finally finished that book. There’s a photograph from a walk you would have liked. Ordinary things matter more when you know who shared them.",
          "Your feed brings those moments together in chronological order. You won’t find recommended strangers, ads, or like counts in the feed. When you’ve caught up, you’ve caught up. There’s no obligation to keep scrolling.",
        ],
      },
      {
        id: "boundaries",
        title: "Leave a little room.",
        paragraphs: [
          "You can share up to three regular posts a day, or one link-containing post as your only post that day. It’s an allowance, not a quota. You don’t need to post every day to belong here.",
          "Your posts expire after 30 days. Your Gallery gives you room for up to 20 photographs you want to keep. Words and still photographs leave room to pause without another video starting.",
          "Expiration is not a promise to erase screenshots, exports, or backups at the same moment. You deserve to know that difference before you share.",
        ],
        links: [
          { label: "How Margin works", href: "/how-it-works" },
          { label: "Expiration and deletion", href: "/retention" },
        ],
      },
      {
        id: "conversation",
        title: "Make room for each other.",
        paragraphs: [
          "A post can become a conversation. A photograph can become a plan for Saturday. You can reply beneath a post, write privately to a friend, or save a thought in your own Notebook.",
          "Your profile brings together your introduction, photographs, On Repeat song, and optional Top 4 friends. You choose what to share. You can leave Top 4 empty or hide it entirely.",
        ],
      },
      {
        id: "about",
        title: "About Margin",
        paragraphs: [
          "You’re joining an independently operated social space based in California, built around mutual friendship, a little restraint, and respect for your attention.",
          "You join through an invitation from someone already here. An invitation doesn’t make you friends automatically; you both choose that separately. Our launch is planned for adults in the United States.",
          "You can reach us at " +
            publicSiteDetails.supportEmail +
            ". If something feels confusing, unsafe, or out of step with these values, tell us.",
        ],
      },
    ],
    related: [
      { label: "How it works", href: "/how-it-works" },
      { label: "Community Guidelines", href: "/community-guidelines" },
    ],
  },
  "how-it-works": {
    category: "Explore",
    title: "How Margin works",
    intro: "Your people. A few clear boundaries. Plenty of room within them.",
    summary: [
      "Join by invitation and connect through mutual friendship.",
      "Share up to three regular posts a day, or one link-containing post.",
      "Keep photographs in Gallery and conversations in their own space.",
    ],
    sections: [
      {
        id: "joining",
        title: "Start with an invitation",
        paragraphs: [
          "Open the invitation link someone sent you, verify your email, and set up your profile. If you already have an account, choose Sign in. You don’t need another invitation to return.",
          "You can keep up to three personal invitations open at once. An accepted, expired, or withdrawn invitation frees a place for another. Your invitations expire after 30 days. Share them thoughtfully rather than posting them publicly.",
        ],
      },
      {
        id: "friends",
        title: "Choose your people",
        paragraphs: [
          "Find someone by name or username and send a friend request. You become friends when they accept. A pending request doesn’t give either of you access to the other’s personal posts or Gallery.",
          "Your name, username, bio, and profile-sized portrait can help other signed-in members recognize you. Your personal posts, Gallery, On Repeat, and visible Top 4 are for accepted friends. Your Top 4 doesn’t replace or publish your full friend list.",
          "Your feed shows friends’ posts and posts from Spaces you’ve chosen to include, newest first. Your own personal posts are on your profile. Like counts stay inside post conversations, outside the feed.",
        ],
      },
      {
        id: "posting",
        title: "Share a little",
        paragraphs: [
          "Write a post, add still photographs if you like, and choose Publish. You can also share a link, with a different daily allowance.",
        ],
        points: postingPoints,
      },
      {
        id: "conversations",
        title: "Keep the conversation going",
        paragraphs: [
          "Choose the conversation icon on a post to read comments, reply, or add a thought. A post conversation shares the post’s audience; it is not a private direct message.",
          "Use Messages to write to another member when your relationship and both members’ messaging settings allow it. Use Notebook for notes to yourself. Enter sends a message or saves a note; Shift+Enter starts a new line.",
          "Each message expires " +
            MESSAGE_LIFETIME_DAYS +
            " days after it is sent. Each Notebook note expires " +
            NOTEBOOK_LIFETIME_DAYS +
            " days after it is saved. You can download an available conversation before it expires.",
          messagePrivacy,
        ],
      },
      {
        id: "thirty-days",
        title: "Let the everyday move on",
        paragraphs: [
          "Your posts expire 30 days after publication. Editing doesn’t restart the clock. When a post expires, its conversation is no longer available through the app.",
          "A photograph you keep in Gallery can outlive the post that used it. Copies someone downloaded or captured have their own lifetime. Read Retention for the difference between losing access and finishing storage cleanup.",
        ],
        links: [{ label: "Expiration and deletion", href: "/retention" }],
      },
      {
        id: "gallery",
        title: "Keep the photographs you choose",
        paragraphs: [
          "Your Gallery holds up to 20 photographs, with up to three featured on your profile. Open Arrange to move or feature photographs. You can drag, use the move controls, or use the keyboard. Done saves your arrangement; Cancel leaves it as it was.",
          "A direct Gallery upload uses your daily photo allowance without publishing a feed post. Reusing a photograph already in your library does not upload it again.",
          "Deleting a post keeps its Gallery photographs unless you choose to delete the photographs, too. Deleting a photograph removes its placements across your Gallery, portrait, and posts, while keeping surrounding post text and conversations.",
        ],
      },
      {
        id: "media",
        title: "Words, photographs, and a little music",
        paragraphs: [
          "You can upload still JPEG, PNG, and WebP photographs up to 8 MB, 10,000 pixels on either side, and 40 megapixels total. Export HEIC or HEIF photographs as JPEG or PNG first. Video, animated images, motion photos, and video embeds aren’t supported.",
          photoProcessing,
          "Choose a song for On Repeat to share what you keep coming back to. Listening links open an external music service; Margin doesn’t play or store music audio.",
        ],
      },
      {
        id: "spaces",
        title: "Gather in a Space",
        paragraphs: [
          "You can create an invitation-only Space for a group, with optional plans and RSVPs. A Space has its own members and permissions. Someone in the same Space may not be your friend, so check the audience before posting.",
          "Space administrators can invite their accepted friends. Joining a Space doesn’t automatically create friendships or grant access to personal Galleries. You can choose whether a Space’s posts appear in your feed. Public Event Spaces are currently unavailable.",
        ],
      },
      {
        id: "eligibility",
        title: "For adults",
        paragraphs: [
          "Your minimum signup age is " +
            MINIMUM_AGE +
            ". Our launch is planned for people in the United States. Please don’t create an account for a child or help someone bypass account restrictions.",
        ],
        links: [
          { label: "Community Guidelines", href: "/community-guidelines" },
          { label: "Help", href: "/help" },
        ],
      },
    ],
    related: [
      { label: "Why Margin", href: "/why-margin" },
      { label: "Help", href: "/help" },
      { label: "Your data", href: "/your-data" },
    ],
  },
  help: {
    category: "Support",
    title: "A little help",
    intro:
      "Find your way around, change what you share, or get help with something that isn’t right.",
    summary: [
      "Your posts, friends, photographs, and messages have their own controls.",
      "Your daily allowance follows your saved time zone.",
      "You can reach us at " + publicSiteDetails.supportEmail + ".",
    ],
    sections: [
      {
        id: "account",
        title: "Join or sign in",
        paragraphs: [
          "If you’re new, open an invitation link from someone already on Margin. Verify the invited email address and finish setting up your profile. You must be " +
            MINIMUM_AGE +
            " or older.",
          "If you already have an account, choose Sign in and use your existing sign-in method. A message about invitations is for new accounts. If you can’t reach your existing account, contact support with the error wording and your account email. Never include verification codes.",
        ],
      },
      {
        id: "posting",
        title: "Publish a post",
        paragraphs: [
          "Open New Post on your profile or use the composer in your feed. Add your words and photographs, then choose Publish. A selected photograph isn’t published until you submit the post.",
        ],
        points: postingPoints,
      },
      {
        id: "edit-post",
        title: "Edit or delete a post",
        paragraphs: [
          "Open the post on your profile and choose Edit. Your saved edits keep the original publication date, expiration, and conversation. On mobile, look for the edit icon.",
          "Deleting a post also removes its comments and likes. If it has photographs, you can choose whether to delete those photographs, too. Leave that option unchecked to keep photographs in Gallery. Deleting either a post or a photograph does not refill your daily allowance.",
        ],
      },
      {
        id: "saving",
        title: "Check whether a change saved",
        paragraphs: [
          "Settings options save as you change them. Look for the saved confirmation beside the option. Profile, post, Top 4, and Gallery editors use their own Save or Done button.",
          "If a submission’s result is uncertain, use the recovery action to check what saved before submitting again. Keep the draft open until you know the result. Unpublished drafts are temporary and aren’t a backup; save important writing elsewhere before closing or refreshing your browser.",
        ],
      },
      {
        id: "expiration",
        title: "Understand expiration",
        paragraphs: [
          "Your posts and direct messages expire after 30 days. Notebook notes expire after 90 days. Editing a post or adding a new message does not extend an older item’s deadline.",
          "You can download available content before it expires. Gallery photographs remain while you keep them there. Screenshots, downloads, backups, and safety records have separate limits.",
        ],
        links: [{ label: "Retention", href: "/retention" }],
      },
      {
        id: "gallery",
        title: "Organize or delete photographs",
        paragraphs: [
          "Open Gallery from your profile. Choose Add photo to upload or Arrange to change the order and featured selection. You have 20 Gallery places and three featured positions. Unfeature a photograph to free a featured position.",
          "Choose Done to save an arrangement. Cancel discards that arrangement draft. Move controls and keyboard actions let you arrange photographs without dragging.",
          "Delete photograph removes that photograph from its placements, including attached posts and your portrait if used there. The surrounding post text and conversation stay. Review the confirmation carefully; deletion isn’t the same as changing which photographs are featured.",
        ],
      },
      {
        id: "photo-problem",
        title: "If a photograph won’t attach",
        points: [
          "Choose a still JPEG, PNG, or WebP file of 8 MB or less. Export HEIC or HEIF first; video, animation, and motion photos aren’t supported.",
          "Keep the image within 10,000 pixels per side and 40 megapixels total. If it can’t be read, export a fresh JPEG or PNG copy.",
          "Check your daily photo allowance and Gallery capacity. The picker explains which limit needs attention. An image description is not required.",
          "Wait for the preview before publishing. If the upload fails, keep your draft and try the available retry action.",
        ],
        paragraphs: [photoProcessing],
      },
      {
        id: "profile",
        title: "Make your profile yours",
        paragraphs: [
          "Choose Edit profile to change your name and bio. In Settings, you can change your username once after setup. After that, it’s permanent. Usernames have 3–24 letters, numbers, or underscores, start with a letter, and are saved in lowercase.",
          "Use On Repeat to choose your profile song. Use Top 4 → Edit to select up to four accepted friends and arrange them. You can hide Top 4 or leave it empty; an empty or hidden selection won’t reserve space on a visitor’s profile view.",
        ],
      },
      {
        id: "managing-friends",
        title: "Manage friendships and boundaries",
        paragraphs: [
          "Find a profile and choose Add friend. In Friends, you can accept or decline received requests and cancel sent requests. Friendship is mutual; a sent request alone doesn’t unlock personal content.",
          "Unfriend removes the relationship and access to friend-only content. Block also prevents contact and access between your accounts. Unblocking doesn’t restore a friendship automatically. A shared Space has its own audience, and removing a friend does not erase copies they already saved.",
        ],
      },
      {
        id: "messages",
        title: "Write a message or a note",
        paragraphs: [
          "Open Messages and choose a conversation. Enter sends; Shift+Enter starts a new line. In Notebook, Enter saves a note to yourself. Your composer stays below the conversation as you write.",
          "You can turn messaging off in Settings. That stops reads and sends for conversations involving your account, including existing conversations, while the underlying retention deadlines continue. Turning it back on restores access to content that hasn’t expired.",
          "Download an available conversation from its header. Your account download can include available messages and Notebook notes. Unsent drafts stay in the current tab and aren’t included in the saved-account export.",
          messagePrivacy,
        ],
      },
      {
        id: "notifications",
        title: "Choose what gets your attention",
        paragraphs: [
          "The bell brings together in-app activity such as friendship requests, comments, replies, messages, and Space invitations. Opening an item marks it read and takes you to the related content. You can also mark all as read.",
          "Choose notification categories in Settings. Like notifications are off by default for new accounts. These controls manage in-app notifications; they don’t promise email or phone push delivery.",
        ],
      },
      {
        id: "privacy-safety",
        title: "Know who can see what",
        paragraphs: [
          "Your profile introduction can be found by other signed-in members. Your personal posts and Gallery require accepted friendship. Space posts are for eligible Space members; post comments share the post’s audience.",
          "Only share something you’re comfortable with its recipients keeping. They may save or capture it. Your content is access-controlled, but messages aren’t end-to-end encrypted and reported content can be reviewed for safety.",
        ],
        links: [
          { label: "Privacy", href: "/privacy" },
          { label: "Community Guidelines", href: "/community-guidelines" },
        ],
      },
      {
        id: "your-data",
        title: "Download your information or leave",
        paragraphs: [
          "In Settings, open the account download, choose the categories you want, and prepare an archive or PDF. You can include your available photographs. Expired or erased content cannot be reconstructed for the download.",
          removalScope,
        ],
        links: [{ label: "Your data", href: "/your-data" }],
      },
      {
        id: "report",
        title: "Report harm or a problem",
        paragraphs: [
          "Use Report in the relevant profile, post, comment, or message options. Choose a reason and add only the context needed to understand what happened. You can see your submitted reports in Settings. A report can make the reported content and your explanation available for founder review.",
          "For a bug, email the page, what you tried, what happened, and your browser or device. Remove private information from screenshots. For a safety concern you can’t report in the app, email a brief description and the relevant account or content reference. Don’t forward intimate images, exploitative material, or unrelated private conversations.",
          "Margin is not an emergency service and reports aren’t monitored around the clock. If someone faces immediate danger, contact the appropriate local emergency service rather than waiting for a reply.",
          supportContact,
        ],
        links: [{ label: "Contact", href: "/contact" }],
      },
      {
        id: "appeals",
        title: "Ask us to review a decision",
        paragraphs: [
          "If you think a restriction or removal is a mistake, email support with your username, the relevant decision or content reference, and a short explanation. Use “Review request” in the subject. This is a manual request, not an automatic reinstatement or a promise of a particular outcome or response time.",
          "We may need to verify your connection to the account. Don’t create another account to bypass a restriction or contact someone who has blocked you.",
        ],
      },
      {
        id: "accessibility",
        title: "Make reading more comfortable",
        paragraphs: [
          "In Settings, choose larger text or reduced motion. You can also use your browser’s zoom. Use Tab and Shift+Tab to move between controls, and Escape to close supported dialogs. Gallery move controls and conversation buttons give you alternatives to dragging and swiping.",
        ],
        links: [{ label: "Accessibility", href: "/accessibility" }],
      },
    ],
    related: [
      { label: "Contact", href: "/contact" },
      { label: "How it works", href: "/how-it-works" },
      { label: "Your data", href: "/your-data" },
    ],
  },
  contact: {
    category: "Support",
    title: "Get in touch",
    intro: "A question, a rough edge, or something we could explain better.",
    summary: [
      "Email " + publicSiteDetails.supportEmail + ".",
      "Share enough to help us understand, without sending unnecessary private information.",
      "For immediate danger, contact your local emergency service.",
    ],
    sections: [
      {
        id: "support",
        title: "Email Margin",
        paragraphs: [
          supportContact,
          "You can use this inbox for support, privacy requests, safety concerns, accessibility feedback, and requests to review a decision. This page opens your email app; it doesn’t submit a form or send a message on your behalf. We don’t offer round-the-clock support or a guaranteed response time.",
        ],
        links: [
          {
            label: "Email support",
            href: "mailto:" + publicSiteDetails.supportEmail,
          },
        ],
      },
      {
        id: "feedback",
        title: "Help us understand the problem",
        points: [
          "Tell us which page or feature you used and what you expected.",
          "Include what happened instead and any visible error wording.",
          "Mention your browser and device if they matter to the problem.",
          "Send a screenshot only if useful, with private information removed.",
        ],
        links: [{ label: "Browse Help", href: "/help" }],
      },
      {
        id: "safety",
        title: "For a safety concern",
        paragraphs: [
          "If you can, report the content through its options in the app. That gives the review a specific reference. If you can’t access the account or content, email a brief explanation and the reference you have.",
          "Don’t send harmful or intimate files, identity documents, or entire message archives in an initial email. Your report may require access to the reported content; it doesn’t authorize an unrestricted search of your private account.",
          "If someone is in immediate danger, don’t wait for us. Contact the appropriate local emergency service.",
        ],
        links: [
          { label: "Reporting and review", href: "/help#report" },
          { label: "Community Guidelines", href: "/community-guidelines" },
        ],
      },
      {
        id: "data-copyright",
        title: "For privacy or copyright",
        paragraphs: [
          "For a privacy request, use “Privacy request” in the subject and tell us what you need. For a copyright concern, use “Copyright” and identify the work and the material you believe infringes it. You don’t need an account to raise a concern.",
          "General support correspondence is not a court filing, service of legal process, or a substitute for any formal copyright notice that requires a designated agent. Our Copyright page explains the current notice status.",
        ],
        links: [
          { label: "Your data", href: "/your-data" },
          { label: "Copyright", href: "/copyright" },
        ],
      },
    ],
    related: [
      { label: "Help", href: "/help" },
      { label: "Privacy", href: "/privacy" },
    ],
  },
  "your-data": {
    category: "Legal",
    title: "Your data",
    intro:
      "You should be able to understand what you share, keep a copy, and ask to leave.",
    summary: [
      "Download available account information from Settings.",
      "Edit or remove your own content with the controls beside it.",
      "Deactivation and complete account erasure are different.",
    ],
    sections: [
      {
        id: "account-export",
        title: "Take a copy with you",
        paragraphs: [
          "In Settings, open the account download and choose the categories you want. Prepare an archive with available photographs or a readable PDF. You can also download an available conversation from its header.",
          "Your download can include your profile and music, posts, photographs and Gallery arrangement, comments and likes, relationships, messages, Notebook notes, notifications, preferences, and your reports. It doesn’t expose provider credentials, private storage keys, other people’s full accounts, or other people’s reports.",
          "Unpublished drafts remain in your tab and are excluded from the saved-account export. Expired and erased content isn’t recoverable through a download. If your account needs an assisted export or a category is missing, email support.",
        ],
      },
      {
        id: "correction",
        title: "Change what you share",
        paragraphs: [
          "Use Edit profile for your name and bio, Settings for your one permitted username change, and the controls beside your posts, Gallery, Top 4, and On Repeat for those choices. Settings options save as you change them; editors with a Save or Done button need that final step.",
          "Your personal posts and Gallery are for accepted friends. Your profile introduction can be visible to other signed-in members. Removing a friendship changes access; it does not erase a screenshot or downloaded copy.",
        ],
        links: [{ label: "Help with your profile", href: "/help#profile" }],
      },
      {
        id: "delete-account",
        title: "Deactivate or request erasure",
        paragraphs: [
          "Download anything you want to keep before deactivating. In Settings → Account removal, choose Deactivate account and follow the confirmation.",
          removalScope,
          "For complete erasure, email “Privacy request — account erasure” from the email associated with your account if possible. Tell us your username. We may need to verify ownership and explain any information that must remain for a legal obligation or a specific safety or security reason. Don’t send identification documents unless we arrange a suitable verification method.",
        ],
      },
      {
        id: "requests",
        title: "Ask about your information",
        paragraphs: [
          "Email support to request access, correction, deletion, or an explanation of how your information is used. Describe what you need and the account involved. If you’re acting for someone else, we may need to verify that you’re authorized.",
          "Your rights and the time limits for responding depend on applicable law. You can raise a concern without being penalized for exercising a protected right. If a request can’t be completed, you can ask for the reason and another review. These pages don’t limit any rights you have under the law.",
          supportContact,
        ],
      },
      {
        id: "copies",
        title: "Know the limits of removal",
        paragraphs: [
          "Copies you or another recipient saved outside Margin are outside our control. Backups, provider records, and restricted safety or legal records have separate retention needs. Deactivation doesn’t promise instant erasure from every system.",
          "Your account download is personal. Keep it somewhere safe, especially if it includes conversations or photographs involving other people.",
        ],
        links: [
          { label: "Retention", href: "/retention" },
          { label: "Privacy", href: "/privacy" },
        ],
      },
    ],
    related: [
      { label: "Privacy", href: "/privacy" },
      { label: "Retention", href: "/retention" },
      { label: "Contact", href: "/contact" },
    ],
  },
  privacy: {
    category: "Legal",
    title: "Privacy Policy",
    draft: true,
    intro:
      "What you share, why we need it, who can see it, and the choices you have.",
    summary: [
      "Your personal posts and Gallery are for accepted friends; Spaces have their own members.",
      "Your messages are stored on our servers and are not end-to-end encrypted.",
      "You can download your information and contact us about your privacy.",
    ],
    sections: [
      {
        id: "operator",
        title: "About Margin",
        paragraphs: [
          "You’re using Margin, an independently operated service based in California. You can contact us about this policy or your information at " +
            publicSiteDetails.supportEmail +
            ". Our launch is planned for adults in the United States.",
          "This draft explains the current application’s data practices. Before it takes effect, we need to confirm the required legal operator information and hosted provider, cookie, and retention details. You’ll see an effective date when that review is complete.",
        ],
      },
      {
        id: "information",
        title: "What you give us",
        points: [
          "Account information: your sign-in identifier, email verification and adult-eligibility confirmations, username, profile name, bio, portrait, and account status. Clerk manages your authentication and recovery information.",
          "What you share: posts, links, comments, likes, uploaded photographs, Gallery arrangement, On Repeat selections, and optional Top 4 selections.",
          "Your relationships and conversations: friend requests, accepted friendships, blocks, Space memberships and invitations, RSVPs and plans you enter, direct messages, and Notebook notes.",
          "Your choices and requests: saved time zone, reading and motion settings, notification and messaging choices, reports, review requests, and support correspondence.",
        ],
        paragraphs: [
          "Only provide information you’re comfortable sharing with its audience. Your saved time zone determines posting limits; it isn’t a request for your precise device location. Age confirmation is not a promise that every member’s age or identity has been independently verified.",
        ],
      },
      {
        id: "technical",
        title: "Information used to run the service",
        paragraphs: [
          "When you visit or sign in, your browser and our providers exchange information needed to deliver pages and manage sessions, such as network addresses, browser details, session identifiers, and request times. Hosting and authentication providers may maintain their own security logs.",
          "We keep publication and upload records to enforce daily limits, including after you delete a post or photograph. We also maintain records needed to prevent misuse, retry failed cleanup, and record safety decisions.",
          "When error monitoring is configured, our application filters identifying fields and private request content from diagnostic events. No session replay is implemented. Filtering is a safeguard, not a guarantee that no provider ever receives connection information.",
        ],
      },
      {
        id: "purposes",
        title: "Why we use your information",
        points: [
          "To create and authenticate your account, recover access, and deliver the features you choose.",
          "To show content to its permitted audience and save your settings, relationships, and conversations.",
          "To enforce limits, prevent fraud and abuse, investigate reports, and keep the service working.",
          "To answer your requests, carry out deletion and export, and meet applicable legal obligations.",
        ],
        paragraphs: [
          "You won’t find ads or advertising profiles in the current Margin experience. We don’t use your private conversations for advertising. If our practices change, we’ll update this policy and provide any notice or choice the law requires before a new use begins.",
        ],
      },
      {
        id: "audience",
        title: "Who can see what you share",
        paragraphs: [
          "Other signed-in members can find your profile introduction, including your name, username, bio, and a profile-sized portrait. Finding you or sending a request does not unlock your personal posts or Gallery. Those require accepted friendship. On Repeat and visible Top 4 also require access to your private profile.",
          "A Space has its own audience. Eligible members may see Space posts even if they aren’t your friends. Comments share the post’s audience. Direct messages are for their participants, subject to current account, relationship, blocking, and messaging settings. Notebook notes are for you.",
          messagePrivacy,
          "The founder’s report-review tools can access reported content that remains available and your submitted explanation, and can record a decision or take enforcement action. These tools do not provide a general-purpose browser of private messages. Necessary support, security, legal, or infrastructure access is separate from what another member can see.",
          "A recipient can take a screenshot, download content, or share a copy outside Margin. Access controls can’t prevent every misuse by someone who already received it. Avoid sharing passwords, financial credentials, or information whose disclosure would put you at risk.",
        ],
      },
      {
        id: "photographs",
        title: "How your photographs are processed",
        paragraphs: [
          photoProcessing,
          "Your uploaded photograph is stored privately and delivered through access checks for its current use. Reusing a photograph across a post, Gallery, or portrait references the same stored asset. A profile-sized portrait may be visible to signed-in members who can see your introduction; your original photograph has its own access restrictions.",
        ],
      },
      {
        id: "services",
        title: "Providers and other disclosures",
        paragraphs: [
          "Your account uses Clerk for authentication, PostgreSQL for saved information, private object storage through Cloudflare R2 for hosted photographs, and Upstash Redis for session checks and rate limits. Sentry may receive filtered error diagnostics when enabled. Hosting and support email providers also process the requests or correspondence needed for their services. The final hosted inventory and provider retention details are still under review.",
          "A music search sends your song or artist query to Apple’s catalog through our server. Music artwork may be fetched for display. If you open an Apple Music, Spotify, or other external link, you use that provider’s service under its own terms and privacy policy.",
          "Information may need to be disclosed in response to valid legal process or to address a specific safety, fraud, or security concern. That is not permission to publish everyone’s private content. If the service changes ownership, any transfer of personal information must remain subject to applicable law and the disclosures required for that change.",
          "A U.S. launch does not mean every provider processes information only in the United States. We won’t promise a storage location or international-transfer arrangement that hasn’t been verified.",
        ],
      },
      {
        id: "retention",
        title: "How long information stays",
        paragraphs: [
          "Posts and direct messages expire after 30 days; Notebook notes expire after 90 days. Expired content is excluded from ordinary access and exports. A separate cleanup process removes expired records and unreferenced photographs; failures can delay physical deletion without restoring access.",
          "Gallery photographs can stay while you keep them. Account information, relationships, reports, security records, provider records, and backups have separate purposes and retention needs. The final backup and restricted-record schedules still need to be published. We don’t promise erasure from every copy at the instant content expires.",
        ],
        links: [{ label: "Retention details", href: "/retention" }],
      },
      {
        id: "choices",
        title: "Your choices and privacy requests",
        paragraphs: [
          "You can edit your profile, manage friendships and blocks, choose notifications and messaging settings, download available account information, and deactivate your account. For full erasure or another privacy request, email support. We may need to verify your connection to the account without collecting unnecessary information.",
          "Applicable rights may include access, correction, deletion, and other controls or review rights. Their scope depends on the law and your circumstances. You can ask what applies to your request; this policy does not waive mandatory protections or promise that a particular statute covers every account.",
          "You can manage cookies and site data through your browser. Clearing browser data may sign you out, but it does not erase your server-stored account.",
        ],
        links: [
          { label: "Your data", href: "/your-data" },
          { label: "Cookies", href: "/cookies" },
        ],
      },
      {
        id: "age",
        title: "If an account belongs to a child",
        paragraphs: [
          "You must be " +
            MINIMUM_AGE +
            " or older to join. Margin is not intended for children. If you believe a child has an account or their information has been shared without appropriate permission, contact support with the minimum details needed to identify the concern. Don’t send a child’s identity documents or additional sensitive material in an initial message.",
        ],
      },
      {
        id: "changes",
        title: "Changes to this policy",
        paragraphs: [
          "You’ll be able to find the effective date and current policy here. Material changes will need clear notice and any consent or choices required by law. This draft has no effective date and is not a claim of completed legal review or a certified security guarantee.",
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
    draft: true,
    intro:
      "Your responsibilities, your content, and the boundaries of using Margin.",
    summary: [
      "You keep the rights you have in your content.",
      "Respect other people’s safety, privacy, and ownership.",
      "No provision here takes away rights the law does not let you waive.",
    ],
    sections: [
      {
        id: "accounts",
        title: "Your account",
        paragraphs: [
          "You must be " +
            MINIMUM_AGE +
            " or older and legally able to agree to the service’s terms. Our launch is planned for adults in the United States. Use accurate account information, protect your sign-in and recovery methods, and don’t impersonate someone else or transfer an account to evade a restriction.",
          "An invitation is permission to begin joining, not a guarantee of continued access, a friendship, or approval of everything another member shares. Don’t sell invitations, use them for spam, or help someone bypass a safety restriction.",
          "You are reading draft terms. They do not create an active agreement. The contracting operator details, acceptance process, and effective date need legal review before these terms take effect.",
        ],
      },
      {
        id: "posting",
        title: "Your posting allowance",
        paragraphs: [
          "You can share within the limits below. These limits keep the service small; you don’t have an obligation to use every available post.",
        ],
        points: postingPoints,
        links: [{ label: "How it works", href: "/how-it-works" }],
      },
      {
        id: "content",
        title: "Your content and the permission we need",
        paragraphs: [
          "You keep the ownership and other rights you have in your writing and photographs. Posting does not transfer ownership to Margin. You must have the rights and consent needed for what you upload or share.",
          "Under the proposed terms, you give Margin a nonexclusive, worldwide, royalty-free license to host, store, reproduce, technically process, and display your content only as needed to operate, secure, and maintain the service, deliver it to its permitted audience, and address reports and legal obligations. Providers working for the service may perform those tasks on its behalf. This permission does not authorize unrelated advertising use or sale of your content.",
          "The proposed permission ends when the content is removed from the service’s systems, except for the limited period needed to complete deletion, rotate backups, or meet a specific lawful retention requirement. It does not undo copies another recipient already kept. This license remains subject to legal review and is not granted merely by reading this draft.",
        ],
        links: [{ label: "Copyright", href: "/copyright" }],
      },
      {
        id: "conduct",
        title: "Respect the people here",
        paragraphs: [
          "Don’t harass, threaten, exploit, impersonate, scam, stalk, or expose someone’s private information. Don’t share sexual abuse material, nonconsensual intimate images, or other unlawful content. Respect a blocked account, declined request, and withdrawn consent.",
          "Don’t scrape private content, compromise accounts, distribute malware, overload the service, or evade limits with automation or extra accounts. Words and supported still photographs belong here; video, animation, motion photos, and video embeds aren’t supported.",
        ],
        links: [
          { label: "Community Guidelines", href: "/community-guidelines" },
        ],
      },
      {
        id: "audience",
        title: "Know your audience",
        paragraphs: [
          "Your personal posts and Gallery require accepted friendship. Your profile introduction can be visible to other signed-in members. A Space’s audience is its eligible members, who may not all be your friends. Post conversations share the post’s audience.",
          "Recipients may save or redistribute what you share. You are responsible for your choices and conduct, but another member is responsible for theirs. A limited audience is not a guarantee of confidentiality, and messages are not end-to-end encrypted.",
          "Your content is not reviewed or approved automatically before publication. Technical photo checks are not content moderation. Reporting can give the founder access to the reported content for review.",
        ],
        links: [{ label: "Privacy", href: "/privacy" }],
      },
      {
        id: "retention",
        title: "Expiration, removal, and leaving",
        paragraphs: [
          "Your posts and direct messages expire after 30 days, and Notebook notes after 90 days. Gallery photographs have a separate lifetime. Downloads, recipient copies, backup rotation, and specific lawful safety or legal records are separate from ordinary visibility.",
          "Download anything you want to keep before expiration or deactivation. Your account removal control deactivates access; full provider and account erasure requires a support request. No promise here guarantees recovery of expired or erased information.",
        ],
        links: [
          { label: "Retention", href: "/retention" },
          { label: "Your data", href: "/your-data" },
        ],
      },
      {
        id: "moderation",
        title: "Restrictions and review",
        paragraphs: [
          "To address a rule violation, safety risk, misuse, or legal obligation, your content may be removed or your account access restricted or deactivated. A report is reviewed in context; it does not guarantee removal or a particular result.",
          "You can ask support to review a decision and explain why you believe it is mistaken. Urgent safety needs, legal restrictions, or protecting someone’s privacy may limit what can be disclosed or when notice can be given. Reports and support are not an emergency service or a guarantee of continuous monitoring.",
        ],
        links: [{ label: "Request a review", href: "/help#appeals" }],
      },
      {
        id: "external-services",
        title: "External services and other people’s content",
        paragraphs: [
          "Music links and other external websites belong to their operators. Their terms, availability, and privacy practices apply when you use them. A link or music selection is not an endorsement, and Margin does not provide a music subscription or player.",
          "Other members’ opinions and content are their own. You should use your judgment rather than treating a post or message as professional advice, a verified identity claim, or a guarantee from Margin.",
        ],
      },
      {
        id: "availability",
        title: "Availability and limits on responsibility",
        paragraphs: [
          "We work to keep Margin useful and available, but outages, errors, security incidents, and lost access can happen. To the extent permitted by applicable law, the proposed service is provided as available, without a promise of uninterrupted operation, perfect accuracy, absolute security, or suitability for every purpose. Keep your own copies of information you cannot afford to lose.",
          "To the extent applicable law permits, the proposed terms exclude responsibility for indirect or consequential losses arising from use of the service. This does not exclude responsibility or remedies that cannot lawfully be excluded, including mandatory consumer protections. The final scope of any liability limit still requires legal review; this draft does not impose a dollar cap, indemnity, or waiver of mandatory rights.",
        ],
      },
      {
        id: "changes",
        title: "Changes and service closure",
        paragraphs: [
          "Features and limits may change as the service develops. Material changes to an active agreement need clear notice and any consent required by law. If the service closes, any notice and opportunity to retrieve information must follow the obligations that apply.",
          "A future paid feature would need its price and terms disclosed before you choose it. These draft terms do not authorize a subscription charge.",
        ],
      },
      {
        id: "questions",
        title: "Questions and disagreements",
        paragraphs: [
          supportContact,
          "You can contact us to try to resolve a concern, without giving up any right to use a regulator, court, or other remedy available to you. No mandatory arbitration, class-action waiver, exclusive venue, or choice-of-law clause is imposed by this draft. The final operator and dispute provisions require California-focused legal review before publication.",
        ],
      },
    ],
    related: [
      { label: "Community Guidelines", href: "/community-guidelines" },
      { label: "Privacy", href: "/privacy" },
      { label: "Copyright", href: "/copyright" },
    ],
  },
  "community-guidelines": {
    category: "Support",
    title: "Community Guidelines",
    draft: true,
    intro:
      "Make room for other people. Respect their boundaries as well as your own.",
    summary: [
      "Share with care, consent, and the rights you need.",
      "A small audience still deserves privacy and respect.",
      "Report harm, and ask for a review if we get something wrong.",
    ],
    sections: [
      {
        id: "respect",
        title: "Treat people with care",
        paragraphs: [
          "You can disagree, be awkward, and have a difficult conversation. You cannot target someone with cruelty, intimidation, or attempts to make them unsafe. A friendship or shared Space is not permission to cross a boundary.",
        ],
        points: [
          "No harassment, credible threats, hateful abuse, or targeted intimidation.",
          "No stalking, doxxing, impersonation, or sharing private information without permission.",
          "No exploitation, sexual abuse material, or nonconsensual intimate content, including manipulated images and threats to share them.",
          "No fraud, spam, malicious links, or attempts to compromise accounts.",
        ],
      },
      {
        id: "sharing",
        title: "Think before you share",
        paragraphs: [
          "Share work you own, have permission to use, or are otherwise legally entitled to share. Giving credit does not replace permission. Consider the privacy and consent of everyone in a photograph or conversation, including people who aren’t members.",
          "Don’t post someone’s intimate material, private conversations, or sensitive personal details to shame, threaten, or expose them. Content involving children requires particular care; illegal sexual content involving a child is prohibited without exception.",
          "Keep to supported words and still photographs. Don’t evade posting or upload limits with repeated deletion, automation, or extra accounts.",
        ],
        links: [
          { label: "Posting rules", href: "/how-it-works#posting" },
          { label: "Copyright", href: "/copyright" },
        ],
      },
      {
        id: "boundaries",
        title: "Let a boundary be a boundary",
        paragraphs: [
          "If someone declines, doesn’t respond, unfriends, or blocks you, give them space. Don’t contact them through another account or recruit someone else to pressure them.",
          "Use Space invitations for people you genuinely want to include, not unsolicited promotion. Don’t gather private profiles, photographs, or relationships for use elsewhere. Respect the audience someone chose when they shared.",
        ],
      },
      {
        id: "moderation",
        title: "Reports, decisions, and mistakes",
        paragraphs: [
          "Use the Report control on the relevant content or profile. Choose a reason and share only what helps explain the concern. The founder can review reports and available reported content, dismiss a report, remove reported posts, messages, or photographs, or deactivate an account. A submitted report does not automatically prove a violation.",
          "Technical checks on photos do not decide whether content is harmful or unlawful. There is no promise that every post is checked before publication or that every report gets an immediate response.",
          "If you believe an action is mistaken, email support with the relevant reference and your explanation. Don’t evade restrictions while asking for review. Necessary privacy, safety, or legal limits may affect the detail we can share.",
        ],
        links: [
          { label: "Report a concern", href: "/help#report" },
          { label: "Ask for another review", href: "/help#appeals" },
        ],
      },
      {
        id: "immediate-danger",
        title: "If someone is in immediate danger",
        paragraphs: [
          "Contact the appropriate local emergency service. Margin is not an emergency service, and reports are not monitored around the clock. Don’t wait for a platform response when someone needs immediate help.",
        ],
      },
    ],
    related: [
      { label: "Help", href: "/help" },
      { label: "Contact", href: "/contact" },
      { label: "Terms", href: "/terms" },
    ],
  },
  retention: {
    category: "Legal",
    title: "Content & Data Retention",
    draft: true,
    intro:
      "Know when content expires, what deletion changes, and which copies have a separate lifetime.",
    summary: [
      "Your posts and direct messages expire after 30 days; Notebook notes after 90.",
      "Your Gallery photographs stay while you keep them.",
      "Loss of access, storage cleanup, and backup rotation are different steps.",
    ],
    sections: [
      {
        id: "posts",
        title: "Your posts and their conversations",
        paragraphs: [
          "Your post expires 30 days after publication. Editing keeps the original deadline. At expiration, the app denies ordinary access to the post and its conversation, even if cleanup is delayed.",
          "Deleting your post removes its record and associated comments, likes, and attachment placements from the active service. Expired records are removed by a separate scheduled cleanup process. A photograph kept elsewhere can survive removal of the post.",
          "A minimal publication record remains for daily-limit enforcement after deletion and is eligible for cleanup after 35 days. It is not a retained copy of your post text.",
        ],
      },
      {
        id: "messages",
        title: "Your messages and Notebook",
        paragraphs: [
          "Each direct message expires " +
            MESSAGE_LIFETIME_DAYS +
            " days after it is sent. Each Notebook note expires " +
            NOTEBOOK_LIFETIME_DAYS +
            " days after it is saved. New messages and notes do not renew earlier entries.",
          "Expired entries are excluded from conversation history, previews, and exports. Scheduled cleanup removes their stored rows. Turning messaging off does not pause these deadlines. Download available messages before expiration if you want to keep a copy.",
        ],
      },
      {
        id: "gallery",
        title: "Your photographs",
        paragraphs: [
          "A photograph in your Gallery remains while you keep it there. Your portrait, Gallery, and post attachments can reference one stored photograph. Removing one placement does not automatically remove another valid placement.",
          "If you delete a post, Gallery photographs are kept unless you also choose to delete the photographs. Deleting the photograph itself removes its placements across the service while keeping surrounding post text and conversations.",
          "When no valid reference remains, the photograph becomes unavailable and cleanup deletes the stored file. Failed storage deletion is retried; a failure doesn’t make the photograph readable again. A minimal successful-upload marker remains for 48 hours, followed by a later cleanup sweep, so deletion can’t reset your daily photo allowance.",
        ],
      },
      {
        id: "account",
        title: "Your account and settings",
        paragraphs: [
          "Your profile, relationships, preferences, and selected music are saved so your account works across visits. Unpublished drafts are temporary browser state, not a permanent archive.",
          removalScope,
          "Deactivation can leave account, comment, report, review, and security records that require separate handling. Request complete erasure through support so we can verify ownership and explain any applicable exception. Don’t assume a sign-out or browser reset deletes server records.",
        ],
      },
      {
        id: "reports",
        title: "Reports and restricted records",
        paragraphs: [
          "Your reports, explanations, and review decisions have a different purpose from an expiring post. A report is not an automatic permanent snapshot of every related message or photograph; reviewer access to the target also depends on whether that content remains available.",
          "A specific legal obligation, safety investigation, or security need may require a limited record to remain. The final retention schedule for reports, operator decisions, account records, and provider logs is still under review. This draft does not promise a fixed erasure deadline for those records or authorize blanket indefinite retention.",
        ],
      },
      {
        id: "backups",
        title: "Backups and cleanup delays",
        paragraphs: [
          "Removing a live database record does not instantly erase database recovery logs, replicas, or backups. A storage outage or cleanup backlog can delay physical deletion while normal access remains denied.",
          "The hosted backup rotation, deletion completion targets, and controls for reapplying deletions after restoration must be confirmed before this policy becomes effective. A one-minute cleanup schedule is an operating cadence, not a promise that every file disappears within one minute.",
        ],
      },
      {
        id: "copies",
        title: "Copies outside the service",
        paragraphs: [
          "You or another recipient may keep a screenshot, saved photograph, or exported conversation. These copies are outside Margin’s ordinary expiration and deletion controls.",
          "Keep your downloads secure and respect other people’s privacy when deciding whether to retain or share a copy.",
        ],
        links: [{ label: "Your data", href: "/your-data" }],
      },
    ],
    related: [
      { label: "Your data", href: "/your-data" },
      { label: "Privacy", href: "/privacy" },
      { label: "Help with photographs", href: "/help#gallery" },
    ],
  },
  copyright: {
    category: "Legal",
    title: "Copyright Policy",
    draft: true,
    intro:
      "Share work you own, have permission to use, or are otherwise entitled to share.",
    summary: [
      "You keep the rights you have in your own work.",
      "Credit alone is not permission to upload someone else’s work.",
      "You can raise a concern by email; formal DMCA agent details still require review.",
    ],
    sections: [
      {
        id: "rights",
        title: "Respect the work behind what you share",
        paragraphs: [
          "Your writing and photographs can belong to you without belonging to Margin. You still need permission or another valid legal basis to upload someone else’s photograph, artwork, writing, or other protected work. Finding it online or naming its creator is not enough by itself.",
          "A music search result or listening link does not give you a license to republish audio or artwork elsewhere. Our proposed service license is limited to operating Margin and is explained in the Terms.",
        ],
      },
      {
        id: "notices",
        title: "If you believe your work was copied",
        paragraphs: [
          "Email " +
            publicSiteDetails.supportEmail +
            " with “Copyright” in the subject to raise a concern. Identify your work, the material you believe infringes it, and where we can find that material. Include a way to reach you and explain whether you own the rights or are authorized to act for the owner. Don’t send unrelated private content.",
          "For a formal U.S. DMCA notice, the designated agent’s published contact and registration must first be confirmed. The general support inbox is not represented as a registered DMCA agent. This draft does not claim safe-harbor eligibility.",
        ],
        points: [
          "A formal notice generally needs your physical or electronic signature and identification of the copyrighted work and disputed material.",
          "It generally needs contact information, a good-faith statement that the use is not authorized by the rights holder, their agent, or the law, and an accuracy and authority statement under penalty of perjury.",
          "A complaint should account for legally permitted uses, including any applicable fair use. Don’t submit a notice you know is materially false.",
        ],
      },
      {
        id: "mistakes",
        title: "If your content is removed by mistake",
        paragraphs: [
          "Email support with the removal reference and why you believe there was a mistake. An ordinary review request is different from a formal DMCA counter-notice.",
          "A formal counter-notice can involve statements under penalty of perjury, disclosure of contact information to the complainant, consent to court jurisdiction, and possible legal action. Seek qualified advice if you are unsure. The formal notice, counter-notice, and reinstatement process will be published after legal review; this draft does not promise an automatic restoration date.",
        ],
      },
      {
        id: "repeat",
        title: "Repeated infringement",
        paragraphs: [
          "Under the proposed policy, repeated or serious infringement may result in content removal or account restrictions, including termination where appropriate. A complaint alone does not establish that infringement occurred; mistakes and valid challenges need review.",
          "You should not create new accounts to evade an infringement restriction. Final agent information and the complete U.S. notice-and-counter-notice process remain required before this draft takes effect.",
        ],
        links: [
          {
            label: "U.S. Copyright Office: Section 512",
            href: "https://www.copyright.gov/512/",
          },
          { label: "Contact", href: "/contact" },
        ],
      },
    ],
    related: [
      { label: "Terms", href: "/terms" },
      { label: "Community Guidelines", href: "/community-guidelines" },
    ],
  },
  cookies: {
    category: "Legal",
    title: "Cookies & Preferences",
    draft: true,
    intro:
      "What your browser keeps, why it matters, and the controls available to you.",
    summary: [
      "Sign-in uses essential session storage and cookies.",
      "A small browser marker helps avoid repeating the logo animation.",
      "The current service has no advertising trackers or session replay.",
    ],
    sections: [
      {
        id: "authentication",
        title: "Stay signed in",
        paragraphs: [
          "Clerk uses cookies and related browser storage to establish and maintain your sign-in session, protect account access, and support recovery. Invitation setup can also use a temporary cookie to connect your browser with the invitation you opened.",
          "These mechanisms are different from advertising cookies. Blocking storage needed for sign-in or invitations can stop those features from working. The exact hosted cookie names, providers, and lifetimes still need a deployment inventory before this policy becomes effective.",
        ],
      },
      {
        id: "preferences",
        title: "Your preferences and temporary state",
        paragraphs: [
          "Your saved account settings, such as text size, motion, messaging, and notifications, belong to your server-stored account. Draft writing and other temporary interface state can remain in your current browser tab and may be lost when you close or refresh it.",
          "A local browser marker records whether the brand entrance animation has played for the current login, so it doesn’t repeat across navigation, reloads, and tabs. It does not grant account access.",
          "Your browser can cache public images, fonts, scripts, and styles to load pages. Caching a file is not the same as giving another member access to private account content.",
        ],
      },
      {
        id: "tracking",
        title: "Advertising, analytics, and diagnostics",
        paragraphs: [
          "The current Margin experience has no advertising or product-analytics integration and no session replay. Optional Sentry diagnostics, when configured, use application filtering to reduce private information in error events. Hosting and authentication providers may still receive ordinary connection and security information.",
          "A browser’s Do Not Track signal does not change the current application’s behavior. We don’t interpret it as consent to a new use of your information. Any future optional tracking would need its own explanation and any consent, withdrawal, or opt-out controls required by law.",
        ],
        links: [{ label: "Privacy", href: "/privacy" }],
      },
      {
        id: "browser-choices",
        title: "Manage your browser data",
        paragraphs: [
          "Use your browser’s privacy settings to view, block, or delete cookies and site data. Doing so may sign you out, interrupt an invitation, or reset cosmetic preferences. It does not submit an account-erasure request or delete server-stored posts and messages.",
          "To manage or erase information associated with your account, use Settings or contact support. If a browser setting prevents access, tell us what you tried without sending your cookies or session tokens.",
        ],
        links: [{ label: "Your data", href: "/your-data" }],
      },
    ],
    related: [
      { label: "Privacy", href: "/privacy" },
      { label: "Your data", href: "/your-data" },
    ],
  },
  accessibility: {
    category: "Legal",
    title: "Accessibility Statement",
    draft: true,
    intro: "Room for different ways of reading, navigating, and taking part.",
    summary: [
      "You can use larger text, browser zoom, and reduced motion.",
      "Buttons and move controls offer alternatives to gestures and dragging.",
      "Tell us when something gets in your way.",
    ],
    sections: [
      {
        id: "support",
        title: "Read and navigate your way",
        paragraphs: [
          "In Settings, you can choose larger text and reduced motion. Your browser’s zoom remains available, and the interface respects your system’s reduced-motion setting.",
          "Use Tab and Shift+Tab to move through controls, Enter or Space to activate buttons, and Escape to close supported dialogs. Dialogs manage focus so you can return to where you started. Conversation buttons let you open a post’s discussion without swiping.",
        ],
      },
      {
        id: "photographs",
        title: "Photographs and movement",
        paragraphs: [
          "Your Gallery has explicit move controls and keyboard actions alongside dragging. You don’t need a precise drag gesture to arrange your photographs. Image viewers have controls for opening and closing the photograph.",
          "Uploaded photographs don’t require an image description. We recognize that user-uploaded images may not have a useful text alternative. When the image’s meaning matters, your post text can help describe it to the people reading. That limitation remains part of the accessibility work to address.",
        ],
      },
      {
        id: "verification",
        title: "An ongoing responsibility",
        paragraphs: [
          "You should be able to use the whole service, including forms, errors, dialogs, and mobile keyboards. Automated checks and individual interface improvements don’t establish complete accessibility conformance. We do not claim WCAG certification or full conformance without an appropriate assessment.",
          "Screen-reader combinations, zoom and reflow, text spacing, contrast, and real-device interaction need continued review. If a feature is inaccessible to you, contact us for help with the task and tell us what blocked you.",
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
          "Email support with the page, what you were trying to do, and the barrier you encountered. Browser or assistive-technology details can help, but only share information you’re comfortable providing. You don’t need to disclose a diagnosis or disability to ask for help.",
          supportContact,
        ],
        links: [{ label: "Contact", href: "/contact" }],
      },
    ],
    related: [
      { label: "Reading help", href: "/help#accessibility" },
      { label: "Contact", href: "/contact" },
    ],
  },
} satisfies Record<string, PublicDocumentData>;
