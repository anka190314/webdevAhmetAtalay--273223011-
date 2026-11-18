# Usage

One row per agent session. In Gemini CLI, type `/stats` before you quit and copy the input and output tokens. Copilot shows credits instead of tokens: write those in the credits column. The free tier charges nothing, so record what the session **would cost at the provider's published list price**, and note once below the table which price list you used. Leave the cost empty for rows that only show credits.

| Date | Tool | Input tokens | Output tokens | Credits (if no tokens) | List-price cost |
|---|---|---|---|---|---|
| 2026-10-12 | Claude (claude.ai chat, tutor) | — | — | — | |
| 2026-10-15 | Claude (claude.ai chat, tutor) | — | — | — | |
| 2026-10-15 | Gemini CLI (gemini-3.5-flash-lite) | 24 437 | 84 | | $0.0075 |
| 2026-10-15 | Gemini CLI (gemini-3.5-flash-lite) | 25 080 | 49 | | $0.0076 |
| 2026-10-20 | Claude (claude.ai chat, tutor) | — | — | — | |
| 2026-10-27 | Claude (claude.ai chat, tutor) | — | — | — | |
| 2026-10-27 | Gemini CLI (gemini-3.5-flash-lite), always-ask check | 12 517 | 100 | | $0.0040 |
| 2026-10-27 | Gemini CLI (gemini-3.5-flash-lite), plan and part a | not recorded | not recorded | | |
| 2026-10-28 | Gemini CLI (gemini-3.5-flash-lite), part b | not recorded | not recorded | | |
| 2026-10-28 | Gemini CLI (gemini-3.5-flash-lite), slice 1 fixes | 150 614 (109 449 cached) | 1 119 | | $0.0480 |
| 2026-10-28 | Claude (claude.ai chat, tutor) | — | — | — | |
| 2026-11-03 | Gemini CLI (gemini-3.5-flash-lite), always-ask test | 54 935 (32 466 cached) | 142 | | $0.0168 |
| 2026-11-03 | Gemini CLI (gemini-3.5-flash-lite), slice 2 plan and steps | not recorded | not recorded | | |
| 2026-11-03 | Claude (claude.ai chat, tutor) | — | — | — | |
| 2026-11-10 | Gemini CLI (gemini-3.5-flash-lite), layering fix | 402 845 (336 509 cached) | 1 765 | | $0.1253 |
| 2026-11-10 | Claude (claude.ai chat, tutor) | — | — | — | |
| 2026-11-11 | Gemini CLI (gemini-3.5-flash-lite), slice 3 plan and steps 1-2 | 580 160 (466 955 cached) | 2 772 | | $0.1810 |
| 2026-11-11 | Gemini CLI (gemini-3.5-flash-lite), slice 3 step 3 and slice 4 plan | not recorded | not recorded | | |
| 2026-11-11 | Claude (claude.ai chat, tutor) | — | — | — | |
| 2026-11-16 | Gemini CLI (gemini-3.5-flash-lite), slice 4 steps 1-3 | not recorded | not recorded | | |
| 2026-11-16 | Claude (claude.ai chat, tutor) | — | — | — | |
| 2026-11-17 | Gemini CLI (gemini-3.5-flash-lite), slice 4 step 4 and slice 5 | not recorded | not recorded | | |
| 2026-11-17 | Claude (claude.ai chat, tutor) | — | — | — | |
| 2026-11-18 | Gemini CLI (gemini-3.5-flash-lite), slice 5 page and slice 6 | not recorded | not recorded | | |
| 2026-11-18 | Claude (claude.ai chat, tutor) | — | — | — | |

Price list: Gemini API list price for gemini-3.5-flash-lite, $0.30 per 1M input tokens and $2.50 per 1M output tokens (ai.google.dev/gemini-api/docs/pricing, checked 2026-10-15). Cached input tokens are counted at the full input price, so the real cost would be lower. The claude.ai chat does not show token counts.

Not recorded: in those sessions I quit Gemini CLI without running `/stats` first, or the session ended at the rate limit. The recorded sessions show where the tokens go: nearly all of the input is the agent reading the same files again on each request, and more than 80% of it was cached; the layering fix, a three-line change, cost more input than slice 1.
