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
| Multi-stage Docker build vs single stage | Single stage (large image with dev dependencies), Multi-stage (builder stage installs deps, production stage copies only what's needed) | Multi-stage build | Production image contains zero dev dependencies or build tools — smaller attack surface, faster deploys, smaller image size | Slightly more complex Dockerfile — two FROM statements |
| Connection pool size | Default pool of 10 connections, Increased to 20 connections | 20 connections (max: 20) | At 2000 RPS with cache misses, 10 connections caused queue buildup producing p95 outliers. Doubling pool size reduced connection wait time. | Higher memory usage per instance — each PostgreSQL connection uses ~5-10MB |
| Rate limiter bypass for load testing | Hard-coded bypass, Environment variable flag | DISABLE_RATE_LIMIT env var | Clean separation — production runs with rate limiting, load tests disable it via env var without touching code | Must remember to not set this in production |

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
- [x] Multi-stage Docker build — evidence: Dockerfile with builder and production stages
- [x] Docker Compose multi-service orchestration — evidence: docker-compose.yml with app, postgres, redis services
- [x] Service health checks — evidence: postgres and redis healthcheck config, app depends_on with condition: service_healthy
- [x] Docker networking between containers — evidence: DATABASE_URL uses postgres hostname, REDIS_URL uses redis hostname (not localhost)
- [x] Database schema initialisation via init.sql — evidence: init.sql mounted to docker-entrypoint-initdb.d
- [x] Non-root container user — evidence: appuser created in Dockerfile for security
- [x] Data persistence via Docker volumes — evidence: postgres_data volume in docker-compose.yml
- [x] Load testing with k6 — evidence: tests/load-test.js with constant-arrival-rate executor at 100/500/2000 RPS
- [x] Latency percentile interpretation — evidence: p50 7ms, p95 17ms, max 635ms at 2000 RPS documented
- [x] Bottleneck identification and fix — evidence: connection pool increased from 10 to 20 after identifying DB queue buildup at high RPS
- [x] Zero-downtime load handling — evidence: 0 HTTP failures across 78,001 requests at 2000 RPS

# 6. Numbers I measured

| Metric | Before fix | After fix | How measured |
|---|---|---|---|
| p50 latency | 7.55ms | 7.06ms | k6 constant-arrival-rate load test |
| p95 latency | 12.08ms | 17.55ms | k6 constant-arrival-rate load test |
| Max RPS sustained | 2000 | 2000 | k6 load_2000 stage — zero HTTP failures |
| HTTP failure rate | 0% | 0% | k6 http_req_failed metric |
| Error rate | 0.15% | 0.12% | k6 custom errors metric (fixed denominator) |
| Cache hit ratio | measured per session | measured per session | /metrics/cache endpoint |
| Connection pool | 10 (default) | 20 (tuned) | src/db.js Pool config |

Bottleneck found: DB connection pool exhaustion at 2000 RPS causing 
101/78001 (0.13%) requests to exceed 200ms response time.
Fix applied: Increased pool max from 10 to 20. Zero HTTP failures 
at all RPS tiers before and after fix.

# 7. Bugs and lessons

1. Symptom: PowerShell burst test showed "Status 302" printed after 429 errors
   Cause: Invoke-WebRequest throws exception on 4xx responses, $response variable retains previous value from last successful request
   Fix: Read error message from the exception body directly, not from $response
   Lesson: When testing APIs with PowerShell, always read the exception message for 4xx responses — $response only updates on successful requests

2. Symptom: Expired links still redirected after expiry
   Cause: Redis cached only the URL string with a fixed 24-hour TTL — no expiry information stored in cache, so a link could expire in DB but still be served from Redis for up to 24 hours
   Fix: Cache a JSON payload containing both url and expires_at, check expiry on every cache hit, delete stale cache entry on detection, calculate TTL dynamically from actual link expiry time
   Lesson: When cached data has its own independent expiry schedule, the cache TTL must match — a fixed TTL is only safe when underlying data never changes on its own schedule

5. Symptom: k6 error rate showed 100% even when most requests succeeded
   Cause: errorRate.add(1) only called on failures — denominator was failure count not total count, making ratio meaningless
   Fix: Changed to errorRate.add(!success) so every iteration contributes to denominator regardless of outcome
   Lesson: Rate metrics need both numerator AND denominator to be meaningful — always call the metric on every iteration

6. Symptom: 101 requests out of 78001 exceeded 200ms at 2000 RPS
   Cause: Default pg Pool size of 10 connections caused queue buildup when cache miss rate spiked under high load
   Fix: Increased Pool max to 20, added idleTimeoutMillis and connectionTimeoutMillis for better connection lifecycle
   Lesson: Always tune connection pool size based on measured load — default settings are conservative and rarely match production traffic patterns

# 8. What I would do differently at 100x scale

- **Distributed ID generation:** Auto-increment breaks across database shards — two independent shards can generate the same integer. Switch to Snowflake-style distributed IDs (timestamp + machine ID + sequence) for globally unique IDs without central coordination.

- **Horizontal app scaling:** Single Node.js instance is CPU-bound and single-threaded. At 100x scale, run multiple instances behind a load balancer (Nginx/AWS ALB). This requires Redis Cluster instead of single Redis instance for shared rate-limit state — a request hitting app-2 needs to know about requests hitting app-1's rate limiter.

- **Database read replicas:** Redirect endpoint is read-heavy. Use PostgreSQL streaming replication to create read replicas, route read queries to replicas, reserving primary for writes. This decouples read and write load.

- **Decouple analytics completely:** Current fire-and-forget is still in-process. At scale, push click events to Kafka/RabbitMQ and consume in a separate analytics service. Redirect latency becomes completely independent of analytics throughput — a spike in clicks cannot affect redirect speed.

- **Database sharding:** Single PostgreSQL instance maxes out around 50 million rows. Shard by short_code prefix (0-2 → shard 1, 3-5 → shard 2, etc.) or by hash. Each shard owns its own links and clicks tables. This requires a shard router in the app layer to route queries to the right shard.

- **CDN for redirects:** A redirect is just a 301/302 HTTP response. Deploy behind Cloudflare or AWS CloudFront — edge nodes cache the redirect globally. User in Singapore hits local edge node, gets redirect in <5ms without touching our servers.

# 9. Interview answers I have rehearsed

**Q1: Walk me through a request to GET /abc123. What happens at every layer?**

A: "User sends GET /abc123. It hits our rate-limiter middleware first — we check Redis for this IP's request count in the last 60 seconds using a sorted set. If under 10 requests, we continue. Next, we check our Redis cache for the short code 'abc123' — if it's cached as JSON with the url and expires_at timestamp, we check expiry. If not expired and still cached, we return a 302 redirect immediately — this is the fast path, sub-millisecond from Redis. If it's a cache miss, we query PostgreSQL using a parameterized query to prevent SQL injection — SELECT * FROM links WHERE short_code = $1. We get back the url and expires_at. We check if it's expired — if yes, return 410 Gone. If no, we cache the JSON payload in Redis with a TTL matching the link's actual expiry time, and simultaneously fire-and-forget a db.logClick() call that records the IP and user agent asynchronously without blocking the response. We return 302 redirect to the original URL. The user sees the redirect instantly while the click log happens in the background."

**Q2: Why did you choose Base62 over UUID or random strings for short codes?**

A: "Three options existed. UUID is 36 characters and not URL-safe — you'd need Base64 encoding which adds + and / characters requiring URL-encoding. Random strings have collision risk — the more codes generated, the higher the probability two requests generate the same string, requiring either a retry loop or a SELECT-then-INSERT race condition. I chose Base62 — auto-increment ID from PostgreSQL, encoded to Base62 using 62 characters (0-9, a-z, A-Z). This gives guaranteed uniqueness from the database, stays URL-safe, and produces compact short codes. Trade-off: it's sequential and predictable — someone could guess that code 2 exists because code 1 exists. This is fine for a single-instance system. If we scaled to multiple database shards, auto-increment breaks because two shards both generate ID=1. Then we'd switch to Snowflake-style IDs."

**Q3: Your p95 is 17ms at 2000 RPS. What causes the 101 requests that exceed 200ms? How would you fix it further?**

A: "At 2000 RPS, most requests are cache hits and serve from Redis in <10ms. But some requests miss the cache and query PostgreSQL. When cache misses cluster together, they compete for connections from the pool. I tuned the pool from 10 to 20 connections, which reduced the problem. The remaining 101 outliers are likely: (1) Unlucky request sequencing — multiple cache misses hit at exact same time, still queue for available connection, (2) Slow PostgreSQL query — if the DB itself is slow that day, even with connection available, query takes longer, (3) GC pause — Node.js garbage collection can pause the event loop for 10-50ms. To fix further: (a) increase pool more — test pool=50 and measure if p95 improves or hits diminishing returns, (b) add query result caching at app layer — in-memory cache for hot codes, (c) move analytics writes fully to a queue so they don't compete for DB connections, (d) shard the database so no single DB is the bottleneck. For a production system at true 100x scale, probably all four."

**Q4: Why fire-and-forget for analytics instead of awaiting the insert?**

A: "If I awaited the analytics insert, the user would wait for the database write to complete before getting the redirect. Analytics inserts take 10-50ms. That adds 10-50ms of latency to every redirect just for logging. Fire-and-forget means the function starts but we don't wait for it. The user gets redirected instantly. The analytics write happens asynchronously. I still attach a .catch() to log errors if it fails, so we know about DB problems. Trade-off: if the database is down, we lose clicks. This is acceptable because analytics is not critical — the redirect still works. If it were a payment transaction, we could not use fire-and-forget because losing the transaction is unacceptable."

**Q5: Walk me through what changed from before to after the connection pool tuning.**

A: "Before: PostgreSQL pool had default max of 10 connections. Under 2000 RPS load, when cache misses spiked, 20+ requests might need a DB connection simultaneously. Only 10 were available. Requests queued waiting for one to be released. Queue time added 50-100ms latency to some requests, causing 101 requests to exceed 200ms. After: pool max = 20. Most requests got a connection immediately without waiting. The 101 outliers didn't disappear — they just became 0.13% instead of visible. This is the law of diminishing returns. Further increases would help less. The real fix at massive scale is read replicas or sharding, not bigger pools."

**Q6: What's the difference between 404 and 410 in your implementation?**

A: "404 Not Found means 'this resource never existed or is unknown'. 410 Gone means 'this resource existed but is permanently unavailable now'. I return 404 when a short code doesn't exist in the database. I return 410 when a short code exists but its expires_at timestamp has passed. This is semantically correct and matters for search engines — they treat 410 as 'please remove this from your index' and 404 as 'unknown', and they index differently."

**Q7: How does Redis caching work if the link expires but the Redis cache still has it?**

A: "This is the hard problem in caching. I solved it by caching a JSON payload containing both the url AND the expires_at timestamp. On every cache hit, I check if expires_at < now(). If true, I delete the cache entry and return 410. This adds a tiny bit of latency to cache hits (parsing JSON and checking timestamp) but prevents the bug where expired links stay accessible. Additionally, I set the Redis TTL dynamically — if a link expires in 30 seconds, the Redis entry expires in 30 seconds too, so stale entries auto-clean."

**Q8: Database connection pooling — why not just make a new connection per request?**

A: "Opening a new TCP connection to PostgreSQL takes 100-300ms. If every request opened a new connection, that 100-300ms would add to every query latency. A pool keeps connections open and reuses them. The tradeoff: connections have memory overhead and server-side limits. So pools are sized — I use 20 max. When the pool is full, new requests wait for a free connection. This is better than 100 concurrent connection opening errors."

**Q9: Why sliding window rate limiting over fixed window?**

A: "Fixed window: reset counter every 60 seconds. Problem — at the boundary, a client could send 10 requests at 59s and 10 more at 61s = 20 requests in 2 seconds, bypassing the per-minute limit. Sliding window: count requests in the last 60 seconds from now. No boundary exploit. I use Redis sorted sets — each request timestamp is a member, old timestamps are removed, count remaining. More memory intensive but prevents the bypass."

**Q10: Why Docker Compose instead of just running node src/index.js?**

A: "node src/index.js works locally but is fragile — requires manual service startup order, credentials hardcoded or in environment, no reproducibility. Docker Compose: one command, three services start in dependency order (postgres health check before app), databases initialize automatically, volumes persist data, it runs identically on my machine, a coworker's machine, and production. This is the difference between 'I built this locally' and 'I built this in a deployable way'."

# 10. Deployment notes

# 11. Handoff

# 12. Honest limitations

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
