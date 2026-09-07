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
| Rate limiting algorithm | Fixed window (counter resets every N seconds), Sliding window (count requests in last N seconds from now), Token bucket (steady refill rate) | Sliding window via Redis sorted sets | Prevents boundary exploit — fixed window allows 2x requests at window boundary (100 at 0:59 + 100 at 1:01 = 200 in 2 seconds). Sliding window enforces exactly N requests per N seconds regardless of timing | Higher memory — stores one timestamp per request vs one counter per window |
| Cache TTL strategy for expiring links | Fixed 24-hour TTL (risk of serving stale expired links from cache), Dynamic TTL matching actual link expiry | Dynamic TTL calculated from expires_at | Prevents serving expired links from cache — TTL matches actual link lifetime so Redis and PostgreSQL always agree on whether a link is valid | More complex — must handle null expires_at for permanent links and edge case of near-zero TTL |
| HTTP status for expired links | 404 Not Found (generic), 410 Gone (resource existed but is permanently unavailable) | 410 Gone | Semantically correct — 404 means "never existed or unknown", 410 means "existed but is permanently gone". Clients and crawlers treat these differently. Search engines deindex 410 faster than 404 | Slightly less common status code — some clients treat 410 same as 404 anyway |

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
- [x] Sliding window rate limiting algorithm — evidence: src/middleware/rateLimit.js using Redis sorted sets (zAdd, zRemRangeByScore, zCard)
- [x] Redis sorted set operations — evidence: zAdd adds timestamp per request, zRemRangeByScore removes old entries, zCard counts remaining
- [x] Express middleware pattern — evidence: rateLimit passed as second argument to app.get and app.post — runs before route handler
- [x] Fail-open error handling in middleware — evidence: rateLimit.js catch block calls next() if Redis is down so service stays available during cache outage
- [x] 429 Too Many Requests — evidence: burst test confirmed requests 11+ blocked with correct JSON error body and retryAfter field
- [x] Link expiry with timestamp-based validation — evidence: links.expires_at column in PostgreSQL, getLink() checks expiry at read time
- [x] Dynamic cache TTL matching link lifetime — evidence: ttlSeconds calculated from expires_at in GET /:code, permanent links default to 24 hours
- [x] Cache invalidation on detected expiry — evidence: cache.del(code) called immediately when expired link found on cache hit
- [x] HTTP 410 Gone vs 404 Not Found — evidence: expired links return 410, missing links return 404, tested and verified
- [x] Structured JSON in Redis cache — evidence: cache payload stores both url and expires_at so expiry can be checked on cache hit without DB query

# 6. Metrics

# 7. Bugs and lessons

1. Symptom: PowerShell burst test showed "Status 302" printed after 429 errors
   Cause: Invoke-WebRequest throws exception on 4xx responses, $response variable retains previous value from last successful request
   Fix: Read error message from the exception body directly, not from $response
   Lesson: When testing APIs with PowerShell, always read the exception message for 4xx responses — $response only updates on successful requests

2. Symptom: Expired links still redirected after expiry
   Cause: Redis cached only the URL string with a fixed 24-hour TTL — no expiry information stored in cache, so a link could expire in DB but still be served from Redis for up to 24 hours
   Fix: Cache a JSON payload containing both url and expires_at, check expiry on every cache hit, delete stale cache entry on detection, calculate TTL dynamically from actual link expiry time
   Lesson: When cached data has its own independent expiry schedule, the cache TTL must match — a fixed TTL is only safe when underlying data never changes on its own schedule

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
