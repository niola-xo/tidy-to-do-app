# Tidy: Voice-Powered To-Do App (PRD v2)

## 0. Status snapshot (update this after every phase)

| Phase | Status |
|---|---|
| 1 Foundation (auth, database, RLS) | Done and deployed |
| 2 Core app (spaces, lists, tasks, delete, theme) | Done and deployed |
| 3 Voice and AI | Built on branch `voice-feature`, merged to `main`. Overlap deduplication applied. Awaiting `GEMINI_API_KEY` on Vercel |
| 3.5 Calendar export (Level 1) | Planned |
| 4 Polish | Planned |
| 5 Deploy | Initial deploy done. Redeploy after every merge to `main` |
| 6 Calendar sync (Level 3) | Future, only after Phases 3.5 and 4 |

Production URL: https://tidy-to-do-app.vercel.app

Before building anything, verify this table against the actual code and tell me about any difference.

## 1. What we are building

A clean, modern to-do web app for one person. The headline feature is the **voice brain dump**: the user speaks a long, messy ramble, an AI turns it into clean tasks, sorts them into the right **space** (Work, Personal, School and so on) and groups related tasks into **lists**. The user reviews the result before anything is saved. Work and personal tasks must never be mixed.

Design principle: simple to use, beautiful to look at, but not bare-bones. No feature bloat.

## 2. Goals and non-goals

**Goals**
- A polished UI that feels like a real product, on mobile and desktop.
- Voice brain dump with AI sorting and a review step.
- Hard separation between spaces.
- Data persists in a real database, per user.
- Tasks with dates can be put on the user's calendar (Phase 3.5).

**Non-goals (do not build unless a phase below says so)**
- Team collaboration or sharing
- Push notifications or reminders
- Native mobile apps
- Kanban, Gantt or deep sub-tasks
- Gamification or streaks
- Two-way Google Calendar sync (only in Phase 6, later)
- Google login for the app itself (email and password only for now)

## 3. Stack (fixed, do not change)

- Next.js (App Router) and TypeScript
- Tailwind CSS and shadcn/ui, Lucide icons
- Supabase: Postgres and Auth (email and password), with Row Level Security on every table
- Google Gemini API, called only from server routes, key in `GEMINI_API_KEY`
- Vercel for hosting
- Zod to validate all AI output

## 4. Rules for the agent (read first)

1. Work one phase at a time, in the order of section 9. Finish a phase completely, then STOP and wait for me to say "continue". Do not jump ahead to a later phase.
2. Before saying a phase is finished, verify it yourself: run `npm run build` and `npm run lint`, start the dev server, and go through that phase's test steps in the browser.
3. Report every acceptance criterion as PASS or FAIL with evidence (what you ran, what you saw). A criterion you did not test counts as FAIL. Do not use the words "done", "complete" or "working" without evidence.
4. Never skip, shrink or quietly change a requirement. If something is unclear or impossible, say so and ask.
5. Work on a git branch for each phase, not on `main`, unless I say otherwise.
6. Never invent keys or secrets. When you need a value, list the exact variable name and stop.
7. Never commit secrets. Keep `.env.example` up to date (names only).
8. No extra features and no new libraries without asking me first.
9. Do not change Vercel, Supabase or Google dashboard settings yourself. Give me the exact steps and I will do them.
10. Keep `PROGRESS.md` at the project root: one line per phase with its status and what was verified.

## 5. Core concepts

- **Space:** top-level category. Defaults are Work and Personal. Users can add, rename and delete spaces.
- **List:** an optional, named group of tasks inside exactly one space (for example "Client Launch Prep").
- **Task:** one checklist item. It always belongs to one space. It may or may not belong to a list.

Hierarchy: Space, then optional List, then Task. A task never belongs to more than one space.

## 6. Features and acceptance criteria

### F1 Authentication
- AC1.1 Sign up and log in with email and password.
- AC1.2 On first login, Work and Personal spaces are created only when the user has zero spaces. Logging in again never creates duplicates.
- AC1.3 Logout works. Signed-out users are redirected to the login page.
- AC1.4 Redirects use `NEXT_PUBLIC_SITE_URL`, never a hard-coded localhost.
- AC1.5 The login card is readable in both light and dark mode, on desktop and on a phone.

