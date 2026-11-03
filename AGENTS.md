# Instructions for the agent

Read this file at the start of every session. Keep it short and correct; update it when the project changes.

## Project
TU Sofia Lab Booking is a web app where students of the Technical University of Sofia see which lab workstations are free on a weekday and book 2-hour slots, and lab staff manage labs and workstations and see how they are used.See `SPEC.md` for goals, non-goals and acceptance criteria.

## Commands
- Install: `npm install`
- Run: `npm start`
- Test: `npm test`
- MCP server: `npm run --silent mcp`

## Conventions
- Node.js with Express for the REST API; SQLite in development (one file, `data/app.db`), PostgreSQL from Exercise 4; all SQL stays in `src/db/`. Plain HTML, CSS and JavaScript in the UI.
- The MCP server and the HTTP API call the same functions in `src/services/`; a rule is never written twice.## Layers

## Layers
- Route handlers: `src/routes/`
- Services: `src/services/`
- Data access: `src/db/`
- Database: `data/app.db` (SQLite in development)
- MCP tools: `mcp-server/server.js`, calling `src/services/`

## The model feature
<!-- Provider, env var, and the call site. -->
- The provider is named in exactly one file: `src/services/search.js` (Gemini, model from `MODEL_NAME`, key from `GEMINI_API_KEY`).
- The key comes from an environment variable and is never committed or logged.
- Every call has a timeout and a deterministic fallback, so the app still works when the provider is down or rate-limited.
- The model's output is re-checked against real data before anything is saved or shown.
- Tests never call the provider: they pass in a fake client.

## The MCP server
<!-- Where it lives and how it authenticates. -->
- Lives in `mcp-server/`, grew out of Exercise 1.
- Every tool calls a service function; none touches the data layer or the database directly.
- It carries a user, and enforces exactly the same authorization rules as the HTTP API.
- Adding a tool means adding a row to the table in `SPEC.md` too.

## Tests and coverage
- Every acceptance criterion in `SPEC.md` has an id like `AC-3`, and a test whose title contains that id.
- The coverage gate runs in CI: 100% of the service layer, 80% overall.
- A test is evidence. Changing a test so the code passes destroys the evidence.

## Always ask before
- deleting files or folders
- editing a migration that has already run
- installing or removing dependencies
- pushing, tagging or changing CI
- anything that touches secrets or `.env`
- changing an authentication or authorization rule
- adding, renaming or removing an MCP tool
- changing a coverage threshold
- sending user data to a third-party model
- creating a new migration file
- changing or deleting a test that already exists

## Never
- commit secrets, passwords, API keys or an OAuth client secret
- weaken or delete a test to make it pass
- lower a coverage threshold or switch off a CI job to make the build green
- add an MCP tool that reaches past the service layer
- log a prompt that contains somebody's personal data

