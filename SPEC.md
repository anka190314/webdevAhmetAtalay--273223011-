# TU Sofia Lab Booking

<!-- Exercise 2. Write the non-goals first. Every acceptance criterion must be checkable in under a minute.
     Keep these headings exactly as they are: the self-checks look for them by name.
     The full target is on the course site under Resources → The course project. -->

## Project option
<!-- One line: lab booking, study groups, club events, or the own project the lecturer approved. -->
Lab booking.

## Goals
- A student signs in, chooses a day, sees which workstations are free that day and books a free time slot.
- A student cancels their own booking, and the time slot becomes free again.
- Lab staff add labs and workstations and see all bookings.
- When a student clicks the "Add to Google Calendar" button next to their bookings, Google Calendar opens with the lab, workstation and time already filled in, and the student saves the event with a single click.
- Lab staff see, in a simple table, how many bookings were made in each lab in a selected week and which workstations are used most.
- All screens of the app display properly and are fully functional on a phone screen.

## Non-goals
- No recurring bookings: a student books each time slot separately.
- No waitlist: if a workstation is already booked, the student chooses another one or another time.
- No remote access to workstations: the app does not connect to, turn on or turn off any computer.
- No booking of other equipment such as printers or projectors: only workstations can be booked.
- No payments: every booking is free.
- No reminders by e-mail, SMS or push: students can use their own calendar's reminder.
- No automatic Google Calendar sync: the app never writes to or deletes from a calendar by itself.
- No charts and no PDF or Excel reports: the usage overview is one simple table.
- No mobile app for iOS or Android: the web UI also works on a phone screen.

## Constraints
- Node.js with Express for the REST API; PostgreSQL on Neon (Frankfurt) through DATABASE_URL; tests use a throwaway local Postgres, one schema per test file; all SQL stays in `src/db/`. Plain HTML, CSS and JavaScript in the UI.- Bookings use fixed 2-hour time slots, Monday to Friday, from 08:00 to 20:00.
- Passwords are stored only as a bcrypt hash, never as readable text.
- Keys and client secrets live only in Codespaces secrets, never in a file in the repository.
- Every rule about who may do what is checked on the server, not only hidden in the UI.
- Seed data goes only into an empty database and never runs when NODE_ENV is production.

## The model feature


- Model: Gemini 3.5 Flash-Lite through the Gemini API, called only from `services/search.js`.
- Input: the sentence the student types, today's date and the list of lab names; nothing about the student or any other user.
- Output: a lab, a date and a start time as JSON, which fill the filters on the booking screen; the student still presses "Book" to book.
- When it fails: with no key, no answer within 5 seconds, a 429 or an answer that is not valid JSON, the filters stay empty and the screen shows "Could not understand the request, please choose the day and time yourself." A date in the past, a weekend or a time outside 08:00–20:00 is left empty, never guessed, and nothing is booked unless the student presses "Book".
İki yeni kriter

## Auth
- Local: e-mail and password; the password is stored only as a bcrypt hash.
- Provider: Sign in with Google, the authorization-code flow, handled on the server.
- Linking: a Google login is stored by its Google account id (`sub`). The first time someone signs in with Google, if Google marks the e-mail as verified and it matches an existing password account, the Google id is added to that account and no new user is created. An e-mail that Google has not marked as verified is never linked to an existing account.
- Roles: every new account is a student; staff accounts come from the seed data, and no one can make themselves staff.

## MCP tools
| Tool | What it does | Who may call it |
| --- | --- | --- |
| `free_workstations` | Lists the workstations in one lab that are free in each 2-hour slot on a given weekday | any signed-in user |
| `my_bookings` | Lists the upcoming bookings of the signed-in student, with lab, workstation and time | the token's owner |
| `book_slot` | Books a free 2-hour slot on a workstation for the signed-in student, and refuses a slot that is already booked | the token's owner |
| `lab_usage` | Returns the number of bookings in each lab for a given week, the same numbers as the usage table | lab staff only |


The MCP server acts for one user, given by a personal token in the `MCP_TOKEN` environment variable. A token is a long random string created with `npm run mcp-token -- <email>`, which prints it once; the database keeps only its SHA-256 hash, in the `mcp_tokens` table. A missing or unknown token means no tool runs. Tokens never go into the repository.

