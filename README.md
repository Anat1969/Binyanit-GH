# Building Renewal Plan 603-0972307 – Ashdod

Public Hebrew RTL site: plan summary, address check with a deterministic rules engine, documents library, grounded Q&A, quarter quota dashboard.

```
npm install
npm test                      # rules engine unit tests
npx next build && npx playwright test
```

Optional env: `ANTHROPIC_API_KEY` enables LLM explanations and Q&A phrasing (retrieval-only mode without it).
See CLAUDE.md for architecture and data notes.
