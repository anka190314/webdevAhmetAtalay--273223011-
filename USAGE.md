# Usage

One row per agent session. In Gemini CLI, type `/stats` before you quit and copy the input and output tokens. Copilot shows credits instead of tokens: write those in the credits column. The free tier charges nothing, so record what the session **would cost at the provider's published list price**, and note once below the table which price list you used. Leave the cost empty for rows that only show credits.

| Date | Tool | Input tokens | Output tokens | Credits (if no tokens) | List-price cost |
|---|---|---|---|---|---|


| 2026-10-12 | Claude (claude.ai chat, tutor) | — | — | — | |
| 2026-10-15 | Claude (claude.ai chat, tutor) | — | — | — | |
| 2026-10-15 | Gemini CLI (gemini-3.5-flash-lite) | 24 437 | 84 | | $0.0075 |
| 2026-10-15 | Gemini CLI (gemini-3.5-flash-lite) | 25 080 | 49 | | $0.0076 |

Price list: Gemini API list price for gemini-3.5-flash-lite, $0.30 per 1M input tokens and $2.50 per 1M output tokens (ai.google.dev/gemini-api/docs/pricing, checked 2026-10-15). Cached input tokens (20 296 in the second Gemini session) are counted at the full input price, so the real cost would be slightly lower. The claude.ai chat does not show token counts.