## UI
Plain HTML, CSS and JavaScript served by Express; the pages call the REST API with `fetch`. Every screen also works on a 375-pixel-wide phone screen. Five screens:
- Sign in (`/login`): e-mail and password form, and a "Sign in with Google" button.
- Labs (`/labs`): every lab with its name and number of workstations.
- Booking (`/labs/:id`): a day picker, the natural-language search box, and each workstation with its six slots marked "Free" or "Booked".
- My bookings (`/bookings`): the student's upcoming bookings, each with "Cancel" and "Add to Google Calendar".
- Staff (`/staff`): add labs and workstations, and the weekly usage table.
Every screen shows a loading state, an empty state, an error state and the normal view. The checklist is in `docs/UI.md`.


## Architecture
<!-- Exercise 3. One request traced through every layer, naming the file for each one,
     plus one place where your own code does not match this layering. -->
One request followed end to end: a student presses "Book" on a free slot.

**Browser**
- View: `loadSlots()` in `public/lab.html` draws each workstation with its six slots.
- REST call: `bookSlot()` in `public/lab.html` sends `POST /api/bookings` with `{ workstationId, date, slot }`.
- State: the slot list is not kept in any variable. After a booking or a cancel, `bookSlot()` and `cancelBooking()` call `loadSlots()`, which fetches `GET /api/labs/:id/slots` again. The chosen date lives only in the date input.

**Server**
- Route: `router.post('/api/bookings')` in `src/routes/labs.js`. `requireAuthApi` answers 401 without a session; the handler reads the body, calls the service and turns its errors into status codes: `InvalidBooking` 422, `BookingConflict` 409, `WorkstationNotFound` 404. It holds no rule.
- Service: `createBooking()` in `src/services/bookingService.js` holds the rules: a real weekday, a slot from 0 to 5, an existing workstation, and no double booking (a UNIQUE violation becomes `BookingConflict`).
- Data access: `getWorkstationById()` and `insertBooking()` in `src/db/bookings.js`, the only file with booking SQL, with parameters instead of string building.
- Database: the `bookings` table in Postgres on Neon, created by `migrations/002_bookings.sql` with `UNIQUE(workstation_id, date, slot)`.
- Back to the client: 201 with `{ id, userId, workstationId, date, slot }`, or `{ "error": "..." }` with the status code.

**One place that did not match the layering**
`GET /labs/:id` in `src/routes/labs.js` imported `getLabById` from `src/db/bookings.js` and checked the lab itself, skipping the service. Fixed in commit 634ff3c: the route now calls `getLab()` in `src/services/bookingService.js`, which throws `LabNotFound`.

### How each screen is rendered

Every page is a static HTML file in `public/`, sent by Express with `sendFile` only after the server has decided whether this visitor may see it. The data is fetched as JSON from `/api/...` by the page's own script and written into the page with `textContent` (client-side rendering). There is no server-side template.

| Screen | Path | Who may open it (decided on the server, before any HTML is sent) | Rendered | Data it loads |
|---|---|---|---|---|
| Sign in | `/login` | anyone | static HTML, no data | none; the form posts to `/api/login`, the Google button goes to `/api/auth/google` |
| Labs list | `/labs` | signed in, otherwise 302 to `/login` | in the browser | `GET /api/labs` |
| Booking screen | `/labs/:id` | signed in, otherwise 302 to `/login`; an unknown lab gives 404 | in the browser, redrawn after every date change and booking | `GET /api/labs/:id/slots?date=`, `POST /api/bookings`, `DELETE /api/bookings/:id`, `POST /api/search` |
| Staff page | `/staff` | staff only: 302 without a session, 403 for a student | in the browser | `GET /api/labs`, `GET /api/usage?week=`, `POST /api/labs/:id/workstations` |
| My bookings | `/bookings` | - | not built; see the known gaps in READINESS.md | - |

Why this way: the pages are small and the same for everyone, so they need no server templates; what changes (the slots, the usage numbers) changes after every click, so the browser asks the API again instead of loading a new page. The price is a waterfall: the data arrives one round trip after the page (measured on the live booking screen: about 80 ms for the page, then about 75 ms for the slots).

