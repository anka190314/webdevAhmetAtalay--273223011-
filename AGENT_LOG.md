# Agent log

One entry per agent session, newest at the bottom. Be honest: what went wrong is the useful part.

<!-- Copy this block for each session:

## YYYY-MM-DD · <short title>
- Goal:
- Delegated:
- Checkpoints:
- Went wrong:
- Changed by hand:

-->
## 2026-10-12 · Claude tutor: server steps 1–4
- Goal: Set up the repository and build the reading loop, the initialize handshake and tools/list.
- Delegated: Claude (claude.ai chat) explained each step and gave the code line by line; I typed it myself. I wrote the first draft of the get_timetable description and Claude corrected it.
- Checkpoints: echo tests after every step, `node --check`, check.mjs (3/8, then 8/12).
- Went wrong: VS Code created a nested `mcp-server/mcp-server/` folder, so node ran the wrong file; I pasted a terminal command into server.js (SyntaxError); a placeholder description passed check.mjs because the check only counts characters.
- Changed by hand: deleted the nested folder and recreated server.js; replaced the placeholder description.

## 2026-10-15 · Claude tutor: server steps 5–10
- Goal: Make tools/call work, answer the three error cases, record the session transcript and set up the start command.
- Delegated: Claude gave the corrected server.js (including the get_timetable logic) and the error-handling block; I typed them in and went through each line.
- Checkpoints: `node --check`, echo tests without `2>/dev/null` to see errors, check.mjs (9/12, then 12/12).
- Went wrong: toolResult ended up inside the line handler and the tools/call branch was missing, so tools/call got no reply; leftover braces caused a SyntaxError; my first transcript skipped tools/list and had no code fences.
- Changed by hand: timetable.json, the README transcript, the package.json script.

## 2026-10-15 · Gemini CLI: connect the server
- Goal: Check that a real agent lists my tools and calls one without me naming it.
- Delegated: "What does lecture 7 cover?"
- Checkpoints: check.mjs 12/12 before connecting; `/mcp` showed my-project Ready (2 tools); I approved the call with "Allow once".
- Went wrong: the first request failed with "API key not valid" because the auth method was set to an API key; with the Auto model the request stayed on "Thinking" for minutes, probably because of the quota on the larger model.
- Changed by hand: created a new API key and set it with `/auth`; switched to gemini-3.5-flash-lite with `/model`.

## 2026-10-15 · Gemini CLI: description experiment
- Goal: See whether a vague description changes which tool the model picks.
- Delegated: the same question, after changing only the find_lecture description to "Gets data from a file."
- Checkpoints: restarted Gemini so it read the new tool list; check.mjs 12/12 after I restored the description.
- Went wrong: nothing failed; the model still chose find_lecture.
- Changed by hand: the description, and then restored it.

## 2026-10-20 · Claude tutor: SPEC.md goals to acceptance criteria
- Goal: write the project option, goals, non-goals, constraints and acceptance criteria.
- Delegated: Claude asked questions, criticised my drafts and suggested English wording for most lines; I chose the project and decided what is in and out of scope.
- Checkpoints: node checks/ex2.mjs after every section.
- Went wrong: I first wrote the goals as questions copied from the chat and put extras (mobile app, statistics, calendar sync) as goals; I renamed the "Project option" heading, so the check could not find it.
- Changed by hand: rewrote the goals as decisions, moved the extras to non-goals and kept only a calendar link and a simple usage table.

## 2026-10-27 · Claude tutor: model feature, auth, MCP tools, UI and AGENTS.md
- Goal: fill in the rest of SPEC.md and AGENTS.md.
- Delegated: wording of the sections; I chose natural-language search as the model feature.
- Checkpoints: the ex2 self-check; checked the length and prefix of GEMINI_API_KEY without printing it.
- Went wrong: the Codespaces secret held the text "Add secret" instead of the key; my API key was visible in a screenshot I shared, so I deleted it and created a new one; PostgreSQL is not installed in the codespace.
- Changed by hand: the secret value, the new key, and the constraint now says SQLite in development and PostgreSQL from Exercise 4.

