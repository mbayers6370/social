import { publicSiteDetails } from "./site-details";
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

const postingPoints = [
  POSTING_RULE_SUMMARY,
  POSTING_EDIT_RULE,
  POSTING_EXCLUSIONS,
  "Your posting day runs from midnight to midnight in your account’s saved time zone. Changing time zones does not give you a fresh allowance; recent usage carries forward for at least 24 hours.",
];

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
          "Margin is a social media website for keeping up with friends. A café they found, a photograph from a walk, something they’ve been thinking about. Ordinary things, from people you know.",
          "Your feed runs newest first, without ads, recommended strangers or like counts. It has an end, so you can catch up and get back to your day.",
        ],
      },
      {
        id: "boundaries",
        title: "A little room around it.",
        paragraphs: [
          "Share up to three regular posts a day, or one link post if it’s your only post that day. Posts expire after 30 days. Keep up to 20 photographs in Gallery. It’s an allowance, not a quota.",
        ],
        links: [{ label: "How Margin works", href: "/how-it-works" }],
      },
      {
        id: "conversation",
        title: "More ways to stay close.",
        paragraphs: [
          "Reply beneath a post, message a friend, or make plans in an invitation-only Space. Your profile brings together your introduction, photographs, On Repeat song and optional Top 4 friends.",
        ],
      },
      {
        id: "about",
        title: "About Margin",
        paragraphs: [
          "Margin is an individual’s independent project, based in California. Our planned launch is for adults in the United States, joining by invitation. An invitation doesn’t make you friends automatically; you both choose that separately.",
          "Questions or feedback? Email " +
            publicSiteDetails.supportEmail +
            ".",
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
    intro: "A social media website for friends, with a feed you can finish.",
    summary: [
      "Join by invitation and connect through mutual friendship.",
      "Share up to three posts a day, or one post with a link.",
      "Keep photographs in Gallery and conversations in their own space.",
    ],
    sections: [
      {
        id: "joining",
        title: "Join by invitation",
        paragraphs: [
          "Open the link someone sent you, verify your email and set up your profile. Already a member? Sign in with your existing account.",
          "You can keep three personal invitations open at once. They expire after 30 days; an accepted, expired or withdrawn invitation frees a place.",
        ],
      },
      {
        id: "friends",
        title: "Choose your friends",
        paragraphs: [
          "Find someone by name or username and send a request. Friendship starts when they accept. Your introduction can be found by other signed-in members; your personal posts, Gallery, On Repeat and visible Top 4 are for accepted friends.",
          "Your feed shows friends’ posts and posts from Spaces you include, newest first. Your own personal posts are on your profile. Like counts stay inside post conversations.",
        ],
        links: [{ label: "Who can see what", href: "/privacy#audience" }],
      },
      {
        id: "posting",
        title: "Share a post",
        paragraphs: [
          "Write a thought, add still photographs or share a link. Pasting a web link into your words counts as a link post too.",
        ],
        points: postingPoints,
        links: [{ label: "Posting help", href: "/help#posting" }],
      },
      {
        id: "conversations",
        title: "Messages and conversations",
        paragraphs: [
          "Open Conversation beneath a post to read comments or reply. Comments share the post’s audience.",
          "Messages are for direct conversations when your relationship and both members’ settings allow them. Notebook is for notes to yourself. Messages expire after " +
            MESSAGE_LIFETIME_DAYS +
            " days; notes after " +
            NOTEBOOK_LIFETIME_DAYS +
            ". Messages are not end-to-end encrypted.",
        ],
        links: [{ label: "Using Messages", href: "/help#messages" }],
      },
      {
        id: "thirty-days",
        title: "Posts move on",
        paragraphs: [
          "Posts and their conversations expire 30 days after publication. Editing doesn’t restart the clock. Photographs you keep in Gallery can stay longer.",
        ],
        links: [{ label: "Expiration and deletion", href: "/retention" }],
      },
      {
        id: "gallery",
        title: "Keep a Gallery",
        paragraphs: [
          "Keep up to 20 photographs, with three featured on your profile. Use Arrange to move or feature them. Done saves; Cancel discards the arrangement. Move controls and keyboard actions work alongside dragging.",
          "Deleting a post keeps its Gallery photographs unless you choose to delete them too. Deleting a photograph removes its placements, while keeping surrounding post text and conversations.",
        ],
        links: [{ label: "Photo help", href: "/help#photo-problem" }],
      },
      {
        id: "media",
        title: "Photographs and music",
        paragraphs: [
          "Margin supports still JPEG, PNG and WebP photographs, not video or animation. On Repeat lets you share a song; its listening link opens an external service. Margin doesn’t play music audio.",
        ],
      },
      {
        id: "spaces",
        title: "Gather in a Space",
        paragraphs: [
          "Create an invitation-only Space for a group, with optional plans and RSVPs. Administrators can invite accepted friends. Space members may not be your friends, and joining doesn’t unlock personal profiles or Galleries.",
          "Choose whether a Space’s posts appear in your feed. Public Event Spaces are currently unavailable.",
        ],
      },
      {
        id: "eligibility",
        title: "For adults",
        paragraphs: [
          "Your minimum signup age is " +
            MINIMUM_AGE +
            ". The planned launch is for people accessing Margin from the United States. Don’t create an account for a child or bypass account restrictions.",
        ],
        links: [
          { label: "Community Guidelines", href: "/community-guidelines" },
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
    title: "Help",
    intro: "Posting, photographs, messages and account settings.",
    summary: [
      "Find the controls for what you want to do.",
      "Check a failed change before trying it again.",
      "Need a hand? Email " + publicSiteDetails.supportEmail + ".",
    ],
    sections: [
      {
        id: "account",
        title: "Join or sign in",
        paragraphs: [
          "New here? Open an invitation link, verify the invited email address and finish your profile. You must be " +
            MINIMUM_AGE +
            " or older. Returning members can use Sign in without another invitation.",
          "If you can’t sign in, email support with your account email and the error wording. Never include a password or verification code.",
        ],
      },
      {
        id: "posting",
        title: "Publish, edit or delete a post",
        paragraphs: [
          "Use Share a thought in the feed or New Post on your profile. Add your words and photographs, then choose Publish. A selected photograph is not published until you submit.",
          "To change a published post, open it on your profile and choose Edit. Deleting it also removes its comments and likes. You can keep attached Gallery photographs or choose to delete them too.",
          "Posts follow your account’s saved time zone. Deleting a post or photograph does not refill the allowance. Editing keeps the original publication date and expiration.",
        ],
        points: [
          "Up to three regular posts a day, or one link post if it’s your only post that day. Pasted web links count too.",
          "Up to three new photographs a day across posts and Gallery. Comments and private messages don’t use your post allowance.",
        ],
        links: [{ label: "Full posting rules", href: "/how-it-works#posting" }],
      },
      {
        id: "saving",
        title: "Save changes and keep drafts",
        paragraphs: [
          "Settings save automatically; look for their confirmation. Profile, post, Top 4 and Gallery edits use Save or Done. If you’re unsure a post went through, check before submitting again.",
          "Drafts stay temporarily in your browser tab and can be lost on refresh or close. Copy important writing somewhere safe.",
        ],
      },
      {
        id: "gallery",
        title: "Arrange or remove photographs",
        paragraphs: [
          "Open Gallery → Arrange to move photographs and choose up to three to feature. Done saves; Cancel discards the arrangement. Use move controls or keyboard actions if dragging is difficult.",
          "Delete photograph removes it from Gallery, posts and your portrait wherever it is used. Surrounding post text and conversations stay. Unfeaturing only changes the featured selection.",
        ],
      },
      {
        id: "photo-problem",
        title: "If a photograph won’t attach",
        paragraphs: [
          "Use a still JPEG, PNG or WebP file, no larger than 8 MB, 10,000 pixels per side or 40 megapixels total. Export HEIC or HEIF as JPEG or PNG first. Video, animation and motion photos aren’t supported.",
          "Check your daily allowance and the 20-photo Gallery limit. Wait for the preview before publishing; keep your draft if an upload fails. If a file can’t be read, export a fresh copy.",
        ],
        links: [{ label: "Photo privacy", href: "/privacy#photographs" }],
      },
      {
        id: "profile",
        title: "Edit your profile and Top 4",
        paragraphs: [
          "Edit profile changes your name and bio. Settings allows one username change after setup. Usernames use 3–24 letters, numbers or underscores, start with a letter and are saved in lowercase.",
          "Choose a song in On Repeat. Use Top 4 → Edit to select and arrange up to four accepted friends. You can hide Top 4 or leave it empty.",
        ],
      },
      {
        id: "managing-friends",
        title: "Friendships and blocks",
        paragraphs: [
          "Use Add friend on a profile. In Friends, accept or decline received requests or cancel sent ones. A pending request does not unlock personal content.",
          "Unfriend removes the relationship and access to friend-only content. Block also prevents contact and access between your accounts. Unblocking does not restore the friendship. Shared Spaces have their own audiences.",
        ],
      },
      {
        id: "messages",
        title: "Read, send or refresh messages",
        paragraphs: [
          "Open Messages and choose a conversation. Enter sends; Shift+Enter starts a new line. In Notebook, Enter saves a note to yourself.",
          "Messages refresh when you open a conversation or return to the window. Choose Refresh in the conversation to check for incoming messages without leaving. New messages do not currently appear automatically while you stay on the page.",
          "Turn messaging off in Settings to pause conversations in both directions. Expiration continues. Download an available conversation from its header before it expires.",
          "If someone deactivates their account, your conversation with them is removed too. Messages are stored on our servers and are not end-to-end encrypted.",
        ],
        links: [{ label: "Message lifetimes", href: "/retention#messages" }],
      },
      {
        id: "notifications",
        title: "Check notifications",
        paragraphs: [
          "Open the bell for friendship requests, comments, messages and other activity. It refreshes when you open it or return to the window. Opening an item marks it read; Mark all as read clears the unread list.",
          "Choose categories in Settings. Like notifications are off by default. Notifications appear on Margin, not by email or phone push.",
        ],
      },
      {
        id: "report",
        title: "Report a concern",
        paragraphs: [
          "Choose Report in the relevant profile, post, comment or message options. Give a reason and only the context needed. You can see your reports in Settings. The founder can review your explanation and available reported content.",
          "If you can’t report on Margin, email support with the reference you have. Don’t forward intimate files, exploitative material or unrelated conversations. Margin is not an emergency service or monitored around the clock; contact local emergency services for immediate danger.",
        ],
        links: [
          { label: "Contact support", href: "/contact" },
          { label: "Community Guidelines", href: "/community-guidelines" },
        ],
      },
      {
        id: "appeals",
        title: "Ask for a decision review",
        paragraphs: [
          "Email support with “Review request” in the subject, your username, the decision or content reference and why you think it was mistaken. Ownership checks may be needed. A review does not promise reinstatement or a particular response time.",
          "Don’t use another account to evade a restriction or contact someone who blocked you.",
        ],
      },
      {
        id: "your-data",
        title: "Download or delete your account",
        paragraphs: [
          "Settings offers an account download and separate Deactivate account and Delete account controls. Download anything you want to keep first.",
        ],
        links: [
          { label: "Downloads and account removal", href: "/your-data" },
          { label: "Expiration and deletion", href: "/retention" },
        ],
      },
      {
        id: "accessibility",
        title: "Reading and navigation",
        paragraphs: [
          "Choose larger text or reduced motion in Settings, or use browser zoom. Tab moves between controls; Escape closes supported dialogs. Gallery move controls and conversation buttons offer alternatives to dragging and swiping.",
        ],
        links: [{ label: "Accessibility help", href: "/accessibility" }],
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
      "Include the page or content reference and what you need help with.",
      "For immediate danger, contact local emergency services.",
    ],
    sections: [
      {
        id: "support",
        title: "Email support",
        paragraphs: [
          "For account help, privacy requests, accessibility feedback or decision reviews, email " +
            publicSiteDetails.supportEmail +
            ". The link below opens your email app. We don’t offer round-the-clock support or a guaranteed response time.",
          "Never send passwords, verification or recovery codes, session tokens, or identity documents in an initial message.",
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
        title: "What to include",
        paragraphs: [
          "Tell us what you were trying to do, what happened and any error wording. Include your browser or device when relevant. Send a screenshot only if useful, with private information removed.",
        ],
        links: [{ label: "Browse Help", href: "/help" }],
      },
      {
        id: "safety",
        title: "Safety and copyright concerns",
        paragraphs: [
          "Use Report on Margin when possible so the concern has a specific reference. If you can’t, email a brief explanation. Don’t send harmful or intimate files or entire message archives.",
          "Use “Copyright” in the subject for a copyright concern. General support is not a registered DMCA agent or a substitute for formal legal process.",
        ],
        links: [
          { label: "Reporting and review", href: "/help#report" },
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
    draft: true,
    intro: "Download a copy, change what you share or delete your account.",
    summary: [
      "Download available account information from Settings.",
      "Edit or remove your own content with the controls beside it.",
      "Deactivation and complete account erasure are different.",
    ],
    sections: [
      {
        id: "account-export",
        title: "Download your information",
        paragraphs: [
          "In Settings, open the account download, choose categories and prepare an archive or PDF. Available photographs can be included. A conversation also has its own download in its header.",
          "Your download can include your profile, posts, photos, comments, likes, relationships, messages, Notebook, preferences, notifications and reports. It excludes passwords, other people’s private accounts and reports, unpublished drafts, and expired or erased content. Keep it secure.",
        ],
      },
      {
        id: "correction",
        title: "Change what you share",
        paragraphs: [
          "Use Edit profile for your name and bio, and Settings for your one username change. Posts, Gallery, Top 4 and On Repeat have their own editing controls.",
        ],
        links: [{ label: "Profile help", href: "/help#profile" }],
      },
      {
        id: "delete-account",
        title: "Deactivate or permanently delete",
        paragraphs: [
          "Download anything you want to keep first. Settings → Account removal offers two choices.",
          "Deactivate account ends access and removes active posts, Gallery placements, friendships and messages, with photos queued for cleanup. It does not erase your sign-in identity, all remaining account records or backups.",
          "Delete account requests permanent erasure. Type DELETE and verify your identity again if asked. Once accepted, access ends immediately and the request cannot be undone. Background work removes your account data, photos and Clerk sign-in identity, retrying failures.",
          "A Space you created passes to another active member when possible; otherwise it is removed. The last active founder must arrange a successor before using self-service deletion.",
        ],
        links: [
          {
            label: "Deletion scope, receipts and backups",
            href: "/retention#account",
          },
        ],
      },
      {
        id: "requests",
        title: "If you need help with your data",
        paragraphs: [
          "Email " +
            publicSiteDetails.supportEmail +
            " for access, correction, deletion or a missing download category, including if you can’t sign in or are outside the supported region. Describe the request and account. We verify ownership or authorization without asking for unnecessary information.",
          "Applicable rights and response deadlines depend on the law and your circumstances. Exercising a protected right won’t be penalized. If a request cannot be completed, you can ask for the reason and another review. Nothing here limits your legal rights.",
          "Never send passwords, verification or recovery codes, session tokens, or identity documents in an initial message.",
        ],
      },
      {
        id: "copies",
        title: "Copies outside Margin",
        paragraphs: [
          "Screenshots, downloads and copies kept by recipients are outside our control. Clearing browser data or signing out does not delete your server-stored account.",
        ],
        links: [{ label: "Privacy", href: "/privacy" }],
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
        title: "About this website",
        paragraphs: [
          "Margin is an individual’s independent, pre-launch social media project in California. It is not a separate incorporated entity. Contact " +
            publicSiteDetails.supportEmail +
            ".",
          "The required contracting operator details, hosted providers, cookie inventory and retention schedules still need review before this draft takes effect.",
        ],
      },
      {
        id: "information",
        title: "Information we collect",
        paragraphs: [],
        points: [
          "Account details: sign-in identifier, email verification and age confirmations, name, username, bio, portrait and account status. Clerk manages authentication and recovery.",
          "Content and activity: posts, links, comments, likes, photographs, Gallery arrangement, On Repeat, Top 4, messages and Notebook notes.",
          "Connections: friend requests, friendships, blocks, Space memberships, invitations, plans and RSVPs.",
          "Settings and requests: time zone, reading, motion, messaging and notification choices, reports, review requests and support correspondence.",
        ],
      },
      {
        id: "region-access",
        title: "Connection location",
        paragraphs: [
          "The planned production service uses Cloudflare’s IP-country estimate to permit account access from the United States. Unknown locations and untrusted direct connections are denied. Public help and policy pages remain available worldwide.",
          "Margin requests no GPS permission and stores no country history for this check. IP location may be wrong, block travel or reflect a VPN instead of your actual location. It does not establish residence, nationality, age or identity. Hosted enforcement still needs verification.",
        ],
      },
      {
        id: "technical",
        title: "Technical information",
        paragraphs: [
          "Browsers, hosting and sign-in providers process network addresses, browser details, session identifiers and request times to deliver and secure the website. Providers may keep their own logs.",
          "Publication and upload records enforce daily limits after content deletion. Cleanup and report records support retries and safety decisions. Your saved time zone controls posting limits; it does not provide precise device location.",
          "Optional error monitoring filters identifying fields and private request content. No session replay is implemented; filtering cannot guarantee that providers receive no connection information.",
        ],
      },
      {
        id: "purposes",
        title: "How we use information",
        paragraphs: [
          "We use information to run accounts and the features you choose, show content to its permitted audience, save settings, enforce limits, investigate reports, answer requests, complete exports and deletion, and meet legal obligations.",
          "The current website has no ads or advertising profiles. Private conversations are not used for advertising. New uses require updated disclosures and any legally required notice or choice.",
        ],
      },
      {
        id: "audience",
        title: "Who can see what",
        paragraphs: [
          "Other signed-in members can find your name, username, bio and profile-sized portrait. Personal posts, Gallery, On Repeat and visible Top 4 require accepted friendship; a request alone does not unlock them.",
          "Spaces have their own eligible members, who may not be your friends. Comments share the post’s audience. Direct messages are for their participants, subject to account, relationship, blocking and messaging settings. Notebook is for you.",
          "Messages are stored on our servers and are not end-to-end encrypted. Reporting a message can make that message available for founder review; it does not open your entire inbox to other members.",
          "Founder report tools can access available reported content and your explanation and record enforcement decisions. They are not a general-purpose private-inbox browser. Necessary support, infrastructure, security or legal access is separate from member visibility.",
          "Recipients can save, screenshot or redistribute content. Access controls cannot prevent every misuse by someone who already received it.",
        ],
      },
      {
        id: "photographs",
        title: "Photograph processing",
        paragraphs: [
          "We check supported file type, size and dimensions, then re-encode photographs to remove embedded source metadata. These are technical privacy checks, not automated moderation or approval of the image. Visible details may still identify people or places.",
          "Photos are stored privately and delivered through access checks. A post, Gallery and portrait can share one stored asset. The profile-sized portrait may be visible with your introduction; the original has separate access restrictions.",
        ],
      },
      {
        id: "services",
        title: "Providers and disclosures",
        paragraphs: [
          "The current design uses Cloudflare for the production access gate, Clerk for sign-in, PostgreSQL for saved data, private Cloudflare R2 for photos, and Upstash for rate limits. Hosting and email providers process requests and correspondence; Sentry may receive filtered errors when enabled. Deployment locations and provider retention still need verification. U.S. access does not mean all processing is U.S.-only.",
          "Music searches send your query to Apple’s catalog through our server and fetch artwork for display. External music and website links have their own terms and privacy practices.",
          "Information may be disclosed for valid legal process or specific safety, fraud or security concerns. A change of ownership must follow applicable law and required disclosures.",
        ],
      },
      {
        id: "retention",
        title: "How long information stays",
        paragraphs: [
          "Posts and messages expire after " +
            MESSAGE_LIFETIME_DAYS +
            " days; Notebook notes after " +
            NOTEBOOK_LIFETIME_DAYS +
            ". Gallery photos have a separate lifetime. Removing access and completing storage deletion are different steps.",
        ],
        links: [
          {
            label: "Retention, backups and deletion receipts",
            href: "/retention",
          },
        ],
      },
      {
        id: "choices",
        title: "Your choices and requests",
        paragraphs: [
          "Settings lets you manage your account, messaging and notification choices, download data, deactivate or request permanent deletion. Email support for assisted requests, including if you cannot sign in or access the product region. Ownership checks may be required.",
          "Privacy rights depend on applicable law and your circumstances. You can ask about access, correction, deletion or review without waiving mandatory protections. Browser controls manage site data; clearing it does not erase your account.",
        ],
        links: [
          { label: "Your data", href: "/your-data" },
          { label: "Cookies and preferences", href: "/cookies" },
        ],
      },
      {
        id: "age",
        title: "Adults only",
        paragraphs: [
          "You must be " +
            MINIMUM_AGE +
            " or older to join. Age confirmation is not independent age or identity verification. If you believe a child has an account or their information was shared without permission, contact support with only the details needed to identify the concern.",
        ],
      },
      {
        id: "changes",
        title: "Policy updates",
        paragraphs: [
          "The current policy and effective date will appear here after review. Material changes require clear notice and any consent or choices required by law.",
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
        title: "Accounts and invitations",
        paragraphs: [
          "You must be " +
            MINIMUM_AGE +
            " or older and legally able to agree to the terms. The planned production service permits connections identified as U.S.-based; location estimates can be inaccurate or affected by travel and VPNs.",
          "Use accurate account information and protect sign-in and recovery methods. Don’t impersonate someone, sell or spam invitations, or evade restrictions. An invitation starts signup; it does not guarantee friendship or continued access.",
        ],
      },
      {
        id: "posting",
        title: "Sharing on Margin",
        paragraphs: [
          "Follow the posting and photo allowances shown on Margin. Don’t evade them with repeated deletion, automation or extra accounts. Video, animation and motion photos aren’t supported.",
        ],
        links: [{ label: "Posting rules", href: "/how-it-works#posting" }],
      },
      {
        id: "content",
        title: "Your content",
        paragraphs: [
          "You keep the ownership and other rights you have in your content. You must have the rights and consent needed to share it.",
          "The proposed terms would grant the operator a nonexclusive, worldwide, royalty-free license to host, store, reproduce, technically process and display content only to operate, secure and maintain Margin, deliver it to its permitted audience, address reports and meet legal obligations. Service providers may perform those tasks on the operator’s behalf. This does not authorize unrelated advertising or sale of content.",
          "That permission would end when content leaves the service’s systems, except for the limited time needed for deletion, backup rotation or a specific lawful retention requirement. It cannot undo recipient copies. Reading this draft does not grant the proposed license.",
        ],
        links: [{ label: "Copyright", href: "/copyright" }],
      },
      {
        id: "conduct",
        title: "Respect other people",
        paragraphs: [
          "Don’t harass, threaten, stalk, exploit, impersonate, scam or expose private information. Sexual abuse material, nonconsensual intimate content and other unlawful content are prohibited. Respect blocks and withdrawn consent.",
          "Don’t scrape private content, compromise accounts, distribute malware or overload the website.",
        ],
        links: [
          { label: "Community Guidelines", href: "/community-guidelines" },
        ],
      },
      {
        id: "audience",
        title: "Audiences and privacy",
        paragraphs: [
          "Personal posts and Gallery are for accepted friends. Profile introductions are discoverable by signed-in members; Spaces have their own audiences. Comments share the post’s audience.",
          "Recipients may keep or redistribute copies. Messages are not end-to-end encrypted. Content is not automatically approved before publication, and reports can make reported content available for review.",
        ],
        links: [{ label: "Privacy", href: "/privacy" }],
      },
      {
        id: "retention",
        title: "Expiration and account removal",
        paragraphs: [
          "Download what you want to keep before expiration or removal. Settings offers separate deactivation and permanent deletion. Storage cleanup, backups and copies outside Margin have separate limits; recovery of expired or erased content is not promised.",
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
          "Content may be removed or account access restricted for rule violations, misuse, safety risks or legal obligations. Reports are reviewed in context and do not guarantee a particular outcome.",
          "You can ask support to review a decision. Privacy, safety or legal restrictions may limit notice or the detail disclosed. Support and reporting are not emergency services.",
        ],
        links: [{ label: "Request a review", href: "/help#appeals" }],
      },
      {
        id: "external-services",
        title: "Links and other members’ content",
        paragraphs: [
          "External websites and music services have their own operators, terms and privacy practices. Links are not endorsements; Margin does not provide a music player or subscription.",
          "Members’ opinions are their own, not professional advice, verified identity claims or guarantees from Margin.",
        ],
      },
      {
        id: "availability",
        title: "Availability and responsibility",
        paragraphs: [
          "Outages, errors, security incidents and lost access can happen. The proposed service would be provided as available, to the extent permitted by law, without guarantees of uninterrupted operation, perfect accuracy or absolute security. Keep copies of information you cannot afford to lose.",
          "The proposed terms would exclude responsibility for indirect or consequential losses only where legally permitted. Mandatory consumer protections and remedies remain. The final scope requires legal review; this draft imposes no dollar cap, indemnity or waiver of mandatory rights.",
        ],
      },
      {
        id: "changes",
        title: "Changes and closure",
        paragraphs: [
          "Features may change. Material changes to an active agreement require clear notice and any legally required consent. Service closure must follow applicable notice and retrieval obligations. Any future paid feature needs its price and terms disclosed before you choose it.",
        ],
      },
      {
        id: "questions",
        title: "Questions and disagreements",
        paragraphs: [
          "Email " +
            publicSiteDetails.supportEmail +
            " to raise a concern. You retain access to regulators, courts and other remedies available by law. This draft imposes no mandatory arbitration, class-action waiver, exclusive venue or choice-of-law clause. Operator details, dispute terms and acceptance still require legal review.",
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
          "Disagreement is welcome. Targeting someone with cruelty, intimidation or attempts to make them unsafe is not.",
        ],
        points: [
          "No harassment, credible threats, hateful abuse, stalking, doxxing or impersonation.",
          "No exploitation, sexual abuse material, or nonconsensual intimate content, including manipulated images and threats to share them.",
          "No fraud, spam, malicious links or attempts to compromise accounts.",
        ],
      },
      {
        id: "sharing",
        title: "Share with permission",
        paragraphs: [
          "Share work you own, have permission to use or are legally entitled to share. Credit does not replace permission. Consider the consent and privacy of people in photographs and conversations, including nonmembers.",
          "Don’t expose private conversations or sensitive details to shame or threaten someone. Illegal sexual content involving children is prohibited without exception. Don’t evade posting and upload limits.",
        ],
        links: [
          { label: "Copyright", href: "/copyright" },
          { label: "Posting rules", href: "/how-it-works#posting" },
        ],
      },
      {
        id: "boundaries",
        title: "Respect a boundary",
        paragraphs: [
          "Give people space after a declined request, unfriend or block. Don’t use another account or other people to pressure them. Don’t collect private profiles, photos or relationships for use elsewhere, or use Space invitations for unsolicited promotion.",
        ],
      },
      {
        id: "moderation",
        title: "Reports and reviews",
        paragraphs: [
          "Use Report on the relevant content or profile. The founder can review available reported content and take action, including removal or deactivation. A report does not by itself prove a violation. Technical photo checks are not content moderation.",
          "If you think a decision is mistaken, ask for review. Don’t evade a restriction while it is being reviewed.",
        ],
        links: [
          { label: "Report a concern", href: "/help#report" },
          { label: "Request a review", href: "/help#appeals" },
        ],
      },
      {
        id: "immediate-danger",
        title: "Immediate danger",
        paragraphs: [
          "Contact local emergency services. Margin is not an emergency service, and reports are not monitored around the clock.",
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
    title: "Expiration & deletion",
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
        title: "Posts and comments",
        paragraphs: [
          "Posts expire 30 days after publication; editing does not change the deadline. Margin denies access to the post and conversation at expiration, even if scheduled cleanup is delayed.",
          "Deleting a post removes its active record, comments, likes and photo placements. Photos used elsewhere can remain. A minimal publication record, not the post text, stays for daily-limit enforcement and is eligible for cleanup after 35 days.",
        ],
      },
      {
        id: "messages",
        title: "Messages and Notebook",
        paragraphs: [
          "Each message expires " +
            MESSAGE_LIFETIME_DAYS +
            " days after sending; each Notebook note expires " +
            NOTEBOOK_LIFETIME_DAYS +
            " days after saving. New entries and turning messaging off do not extend older entries.",
          "Expired entries are excluded from history, previews and downloads, then removed by scheduled cleanup. Deactivating an account also removes its shared conversations. Download available messages first if you want a copy.",
        ],
      },
      {
        id: "gallery",
        title: "Photographs",
        paragraphs: [
          "Gallery photos stay while you keep them. Posts, Gallery and portraits can reference the same stored photo. Removing one placement does not remove other valid placements.",
          "Deleting the photo itself removes its placements while keeping surrounding text and conversations. Without a valid reference, it becomes unavailable and storage cleanup deletes the file. Failures are retried without restoring access.",
          "A minimal successful-upload marker remains for 48 hours plus a later cleanup sweep, so deletion cannot reset the daily photo allowance.",
        ],
      },
      {
        id: "account",
        title: "Accounts and deletion receipts",
        paragraphs: [
          "Settings offers deactivation and permanent deletion. Deactivation ends access and removes active content but is not complete erasure.",
          "Permanent deletion removes profile data, posts, comments, messages, Notebook, photos, preferences, relationships, owned invitations, reports stored by Margin by or about the account and associated decisions, and the Clerk sign-in identity. Background work retries failures.",
          "A minimal receipt stays for 90 days after completion so deletion can be reapplied after a backup restore. It contains an internal account reference and timestamps, not content; the Clerk reference is cleared on completion.",
        ],
        links: [
          {
            label: "Request account deletion",
            href: "/your-data#delete-account",
          },
        ],
      },
      {
        id: "reports",
        title: "Reports and other records",
        paragraphs: [
          "Reports are not permanent snapshots of all related content; reviewers depend on what remains available. Account erasure removes the reports stored by Margin and decisions described above.",
          "Specific legal preservation needs separate authorization, restricted access, a reason and a review deadline. Ordinary report, support and independent provider-log schedules still need review; this draft does not authorize indefinite retention.",
        ],
      },
      {
        id: "backups",
        title: "Backups and cleanup delays",
        paragraphs: [
          "Removing a live record does not instantly erase recovery logs, replicas or backups. Outages and cleanup backlogs can delay physical deletion while access remains denied.",
          "The approved launch plan caps backups at 30 days and completed deletion receipts at 90 days. After a backup is restored, deletion records must be applied before accounts are reopened. These hosting settings and recovery procedures still need verification before launch.",
        ],
      },
      {
        id: "copies",
        title: "Saved copies and drafts",
        paragraphs: [
          "Screenshots, downloads and recipient copies are outside Margin’s deletion controls. Keep downloads secure and respect the privacy of others in them. Unpublished drafts are temporary tab state, not a permanent archive.",
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
        title: "Share work you can use",
        paragraphs: [
          "You keep your rights in your work. Uploading someone else’s photograph, writing or artwork needs permission or another valid legal basis; finding it online or giving credit is not enough. Music search results do not license you to republish audio or artwork elsewhere.",
        ],
        links: [{ label: "Proposed service license", href: "/terms#content" }],
      },
      {
        id: "music-credits",
        title: "Music credits",
        paragraphs: [
          "Music artwork and catalog information in iTunes search results and On Repeat come from Apple’s iTunes Search API. Each selection links to the song in the iTunes Store.",
          "Apple, the Apple logo, Apple Music, and iTunes are trademarks of Apple Inc., registered in the U.S. and other countries. iTunes Store is a service mark of Apple Inc., registered in the U.S. and other countries.",
        ],
      },
      {
        id: "notices",
        title: "Report a copyright concern",
        paragraphs: [
          "Email " +
            publicSiteDetails.supportEmail +
            " with “Copyright” in the subject. Identify your work, the disputed material and where to find it, your contact details, and whether you own the rights or are authorized to act.",
          "Formal U.S. DMCA agent details and registration remain unresolved. General support is not represented as a registered agent, and this draft does not claim safe-harbor eligibility.",
        ],
        points: [
          "A formal notice generally requires a signature, identification of the work and disputed material, contact information, a good-faith authorization statement, and an accuracy and authority statement under penalty of perjury.",
          "Consider legally permitted uses, including applicable fair use. Don’t knowingly submit a materially false notice.",
        ],
      },
      {
        id: "mistakes",
        title: "Mistakes and repeat infringement",
        paragraphs: [
          "For an ordinary review, email the removal reference and why you think it was mistaken. A formal counter-notice is different: it may require sworn statements, sharing contact information with the complainant and consenting to court jurisdiction. Get qualified advice if unsure.",
          "Under the proposed policy, repeated or serious infringement may lead to removal or account restrictions. Complaints and valid challenges require review; don’t evade restrictions with another account. The formal notice, counter-notice and reinstatement process still needs legal review.",
        ],
        links: [
          {
            label: "U.S. Copyright Office: Section 512",
            href: "https://www.copyright.gov/512/",
          },
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
        title: "Sign-in and invitations",
        paragraphs: [
          "Clerk uses cookies and related browser storage for sign-in, recovery and account protection. Invitation setup can use a temporary cookie. Blocking essential storage can prevent these features from working.",
          "The exact hosted cookie names, providers and lifetimes still need inventory before this draft takes effect.",
        ],
      },
      {
        id: "preferences",
        title: "Preferences and temporary state",
        paragraphs: [
          "Account settings are saved on the server. Unpublished writing and other temporary state can stay in your tab and be lost on refresh or close. A local marker prevents the logo entrance animation from repeating during a login; it does not authorize account access.",
          "Browsers can cache public images, fonts, scripts and styles. Cached files do not grant access to private account content.",
        ],
      },
      {
        id: "tracking",
        title: "Tracking and diagnostics",
        paragraphs: [
          "The current website has no advertising or product-analytics integration and no session replay. Optional Sentry diagnostics filter private information; hosting and sign-in providers may still receive connection and security information.",
          "Do Not Track does not change the current website’s behavior or authorize new data uses. Future optional tracking would require its own explanation and any legally required consent, withdrawal or opt-out controls.",
        ],
        links: [{ label: "Privacy", href: "/privacy" }],
      },
      {
        id: "browser-choices",
        title: "Browser controls",
        paragraphs: [
          "Your browser can view, block or clear cookies and site data. This may sign you out or interrupt an invitation; it does not delete server-stored posts or submit account erasure. Use Settings or contact support for account data requests. Never send cookies or session tokens.",
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
        title: "Reading and navigation",
        paragraphs: [
          "Settings offers larger text and reduced motion. Browser zoom and your system’s reduced-motion preference also apply.",
          "Use Tab and Shift+Tab to move between controls, Enter or Space for buttons, and Escape for supported dialogs. Conversation buttons provide an alternative to swiping.",
        ],
      },
      {
        id: "photographs",
        title: "Photographs and movement",
        paragraphs: [
          "Gallery move controls and keyboard actions offer alternatives to dragging. Uploaded photographs do not require descriptions and may lack useful text alternatives. Post text can help explain an image, but this remains an accessibility limitation.",
        ],
      },
      {
        id: "verification",
        title: "Current limitations",
        paragraphs: [
          "Individual improvements and automated tests are not a complete accessibility assessment. We do not claim WCAG certification or full conformance. Screen readers, zoom, reflow, text spacing, contrast and real-device use need continued review.",
        ],
        links: [{ label: "WCAG 2.2", href: "https://www.w3.org/TR/WCAG22/" }],
      },
      {
        id: "contact",
        title: "Ask for help",
        paragraphs: [
          "Email " +
            publicSiteDetails.supportEmail +
            " with the page, the task and what blocked you. Browser or assistive-technology details may help. You do not need to disclose a diagnosis or disability.",
        ],
        links: [{ label: "Contact support", href: "/contact" }],
      },
    ],
    related: [
      { label: "Reading help", href: "/help#accessibility" },
      { label: "Contact", href: "/contact" },
    ],
  },
} satisfies Record<string, PublicDocumentData>;
