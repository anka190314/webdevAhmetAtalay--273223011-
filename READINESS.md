# Readiness report: TU Sofia Lab Booking

## 1. Live URL and how to verify it

The app runs on a free Render web service, built from the `Dockerfile`, in Frankfurt. The database is Postgres on Neon, also in Frankfurt.

- Live URL: https://webdevahmetatalay-273223011.onrender.com (the service is named after the repository, so the address is not `webdev-273223011`).
- Check: `curl -s https://webdevahmetatalay-273223011.onrender.com/health` answers `{"status":"ok","db":"ok"}`. The free plan puts an idle service to sleep, so the first request after about 15 minutes can take around 50 seconds.
- Deploys: Auto-Deploy "After CI Checks Pass" from `main`.

How I checked: `curl -i` on `/health` answered `HTTP/2 200` with that body (2026-11-19). In Render's Events, the push of `99d0819` started deploying only after the four CI jobs were green (CI done about 18:10, "Deploy started, New commit via Auto-Deploy" 18:10, live 18:11).

## 2. Environment variables

Every variable is listed in `.env.example` with a harmless placeholder. Real values live in `.env` (git-ignored) and in Render's Environment settings.

| Variable | Needed | Where the real value comes from | Without it |
|---|---|---|---|
| `SESSION_SECRET` | yes | `openssl rand -hex 32`, a different value in `.env` and on Render | the app stops at start-up: `missing SESSION_SECRET: see .env.example` |
| `DATABASE_URL` | yes | Neon dashboard, Connect, with `sslmode=verify-full` | the app stops at start-up |
| `NODE_ENV` | on Render | `production` (also set in the Dockerfile) | development behaviour: no Secure cookie, no trust proxy |
| `TZ` | yes in practice | `Europe/Sofia` | "today" and booking dates are UTC dates |
| `PUBLIC_BASE_URL` | for Google sign-in | the live URL; the codespace URL in `.env` | `/api/auth/google` answers 503 |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | for Google sign-in | Google Cloud, an OAuth client in Testing mode | 503 "Google Sign-In is not configured." |
| `GEMINI_API_KEY` | no | Google AI Studio | the search box shows its fallback sentence |
| `MODEL_NAME` | no | - | `gemini-3.5-flash-lite` |
| `PORT` | no | Render sets it | 3000 |
| `SEED_DEMO_USERS` | tests only | set by `test/db.mjs`; never on Render or for Neon | no demo accounts |
| `MCP_TOKEN` | MCP server only, never on Render | `npm run mcp-token -- <email>` | the MCP tools answer "Missing or unknown MCP token" |

How I checked: `SESSION_SECRET= npm start` stopped with the line above. The first Render deploy failed with "SESSION_SECRET environment variable is required in production", because the service was created before the variables were entered. On the live site `/api/auth/google` answered 503 "Google Sign-In is not configured." until the Google variables were added, and 302 to Google afterwards.

## 3. What happens when things fail

| What fails | What the user or the platform sees | How I checked |
|---|---|---|
| The database is down | `/health` answers 503 `{"status":"error","db":"down"}`; the app stays up and recovers by itself when the database is back | I stopped the local Postgres under the running app: 200, then 503, then 200 without a restart. The first try crashed the whole process with an unhandled `'error'` event from an idle pool connection (code 57P01); fixed with an error listener on the pool and the test `src/db/database.test.mjs`. Neon closes idle connections the same way when it scales to zero. |
| A required variable is missing | the app does not start; one line names the variable | section 2 |
| Broken JSON in a request | 400 "The request body is not valid JSON." | `curl` with `{"title": 12` on the live URL |
| An unexpected error | 500 "Something went wrong. Please try again."; the stack only in the log | the error handler in `src/app.js` logs `err.stack`, not the error object, because a JSON parse error carries the request body (a password in a broken login request would have reached the log) |
| An unknown path | 404 `{"error":"Not found"}` | `curl` on `/no-such-page` |
| The model is slow, down or out of quota | the fallback sentence within 5 seconds; the date and slot pickers still work | tests AC-16 and AC-22 |
| A bad release | Render's Rollback restores the previous build in about 26 seconds; a `git revert` takes 2 to 3 minutes (CI and build); Render switches Auto-Deploy off on a rollback | a broken `/labs` heading passed CI (94 tests) and went live; Rollback clicked at 19:15:14 UTC, live at 19:15:40 UTC on 2026-11-19 |
| A restart (deploy, rollback, waking up) | the data stays, because it is in Neon; every user is signed out | a booking for 25.11.2026 was still there after a Manual Deploy; after the restarts, the page that was still open got 401 on its next request |
| Render stops the container | the app exits at once on SIGTERM | Ctrl+C on the container printed "SIGINT received, shutting down" |