### F2 Spaces
- AC2.1 The sidebar (desktop) or drawer (mobile) lists the user's spaces. Selecting one shows only its tasks and lists.
- AC2.2 Create a space by typing a name. A unique rule on (user_id, name) prevents duplicates.
- AC2.3 Delete a space with a confirmation dialog that states how many lists and tasks will be removed.

### F3 Tasks and lists
- AC3.1 Opening a space lets me type in "What needs to be done?" and add a task immediately. No list is required.
- AC3.2 Tasks without a list sit in a default group at the top of the space view.
- AC3.3 Lists are optional sections in the main area, created with a small "+ New list" button. Click a list title to rename it. Each list shows a progress count.
- AC3.4 Check and uncheck tasks with a smooth animation. Completed tasks stay visible with a strikethrough.
- AC3.5 Edit a task by clicking it. Delete a task with a trash icon (always visible on mobile) and show an "Undo" toast. Deleting a list asks for confirmation and states how many tasks go with it.
- AC3.6 Optional per-task fields, hidden until needed: due date, due time (from Phase 3.5), priority, note.
- AC3.7 Dark and light mode are both properly designed, and switching is smooth with no flash and no hydration errors.

### F4 Voice brain dump (Phase 3)
- AC4.1 A mic button is always reachable. It opens a listening view with a live transcript (Web Speech API).
- AC4.2 The transcript is correct: speaking one sentence once produces that sentence once, on desktop Chrome AND Android Chrome. Finalized text and interim text are kept separately. Never append cumulative results to the existing transcript.
- AC4.3 If speech recognition ends on its own, restart it only while the user is still in listening mode, without duplicating text.
- AC4.4 If speech is unsupported or microphone permission is denied, show a clear message and a typed or pasted text box that goes through the same Organize flow.
- AC4.5 The transcript is editable by hand before Organize. Maximum 5,000 characters, with a friendly message when exceeded.
- AC4.6 Organize calls `POST /api/organize`. The server sends the transcript to Gemini together with the user's existing space names, today's date and the user's timezone. The key never reaches the browser.
- AC4.7 Gemini must return strict JSON in the shape in section 8, validated with Zod. On invalid output, retry once, then show a friendly error and keep the transcript.
- AC4.8 The AI must: extract every actionable task, assign each to an existing space (never mix work and personal), group related tasks into lists with short titles, rewrite tasks in short action style, resolve relative dates, flag low-confidence placements, and drop filler and chatter. It must never invent tasks, dates or times.
- AC4.9 A review screen shows the proposal grouped by space and list. The user can edit text, delete a task, move a task or list to another space, rename a list and add a missed task. Low-confidence items are visually flagged.
- AC4.10 Nothing is saved until the user taps "Add to my lists". Discard saves nothing.
- AC4.11 Test with this ramble: "send the weekly report to my manager by Friday, reply to the marketing email today, prepare slides for Monday's meeting, finish chapter two of my project by next Wednesday, buy groceries tonight, call my mum this weekend, book a dentist appointment next week, go to the gym three times this week, pay the electricity bill before the weekend". Work and personal items land in the right spaces, dates are correct in the Lagos timezone, and no filler becomes a task.

### F5 Calendar export, Level 1 (Phase 3.5)
- AC5.1 Add a nullable `due_time` to tasks. A task with a date but no time is all-day. The AI fills `due_time` only when the user clearly says a time ("at 3pm", "by noon").
- AC5.2 Every task with a due date shows a small calendar icon. Clicking it opens a Google Calendar create-event link (`https://calendar.google.com/calendar/render?action=TEMPLATE`) prefilled with the task text as the title, the date and time, and the space and list name in the description. No time means all-day.
- AC5.3 An "Export to calendar (.ics)" button downloads one `.ics` file with every incomplete dated task, for the current space or for all spaces, with correct Africa/Lagos timezone handling.
- AC5.4 The brain dump review screen shows a date and time chip on dated tasks so the user can correct them before saving.
- AC5.5 No Google login and no Google Calendar API in this phase.
- AC5.6 Test: brain dump a ramble with three dated tasks, one with a time. Both the calendar icon and the `.ics` import must put the events on the correct days and times in Google Calendar.

