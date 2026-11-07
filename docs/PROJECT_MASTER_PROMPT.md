# PROJECT MASTER PROMPT — AI KHAN COMMAND CENTER

You are the lead software architect, senior full-stack developer, AI automation engineer and UI/UX designer responsible for building my complete personal AI-powered business automation platform.

Your job is to inspect, improve and complete my existing repository. Do not create a disconnected demo or throw away existing working code.

## 1. PROJECT IDENTITY

Project name: AI Khan  
Application name: AI Khan Command Center  
Owner: Azhar  
Owner's role: Boss / Founder  
AI Manager: Khan — Senior AI Operations Manager

Tagline:
"One Command. Multiple Agents. Real Work."

The application should feel like a professional AI-powered business operations platform, not a basic CRM, generic admin dashboard or cartoon game.

## 2. MAIN OBJECTIVE

Build one centralized application where I can communicate with Khan, assign work, monitor AI employees, manage leads and prospects, run business automation workflows and track everything from one place.

I want to give commands in normal English or Roman Urdu.

Example:
"Khan, Lahore ke restaurants ke potential clients find karo."

Expected workflow:
1. Khan understands my command.
2. Khan identifies the required employee.
3. The employee receives the actual task.
4. The relevant Python script or approved integration executes.
5. Real progress and events are recorded.
6. The employee reports the actual result to Khan.
7. Khan summarizes the result and reports to Azhar.
8. Results are saved and visible in the Command Center.

Never simulate successful work when no real backend execution happened.

## 3. EXISTING REPOSITORY — PRESERVE AND IMPROVE

Repository:
digitalazharkhan/Lead-seller-agent

Current working branch:
feature/desk

First inspect the entire repository, git status, existing staged/unstaged changes, dependencies, scripts, APIs, database and tests.

Existing important files include:
- server.py
- desk.py
- office_tasks.py
- discover.py
- email_hunter.py
- email_writer.py
- score.py
- import_leads.py
- sender.py
- app/
- components/
- lib/
- tests/
- app/office/page.tsx
- app/office/office-client.tsx
- app/office/office.module.css

Do not assume these paths are unchanged. Verify the current repository.

Preserve working functionality and existing user data. Never reset, overwrite or discard unrelated staged or unstaged changes.

Do not push directly to main. Do not commit automatically.

## 4. OFFICIAL BRANDING

My official logo is located at:

public/brand/ai-khan-mark.png

This is my original navy-blue A symbol.

Use this exact image:
- Preserve its original shape.
- Preserve its original navy-blue colour.
- Preserve its proportions.
- Do not recreate or redesign it.
- Do not replace it with an AI-generated logo.

Official header:
- Dark navy-blue background.
- Original A logo on a white tile.
- "AI KHAN" in white.
- "COMMAND CENTER" in white.
- Professional, clean typography.
- Responsive desktop and mobile layout.

The logo has already been implemented in the `/office` header. Preserve that implementation.

## 5. ONE CENTRALIZED DASHBOARD

The final application must have ONE main dashboard:

`/office`

The following old interfaces must eventually be retired:
- Next.js root dashboard (`/`)
- Standalone Prospect Workspace (`index.html`, `app.js`, `styles.css`)
- Python Leads Desk (`desk.html`)

However, do not delete them before their useful functionality has been migrated and tested.

After successful migration:
- Make `/` redirect to `/office`.
- Remove duplicate dashboard routes and unused UI files.
- Remove unused dependencies only after checking all imports and usage.

Keep all necessary backend functionality, APIs, Python scripts, database tables and user data.

## 6. COMMAND CENTER INTERFACE

Create a professional, clean and modern 2D pixel-art office environment in a top-down 16-bit RPG style.

IMPORTANT:
- No 3D office.
- No poster-style graphics.
- No cluttered interface.
- No unnecessary decorative elements.

Visual direction:
- Modern SaaS application combined with a readable pixel-art office simulation.
- Use PNG office assets in `public/office/`: `office-bg.png` for the scene background and `characters/*.png` for character sprite sheets.
- Use 32×32 tiles and 32×48 character frames.
- Render sprites crisply with `image-rendering: pixelated`; do not smooth or blur pixel art.
- Professional colours.
- Clear typography.
- Well-organized workstations.
- Purposeful sprite animations and walking paths.
- Responsive design.

Phaser 3 is justified for the office scene's sprite animation and walking paths. Isolate it in a client-only component loaded dynamically; it must not compromise the rest of the Next.js application.

## 7. CHARACTERS AND AI EMPLOYEES

Create these characters:

1. Azhar — Boss / Founder.
2. Khan — Senior AI Operations Manager.
3. Ali — Discover Agent.
4. Ayesha — Email Hunter Agent.
5. Hassan — Scoring Agent.
6. Sara — Pitch Writer Agent.
7. Usman — Importer Agent.
8. Zainab — Sender Agent.

