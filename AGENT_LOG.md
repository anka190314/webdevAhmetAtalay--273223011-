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