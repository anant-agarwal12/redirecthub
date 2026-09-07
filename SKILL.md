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
| Read-through cache vs write-through vs write-behind | Write-through (sync write to cache+DB), Read-through (lazy load on miss), Write-behind (async flush to DB) | Read-through | Simple to implement — cache only populates after first request, no extra write-path complexity | Cold cache on first request always hits DB; first user for any link pays full DB latency |
| Sync analytics write vs fire-and-forget async | Awaiting INSERT before redirect (adds 10-50ms per request), Fire-and-forget without await | Fire-and-forget | Analytics latency must never affect redirect speed — a 50ms analytics write would add 50ms to every user's redirect experience | If analytics INSERT fails silently, click data is lost — acceptable tradeoff since analytics is non-critical |

# 5. Skills demonstrated

- [x] PostgreSQL schema design — evidence: psql CREATE TABLE links
- [x] Connection pool management — evidence: src/db.js Pool setup
- [x] Parameterized queries ($1/$2) — evidence: src/db.js query()
- [x] Environment-based config — evidence: DATABASE_URL in .env
- [x] Distributed ID generation trade-offs
  
  **Strategy chosen: Auto-increment + Base62 encoding**
  
  **Three approaches evaluated:**
  
  1. Auto-increment + Base62 (CHOSEN)
     - How: PostgreSQL SERIAL auto-generates unique integer, Base62-encode it into alphanumeric string
     - Pros: Guaranteed uniqueness (DB enforces via PRIMARY KEY), no collision checks needed, short codes stay compact
     - Cons: Sequential/predictable — codes leak creation order and volume. Unsafe across distributed shards because independent shards can generate identical integers
     - Trade-off: Predictability acceptable for single-instance system. Simplicity and guaranteed uniqueness outweigh predictability risk
  
  2. Random alphanumeric generation
     - How: Generate N random characters, insert with UNIQUE constraint
     - Pros: Non-predictable, works across distributed systems without coordination
     - Cons: Collision risk grows with scale; requires uniqueness check on insert (either extra SELECT query or retry loop on conflict)
  
  3. Hash-based (MD5/SHA of URL, truncated)
     - How: Hash the original URL, take first N characters as code
     - Pros: Same URL always generates same code (natural deduplication)
     - Cons: Hash collisions possible even after truncation; unrelated URLs can collide, causing data loss
  
  Evidence: src/utils/base62.js (encode/decode implementation), src/db.js createLink() (two-step insert pattern)
- [x] Read-through caching pattern — evidence: src/redis.js get()/setWithTTL(), GET /:code checks cache before DB
- [x] TTL-based cache expiry — evidence: 24-hour TTL on redirect cache in src/index.js
- [x] Cache hit ratio measurement — evidence: /metrics/cache endpoint tracks hits/misses/ratio
- [x] Graceful cache failure handling — evidence: src/redis.js get() catches errors, treats as miss instead of crashing
- [x] Asynchronous write paths — evidence: db.logClick() called without await in GET /:code
- [x] Fire-and-forget error handling — evidence: .catch() on detached promise prevents unhandled rejection crash
- [x] HTTP metadata extraction — evidence: req.ip and req.headers['user-agent'] captured per click
- [x] Async analytics off request path — evidence: clicks table rows exist with timestamps showing background writes

# 6. Metrics

# 7. Bugs and lessons

# 8. Deployment notes

# 9. Handoff

# 10. Honest limitations

- **Stale cache on URL update:** If a link's original_url is updated in 
  PostgreSQL after being cached, the Redis cache continues serving the 
  OLD url for up to 24 hours (the TTL). No cache invalidation logic 
  exists on update because this project doesn't support editing links 
  after creation. If update functionality were added, the fix would be 
  to call cache.del(code) immediately after any UPDATE query on that row.

- **No cache warming:** Every link's first request always hits PostgreSQL 
  (cold cache). This is intentional for simplicity — proactive cache 
  warming would add complexity not justified at this scale.

- **Single Redis instance:** No replication or clustering. If Redis goes 
  down, cache.get() catches the error and falls back to querying 
  PostgreSQL directly — reads still work, just slower. This fallback 
  behavior was verified in src/redis.js error handling.