## 2026-10-27 · Gemini CLI: read back the always-ask list
- Goal: check that the agent reads AGENTS.md.
- Delegated: "What does the Always ask before list in AGENTS.md say?"
- Checkpoints: compared its answer with the file.
- Went wrong: it listed 8 of the 9 items and silently left out "sending user data to a third-party model".
- Changed by hand: nothing; noted it.

## 2026-10-27 · Gemini CLI: plan and database for slice 1
- Goal: plan slice 1, then build part a (tables and seed data).
- Delegated: the plan, the npm packages and src/db/database.js.
- Checkpoints: read the plan before saying go; looked at the tables after part a.
- Went wrong: after installing the packages it stopped and said the plan was done without building anything; sqlite3 failed to load (ERR_DLOPEN_FAILED), so it switched to node:sqlite; it added "type": "module" to package.json without asking, which would have broken mcp-server/server.js; it kept @sofia.bg accounts and seeded on every start with fixed ids.
- Changed by hand: added mcp-server/package.json with "type": "commonjs"; asked for the seed fixes; deleted data/app.db so the new seed ran.

## 2026-10-28 · Gemini CLI: sign-in, labs list and fixes
- Goal: parts b and c of slice 1.
- Delegated: sign-in, sessions, routes, the two pages and the tests.
- Checkpoints: npm test, read the session configuration, curl without a session, a private window, deleted a lab row and restarted.
- Went wrong: npm test hung because the test imported server.js, which started the server; SQL sat in the services and all routes and HTML in server.js, against the layers; the list used innerHTML with database text; the session secret had a hard-coded fallback and the cookie had no sameSite.
- Changed by hand: asked for each fix and checked it again; added AC-19 and the seed constraint to SPEC.md.
## 2026-11-03 · Slice 2: booking a workstation
- Goal: a student books a free 2-hour slot, a booked slot is refused with 409, and only the owner can cancel (AC-1 to AC-5, AC-8 and AC-20 in SPEC.md).
- Autonomy: checkpointed autonomy. The agent works alone inside one step of the plan and stops at the end of that step.
- Checkpoints: after the plan, I read and correct it before any code is written; after each step, npm test must pass and I read git diff --staged before I commit; the agent stops when a test fails, before it writes or changes a migration, and before it installs a dependency.
- Delegated: the migration system, the booking service with its rule tests, the endpoints with API tests, cancellation and authorization, and the booking screen.
- Went wrong: in the always-ask test I chose Allow once by mistake, so dayjs was installed (removed with npm uninstall); the first rule tests wrote into data/app.db because ES module imports run before the module body, so the second run failed (fixed with await import() after setting DB_PATH); GET /labs/:id called the data layer directly (fixed); the Exercise 2 self-check passed while six AC ids were duplicated in SPEC.md.
- Changed by hand: the slice 2 criteria and the removal of the duplicates, the Migrate command in AGENTS.md, the removed fallback in GET /labs/:id, the AC-2 test title, and the architecture note.



### Plan (after review)
1. Migrations: migrations/001_initial.sql (users, labs, workstations, IF NOT EXISTS) and migrations/002_bookings.sql (bookings with UNIQUE(workstation_id, date, slot) and foreign keys); src/db/migrate.js applies each file once, in order, and records it in schema_migrations; npm run migrate; run on start before the seed.
2. Service: src/services/errors.js (InvalidBooking, BookingConflict, NotOwner, BookingNotFound, LabNotFound); src/db/bookings.js; src/services/bookingService.js with getWorkstationSlots, createBooking (also turns a UNIQUE violation into BookingConflict) and cancelBooking (the owner check lives only here); rule tests in src/services/bookingService.test.mjs against a temporary database.
3. Endpoints in src/routes/labs.js: GET /api/labs/:id/slots (200, 401, 404, 422) and POST /api/bookings (201, 401, 409, 422), with API tests.
4. DELETE /api/bookings/:id (204, 401, 403, 404), with tests for AC-4 and AC-5.
5. UI: /labs links to /labs/:id; public/lab.html with a day picker, six slots per workstation showing Free, Booked or Cancel, and loading, empty and error states.

Changed in review: the first plan put the bookings table inside database.js instead of a numbered migration; the service returned status codes instead of named errors, and the owner check was described with req.session in the route; "400/422" was undecided, now always 422 as AC-8 says; nothing turned a UNIQUE violation from two students booking at the same moment into 409; there were only API tests, against the real data/app.db; the screen had no Cancel button for AC-4 and the labs list did not link to it.