## 4. Four states of one screen

Screen: the booking screen, `/labs/:id`, on the live site, in Safari.

| State | What the user sees | How I produced it | Screenshot |
|---|---|---|---|
| Loading | "Loading slots..." in a status line above the old grid, which stays dimmed | the console delayed every `fetch` by 15 seconds, then a new date | `docs/ui/lab-loading.png` |
| Empty | "Weekends are not bookable. Please select a weekday (Monday to Friday)." with a "Choose another lab" link | picked Saturday 21.11.2026 | `docs/ui/lab-empty.png` |
| Error | "Could not load the slots. Check your connection and try again." with a Retry button; the old grid is removed | Wi-Fi off, then a new date | `docs/ui/lab-error.png` |
| Success | six slots for every workstation; my own booking with Cancel and "Add to Google Calendar", other people's as "Booked" | a weekday | `docs/ui/lab-success.png` |

On 2026-11-20 the error state showed only the browser's own "Load failed"; it now has a sentence and Retry. While fixing it I first left the old grid on the screen under the error, so a Book button could book the previous date; my own screenshot showed it and the grid is now removed. What is still weak: after the server forgets a session, the page shows the server's one word "Unauthorized" (gap 1 in section 7).

## 5. Request waterfall

Booking screen on the live URL, caches disabled in Safari's Network tab, 2026-11-20:

| # | Request | Type | Time |
|---|---|---|---|
| 1 | `/labs/1` | document | about 76 ms |
| 2 | `/assets/app.css` | stylesheet | about 71 ms, starts after 1 |
| 3 | `/api/labs/1/slots?date=...` | fetch | about 77 ms, starts after 2 |

Three requests, 5.4 KB transferred, 174 ms in all (measured on 2026-11-20, after the shared stylesheet was added; before it there were two requests and about 95 ms). They run one after the other: the browser waits for the stylesheet before it runs the page's script, and that script asks for the slots. On the next visit `app.css` comes from the cache. A booking adds `POST /api/bookings` (about 100 ms) and then loads all the slots again. Not in these numbers: the first request after Render has put the service to sleep, which can take around 50 seconds.

What I would change: put the few lines of tokens the page needs first into the page itself, or start the slots request before the stylesheet arrives, to save a round trip on the first visit; after a booking, update one slot instead of reloading all of them.

How I checked: Safari Web Inspector, Network tab, "Disable caches", reload (`docs/ui/waterfall.png`).


## 6. Security basics checked