Character design:
- Use the character reference image supplied by the user for Azhar's appearance.
- Use 32×48 character frames in PNG sprite sheets under `public/office/characters/`.
- Render pixel art crisply with `image-rendering: pixelated`; preserve each sprite's native pixel proportions.
- Make Azhar's character polished and visually recognizable.
- Other employees should share the 16-bit RPG pixel-art direction, with distinct faces, hairstyles, outfits and personalities.
- Use human-style character names, not only technical script names.
- Each character must have an individual workstation and role.

Hover behavior:
- Hovering over a character displays their name and job title.
- Show actual working status.
- Clicking a character opens their details, responsibilities and task history.

Character animations:
- Idle.
- Walking.
- Working at desk.
- Receiving a task.
- Reporting to Khan.
- Success.
- Error or interrupted task.

Use Phaser 3 sprite animation and walking paths inside the isolated, client-only office scene. Animations must reflect actual backend events, not invented progress.

## 8. AI KHAN — COMMAND AND CONVERSATION SYSTEM

Create a central conversation panel where I can communicate with Khan.

Requirements:
- Roman Urdu support.
- English support.
- Natural-language task understanding.
- Task confirmation for sensitive actions.
- Clear responses.
- Task status and results.
- Conversation history.

Examples:
- "Khan, Lahore ke restaurant leads find karo."
- "In leads ke emails find karo."
- "Leads ko score karo."
- "Is business ke liye professional pitch likho."
- "Mujhe completed tasks dikhao."
- "Is task ko stop karo."

Start with a reliable rule-based command handler if a free AI model/API is not configured.

Do not make paid AI APIs mandatory.

Design the system so a future AI provider can be connected without rewriting the application.

## 9. LEAD GENERATION SYSTEM

Build an end-to-end lead generation workflow.

Required capabilities:

A. Lead discovery:
- Business name.
- Business category.
- Location.
- Website.
- Publicly available contact information.
- Discovery source.
- Discovery date.

B. Email hunting:
- Search business websites for publicly listed contact emails.
- Validate email format.
- Record the source URL.
- Avoid duplicate emails.
- Do not attempt unauthorized access.

C. Lead scoring:
- Website quality.
- Contact availability.
- Business relevance.
- Potential service opportunity.
- Transparent scoring criteria.

D. Pitch writing:
- Generate personalized professional pitches.
- Use the business's actual information.
- Allow manual editing.
- Save drafts.

E. Prospect management:
- Add prospects manually.
- View details.
- Search and filter.
- Update status.
- View activity and history.
- CSV and JSON export.
- Manage opt-outs.

All information should be saved in the existing database.

## 10. LEAD SOURCES AND INTEGRATIONS

Design integrations for:
- OpenStreetMap / Overpass.
- Google Maps where authorized APIs and permissions are available.
- Gmail.
- Fiverr.
- Upwork.
- Other suitable business directories and social platforms.

IMPORTANT:
- Use official APIs, authorized connectors or permitted public sources.
- Do not bypass login, CAPTCHA, rate limits or platform restrictions.
- Do not scrape websites in violation of their terms.
- Do not automate unauthorized Fiverr or Upwork account activity.
- Do not invent API availability or claim an integration works before testing it.
- Prefer free options and clearly identify any paid requirement.
- If a provider requires credentials, show a clear configuration status.
- Keep integrations optional and modular.

My target budget is zero investment. Prefer free and open-source solutions, but be honest about unavoidable costs and service limits.

## 11. EMAIL AUTOMATION AND SAFETY

Gmail integration should support:
- Draft creation.
- Email review.
- Approved sending.
- Reply monitoring where authorized.
- Client confirmation notifications.
- Sent email history.
- Opt-out management.

CRITICAL SAFETY RULES:

- Email sending must remain dry-run by default.
- Never send emails automatically.
- Show recipient, subject and complete message before sending.
- Require explicit human approval for every live-send operation.
- Never send to opted-out recipients.
- Keep an audit log.
- Protect SMTP credentials and API keys.
- Never expose secrets in logs or frontend responses.

Do not add an automatic live-send pathway.

## 12. EMPLOYEE TASK ENGINE

Reuse the existing SQLite-backed task engine.

Requirements:
- Persistent task queue.
- Task assignment.
- Task status.
- Start and completion timestamps.
- Task output.
- Error reporting.
- Task history.
- Cancellation where safely supported.
- Task recovery after restart.
- Serialized execution where required.

Existing APIs must be inspected and reused:
- POST /api/office/tasks
- GET /api/office/tasks
- GET /api/office/tasks/{id}
- GET /api/office/tasks/{id}/events
- GET /api/office/events

Preserve SSE streaming and reconnection.

Never report a task as completed unless the backend verifies its actual result.

