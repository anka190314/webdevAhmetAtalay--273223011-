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
- Node.js with Express for the REST API; SQLite in development (one file, `data/app.db`), PostgreSQL from Exercise 4; all SQL stays in `src/db/`. Plain HTML, CSS and JavaScript in the UI.- Bookings use fixed 2-hour time slots, Monday to Friday, from 08:00 to 20:00.
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

## Acceptance criteria
<!-- Every criterion carries an id. A test proves it by naming that id in its title, for example
     test('AC-3 a booking that overlaps another is refused with 409', ...).
     Say who acts, what they see, and what must be true in the database. -->
- [AC-1] A signed-in student who chooses a weekday on the booking screen sees six 2-hour slots from 08:00 to 20:00 for each workstation, each marked "Free" or "Booked".
- [AC-2] A student who presses "Book" on a free slot sees the slot change to "Booked", and a new row with their user id appears in the `bookings` table.
- [AC-3] A student who tries to book a slot that another student has already booked sees "This slot is already booked", and no new row appears in `bookings`.
- [AC-4] A student who cancels their own booking sees the slot marked "Free" again, and the row is gone from `bookings`.
- [AC-5] A student who sends a cancel request to the API for another student's booking gets 403, and the row stays in `bookings`.
- [AC-6] After lab staff add a new workstation to a lab, a student who opens that lab's booking screen sees the new workstation with six "Free" slots.
- [AC-7] A student who opens the staff page `/staff` gets 403 and does not see the page content.
- [AC-8] A booking request for a Saturday, or for a slot that starts at or after 20:00, gets 400 from the API, and no new row appears in `bookings`.
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
- [AC-2] A student who presses "Book" on a free slot sees the slot change to "Booked", the API answers 201, and a new row with their user id appears in the `bookings` table.
- [AC-3] A student who tries to book a slot that another student has already booked sees "This slot is already booked", the API answers 409, and no new row appears in `bookings`.
- [AC-4] A student who cancels their own booking gets 204, sees the slot marked "Free" again, and the row is gone from `bookings`.
- [AC-5] A student who sends a cancel request to the API for another student's booking gets 403, and the row stays in `bookings`.
- [AC-8] A booking request for a Saturday, or for a slot that starts at or after 20:00, gets 422 from the API, and no new row appears in `bookings`.
- [AC-20] A booking request without a session gets 401, and no new row appears in `bookings`.

## Traceability
| AC-1 | |
| AC-2 | |
| AC-3 | |
| AC-4 | |
| AC-5 | |
| AC-8 | |
| AC-20 | |
## Spec vs result
- Passed: AC-13 (`/labs` without a session redirects to `/login`; checked with curl, a private window and the AC-13 test), AC-14 (both seeded labs with their workstation counts) and AC-15 (a deleted lab disappears after a reload and does not come back after a restart).
- Missed or reinterpreted: the agent seeded `@sofia.bg` accounts instead of `example.com`; it seeded on every start with fixed ids, so a deleted lab would have come back; it hard-coded a fallback session secret and left out `sameSite`; it put SQL in the services and all routes and HTML in `server.js`, against the layers in AGENTS.md; it built the list with `innerHTML`; and it added `"type": "module"` to package.json without asking, which would have broken the Exercise 1 MCP server. I asked for each fix and checked it again.
- Changed: the spec did not say what an API request without a session gets, so I added AC-19; and "seed only an empty database, never in production" is now a constraint, because it was only in my prompt and the agent ignored it the first time.