- No secret in the repository or its history. How I checked: `git log -p | grep -i -E "(secret|password|token|api_key)[a-z_]*[\"']?[[:space:]]*[=:][[:space:]]*[\"']?[A-Za-z0-9_./+-]{16,}"` found only code, and `git log -p | grep "AQ\.A"` (my Gemini key's prefix) found nothing. Before each push I searched the outgoing diff for Google client secrets (`GOCSPX`) and Neon passwords (`npg_`); it only ever found two harmless lines, a check that refuses a Neon address and a sentence in the log.
- Secrets live only in `.env` (git-ignored, checked with `git check-ignore .env`) and in Render. `.dockerignore` keeps `.env` and `.git` out of the image (checked with `docker run --rm webdev ls -a /app`).
- Passwords are stored as bcrypt hashes. Accounts with a password come only from `npm run create-user` (at least 12 characters). The demo accounts with the public test passwords exist only in test schemas (`SEED_DEMO_USERS`), never in Neon. How I checked: a query on Neon's `users` table shows one staff account and one Google student.
- Google sign-in uses the authorization-code flow with `state` (compared with `crypto.timingSafeEqual` and used once) and PKCE (S256); the client secret and the code exchange stay on the server; the id_token's `iss`, `aud` and `exp` are checked, and a Google account is linked or created only with a verified e-mail (AC-11). How I checked: a server test checks that the SHA-256 of the verifier sent to the token endpoint equals the `code_challenge` sent to Google; `curl -I` on the live `/api/auth/google` shows the 302 with `state`, `code_challenge` and `code_challenge_method=S256`.
- The session cookie is HttpOnly and Secure (seen in Safari, Storage, Cookies, on the live site) and SameSite=Lax (set in `src/app.js`); `trust proxy` is on in production, so Express knows the request came over HTTPS.
- Authentication and authorization are separate: no session gives 401; a signed-in user who is not allowed gives 403, decided in the service layer. How I checked: on the live site a write without a session got 401, and a second account (a Google student) deleting a staff member's booking (`DELETE /api/bookings/5` from the console) got 403 and the row stayed in the table; students get 403 from the staff API (AC-27).
- No stack trace reaches a user (section 3).
- The database connection uses TLS with `sslmode=verify-full`, and the test helper refuses a Neon address, so tests can never touch production data.

## 7. Known gaps, ranked by risk

1. **Sessions live in the server's memory** (express-session's MemoryStore). Every deploy, rollback or wake-up signs everyone out, and a page that is still open then gets 401 and shows the server's one word "Unauthorized" instead of sending the user to sign in (seen on 2026-11-19 and 2026-11-21). It also leaks memory and would break with two instances, and the cookie has no Max-Age. Fix: keep the sessions in Postgres, give the cookie a lifetime, and send a 401 back to the sign-in page.
2. **A slot earlier today can still be booked.** The server refuses past days but not past hours: on 2026-11-20 at 22:16 the 08:00 slot of the same day was booked. Fix: refuse a slot whose start time in Europe/Sofia has passed, with a test.
3. **The "My bookings" page (`/bookings`) from the spec was never built.** A student sees their own bookings only on the booking screen, one lab and one day at a time, or through the MCP tool `my_bookings`.
4. **Linking a Google account by e-mail does not check that the user has signed in locally once** (Lecture 7). With Google, which verifies addresses, the risk is small; with a less careful provider it would allow an account takeover.
5. **The free plan:** the first request after about 15 minutes of inactivity waits around 50 seconds, and Neon scales to zero.
6. **Three requests in a row on the first visit** (page, stylesheet, slots; section 5).
7. **Smaller UI gaps** (`docs/UI.md`): 768 px itself was not tried (820 px was), the labs list and the staff page were not checked state by state, the search suggestion line stays after a failed load, the type scale has seven sizes, and there is no dark mode.
8. Cosmetic: the booking screen's heading shows the lab's id ("Lab 1 Booking") instead of its name, and workstation names are not trimmed.

## 8. Model feature

The booking screen has a search box: a sentence such as "Monday at 10 in lab 2140" picks the date and the slot. It never books anything.

- The provider is Gemini (`MODEL_NAME`, default `gemini-3.5-flash-lite`), called only from `src/services/search.js`. The model gets the sentence, today's date and the lab names; no personal data.
- What leaves the app: only the sentence the user typed, today's date and the lab names are sent to Google's Gemini API. No name, e-mail address, booking, session or password is sent, and the request carries no user id.
- Every call has a 5-second timeout. Without a key, on a timeout, a 429 or an answer that is not the expected JSON, the user gets "Could not understand the request, please choose the day and time yourself", and the pickers still work.
- The model's answer is checked against real data before it is used: the lab must exist, the date must be a weekday that is not in the past, and the slot must be between 0 and 5 (AC-21).
- Tests: AC-16, AC-17, AC-21 and AC-22, and the calls to Gemini with `fetch` faked; `search.js` has 100% line, branch and function coverage, and no test calls the real API.
- Cost: the key is on the free tier; at the list price of gemini-3.5-flash-lite one search costs a small fraction of a cent.

How I checked: on the live site (2026-11-20), "Monday at 10 in lab 2140" set the date to 23.11.2026 and highlighted the 10:00-12:00 slot of every workstation, with nothing booked (`docs/ui/search.png`). "tomorrow at 10 in lab 2140" on a Friday evening, when tomorrow is a Saturday, picked no slot, because the server refuses weekends whatever the model says.

## 9. MCP

- The server is `mcp-server/server.js`, spoken to over stdin and stdout and started with `npm run --silent mcp`. Tools: `find_lecture` and `get_timetable` from Exercise 1; `free_workstations`, `my_bookings`, `book_slot` and `lab_usage` for the project.
- Who is calling: a personal token in `MCP_TOKEN`, printed once by `npm run mcp-token -- <email>`; only its SHA-256 hash is stored, in `mcp_tokens`. The tools call the same services as the HTTP API, so `book_slot` obeys the same booking rules and `lab_usage` is for staff only.
- It runs on the developer's machine against the database in `DATABASE_URL`; it is not deployed to Render.

How I checked: the CI job "mcp" runs `mcp-server/check.mjs` (12/12) on every push; `mcp-server/tools.test.mjs` (AC-18, AC-23 to AC-26, AC-28) runs in the test job against a throwaway Postgres schema; a missing or unknown token gives an error result and changes nothing (AC-26).