### F6 Polish (Phase 4)
- AC6.1 Friendly empty states with a clear call to action (for example "Nothing here yet. Tap the mic and just talk.").
- AC6.2 Loading skeletons instead of spinners where possible.
- AC6.3 Search across tasks, with results labelled by space.
- AC6.4 A simple Today view: tasks due today, grouped by space with colour tags. Never one blended flat list.
- AC6.5 Settings page: profile, logout, theme (light, dark, system), manage spaces, delete account and data.
- AC6.6 Accessibility pass: keyboard navigation, visible focus states, proper contrast, ARIA labels on icon buttons, respect for reduced motion.
- AC6.7 Subtle, purposeful animations for adding, checking and deleting tasks.

## 7. Data model (Supabase / Postgres)

All tables have `id uuid pk`, `created_at timestamptz default now()` and `user_id uuid` referencing the auth user. Row Level Security is enabled on every table with the policy `auth.uid() = user_id`.

Verify the names below against the real schema in `supabase/migrations/` and tell me about any difference before changing anything.

- **spaces:** `name`, `color`, `icon`, `position`. Unique on (user_id, name).
- **lists:** `space_id`, `title`, `position`. No unique rule on title, because the AI may legitimately create two lists with the same name in one space.
- **tasks:** `space_id`, `list_id` (nullable), `text`, `is_done`, `done_at`, `due_date` (nullable), `due_time` (nullable, added in Phase 3.5), `priority` (nullable: low, medium, high), `note` (nullable), `position`.
- Phase 6 only: `calendar_connections` and a `calendar_event_id` column on tasks (see section 10).

SQL goes in numbered files in `supabase/migrations/`. Tell me which file to run in the Supabase SQL editor. Never write a destructive migration (a delete or a drop) without first showing me what it affects and how child rows are handled.

## 8. AI output contract

`POST /api/organize` returns strict JSON validated with Zod:

```json
{
  "spaces": [
    {
      "space_name": "Work",
      "lists": [
        {
          "title": "Client Launch Prep",
          "tasks": [
            {
              "text": "Send final proposal to Acme",
              "due_date": "2026-10-02",
              "due_time": "15:00",
              "priority": "high",
              "low_confidence": false
            }
          ]
        }
      ]
    }
  ]
}
```

- `due_date`, `due_time` and `priority` are optional and only filled when clearly stated.
- The route also receives the existing space names, today's date and the timezone.
- If the transcript has no actionable tasks, return an empty result and show a gentle message.
- Rate limit the route and cap transcript length at 5,000 characters.
- Saving the confirmed result is a separate action that writes spaces, lists and tasks in one transaction. `/api/organize` never writes to the database.

## 9. Build order (stop and test after every phase)

**Phase 1 and 2:** complete. Do not touch unless fixing a bug I report.

**Phase 3: Voice and AI** (branch `voice-feature`)
Fix the transcript repetition (AC4.2, AC4.3), finish AC4.1 to AC4.11, then test on desktop Chrome and Android Chrome. I will add `GEMINI_API_KEY` in Vercel for Production and Preview and redeploy. Stop and test: every AC in F4.

**Phase 3.5: Calendar export** (branch `calendar-export`)
Everything in F5. Stop and test: AC5.1 to AC5.6.

**Phase 4: Polish** (branch `polish`)
Everything in F6. Build in this order: login card colours, empty and loading states, theme setting, search and Today view, animations and accessibility. Stop and test: AC6.1 to AC6.7.

**Phase 5: Deploy**
The first deploy is already live. After each merge to `main`: `npm run build` passes, remind me to check the Vercel environment variables and to redeploy, and remind me to open the production URL in an incognito window to confirm it loads without a Vercel login. Check the Supabase Site URL and Redirect URLs match the production URL.