## Acceptance criteria
<!-- Every criterion carries an id. A test proves it by naming that id in its title, for example
     test('AC-3 a booking that overlaps another is refused with 409', ...).
     Say who acts, what they see, and what must be true in the database. -->
- [AC-6] After lab staff add a new workstation to a lab, a student who opens that lab's booking screen sees the new workstation with six "Free" slots.
- [AC-7] A student who opens the staff page `/staff` gets 403 and does not see the page content.
- [AC-9] A student who presses "Add to Google Calendar" next to a booking sees Google Calendar open with the lab name, the workstation and the correct start and end time already filled in.
- [AC-10] Lab staff who choose a week on the usage screen see one row per lab with the number of bookings in that week, and each number matches the count of rows in `bookings` for that lab and week.
- [AC-11] A student who has a password account and signs in with Google using the same e-mail address lands in the same account, and no second row appears in `users`.
- [AC-12] On a 375-pixel-wide phone screen, a student can open the booking screen and book a slot without scrolling sideways.
- [AC-16] With no model key set, a student who types a request in the search box sees "Could not understand the request, please choose the day and time yourself", the filters stay empty, and the day and time pickers still work.
- [AC-17] A student who types "tomorrow at 10 in lab 2140" sees lab 2140, tomorrow's date and the 10:00 slot selected in the filters, and no new row appears in `bookings` until they press "Book".
- [AC-18] The MCP tool `book_slot` refuses a slot that is already booked with the same message the API returns, "This slot is already booked".

### Slice 1: sign-in and the labs list

- [AC-13] A visitor who opens `/labs` without signing in lands on `/login` instead.
- [AC-14] After signing in with a seeded account, `/labs` shows every seeded lab with its name and its number of workstations.
- [AC-15] After one lab row is deleted in the database, reloading `/labs` no longer shows that lab.
- [AC-19] A request to `/api/labs` without a session gets 401, and the response contains no lab data.


### Slice 2: booking a workstation
- [AC-1] A signed-in student who chooses a weekday on the booking screen sees six 2-hour slots from 08:00 to 20:00 for each workstation, each marked "Free" or "Booked".
- [AC-2] A student who presses "Book" on a free slot sees that slot change to their own booking with a "Cancel" button, the API answers 201, and a new row with their user id appears in the `bookings` table.
- [AC-3] A student who tries to book a slot that another student has already booked sees "This slot is already booked", the API answers 409, and no new row appears in `bookings`.
- [AC-4] A student who cancels their own booking gets 204, sees the slot marked "Free" again, and the row is gone from `bookings`.
- [AC-5] A student who sends a cancel request to the API for another student's booking gets 403, and the row stays in `bookings`.
- [AC-8] A booking request for a Saturday, or for a slot that starts at or after 20:00, gets 422 from the API, and no new row appears in `bookings`.
- [AC-20] A booking request without a session gets 401, and no new row appears in `bookings`.


### Slice 3: natural-language search
This slice also implements AC-16 and AC-17 from the project criteria above.
- [AC-21] When the model answers with a lab that does not exist, a weekend date or a slot outside 08:00-20:00, those filters stay empty, the student sees "Could not understand the request, please choose the day and time yourself", and nothing is booked.
- [AC-22] When the model gives no answer within 5 seconds, the student sees the same message after about 5 seconds, and the day and time pickers still work.


### Slice 4: MCP tools
This slice also implements AC-18 from the project criteria above. `lab_usage` comes later, with the staff page.
- [AC-23] `free_workstations` for a lab and a weekday lists, for each 2-hour slot, the same workstations that the booking screen shows as "Free".
- [AC-24] `my_bookings` returns the upcoming bookings of the token's owner with lab, workstation and time, and none of another student's.
- [AC-25] `book_slot` with a valid token books a free slot, and a new row with the token owner's user id appears in `bookings`.
- [AC-26] A tool call with a missing or unknown token returns an error result, and no row changes in `bookings`.