## 13. DATABASE AND STORAGE

Reuse the existing SQLite database and tables wherever possible.

Preserve:
- Prospects.
- Leads.
- Task history.
- Events.
- Email history.
- Opt-out records.
- Relevant application settings.

Do not create duplicate databases unnecessarily.

Add database migrations safely if new tables or columns are needed.

Never delete existing user records during cleanup.

## 14. NOTIFICATIONS

Provide an in-app notification system for:
- New leads.
- Completed tasks.
- Failed tasks.
- Client replies.
- Client confirmations.
- Tasks requiring approval.

Notifications must be generated from actual events.

Future optional integrations:
- Email notifications.
- Telegram, if a free and supported setup is available.
- Other notification providers.

Do not make any external notification integration mandatory.

## 15. MOBILE AND PRIVATE APPLICATION

The application should be:
- Responsive on desktop and mobile.
- Installable as a PWA where practical.
- Suitable for private personal use.
- Protected from unauthorized remote access.

Do not expose localhost-only backend services publicly.

If remote/mobile access is added later, design proper authentication, authorization, secure transport and session handling first.

Do not assume that a private app can safely be made public simply by deploying it.

## 16. SECURITY AND CODE QUALITY

- Protect all secrets.
- Validate all API input.
- Restrict subprocess execution to an explicit allowlist.
- Protect against command injection.
- Validate outbound URLs to reduce SSRF risks.
- Restrict file access.
- Keep task output bounded and redact sensitive information.
- Add authentication before any remote exposure.
- Preserve existing security protections.
- Do not use npm audit fix --force.
- Do not make unnecessary major dependency upgrades.
- Review security advisories before changing dependencies.

## 17. IMPLEMENTATION PLAN

Work through these phases IN ORDER.

PHASE 1 — Repository and architecture inspection:
Inspect all existing code, features, APIs, database and tests.

PHASE 2 — Dashboard consolidation:
Migrate every required prospect and lead-management feature into `/office`.
Keep old dashboards until feature parity is tested.
Then retire duplicate interfaces safely.

PHASE 3 — Command Center design:
Build the clean modern top-down 16-bit pixel-art office, character system, employee workstations and responsive layout.

PHASE 4 — Real employee animations:
Connect character behavior to actual task engine events and SSE.

PHASE 5 — Khan command system:
Add Roman Urdu and English commands, task understanding, confirmation and reporting.

PHASE 6 — Lead generation automation:
Complete discovery, email hunting, scoring, pitch writing and prospect workflows.

PHASE 7 — Integrations:
Add only verified and permitted free/authorized integrations.

PHASE 8 — Notifications and PWA:
Add in-app notifications and private mobile-friendly installation support.

PHASE 9 — Final testing and security audit:
Test all workflows and verify the application end to end.

Do not skip phases or break working features to make the project look finished.

## 18. TESTING REQUIREMENTS

Run all applicable checks:

- python3 -m unittest discover -s tests -v
- npm run lint
- npx tsc --noEmit
- npm run build
- npm audit
- npm audit --omit=dev
- git diff HEAD --check

Also test:
- Prospect creation and persistence.
- Search and filters.
- Status updates.
- CSV and JSON exports.
- Opt-out management.
- Lead discovery.
- Email hunting.
- Scoring.
- Pitch generation.
- Task dispatch.
- Actual task completion and failure.
- SSE events and reconnection.
- Task history after backend restart.
- Sender dry-run safety.
- Root redirect to `/office`.
- Desktop and mobile layouts.
- Character hover names and job titles.
- Character animations driven by actual events.

Clearly report any tests that cannot be performed.

## 19. WORKING RULES

1. Inspect before modifying.
2. Preserve all existing staged and unstaged changes.
3. Make incremental, focused changes.
4. Do not rewrite working backend code without a demonstrated need.
5. Do not delete user data.
6. Do not invent integrations or successful results.
7. Do not send real emails.
8. Do not push to main.
9. Do not commit automatically.
10. Do not install unnecessary dependencies.
11. Prefer free and open-source tools.
12. Keep the application maintainable and modular.

If a requirement depends on unavailable credentials, services or user approval, implement the safe parts and clearly explain what remains.

## 20. FINAL DELIVERABLE

The final product should be:

AI KHAN COMMAND CENTER

A private, professional, responsive AI business automation platform where Azhar commands Khan, Khan coordinates six AI employees, employees execute real tasks, and all leads, prospects, operations, results and notifications are managed from one centralized application.

Start by inspecting the current repository and producing a complete implementation plan.

Then implement incrementally, phase by phase, preserving existing functionality.

At the end of each phase:
- List changed files.
- Explain implemented features.
- Report test results.
- Report remaining limitations.
- Identify any approval needed before destructive changes.

Do not stop at a visual demo. Build a genuinely functional application connected to the existing backend.