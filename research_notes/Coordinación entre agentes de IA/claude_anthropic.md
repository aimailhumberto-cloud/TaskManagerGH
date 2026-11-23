# Claude (Anthropic) as a connected, semi-autonomous agent: state as of November 2026

> Researcher notes. Every page was opened on 2026-11-23 unless a claim is marked "(search summary)", which means it comes from a search-engine summary and the page itself was not opened. Anthropic documentation pages show no publication date and are marked "live docs"; help-center pages show only "updated this week / over a week ago". Plan names in November 2026 are Free, Pro, Max, Ultra, Team and Enterprise: "Ultra is the new name for the Max 20x plan, and Max is the new name for Max 5x" — [Claude Code feature availability](https://code.claude.com/docs/en/feature-availability) (live docs).

## 1. Is there an Anthropic or Claude product called "Duet"?

### Takeaway
Yes. "Claude Duet" is a real product, announced on 21 October 2026 as a research preview: a proactive agent in its own app that messages the user first and keeps working in its own cloud computer. Access is by waitlist only, for Pro, Max and Ultra subscribers in the United States, and it is not offered on Team or Enterprise, so "I still do not have Duet" is the normal situation for most people; it does not need to be a mis-transcription.

### Cited Findings

**What it is and its status**
- Anthropic's announcement: "Today, we're opening a research preview of Claude Duet, a new app where Claude works as a proactive agent." It surfaces what needs attention, does requested tasks, keeps working when the user steps away, and checks with the user before acting on their behalf — [Introducing Claude Duet, claude.com](https://claude.com/resources/articles/claude-duet) (21 Oct 2026, footer note 23 Oct 2026). Press coverage quotes Anthropic describing "a research preview of Claude that you message the way you'd message a person" — [9to5Mac](https://9to5mac.com/2026/10/21/anthropic-takes-on-chatgpt-dots-and-meta-muse-with-claude-duet/) (21 Oct 2026).
- Status is research preview: "Access opens in waves, and features can change during the research preview" — [Get started with Claude Duet, Help Center](https://support.claude.com/en/articles/17631495-get-started-with-claude-duet) ("updated over a week ago" on 23 Nov 2026).
- The release notes list it as "Oct 21: Claude Duet research preview for Pro and Max" — [Claude release notes](https://support.claude.com/en/articles/12138966-release-notes) (entry dated 21 Oct 2026).

**Who has access**
- "A research preview is available by waitlist today, starting with US Pro, Max, and Ultra subscribers" — [Introducing Claude Duet](https://claude.com/resources/articles/claude-duet) (21 Oct 2026).
- Not on Team or Enterprise yet; Anthropic says "we plan to bring it to those plans later". An invitation is required, and the email on the waitlist must match the Claude account and the phone's Apple or Google account — [Help Center](https://support.claude.com/en/articles/17631495-get-started-with-claude-duet).
- Joining the waitlist does not guarantee a date; invitations go out in waves by email — [9to5Mac](https://9to5mac.com/2026/10/21/anthropic-takes-on-chatgpt-dots-and-meta-muse-with-claude-duet/) (21 Oct 2026).
- No extra cost during the preview; it is included in Pro, Max and Ultra and "uses the same usage limits as the rest of Claude" — [Introducing Claude Duet](https://claude.com/resources/articles/claude-duet) (21 Oct 2026).
- No timeline is given for other countries or for Team and Enterprise — [Introducing Claude Duet](https://claude.com/resources/articles/claude-duet) (21 Oct 2026).

**Where it runs**
- "It's available as a standalone app on iOS and Android, and on claude.ai." It is a separate app from the main Claude app — [Introducing Claude Duet](https://claude.com/resources/articles/claude-duet) (21 Oct 2026).
- "Claude Duet has a virtual machine with its own browser, so it doesn't require your laptop or phone to be on" — [Introducing Claude Duet](https://claude.com/resources/articles/claude-duet) (21 Oct 2026).
- It runs on Claude Opus 5.5 and the user cannot choose the model — [Help Center](https://support.claude.com/en/articles/17631495-get-started-with-claude-duet).

**What it enables**
- Morning brief from email and calendar, progress updates, follow-ups on quiet threads, a Tasks tab (only the user can mark a task done) and a Make tab with finished files such as research briefs, financial models, slide decks or dashboards — [Help Center](https://support.claude.com/en/articles/17631495-get-started-with-claude-duet).
- It "carries over your memory, skills, and connected apps from your Claude account", and can use over 6,000 connectors and plugins in the Claude Marketplace. Named integrations: Gmail, Slack, QuickBooks, Stripe, Gusto, LinkedIn, DocuSign, HubSpot, Canva, Shopify — [Introducing Claude Duet](https://claude.com/resources/articles/claude-duet) (21 Oct 2026).
- A cloud browser is used for sites that have no connector — [Help Center](https://support.claude.com/en/articles/17631495-get-started-with-claude-duet).

**Approvals and limits**
- It reads and drafts on its own, but shows the planned action and waits for approval before sending a message, making a payment, signing a document or deleting anything. Trading securities and moving money between accounts are off-limits even with approval — [Introducing Claude Duet](https://claude.com/resources/articles/claude-duet) (21 Oct 2026).
- It checks connected accounts every few hours, not continuously, to conserve plan limits, so urgent items can arrive between checks — [Introducing Claude Duet](https://claude.com/resources/articles/claude-duet) (21 Oct 2026); [Help Center](https://support.claude.com/en/articles/17631495-get-started-with-claude-duet).
- Background work (for example the morning brief) counts against the plan's five-hour and weekly limits, so users may hit limits sooner than with chat alone — [Help Center](https://support.claude.com/en/articles/17631495-get-started-with-claude-duet); [9to5Mac](https://9to5mac.com/2026/10/21/anthropic-takes-on-chatgpt-dots-and-meta-muse-with-claude-duet/) (21 Oct 2026).
- It cannot see all projects or local files, cannot change the user's work in the main Claude app, does not make phone calls or send texts, and the user cannot watch or take over its browser — [Help Center](https://support.claude.com/en/articles/17631495-get-started-with-claude-duet).
- The Duet help article describes no API, webhook or Slack-based way for another system to trigger or message Duet — [Help Center](https://support.claude.com/en/articles/17631495-get-started-with-claude-duet).

**Conflicts between sources**
- The release-note entry says "Pro and Max"; the announcement and help article say "Pro, Max, and Ultra" — [release notes](https://support.claude.com/en/articles/12138966-release-notes) vs [announcement](https://claude.com/resources/articles/claude-duet).
- One outlet reported that Duet worked only on macOS and needed access to the user's computer; this contradicts Anthropic's own cloud-computer description and should be treated as wrong — [Forklog](https://forklog.com/en/news/anthropic-unveils-personal-ai-agent-claude-duet) (search summary) vs [announcement](https://claude.com/resources/articles/claude-duet).

**Other Claude features with limited or staged availability (in case a different feature was meant)**
- Dispatch (message Claude on the desktop from the phone): limited beta on some Pro, Max and Ultra plans, and not available to new users — [Assign tasks from anywhere, Help Center](https://support.claude.com/en/articles/13947068-assign-tasks-from-anywhere-in-claude-cowork) ("updated over a week ago").
- Claude Tag (Claude inside Slack channels): public beta, Team and Enterprise only, not on Free, Pro, Max or Ultra — [Claude Tag docs](https://claude.com/docs/claude-tag/overview) (live docs). The product page says "Coming soon to Microsoft Teams" with a waitlist — [claude.com/tag](https://claude.com/tag) (undated, © 2026).
- Unified chat and Cowork experience: rolling out gradually to Pro and Max since 16 Sep 2026 — [release notes](https://support.claude.com/en/articles/12138966-release-notes) (entry 16 Sep 2026).
- Cowork on web and mobile: Pro, Max, Ultra; beta on Team; Enterprise only when an owner enables it — [Get started with Claude Cowork](https://support.claude.com/en/articles/13345190-get-started-with-cowork) ("updated this week").
- Computer use (beta) for Team and Enterprise, rolling out gradually to organizations (20 Nov 2026); Claude Meetings (beta) for Team and Enterprise (12 Nov 2026); Personal Finance (beta), Pro, Max, Ultra, US only (5 Nov 2026) — [release notes](https://support.claude.com/en/articles/12138966-release-notes).
- Claude for Outlook: public beta on all paid plans — [Anthropic blog](https://claude.com/blog/collaborate-with-claude-across-excel-powerpoint-word-and-outlook) (7 May 2026).
- In Claude Code: cloud scheduled tasks (formerly routines) and channels are research previews, agent teams are experimental — [scheduled tasks docs](https://code.claude.com/docs/en/routines), [channels docs](https://code.claude.com/docs/en/channels) (live docs).

### Inferences
- The dictated word most likely is literally "Duet". The reader not having it is consistent with any of three documented gates: outside the United States, not yet invited from the waitlist, or on a Team or Enterprise plan.
- Duet is a consumer-style proactive assistant, not an integration interface. Getting Duet would not by itself let a custom GPT, Copilot or an orchestrator hand tasks to Claude; nothing in its documentation offers an inbound trigger.
- Most of what Duet does unattended (work in the cloud with the laptop closed, recurring briefs, connectors, skills, memory) is already available outside the preview through cloud tasks and scheduled tasks (see question 2). What is unique to Duet is the proactive "it messages you first" behaviour, the dedicated app and the payments integrations.

### Gaps
- No date for availability outside the US or on Team and Enterprise.
- Whether custom connectors (the reader's own hub) work inside Duet is not stated explicitly; the sources only say connected apps "carry over".
- A search summary mentioned an internal name "Claude Loop"; the 9to5Mac article I opened does not mention it. Unverified.
- I did not research whether the reader could have meant Google's older "Duet AI" brand; no source checked.

## 2. Claude apps (web, desktop, mobile): what exists and what each can do unattended

### Takeaway
Chat and Cowork are being merged into one experience whose tasks run in Anthropic's cloud, so Claude can now work with the laptop closed and on a schedule (at most hourly), using connectors, skills and memory. Connectors, one custom connector, Skills and memory exist even on Free; the agentic surfaces (Cowork, scheduled tasks, Chrome, Office add-ins) need a paid plan, and Slack-channel Claude (Claude Tag) needs Team or Enterprise. Nothing in the apps accepts a task from an outside system by itself; they act when a person asks, a schedule fires, or (Duet) on periodic checks.

### Cited Findings

**Cowork and the merged experience**
- Cowork "brings Claude Code's agentic capabilities to knowledge work beyond coding"; paid plans only (Pro, Max, Ultra, Team, Enterprise) — [Get started with Claude Cowork](https://support.claude.com/en/articles/13345190-get-started-with-cowork) ("updated this week").
- Cowork left research preview and became "generally available across all paid plans on both macOS and Windows" — [eWeek](https://www.eweek.com/news/claude-cowork-general-availability-enterprise-controls/) (10 Apr 2026).
- Cowork on web and mobile started 7 Jul 2026 (Max first), with sessions running remotely (beta) so that work continues when a laptop is closed — [release notes](https://support.claude.com/en/articles/12138966-release-notes) (entry 7 Jul 2026).
- On 16 Sep 2026 Anthropic announced "Claude Cowork and chat are now one Claude": tasks, chats, projects, connectors and skills carry over; gradual rollout to Pro and Max on web, desktop and mobile — [release notes](https://support.claude.com/en/articles/12138966-release-notes) (entry 16 Sep 2026); announcement at [claude.com/blog/cowork-is-now-claude](https://claude.com/blog/cowork-is-now-claude) (search summary). On Team and Enterprise it applies where "Chat and Cowork unified" is turned on — [Help Center](https://support.claude.com/en/articles/16761823-claude-cowork-and-chat-are-one-claude) (search summary).
- Current platform matrix: desktop app (macOS, Windows, Linux in beta) on all paid plans; web and mobile on Pro, Max, Ultra, Team (beta), Enterprise if an owner enables it — [Get started with Claude Cowork](https://support.claude.com/en/articles/13345190-get-started-with-cowork).
- "Cowork runs your tasks in the cloud." "Sessions keep running even when the desktop app is closed or your computer is asleep." Local files, the local browser and computer control go through the Claude Desktop app, which must stay open for those tasks — [Get started with Claude Cowork](https://support.claude.com/en/articles/13345190-get-started-with-cowork).
- Cowork offers connectors, browser actions, plugins (bundles of skills, connectors and sub-agents), sub-agent coordination, projects, global and folder instructions, and memory shared with chat. "Sessions can't be shared with others" — [Get started with Claude Cowork](https://support.claude.com/en/articles/13345190-get-started-with-cowork).
- On Enterprise, Cowork was off by default at launch and on by default from 10 Sep 2026 unless turned off — [Use Cowork on Team and Enterprise](https://support.claude.com/en/articles/13455879-use-cowork-on-team-and-enterprise-plans) (search summary).
- Independent reaction: the merge is "hopefully good news" for people confused by the Cowork, Claude and Claude Code distinctions — [Simon Willison](https://simonwillison.net/2026/Sep/16/one-claude/) (16 Sep 2026, search summary). The New Stack noted it is unclear whether users can force a request to stay in simple chat mode — [The New Stack](https://thenewstack.io/anthropic-claude-unified-interface/) (Sep 2026, search summary).

**Scheduled or recurring tasks in the apps**
- Available on Pro, Max, Ultra, Team, Enterprise "in Claude Cowork and in the new Claude experience". Frequencies: hourly, daily, weekly, weekdays, or manual — [Schedule recurring tasks, Help Center](https://support.claude.com/en/articles/13854387-schedule-recurring-tasks-in-claude-cowork) ("updated this week").
- "Scheduled tasks run remotely, so they run on their cadence even when your computer is asleep." Exception: choosing a local folder turns on "Require this computer", and the task then "runs only while your computer is awake and Claude Desktop is open" — [same article](https://support.claude.com/en/articles/13854387-schedule-recurring-tasks-in-claude-cowork).
- Tasks can use connected tools, skills and installed plugins. If a connector tool is set to "Always ask", the task "may wait for your answer or finish without the tool". Each run is its own session, reviewed from the "Scheduled" sidebar — [same article](https://support.claude.com/en/articles/13854387-schedule-recurring-tasks-in-claude-cowork).
- The article mentions no API or webhook trigger for these tasks; runs start on schedule or on demand from the Scheduled page — [same article](https://support.claude.com/en/articles/13854387-schedule-recurring-tasks-in-claude-cowork).

**Remote control from the phone**
- Dispatch (phone to desktop Cowork) is in limited beta, closed to new users; the article recommends cloud Cowork instead. It needs the desktop awake with the app open and has a single continuous thread — [Help Center](https://support.claude.com/en/articles/13947068-assign-tasks-from-anywhere-in-claude-cowork) ("updated over a week ago").
- Cloud sessions are saved to the account and can be checked and steered from another surface, including mobile — [Get started with Claude Cowork](https://support.claude.com/en/articles/13345190-get-started-with-cowork).

**Connectors, custom connectors, the directory**
- Web connectors are available to all users on Claude, Cowork, Claude Desktop and Claude Mobile. A Connectors Directory at claude.ai/connectors lists them with read and write capabilities. Team and Enterprise need an Owner to enable connectors first — [Use connectors, Help Center](https://support.claude.com/en/articles/11176164-use-connectors-to-extend-claude-s-capabilities) (undated).
- Custom connectors (remote MCP servers) are available on Free, Pro, Max, Ultra, Team and Enterprise; "Free users are limited to one custom connector" — [Custom connectors, Help Center](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp) ("updated over a week ago").
- On Team only Owners and Primary Owners can add a custom connector; on Enterprise also people with a custom role that manages Libraries. Members then connect individually — [same article](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp).
- Authentication choices: sign in now, sign in when needed, or no sign-in; OAuth with Claude's published identity, automatic registration or the user's own OAuth client; and fixed request headers (API keys, bearer tokens) sent on every request — [same article](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp).
- Claude connects from Anthropic's cloud, not from the user's device: the server must be reachable from the public internet on port 443; other ports are not supported; private servers need Anthropic's IP ranges allowlisted — [same article](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp).
- Tool permissions on Team and Enterprise: Owners set each tool to Always allow, Needs approval or Blocked, org-wide. Installing connectors on mobile is in beta — [Use connectors](https://support.claude.com/en/articles/11176164-use-connectors-to-extend-claude-s-capabilities).
- The catalogue is now called the Claude Marketplace, with over 6,000 connectors and plugins — [Introducing Claude Duet](https://claude.com/resources/articles/claude-duet) (21 Oct 2026). A plugin developer portal opened on 25 Sep 2026 — [release notes](https://support.claude.com/en/articles/12138966-release-notes).

**Skills, Projects, memory**
- "Skills are available for users on Free, Pro, Max, Ultra, Team, and Enterprise plans" and require code execution to be enabled. A skill is a skill.md file plus optional bundled resources such as scripts. Skills work in chat, Cowork, Claude Code and the Excel, PowerPoint, Word and Outlook add-ins — [Use skills in Claude, Help Center](https://support.claude.com/en/articles/12512180-use-skills-in-claude) (undated).
- Memory is on by default for Free, Pro, Max and Ultra; on Team and Enterprise owners control it. Chat search is for paid plans. "Memory is shared between Chat and Claude Cowork when Cowork runs in the cloud"; Duet also uses and adds to memory. Each project has its own memory. Import from and export to other AI assistants exists as an experimental feature — [Chat search and memory, Help Center](https://support.claude.com/en/articles/11817273-use-claude-s-chat-search-and-memory-to-build-on-previous-context) (undated).
- Memory was rebuilt as individual categorised entries on 10 Jul 2026 and extended across chat and Cowork on 25 Aug 2026 — [release notes](https://support.claude.com/en/articles/12138966-release-notes).

**Claude in Chrome**
- Available on paid plans (Pro, Max, Ultra, Team, Enterprise); the side panel now runs as a Cowork session; on Enterprise an owner must enable Claude in Chrome and cloud Cowork — [Get started with Claude Cowork](https://support.claude.com/en/articles/13345190-get-started-with-cowork); [Get started with Claude in Chrome](https://support.claude.com/en/articles/12012173-get-started-with-claude-in-chrome) (search summary).
- Saved shortcuts can be scheduled from the extension; in the classic panel a scheduled shortcut works only while the computer is awake with Claude Desktop and Chrome open — [Get started with Claude in Chrome](https://support.claude.com/en/articles/12012173-get-started-with-claude-in-chrome) (search summary).
- Sources conflict on status: a help article calls it beta in the Chrome browser, while Anthropic's blog said it was generally available — [Help Center](https://support.claude.com/en/articles/12012173-get-started-with-claude-in-chrome) vs [Anthropic blog](https://www.claude.com/blog/claude-for-chrome) (Nov 2025, older than 12 months; both search summaries).

**Slack**
- Claude Tag: public beta since 23 Jun 2026, "available on Team and Enterprise plans, on Anthropic's first-party service. It isn't available on individual plans (Free, Pro, Max, or Ultra)". Anyone in a paired Slack channel can tag @Claude; work runs in an ephemeral cloud sandbox and the result is posted in the thread — [Claude Tag docs](https://claude.com/docs/claude-tag/overview) (live docs); launch date from [release notes](https://support.claude.com/en/articles/12138966-release-notes) (entry 23 Jun 2026).
- Claude Tag is billed by usage against an organization balance with an Owner-set spend limit, not per seat; Slack users do not each need a Claude seat for channel work — [Claude Tag docs](https://claude.com/docs/claude-tag/overview).
- Claude Tag can run "routines": scheduled jobs (at most once an hour), channel watches, and a subscription to a single pull request. Anyone in the channel can list, pause or stop them — [Claude Tag routines](https://claude.com/docs/claude-tag/users/proactivity) (live docs).
- Claude Tag replaces the earlier Claude in Slack app; launch credits were $25,000 for eligible Enterprise and $2,500 for Team organizations — [Anthropic news](https://www.anthropic.com/news/introducing-claude-tag) (23 Jun 2026, search summary).
- For individual plans there is still "Claude Code in Slack", which "answers mentions only from Pro, Max, and Ultra accounts in workspaces not connected to Claude Tag" — [Claude Code docs index](https://code.claude.com/docs/llms.txt) (live docs).

**Microsoft 365, Teams, Outlook, Excel**
- "Claude for Excel, PowerPoint, and Word are generally available"; "Claude for Outlook is now in public beta for all paid plans"; Mac and Windows; admins deploy from Microsoft AppSource. In Outlook Claude triages, drafts replies and prepares invites, but "nothing goes out until you click send" — [Anthropic blog](https://claude.com/blog/collaborate-with-claude-across-excel-powerpoint-word-and-outlook) (7 May 2026).
- The Microsoft 365 connector is on all plans (Free through Enterprise). It searches SharePoint, OneDrive, Outlook mail, calendars and Teams chats and channels. Work or school accounts need one-time consent from a Microsoft Entra Global Administrator; on Team and Enterprise a Claude Owner must also enable it; personal Microsoft accounts work on individual plans without admin setup — [Set up the Microsoft 365 connector, Help Center](https://support.claude.com/en/articles/12542951-set-up-the-microsoft-365-connector) (undated).
- The connector is read-only by default; optional write tools (send email, manage calendar events, create or update OneDrive and SharePoint files) were added on 7 Jul 2026 and need admin enablement — [release notes](https://support.claude.com/en/articles/12138966-release-notes) (entry 7 Jul 2026). Conflict: that entry says Teams stays read-only, while the current help article lists sending Teams messages among the write tools — [Help Center](https://support.claude.com/en/articles/12542951-set-up-the-microsoft-365-connector).
- There is no official Claude bot for Microsoft Teams yet. Claude Tag's page says "Coming soon to Microsoft Teams" with a waitlist — [claude.com/tag](https://claude.com/tag). The Information reported on 30 Jun 2026 that Anthropic plans a Claude agent for Teams; neither company had confirmed a date — [WinBuzzer](https://winbuzzer.com/2026/07/01/anthropic-eyes-claude-agent-for-microsoft-teams-xcxwbn/) (1 Jul 2026, search summary).
- Separately, Microsoft uses Claude models inside its own Copilot: in Researcher and Copilot Studio since 24 Sep 2025 — [Microsoft 365 blog](https://microsoft.com/en-us/microsoft-365/blog/2025/09/24/expanding-model-choice-in-microsoft-365-copilot/) (24 Sep 2025, older than 12 months, search summary) — and in "Copilot Cowork", built with Anthropic's agent technology and tested through Microsoft's Frontier program from March 2026 — [VentureBeat](https://venturebeat.com/orchestration/microsoft-announces-copilot-cowork-with-help-from-anthropic-a-cloud-powered) (Mar 2026, search summary).

**Other**
- Claude Meetings (beta, Team and Enterprise, 12 Nov 2026): Claude joins Google Meet calls as a visible participant, takes notes and builds docs — [release notes](https://support.claude.com/en/articles/12138966-release-notes).
- Max and Team subscribers get monthly API credits, claimed by linking a Claude Console organization (7 Oct 2026) — [release notes](https://support.claude.com/en/articles/12138966-release-notes).

### Inferences
- What runs unattended today in the apps: (1) cloud tasks that continue after the device is closed; (2) scheduled tasks, hourly at most; (3) Duet's periodic checks (US preview only); (4) Claude Tag routines in Slack (Team and Enterprise). Everything else (Office add-ins, Chrome classic panel, Dispatch, tasks on local folders) needs the person or their computer present.
- The practical blocker for unattended runs is approvals: any connector tool left on "Always ask" or "Needs approval" can stall or silently skip a step, so an unattended task needs its tools pre-approved.
- The apps are outbound-first. A person, a clock, or Duet's own check starts the work; no app surface documents "another system sends Claude a task" except through the Claude Code task triggers in question 3.
- For a non-programmer on a paid individual plan, the lowest-effort route to "less manual" is: add the custom connector to their own web app, then create a scheduled task that reads pending items from it and writes results back.

### Gaps
- No single official table of app features by plan was found; the matrix above is assembled from several help articles.
- Claude.ai Projects (the knowledge-base feature) were not researched beyond their per-project memory; no dedicated source opened.
- Whether the Free plan can create scheduled tasks: sources say paid plans only for Cowork scheduled tasks; nothing found for Free.
- Exact usage cost of scheduled and background tasks per plan is not published as numbers; sources only say they consume the normal plan limits.

## 3. Claude Code: cloud sessions, triggers, agents, headless use, GitHub, MCP

### Takeaway
Claude Code is the Anthropic surface with real automation entry points. A "cloud scheduled task" (formerly "routine", research preview, all paid plans) can start on a clock, on a GitHub event, or on an authenticated HTTP POST from any outside system, and it runs in Anthropic's cloud with the user's connectors. Around it sit cloud sessions, Remote Control, channels (push events into a running session), cross-session messaging, subagents, experimental agent teams, headless runs and GitHub integration; nearly all cloud features require signing in with a claude.ai subscription rather than an API key.

### Cited Findings

**Cloud sessions (web, mobile, desktop, terminal)**
- "Cloud sessions are available on Pro, Max, Ultra, and Team plans, and for Enterprise users with premium seats or Chat + Claude Code seats." They can be started from claude.ai/code, the Code tab of the mobile app, the desktop app, or `claude --cloud` in a terminal — [Use Claude Code in the cloud](https://code.claude.com/docs/en/claude-code-on-the-web) (live docs).
- "The session keeps running after you close your laptop, and you can check on it or steer it from any device. It counts toward your plan's usage limits ... and there's no separate charge for the cloud VM" — [same page](https://code.claude.com/docs/en/claude-code-on-the-web).
- Limits: "repository cloning in Anthropic-hosted environments and pull request creation require GitHub"; sessions stop after a period of inactivity and the VM is reclaimed; organizations with Zero Data Retention, the HIPAA configuration or customer-managed keys cannot use cloud sessions — [same page](https://code.claude.com/docs/en/claude-code-on-the-web).
- A follow-up message can be queued into an existing cloud session from any machine where the CLI is logged in: `claude -p "your message" --cloud <session-id>`; it exits without waiting for a reply — [same page](https://code.claude.com/docs/en/claude-code-on-the-web).
- Team and Enterprise can route cloud sessions to self-hosted environments on their own infrastructure — [Remote Control comparison table](https://code.claude.com/docs/en/remote-control) (live docs).

**Cloud scheduled tasks, formerly routines: schedule, API and GitHub triggers**
- Status and plans: "Scheduled tasks are in research preview. Behavior, limits, and the API surface may change." Available on Pro, Max, Ultra, Team and Enterprise; managed at claude.ai/code/routines or with `/schedule` — [Automate work with scheduled tasks](https://code.claude.com/docs/en/routines) (live docs). Launched 14 Apr 2026 as "routines" — [Anthropic blog](https://claude.com/blog/introducing-routines-in-claude-code) (14 Apr 2026).
- A task is "a prompt, one or more repositories, and a set of connectors", run on Anthropic-managed cloud "so they keep working when your laptop is closed". Triggers can be combined: schedule, API, GitHub — [scheduled tasks docs](https://code.claude.com/docs/en/routines).
- Schedule: presets (hourly, daily, weekly), custom cron, or one-off; "Expressions that run more often than once per hour are rejected" — [scheduled tasks docs](https://code.claude.com/docs/en/routines).
- API trigger: "POSTing to the endpoint with the task's bearer token starts a new session and returns a session URL." Endpoint form: `POST https://api.anthropic.com/v1/claude_code/routines/<trigger id>/fire`, with `Authorization: Bearer`, an `anthropic-beta: experimental-cc-routine-2026-04-01` header and an `anthropic-version` header. The body accepts an optional `text` field of freeform text. The token is shown once and is scoped to that one task — [scheduled tasks docs](https://code.claude.com/docs/en/routines).
- The response contains only the new session's ID and URL, not the result of the work — [scheduled tasks docs](https://code.claude.com/docs/en/routines).
- The `text` arrives wrapped as untrusted data: the saved prompt "must opt in to acting on fire text", for example "Investigate the alert described in the routine-fire-payload block" — [scheduled tasks docs](https://code.claude.com/docs/en/routines).
- "The `/fire` endpoint is available to claude.ai users only and is not part of the Claude Platform API surface" — [scheduled tasks docs](https://code.claude.com/docs/en/routines). The API trigger can be added only on the web, not from the CLI — [same page](https://code.claude.com/docs/en/routines).
- GitHub trigger: pull request, release and issue events, with filters; requires the Claude GitHub App on the repository; each event starts a new independent session; events above hourly caps are dropped — [scheduled tasks docs](https://code.claude.com/docs/en/routines).
- Limits: 100 scheduled runs per hour per account; 30 per hour per task shared by "Run now", API fires and re-arming; 100 API fires per hour per account; no overage. Runs draw down subscription usage like interactive sessions — [scheduled tasks docs](https://code.claude.com/docs/en/routines).
- At launch Anthropic stated daily caps of 5 runs for Pro, 15 for Max and 25 for Team and Enterprise — [Anthropic blog](https://claude.com/blog/introducing-routines-in-claude-code) (14 Apr 2026). The current docs page lists only the hourly limits above.
- Approvals: runs start in "auto mode", where a classifier model allows or blocks actions; a run still stops and waits when an action matches an "ask" rule or after repeated blocks — [scheduled tasks docs](https://code.claude.com/docs/en/routines).
- Identity and scope: tasks "belong to your individual claude.ai account", are not shared with teammates, and act as the user in GitHub and connectors. All connected connectors are included by default and can be removed per task — [scheduled tasks docs](https://code.claude.com/docs/en/routines).
- Team and Enterprise Owners can turn the feature off for everyone — [scheduled tasks docs](https://code.claude.com/docs/en/routines).
- Roadmap statement: "We plan to expand webhook-based routines to trigger from more event sources in the future" — [Anthropic blog](https://claude.com/blog/introducing-routines-in-claude-code) (14 Apr 2026).
- Two local alternatives exist: Desktop scheduled tasks (run on the user's machine with local files) and `/loop` (inside an open session) — [scheduled tasks docs](https://code.claude.com/docs/en/routines).

**Remote Control and mobile**
- Remote Control connects claude.ai/code or the mobile app to a session running on the user's own machine; "available on Pro, Max, Ultra, Team, and Enterprise plans. API keys are not supported. On Team and Enterprise, an Owner must first enable" it. The session runs locally, "so your computer has to stay on and the `claude` process has to keep running" — [Remote Control docs](https://code.claude.com/docs/en/remote-control) (live docs).
- Trusted Devices (device verification before steering sessions remotely) arrived 25 Jun 2026 — [release notes](https://support.claude.com/en/articles/12138966-release-notes).
- The mobile app can "start, monitor, and steer Claude Code tasks" on iOS and Android — [docs index](https://code.claude.com/docs/llms.txt) (live docs).

**Channels: pushing outside events into a running session**
- "Channels are in research preview." "A channel is an MCP server that pushes events into your running Claude Code session"; they can be two-way. "Events only arrive while the session is open, so for an always-on setup you run Claude in a background process or persistent terminal" — [Channels docs](https://code.claude.com/docs/en/channels) (live docs).
- Telegram, Discord and iMessage plugins are included; during the preview only allowlisted plugins load, and a self-built channel (for example a webhook receiver) needs a development flag. Team and Enterprise must enable channels explicitly — [Channels docs](https://code.claude.com/docs/en/channels).
- Channels work with a claude.ai login or a Console API key, not through Bedrock, Google Cloud or Foundry — [feature availability](https://code.claude.com/docs/en/feature-availability) (live docs).

**Agents working with agents inside Claude Code**
- Subagents, hooks, skills, plugins and MCP servers work on every provider — [feature availability](https://code.claude.com/docs/en/feature-availability).
- Agent teams ("multiple Claude Code instances working together as a team, with shared tasks, inter-agent messaging") are experimental, off by default, enabled with `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`, first released 5 Feb 2026; teammates spawn only in interactive sessions, not in `-p` or Agent SDK runs — [agent teams docs](https://code.claude.com/docs/en/agent-teams) and [changelog](https://code.claude.com/docs/en/changelog) (live docs, search summary). They use approximately 7 times more tokens than standard sessions when teammates run in plan mode — [Manage costs](https://code.claude.com/docs/en/costs) (live docs, search summary).
- Projects (one conversation that coordinates parallel cloud sessions sharing repositories, instructions and memory) is in public beta on Pro, Max and Ultra — [Run agents in parallel](https://code.claude.com/docs/en/agents) (live docs, search summary).
- Cross-session messaging lets Claude send plain-text messages between the user's own sessions on the same machine, on other machines or in the cloud. A received message "never counts as your consent" and cannot change configuration — [Cross-session messaging](https://code.claude.com/docs/en/cross-session-messaging) (live docs).

**Hooks, headless runs, Agent SDK**
- Hooks "run shell commands automatically when Claude Code edits files, finishes tasks, or needs input"; the reference also covers HTTP hooks — [docs index](https://code.claude.com/docs/llms.txt) (live docs).
- `claude -p "<prompt>"` runs non-interactively and returns text, JSON (with `result`, session ID, cost) or a JSON stream; `--json-schema` forces a structured answer; `--permission-prompts none` denies anything that would wait for a person — [Run Claude Code programmatically](https://code.claude.com/docs/en/headless) (live docs).
- "`--bare` is the recommended mode for scripted and SDK calls"; bare mode does not use the subscription login and needs an `ANTHROPIC_API_KEY` — [same page](https://code.claude.com/docs/en/headless).
- The Agent SDK offers "the same tools, agent loop, and context management that power Claude Code" as Python and TypeScript packages — [same page](https://code.claude.com/docs/en/headless).

**GitHub**
- Claude Code GitHub Actions "respond to @claude mentions, automate tasks, and turn issues into pull requests"; works with a subscription, a Console key, Bedrock, Google-managed Google Cloud and Foundry — [docs index](https://code.claude.com/docs/llms.txt); [feature availability](https://code.claude.com/docs/en/feature-availability).
- Auto-fix: Claude can watch a pull request and respond to CI failures and review comments; needs the Claude GitHub App — [Use Claude Code in the cloud](https://code.claude.com/docs/en/claude-code-on-the-web).
- Code Review of pull requests is for Team and Enterprise — [feature availability](https://code.claude.com/docs/en/feature-availability).

**MCP client and server**
- As a client Claude Code connects to MCP servers over HTTP (recommended), stdio (local) and the deprecated SSE; it supports OAuth and static headers. MCP Tasks (long-running server jobs) are supported in public beta from v2.1.304 — [Connect Claude Code to tools via MCP](https://code.claude.com/docs/en/mcp) (live docs).
- Connectors added in claude.ai are "automatically available in Claude Code" when logged in with a claude.ai account — [same page](https://code.claude.com/docs/en/mcp).
- As a server: "You can use Claude Code itself as an MCP server that other applications can connect to" with `claude mcp serve`, a local stdio server. "This MCP server only exposes Claude Code's tools to your MCP client, so your own client is responsible for implementing user confirmation" — [same page](https://code.claude.com/docs/en/mcp).

### Inferences
- The API trigger on a cloud scheduled task is the closest thing Anthropic offers to "send Claude a task over HTTP" inside a subscription, without paying API rates. It is one-way: the caller gets a session link, and the task must deliver its own result (through a connector, a pull request, a Slack post, or a call to the caller's hub).
- Because the hourly schedule floor applies, anything needing a response within minutes must use the API trigger, a GitHub event or a channel, not polling.
- `claude mcp serve` exposes file and shell tools to a local MCP client; it does not turn Claude into a network service that a remote agent can call. It is not an inbound path for ChatGPT or Copilot.
- Channels are powerful but aimed at developers: a process must stay running on a machine, and custom webhook channels are still behind a development flag.
- Despite the name, Claude Code tasks are not limited to coding: a task can be a prompt plus connectors, which suits a business user's "check the hub and act" loop, though the setup screens assume GitHub.

### Gaps
- Whether an API-triggered task can be created with no GitHub repository at all is unclear: the page defines a task as including "one or more repositories" but also says a task becomes a Claude Code task if you "select a repository or add a GitHub event or API trigger". Needs a test in the reader's own account.
- Whether the launch-time daily caps (5, 15, 25 per day) still apply is not confirmed by the current docs.
- The exact per-hour caps for GitHub events are not published on the page.
- No practitioner tutorial was found that calls the `/fire` endpoint from a custom GPT Action; guides describe relaying events through Make, Zapier or n8n when the source app cannot send the request itself — [The AI Maker](https://aimaker.substack.com/p/claude-code-routines-workflows) and [Builder.io](https://www.builder.io/blog/claude-code-routines) (2026, search summaries).

## 4. Developer platform: what it takes to run a Claude-based agent that other systems can call

### Takeaway
A callable Claude agent needs a Claude Console account and API key, billed per token and separate from the chat subscription. There are three build levels: the Messages API (you write the loop, optionally letting Claude call remote MCP servers directly), the Agent SDK (Claude Code as a library on your own server), and Claude Managed Agents (beta), where Anthropic hosts long-running sessions with sandbox, memory, credentials, cron schedules and webhooks for $0.08 per active session-hour plus tokens.

### Cited Findings
- Anthropic describes two ways to build: Messages API ("direct model prompting access", best for custom agent loops) and Claude Managed Agents ("pre-built, configurable agent harness that runs in managed infrastructure", best for long-running and asynchronous work) — [Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview) (live docs).
- Managed Agents launched in public beta on 8 Apr 2026 — [Anthropic blog](https://claude.com/blog/claude-managed-agents) (8 Apr 2026). It is still beta: "All Managed Agents endpoints require the `managed-agents-2026-04-01` beta header", and access is "enabled by default for all API accounts" — [overview](https://platform.claude.com/docs/en/managed-agents/overview).
- Concepts: agent (model, system prompt, tools, MCP servers, skills), environment (Anthropic cloud sandbox or self-hosted), session, and events. The caller sends user messages as events and Claude "streams back results through server-sent events"; the full event history can be fetched — [overview](https://platform.claude.com/docs/en/managed-agents/overview).
- Built-in tools: bash, file operations, web search and fetch, MCP servers — [overview](https://platform.claude.com/docs/en/managed-agents/overview).
- Available on the Claude API, Claude Platform on AWS and Claude models on Google Cloud (Anthropic managed), all beta; not eligible for Zero Data Retention or HIPAA — [overview](https://platform.claude.com/docs/en/managed-agents/overview).
- Scheduled deployments run an agent on a cron schedule (minute granularity, up to 1,000 per organization), with a `run` endpoint for manual runs and optional per-run budgets; credentials come from vaults — [Scheduled deployments](https://platform.claude.com/docs/en/managed-agents/scheduled-deployments) (live docs).
- Results reach the caller through the event stream or webhooks. Webhooks arrived 6 May 2026 and were extended on 30 Jun and 22 Jul 2026; payloads carry only the event type and ID, so the receiver fetches the object with a GET call — [Platform release notes](https://platform.claude.com/docs/en/release-notes/overview) and [webhooks docs](https://platform.claude.com/docs/en/managed-agents/webhooks) (live docs, search summary).
- Multi-agent orchestration and Outcomes moved from research preview (April launch) to beta on 6 May 2026; dynamic workflows (a program that runs many agents in phases) were added in beta on 9 Oct 2026. MCP tunnels and "dreaming" remain in a limited research preview — [Platform release notes](https://platform.claude.com/docs/en/release-notes/overview) (search summary); [overview](https://platform.claude.com/docs/en/managed-agents/overview).
- Pricing: standard token rates plus $0.08 per session-hour of active runtime; idle time waiting for input is not counted — [Anthropic blog](https://claude.com/blog/claude-managed-agents) (8 Apr 2026); [pricing page](https://platform.claude.com/docs/en/about-claude/pricing) (live docs, search summary).
- MCP connector in the Messages API: beta (headers `mcp-client-2026-09-15`, `mcp-client-2025-11-20`); lets Claude call remote MCP servers "without a separate MCP client". "The server must be publicly exposed through HTTP (supports both Streamable HTTP and SSE transports). Local STDIO servers cannot be connected directly." The caller supplies any OAuth token itself; several servers per request are allowed — [MCP connector docs](https://platform.claude.com/docs/en/agents-and-tools/mcp-connector) (live docs).
- No longer behind a beta header: code execution tool, web fetch tool, tool search and memory tool (since 17 Feb 2026); Agent Skills and the Skills API (out of beta 19 Aug 2026); the Files API (out of beta, date not captured) — [Platform release notes](https://platform.claude.com/docs/en/release-notes/overview) (live docs, search summary).
- Agent SDK: "Build production AI agents with Claude Code as a library"; hosting guidance covers Docker, Kubernetes and sandbox providers; custom tools are defined through an in-process MCP server — [docs index](https://code.claude.com/docs/llms.txt) (live docs).
- Subscription and API are separate worlds: cloud sessions, cloud scheduled tasks, Remote Control and similar features "require signing in with a claude.ai account and are not reachable with an Anthropic Console API key" — [feature availability](https://code.claude.com/docs/en/feature-availability) (live docs).

### Inferences
- The smallest callable agent is: the reader's existing web app receives a task, calls the Messages API with the task text (and, if wanted, the app's own MCP endpoint through the MCP connector), and stores the answer. This gives a synchronous result, which no subscription surface provides.
- Managed Agents suits tasks that run for minutes or hours or need files, memory and schedules; it is still a developer product in beta and needs someone to write and maintain the integration.
- API use is metered separately from the subscription; the monthly API credits now bundled with Max and Team soften this for light use (amount not found).

### Gaps
- The amount of the monthly API credits for Max and Team was not found.
- Managed Agents rate limits and regional availability were not checked.
- No general-availability date for Managed Agents or the MCP connector was found.

## 5. Inbound paths in practice: how another assistant or system hands Claude a task and gets the result back

### Takeaway
There are four workable inbound routes today: (1) a direct API call to the developer platform, the only route with a synchronous answer; (2) an HTTP POST to the API trigger of a cloud scheduled task, inside the subscription but with no result in the response; (3) an event in a shared tool Claude is wired to (a GitHub issue or pull request, an @Claude mention in Slack); and (4) a shared task store that a scheduled task polls through a connector, at best once an hour. There is no public API into a normal chat conversation, Cowork task or Duet thread, no Claude bot in Microsoft Teams, and no native A2A endpoint.

### Cited Findings

**Route 1: API call (custom orchestrator, the reader's own web app, any system that can make HTTPS requests)**
- Messages API and Managed Agents accept tasks over HTTPS with an API key; Managed Agents sessions return output through server-sent events, a fetchable event history and webhooks — [Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview); [Scheduled deployments](https://platform.claude.com/docs/en/managed-agents/scheduled-deployments) (live docs).
- Example header set from Anthropic's own curl for these endpoints: `x-api-key`, `anthropic-version`, `anthropic-beta` — [Scheduled deployments](https://platform.claude.com/docs/en/managed-agents/scheduled-deployments).

**Route 2: API trigger on a cloud scheduled task (subscription, research preview)**
- Any system that can send an authenticated POST can start a run; Anthropic's examples are a monitoring tool passing an alert body as `text` and a deploy pipeline calling the endpoint after each deploy — [scheduled tasks docs](https://code.claude.com/docs/en/routines) (live docs).
- The reply is `{"type": "routine_fire", "claude_code_session_id": ..., "claude_code_session_url": ...}`; a person can open the URL to watch or continue the run — [scheduled tasks docs](https://code.claude.com/docs/en/routines).
- Limits: 30 fires per hour per task, 100 per hour per account; the endpoint is under an experimental beta header and "request and response shapes, rate limits, and token semantics may change" — [scheduled tasks docs](https://code.claude.com/docs/en/routines).
- During a run the task can use the user's connectors, "including writes", so it can post its result to Slack, a tracker or a custom connector — [scheduled tasks docs](https://code.claude.com/docs/en/routines).

**Route 3: events in shared tools**
- GitHub: a task can fire on pull request, release and issue events; GitHub Actions answer @claude mentions and turn issues into pull requests — [scheduled tasks docs](https://code.claude.com/docs/en/routines); [docs index](https://code.claude.com/docs/llms.txt) (live docs).
- Slack with Claude Tag (Team and Enterprise): typing @Claude with a request starts a working session; replies in the thread steer it; the result is posted in the thread — [How Claude Tag works](https://claude.com/docs/claude-tag/concepts/how-it-works) (live docs).
- When Claude is mentioned partway into a thread it gets a window of the thread's messages "with other bots' replies filtered out" — [How Claude Tag works](https://claude.com/docs/claude-tag/concepts/how-it-works).
- Claude Tag routines from Slack react to GitHub only through a subscription to one pull request: "You can't set up a routine from Slack that fires on other repository events" — [Claude Tag routines](https://claude.com/docs/claude-tag/users/proactivity) (live docs).
- Slack on individual plans: "Claude Code in Slack" spawns a cloud session from an @Claude mention, on Pro, Max and Ultra — [Channels docs comparison table](https://code.claude.com/docs/en/channels); [Remote Control docs](https://code.claude.com/docs/en/remote-control) (live docs).
- Microsoft Teams: no Claude bot is available; only "Coming soon to Microsoft Teams" with a waitlist — [claude.com/tag](https://claude.com/tag). Claude can read Teams chats and channels through the Microsoft 365 connector — [Help Center](https://support.claude.com/en/articles/12542951-set-up-the-microsoft-365-connector).

**Route 4: a shared task store that Claude checks**
- Scheduled tasks in the apps can use any connected connector and run remotely hourly, daily or weekly — [Schedule recurring tasks](https://support.claude.com/en/articles/13854387-schedule-recurring-tasks-in-claude-cowork).
- Cloud scheduled tasks in Claude Code reject schedules more frequent than once per hour — [scheduled tasks docs](https://code.claude.com/docs/en/routines).
- Duet checks connected accounts only "every few hours" — [Introducing Claude Duet](https://claude.com/resources/articles/claude-duet) (21 Oct 2026).

**Developer-only inbound routes**
- Channels push webhooks or chat messages into a session that is already running on a machine (research preview) — [Channels docs](https://code.claude.com/docs/en/channels).
- A script can run `claude -p` and read the JSON result, or queue a message into a cloud session with `claude -p "..." --cloud <session-id>` — [headless docs](https://code.claude.com/docs/en/headless); [cloud docs](https://code.claude.com/docs/en/claude-code-on-the-web).
- Third-party open-source wrappers expose Claude Code or the Agent SDK as an A2A server; these are community projects, not Anthropic products — [jcwatson11/claude-a2a](https://github.com/jcwatson11/claude-a2a), [ericabouaf/claude-a2a](https://github.com/ericabouaf/claude-a2a) (search summaries).

**What is not possible today**
- The only documented HTTP entry into subscription-side Claude is the `/fire` endpoint, which "is available to claude.ai users only and is not part of the Claude Platform API surface" — [scheduled tasks docs](https://code.claude.com/docs/en/routines).
- Duet's documentation describes no API, webhook or Slack trigger — [Help Center](https://support.claude.com/en/articles/17631495-get-started-with-claude-duet).
- Claude Code has no native A2A client or server: a feature request for "Native Agent2Agent (A2A) Protocol v1.0 Client Support" was opened 24 Oct 2026 and is open with no Anthropic reply — [GitHub issue 104852](https://github.com/anthropics/claude-code/issues/104852) (24 Oct 2026).
- Cross-session messaging is only between one user's own Claude sessions, and a message from another session cannot approve anything — [Cross-session messaging](https://code.claude.com/docs/en/cross-session-messaging).
- Claude Tag is not available on individual plans — [Claude Tag docs](https://claude.com/docs/claude-tag/overview).

### Inferences
- For the reader's setup (a custom GPT that already calls their own web app), the web app is the natural relay: the GPT or Copilot writes a task to the app; the app either calls the Messages API (immediate answer, API billing) or fires a cloud scheduled task (subscription billing, answer arrives later); Claude writes the result back to the app through a custom connector; the other assistants read it from the app. Each piece is documented, but the combination was not found as a published tutorial.
- Calling the `/fire` endpoint straight from a custom GPT Action should be possible in principle because it is a plain HTTPS POST with a bearer token, but it also needs two fixed Anthropic headers; whether GPT Actions can send them was not verified here. Routing through the reader's own app avoids the question and keeps the token out of ChatGPT.
- Microsoft 365 Copilot has no documented way to push a task to a Claude subscription. The realistic common ground with Copilot is a shared store both can reach (SharePoint, OneDrive, Outlook, Teams via Claude's Microsoft 365 connector) or a Copilot Studio agent that calls the same hub. Copilot-side capabilities are outside this research.
- Whether another bot can trigger Claude Tag by posting "@Claude" in Slack is undocumented; the fact that other bots' replies are filtered from thread context suggests bot-to-bot handoff in Slack is not a designed path.
- With polling, the hand-off delay is about one hour at best; with the API trigger or an API call it is seconds to minutes.

### Gaps
- No source found on Grok handing tasks to Claude; the only generic routes are the API call and the HTTP trigger above.
- No documented way for a claude.ai scheduled task to call back a webhook automatically when it finishes; results must be pushed by the task's own instructions.
- No official statement on whether bot or app messages can start a Claude Tag session.
- Email as an inbound path (sending Claude an email that it acts on) was not found as a feature; it would have to be built as a scheduled task reading Gmail or Outlook through a connector.

## 6. Outbound paths: how Claude calls a custom HTTP hub or shared memory

### Takeaway
The standard outbound route is a custom connector: the hub exposes a remote MCP server on the public internet (port 443), and then chat, Cowork, mobile, Claude Code, cloud scheduled tasks and Claude Tag can all call it. It works on every plan (one connector on Free); on Team and Enterprise an Owner must add it. The alternatives (a Skill script or code making HTTP requests, web fetch, a browser) are more restricted: sandbox network access is limited by default and controlled by Owners on Team and Enterprise, and web fetch only reads URLs already present in the conversation.

### Cited Findings

**Custom MCP connector**
- Available on Free (one), Pro, Max, Ultra, Team and Enterprise, "on Claude, Cowork, and Claude Desktop"; Team needs an Owner to add it, Enterprise an Owner or a role with Libraries access — [Custom connectors, Help Center](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp).
- The connection originates from Anthropic's cloud on every client, so the hub must be publicly reachable on port 443 — [same article](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp).
- A fixed credential in request headers is supported; on Team and Enterprise that credential is shared by everyone who uses the connector — [same article](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp).
- Anthropic does not verify custom connectors; users are told to review tool approval requests and to choose "Allow always" only for trusted servers. In Research mode connector tools are invoked "automatically without further approval" — [same article](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp).
- The same connectors load in Claude Code when signed in with claude.ai, and in cloud scheduled tasks by default — [MCP docs](https://code.claude.com/docs/en/mcp); [scheduled tasks docs](https://code.claude.com/docs/en/routines).
- In cloud runs, "MCP connector traffic is routed through Anthropic's servers, so the connectors you add to the task work without adding their hosts to Allowed domains" — [scheduled tasks docs](https://code.claude.com/docs/en/routines).
- MCP servers added only locally with `claude mcp add` stay on that machine and are not available to cloud tasks — [scheduled tasks docs](https://code.claude.com/docs/en/routines).
- Local MCP servers in Claude Desktop "are not available in claude.ai or in cloud Cowork sessions" — [Custom connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp).

**Skills with scripts and code execution in the apps**
- Code execution and file creation is available to all plans, Free included — [Create and edit files, Help Center](https://support.claude.com/en/articles/12111783-create-and-edit-files-with-claude) (undated).
- On Free, Pro, Max and Ultra, network access is enabled for installing packages from approved sources, with an "Allow network egress" toggle. On Team and Enterprise, Owners choose: off, package managers only (default), package managers plus specific domains, or all domains; users cannot add their own domains — [same article](https://support.claude.com/en/articles/12111783-create-and-edit-files-with-claude).
- Security warning: "Claude can be tricked into sending information from its context" through the sandbox's network access — [same article](https://support.claude.com/en/articles/12111783-create-and-edit-files-with-claude).
- Network egress settings do not apply to web fetch, web search, MCP connectors or Claude in Chrome; they govern only code running in the sandbox — [Get started with Claude Cowork](https://support.claude.com/en/articles/13345190-get-started-with-cowork) ("updated this week").
- Skill scripts run in that same code-execution environment; the Skills article does not state whether scripts may call external HTTP services, and warns to review skills that tell Claude to "connect to potentially untrusted external network sources" — [Use skills in Claude](https://support.claude.com/en/articles/12512180-use-skills-in-claude).

**Code execution in Claude Code cloud sessions**
- The Default cloud environment has Limited network access with an allowlist (package registries, cloud provider APIs, container registries, common development domains). To reach "your own services directly, or a domain outside that list", the user edits the environment's Allowed domains or selects Full access; a blocked host fails with an error such as 403 — [scheduled tasks docs](https://code.claude.com/docs/en/routines).
- API keys for such calls should be stored as "network secrets", which stay outside the sandbox and are attached to matching requests — [scheduled tasks docs](https://code.claude.com/docs/en/routines); [cloud docs](https://code.claude.com/docs/en/claude-code-on-the-web).
- Organization-shared environments are changed only by an Owner in admin settings — [scheduled tasks docs](https://code.claude.com/docs/en/routines).

**Web fetch**
- The web fetch tool only opens URLs that already appeared in the conversation (user messages, tool results, earlier search or fetch results); Claude "is not allowed to dynamically construct URLs"; URLs are capped at 250 characters; a URL containing a credential is refused unless the credential appears in the system prompt or a user message; only text, HTML and PDF; no JavaScript-rendered pages — [Web fetch tool docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-fetch-tool) (live docs, search summary).

**Browser routes**
- Cowork can "open sites, read pages, click, type, and fill forms"; Duet uses a cloud browser for sites without a connector — [Get started with Claude Cowork](https://support.claude.com/en/articles/13345190-get-started-with-cowork); [Duet Help Center](https://support.claude.com/en/articles/17631495-get-started-with-claude-duet).

**API side**
- Messages API: the MCP connector (beta) reaches public remote MCP servers; classic tool use lets the developer's own code call any HTTP service. Managed Agents attach MCP servers to the agent and take credentials from vaults; MCP tunnels for private networks are research preview — [MCP connector docs](https://platform.claude.com/docs/en/agents-and-tools/mcp-connector); [Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview).

### Inferences
- Which routes need what: custom connector needs no paid plan for a single connector, a paid plan for more, and Owner action on Team and Enterprise. Skill or code HTTP calls need the hub's domain to be allowed, which on Team and Enterprise is an Owner decision. Cloud-session HTTP calls need the user (or an Owner for shared environments) to add the domain. Microsoft 365 work accounts need a Microsoft tenant administrator.
- If the reader's web app today only speaks plain HTTP for the custom GPT, it needs an MCP endpoint added (a thin layer over the same functions) to become a Claude connector. That is a one-time development task, and the same MCP endpoint can then serve other MCP-capable assistants.
- Web fetch is not a way to write to a hub or to call an authenticated API; it is a read tool with URL restrictions.
- A static shared key in connector headers is the simplest authentication for a personal hub, but on Team and Enterprise it gives every member the same access.

### Gaps
- Whether an individual-plan user can allow an arbitrary domain (their own hub) for sandbox code, beyond the on/off egress toggle, is not stated in the help article.
- Whether web fetch is strictly limited to GET requests was not confirmed by a source.
- Anthropic's published IP ranges for allowlisting were not looked up.
- Custom connector limits beyond "one on Free" (maximum number on paid plans, timeouts, payload sizes) were not found.

## 7. Official connectors to shared stores that could serve as common ground

### Takeaway
Claude has first-party or directory connectors for the usual shared stores: Google Drive, Gmail, Google Calendar, Microsoft 365 (SharePoint, OneDrive, Outlook, Teams), Slack, GitHub, Linear, and documentation tools such as Notion and Confluence, inside a marketplace of more than 6,000 connectors and plugins. Web connectors are open to all plans; the limits are administrative (Owner enablement, Microsoft tenant consent, write tools off by default), not technical.

### Cited Findings
- Named in Anthropic's connector help: Linear, Slack, Google Drive, Gmail, Google Calendar, Microsoft 365, GitHub — [Use connectors, Help Center](https://support.claude.com/en/articles/11176164-use-connectors-to-extend-claude-s-capabilities).
- Named for Duet: Gmail, Google Calendar, Google Drive, Slack, QuickBooks, HubSpot, Docusign, Calendly — [Duet Help Center](https://support.claude.com/en/articles/17631495-get-started-with-claude-duet); plus Stripe, Gusto, LinkedIn, Canva, Shopify — [Introducing Claude Duet](https://claude.com/resources/articles/claude-duet) (21 Oct 2026).
- Named for Claude Tag: documentation connections "like Google Drive, Notion, or Confluence", monitoring connections such as Datadog, Sentry or PagerDuty, and GitHub — [Claude Tag docs](https://claude.com/docs/claude-tag/overview).
- Marketplace size: "over 6,000 connectors and plugins" — [Introducing Claude Duet](https://claude.com/resources/articles/claude-duet) (21 Oct 2026).
- Microsoft 365 connector: all plans; SharePoint, OneDrive, Outlook mail and calendars, Teams chats and channels, and meeting transcripts if a Teams admin enables them; read-only by default; SharePoint search covers the whole tenant and cannot be restricted to specific sites; OneNote cannot be read — [Set up the Microsoft 365 connector](https://support.claude.com/en/articles/12542951-set-up-the-microsoft-365-connector).
- A Zoom connector was added with Cowork's general availability — [eWeek](https://www.eweek.com/news/claude-cowork-general-availability-enterprise-controls/) (10 Apr 2026). A Salesforce plugin (beta) with 37 sales skills arrived 15 Sep 2026 for organizations approved by Salesforce — [release notes](https://support.claude.com/en/articles/12138966-release-notes).
- Claude inherits each user's permissions in the connected service; each team member authenticates individually unless a shared credential is used — [Use connectors](https://support.claude.com/en/articles/11176164-use-connectors-to-extend-claude-s-capabilities).
- MCP itself is shared ground: Anthropic stated it "has been adopted by ChatGPT, Cursor, Gemini, Microsoft Copilot, Visual Studio Code, and other popular AI products", with more than 10,000 active public MCP servers — [Anthropic news](https://www.anthropic.com/news/donating-the-model-context-protocol-and-establishing-of-the-agentic-ai-foundation) (9 Dec 2025).
- Agent Skills became an open, vendor-neutral format when Anthropic donated it to the Agentic AI Foundation — [AAIF news](https://aaif.io/news/agentic-ai-foundation-announces-four-new-projects) (22 Oct 2026).

### Inferences
- Two kinds of common ground are realistic: (a) a document or message store every assistant can reach (for a Microsoft 365 workplace, SharePoint or OneDrive files and Outlook or Teams; for Google users, Drive and Gmail), and (b) the reader's own hub exposed over MCP, since the major assistants now accept MCP servers.
- For a workplace on Microsoft 365, the Claude connector needs the company's Entra Global Administrator to consent once; without that, a work account cannot be connected even on a personal Claude plan. This is likely the main practical obstacle to using company SharePoint as shared ground.
- A store is slower than a hub: Claude only looks at a store when a person asks or a schedule fires (hourly at most).

### Gaps
- The full current list of first-party connectors (for example Notion, Asana, Atlassian, Box, Dropbox, Airtable) was not verified one by one in the directory; only the names above appear in the sources opened.
- Read versus write capability of each connector was not compiled; the directory lists it per connector.

## 8. Anthropic's stance on agent-to-agent protocols and what it has shipped for agents talking to agents

### Takeaway
Anthropic has not adopted Google's A2A protocol in any Claude product and has made no public statement for or against it that I could find; its bet is MCP, which it donated to the Linux Foundation's Agentic AI Foundation in December 2025, where A2A also became a hosted project in August 2026. What Anthropic has shipped for agent-to-agent work stays inside the Claude family (subagents, agent teams, cross-session messaging, Projects, Managed Agents orchestration, Claude Tag); talking to other vendors' agents is done through MCP, the API, shared tools, or third-party bridges.

### Cited Findings

**Protocol position**
- Anthropic donated MCP to the Agentic AI Foundation (AAIF), "a directed fund under the Linux Foundation", co-founded by Anthropic, Block and OpenAI with support from Google, Microsoft, AWS, Cloudflare and Bloomberg. The post does not mention A2A — [Anthropic news](https://www.anthropic.com/news/donating-the-model-context-protocol-and-establishing-of-the-agentic-ai-foundation) (9 Dec 2025).
- A2A joined the AAIF as a hosted project on 17 Aug 2026. The foundation presents the two as layers: MCP "standardizes how agents connect to and interact with tools, data sources, applications, and services", while "A2A adds an agent to agent interoperability layer". The post names no Anthropic statement and no joint specification — [AAIF blog](https://aaif.io/blog/a2a-joins-aaif) (17 Aug 2026).
- A2A background: version 1.0 shipped March 2026 and the project is backed by more than 150 organizations; founding organizations listed are AWS, Cisco, Google, Microsoft, Salesforce, SAP and ServiceNow — [AAIF blog](https://aaif.io/blog/a2a-joins-aaif) (17 Aug 2026); [Linux Foundation press release](https://www.linuxfoundation.org/press/a2a-protocol-surpasses-150-organizations-lands-in-major-cloud-platforms-and-sees-enterprise-production-use-in-first-year) (Apr 2026, search summary). Google created A2A and donated it to the Linux Foundation in June 2025 — [Google Developers Blog](https://developers.googleblog.com/en/google-cloud-donates-a2a-to-linux-foundation/) (Jun 2025, older than 12 months, search summary).
- Anthropic donated Agent Skills to the AAIF on 22 Oct 2026; David Soria Parra of Anthropic: "Today, we're donating Agent Skills to the AAIF to ensure that anyone building with skills can shape what's next." AAIF then hosted 10 projects including MCP, A2A, AGENTS.md, goose and agentgateway — [AAIF news](https://aaif.io/news/agentic-ai-foundation-announces-four-new-projects) (22 Oct 2026).
- The MCP roadmap (last updated 22 Aug 2026) makes "Agentic Messaging Primitives" its first priority: long-running Tasks, server-initiated events "including webhooks", Triggers, and ways to steer work in flight; a second priority is agent identity and delegation. It has an Agents interest group and does not mention A2A — [MCP roadmap](https://modelcontextprotocol.io/development/roadmap) (22 Aug 2026).
- No native A2A support in Claude Code: feature request opened 24 Oct 2026, still open, no Anthropic reply — [GitHub issue 104852](https://github.com/anthropics/claude-code/issues/104852).
- Anthropic and Google Cloud co-present an on-demand webinar, "Deploying multi-agent systems using MCP and A2A with Claude on Vertex AI", describing the standards as enabling "tool integration, context sharing, task delegation, and more between agents" — [claude.com webinar page](https://claude.com/resources/webinars/deploying-multi-agent-systems-using-mcp-and-a2a-with-claude-on-vertex-ai) (undated).
- Community bridges exist: an MCP server that lets Claude register and message A2A agents — [GongRzhe/A2A-MCP-Server](https://github.com/gongrzhe/a2a-mcp-server) (search summary) — and A2A servers wrapping Claude Code — [jcwatson11/claude-a2a](https://github.com/jcwatson11/claude-a2a) (search summary).

**What Anthropic has shipped for agents working with agents**
- Subagents (all providers) and experimental agent teams with "shared tasks, inter-agent messaging, and centralized management" — [feature availability](https://code.claude.com/docs/en/feature-availability); [docs index](https://code.claude.com/docs/llms.txt) (live docs).
- Cross-session messaging between a user's own Claude Code sessions, local, remote and cloud — [Cross-session messaging](https://code.claude.com/docs/en/cross-session-messaging) (live docs).
- Projects in Claude Code (public beta, Pro, Max, Ultra): Claude coordinates parallel cloud sessions — [Run agents in parallel](https://code.claude.com/docs/en/agents) (search summary).
- Managed Agents multi-agent orchestration (beta since 6 May 2026) and dynamic workflows (beta since 9 Oct 2026) — [Platform release notes](https://platform.claude.com/docs/en/release-notes/overview) (search summary).
- Claude Tag: a team-shared Claude in Slack with its own service accounts, memory per channel and scheduled routines — [How Claude Tag works](https://claude.com/docs/claude-tag/concepts/how-it-works) (live docs).
- MCP Tasks support in Claude Code (public beta), which lets an MCP server run a long job and report back — [MCP docs](https://code.claude.com/docs/en/mcp) (live docs).

### Inferences
- Anthropic's position, read from its actions rather than a statement: build agent-to-agent capabilities into MCP (Tasks, events, triggers, agent identity) and into its own products, while coexisting with A2A under the same foundation. Nothing indicates that Claude apps will speak A2A soon.
- For the reader this means cross-vendor coordination with Claude should be designed around MCP and plain HTTP (a shared hub), not around A2A. An A2A link to Claude today requires a third-party bridge and a developer.
- Claims in secondary blogs that MCP and A2A are "converging toward a joint interoperability spec" are not supported by the AAIF or MCP primary sources opened here.

### Gaps
- No direct quote from Anthropic leadership about A2A was found; the absence is itself the finding.
- One third-party article claimed Anthropic released "experimental" MCP support for agent-to-agent patterns in April 2026; I could not confirm it against a primary source and did not use it.
- Whether Managed Agents or the Agent SDK plan A2A compatibility is not stated anywhere I found.