**Phase 6: Calendar sync, Level 3** (future)
Do not start until Phases 3.5 and 4 are finished and I say so. Full spec in section 10.

## 10. Future: Calendar sync, Level 3 (Phase 6)

**Goal:** tasks with a due date appear on the user's Google Calendar automatically, and stay in step when the task is edited, completed or deleted. This is the same mechanism apps use to add meeting links to a calendar.

**How it works**
1. The user clicks "Connect Google Calendar" in Settings. This is a separate step from signing in to Tidy. Tidy stays email and password.
2. Google's consent screen asks for calendar access. Use the narrowest scope that works, most likely `https://www.googleapis.com/auth/calendar.events`. Check Google's current documentation for scope options before choosing.
3. The server receives an authorization code and exchanges it for an access token and a **refresh token**. Request offline access and force the consent prompt, otherwise Google may not return a refresh token.
4. Store the refresh token in `calendar_connections` (`user_id`, `refresh_token`, `connected_at`, `status`), server only, never exposed to the browser. Encrypt it if possible. Row Level Security alone is not enough for a secret like this.
5. When a task with a due date is created, updated, completed or deleted, a server route creates, updates or deletes the matching Google Calendar event. Store the event ID in `tasks.calendar_event_id`.
6. Events use the due date and time in Africa/Lagos. Tasks with no time become all-day events. The event title is the task text, and the description includes the space and list name.
7. A "Disconnect" button revokes access and deletes the stored token.

**Acceptance criteria**
- AC6.1 The user can connect and disconnect Google Calendar from Settings.
- AC6.2 Creating a task with a date creates exactly one event. Editing the date or time moves the same event, with no duplicates.
- AC6.3 Completing or deleting a task deletes or marks the event. Pick one behaviour and tell me which before building.
- AC6.4 If the token expires or access is revoked, the app shows a clear "Reconnect Google Calendar" message and never loses or blocks the task itself.
- AC6.5 A brain dump with five dated tasks produces five events on the correct days and times.
- AC6.6 Only the signed-in user's own tasks are ever synced.
- AC6.7 Tokens and the Google client secret never appear in client code or in the repository.

**Risks to resolve before building (check Google's current rules)**
- Calendar access is a **sensitive scope**. Until Google verifies the app, users see an "unverified app" warning and the number of users is capped.
- While the Google OAuth app is in **Testing** status, refresh tokens may expire after about 7 days, so a sync could silently stop working during a demo. Check the current rule and plan around it.
- Token refresh, revoked access and duplicate events are the usual causes of bugs. Each one needs a test.
- I will do the Google Cloud Console steps myself. Give me exact instructions: create the OAuth client, add the redirect URI, set the consent screen, add test users.

## 11. Environment variables

```
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=    # or the publishable key name used in .env
GEMINI_API_KEY=                   # server only, Phase 3
# Phase 6 only:
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=             # server only
```

After any Vercel environment variable change, remind me to redeploy.

## 12. Known pitfalls from this project

- The agent once said "done" on a broken app. Always test in the browser and show proof.
- A component defined inside another component made the text input lose focus on every keystroke. Define components at the top level.
- Default spaces were created more than once. Create them only when the user has zero spaces.
- Auth redirects pointed to localhost. Always use `NEXT_PUBLIC_SITE_URL` and test login on the deployed URL.
- Supabase free email sending has a very low hourly limit, and "Confirm email" caused signup problems. Do not build features that depend on sending emails from Supabase.
- Vercel Deployment Protection blocks public access to preview and deployment-specific links. The production domain must be tested in an incognito window.
- The Web Speech API sends cumulative results. Rebuild only from `event.resultIndex` and keep interim text separate.
- Supabase free projects pause after a week of inactivity. If the app stops loading, check for a paused project and restore it.

## 13. Definition of done

- Every acceptance criterion for the current phase is PASS on the deployed production URL, with evidence.
- No secrets are in the repository.
- `PROGRESS.md` and the status table in section 0 are up to date.
- Work and personal tasks are never mixed in any list or view.