### Slice 5: staff page
This slice also implements AC-6, AC-7 and AC-10 from the project criteria above, and the `lab_usage` MCP tool.
- [AC-27] A student who sends a request to a staff API endpoint, to add a workstation or to read the usage numbers, gets 403, and no row changes in `workstations`.
- [AC-28] `lab_usage` with a staff member's token returns the same numbers as the usage table for that week, and with a student's token it returns an error result.

### Slice 6: calendar link, Google account linking, phone width
This slice implements AC-9, AC-11 and AC-12 from the project criteria above. The Google sign-in flow itself (redirect and callback) comes in Exercise 4; this slice builds and tests the linking rule that flow will call.

## Traceability
<!-- Filled in from Exercise 3 onward: each AC id, and the test that names it. -->
| Criterion | Test |
| --- | --- |
| AC-1 | `src/server.test.mjs` |
| AC-2 | `src/server.test.mjs` |
| AC-3 | `src/server.test.mjs`, `src/services/bookingService.test.mjs` |
| AC-4 | `src/server.test.mjs` |
| AC-5 | `src/server.test.mjs` |
| AC-6 | `src/server.test.mjs` |
| AC-7 | `src/server.test.mjs` |
| AC-8 | `src/server.test.mjs`, `src/services/bookingService.test.mjs` |
| AC-9 | `src/services/calendarService.test.mjs`, `src/server.test.mjs` |
| AC-10 | `src/server.test.mjs`, `src/services/labService.test.mjs` |
| AC-11 | `src/services/authService.test.mjs` |
| AC-12 | `src/pages.test.mjs` and a check at 375 px in the browser |
| AC-13 | `src/server.test.mjs` |
| AC-14 | `src/server.test.mjs` |
| AC-15 | `src/server.test.mjs` |
| AC-16 | `src/services/search.test.mjs`, `src/server.test.mjs` |
| AC-17 | `src/services/search.test.mjs` |
| AC-18 | `mcp-server/tools.test.mjs` |
| AC-19 | `src/server.test.mjs` |
| AC-20 | `src/server.test.mjs` |
| AC-21 | `src/services/search.test.mjs` |
| AC-22 | `src/services/search.test.mjs` |
| AC-23 | `mcp-server/tools.test.mjs` |
| AC-24 | `mcp-server/tools.test.mjs`, `src/services/bookingService.test.mjs` |
| AC-25 | `mcp-server/tools.test.mjs` |
| AC-26 | `mcp-server/tools.test.mjs` |
| AC-27 | `src/server.test.mjs`, `src/services/labService.test.mjs` |
| AC-28 | `mcp-server/tools.test.mjs` |


## Spec vs result
- Passed: AC-13 (`/labs` without a session redirects to `/login`; checked with curl, a private window and the AC-13 test), AC-14 (both seeded labs with their workstation counts) and AC-15 (a deleted lab disappears after a reload and does not come back after a restart).
- Missed or reinterpreted: the agent seeded `@sofia.bg` accounts instead of `example.com`; it seeded on every start with fixed ids, so a deleted lab would have come back; it hard-coded a fallback session secret and left out `sameSite`; it put SQL in the services and all routes and HTML in `server.js`, against the layers in AGENTS.md; it built the list with `innerHTML`; and it added `"type": "module"` to package.json without asking, which would have broken the Exercise 1 MCP server. I asked for each fix and checked it again.
- Changed: the spec did not say what an API request without a session gets, so I added AC-19; and "seed only an empty database, never in production" is now a constraint, because it was only in my prompt and the agent ignored it the first time.
- Exercise 3, passed: every one of the 28 criteria traces to a test (48 tests), and the self-check passes 18/18. The status codes were also checked with curl, and the booking, search, staff and phone-width screens in the browser.
- Exercise 3, missed or reinterpreted: AC-2 said the slot changes to "Booked", but a student's own booking shows "Cancel", so AC-2 was reworded; only the Google linking rule is built, the sign-in flow itself comes in Exercise 4; the server must run with TZ=Europe/Sofia, or "today" is a UTC date (to set in Exercise 4); workstation names are not trimmed.
- Exercise 3, changed: AC-21 to AC-28 were added for the model's failure cases, the MCP tools and the staff API, and the MCP token was written into the spec before the agent could invent one.