## What the agent did that I did not ask for
- `src/routes/labs.js`: `GET /labs/:id` had a fallback that sent `Lab ${lab.name}` as HTML when `lab.html` was missing. It never ran, and it would have put the lab name into HTML unescaped. Removed.
- `src/server.test.mjs`: the AC-2 test title still said the slot changes to "Booked" after I changed AC-2 to a "Cancel" button. Renamed by hand.
- `public/lab.html`: a weekend check in the browser as well as on the server (kept: the server still refuses with 422); the title shows the lab id ("Lab 1 Booking") instead of its name (kept, known gap); the default date uses `toISOString()`, which is UTC, so between 00:00 and 02:00 in Sofia it shows the previous day (kept, known gap).
- `src/services/bookingService.js`: `getWorkstationSlots` repeats the lab check instead of calling `getLab` (kept); the conflict check tests `err.code === 'SQLITE_CONSTRAINT'`, which node:sqlite never sets (step 6 showed `ERR_SQLITE_ERROR`), so only the match on the message text works (kept, noted).
- It read the self-check files in `checks/` several times without being asked.
- No new dependencies: the only change in package.json is the migrate script I asked for, and dayjs from the always-ask test was removed.

## 2026-11-10 · Slice 3: natural-language search
- Goal: a student types a request and the booking filters are filled from the model's answer, or stay empty with a message when there is no key, the model is slow, or it answers nonsense (AC-16, AC-17, AC-21 and AC-22 in SPEC.md).
- Autonomy: checkpointed autonomy. The agent works alone inside one step of the plan and stops at the end of that step.
- Checkpoints: after the plan, I read and correct it before any code; after each step, npm test must pass and I read git diff --staged before I commit; the agent stops when a test fails and before it installs a dependency; tests never call the real model, only I call it, by hand, once the feature is built; the key is never printed or logged.
- Delegated: the search service with its tests, the POST /api/search route with API tests, and the search box on the booking screen.
- Went wrong: the AC-21 test created a separate fake for the weekend, past date, slot 7 and non-JSON cases but called the unknown-lab one each time, so it passed without testing them (fixed, and proven by commenting out the weekend check, which then failed AC-21); the timeout did not give the AbortController's signal to the model call, so a slow request kept running (fixed); "today" was built with toISOString(), which is UTC, in the service and on the booking screen, so after midnight in Sofia the page showed yesterday (fixed); the codespace runs in UTC, so the server needs TZ=Europe/Sofia (to set in Exercise 4); the agent again read files in checks/ without being asked.
- Changed by hand: the local date in getInitialDate in public/lab.html, the search placeholder (lab 1 became lab 2140), and the manual checks with the real model (AC-17, AC-21) and with the key removed (AC-16).


### Plan (after review)
1. Search service: src/services/search.js with createSearch({ askModel, now, timeoutMs }), whose defaults are a fetch call to the Gemini REST API with the key in the x-goog-api-key header, the real date and 5000 ms. No key means the fallback message without calling the model. The model gets only the sentence, today's date and the lab names, and its answer is checked against real labs, weekdays, no past dates and slots 0-5. Tests in src/services/search.test.mjs use a fake askModel for AC-16, AC-17, AC-21 and AC-22.
2. Route: POST /api/search in src/routes/labs.js (200 with { labId, date, slot } or { message }, 401, 422), with API tests for AC-16 with the key removed, and for 401 and 422.
3. UI: a search box on the booking screen; a good answer opens /labs/<labId>?date=&slot= and highlights the slot without booking; the fallback message appears under the search box.

Changed in review: the first plan said slots 0-8 in one place and 0-5 in another; it did not say how the model would be faked in tests, so the model client and the clock are now injected; it defaulted to gemini-2.5-flash instead of the model in the spec; it did not say how the key is sent (now a header, never the URL) or whether a new package was needed (none, fetch is enough); the route was going to collect the labs for the service; the UI had no lab filter for the answer to fill in; the timeout test would have waited five real seconds; and the no-key test would have called the real model, because the codespace has a key.