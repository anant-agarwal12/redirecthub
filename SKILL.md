---
project: RedirectHub - Payment Link Management Service
track: backend
level: beginner-to-intermediate
shipped: [TBD]
repo: https://github.com/anant-agarwal12/redirecthub
live: [TBD]
---

# 1. What this project is

For a non-technical person: A service that takes long payment URLs 
and turns them into short links that expire, track clicks, and block 
suspicious traffic — the same infrastructure payment providers like 
Razorpay use internally.

For an engineer: A Node.js/Express REST API backed by PostgreSQL and 
Redis that generates Base62 short codes, serves redirects from a 
read-through Redis cache, writes click analytics asynchronously off 
the request path, and enforces per-IP sliding-window rate limiting.

# 2. Problem it solves

Payment links in fintech are long, expiry-sensitive, and need fraud 
controls. A dedicated link management service gives you short shareable 
links with configurable expiry, click tracking, and rate limiting — 
without exposing raw payment gateway URLs.

# 3. Architecture

[ASCII diagram - fill after Phase 3 when full request flow is built]

Components:
- Express → handles HTTP routing and middleware
- PostgreSQL → persistent storage for links and analytics
- Redis → read-through cache for redirect path 
- k6 → load testing tool to measure p50/p95/p99 

# 4. Decisions

| Decision | Options | Chosen | Why | Trade-off |
|---|---|---|---|---|
| Connection pool vs single connection | Single connection per request vs Pool | Pool (via pg library) | Pool reuses connections — opening a new TCP connection per request adds 20-100ms overhead and crashes under load | Connection limit — pool has a max size, requests queue if exceeded |

# 5. Skills demonstrated

- [x] PostgreSQL schema design — evidence: psql CREATE TABLE links
- [x] Connection pool management — evidence: src/db.js Pool setup
- [x] Parameterized queries ($1/$2) — evidence: src/db.js query()
- [x] Environment-based config — evidence: DATABASE_URL in .env

# 6. Metrics

# 7. Bugs and lessons

# 8. Deployment notes

# 9. Handoff

# 10. Postmortem
