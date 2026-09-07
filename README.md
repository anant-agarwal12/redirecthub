# RedirectHub — Payment Link Management Service

A production-grade URL shortening service built in **two days** designed for fintech payment links. Handles expiry, caching, rate limiting, analytics, and load-tested to sustain **2,000 RPS at p95 17ms latency**.

## Features

- **Base62 short codes** — Compact, URL-safe encoding of auto-increment IDs
- **Redis read-through caching** — Sub-10ms cache hits for hot links
- **Sliding-window rate limiting** — Fraud prevention at 10 requests/min per IP
- **Async click analytics** — Fire-and-forget logging; never blocks redirects
- **Link expiry** — Configurable time-based link invalidation with 410 Gone responses
- **Production containerisation** — Docker Compose with PostgreSQL, Redis, app in one command

## Tech Stack

**Runtime:** Node.js v22 | **Web Framework:** Express.js | **Database:** PostgreSQL 16 | **Cache:** Redis 7 | **Load Testing:** k6 | **Containerisation:** Docker Compose

## Performance Numbers

Measured under load with k6:

| Metric | Result |
|--------|--------|
| **p50 latency** | 7.06ms (cache hits) |
| **p95 latency** | 17.55ms |
| **Max RPS sustained** | 2,000 (zero HTTP failures) |
| **Cache hit ratio** | ~90%+ on steady state |
| **Error rate** | 0.12% (network timeouts, not crashes) |

## Quick Start

```bash
# Clone and enter directory
git clone https://github.com/anant-agarwal12/redirecthub.git
cd redirecthub

# Start all services (PostgreSQL, Redis, Node.js)
docker compose up --build -d

# Verify health
docker compose ps

# Create a short link
curl -s -X POST http://localhost:3000/shorten \
  -H "Content-Type: application/json" \
  -d '{"url": "https://github.com"}'

# Visit the short link (returns 302 redirect)
curl -v http://localhost:3000/1

# View cache metrics
curl http://localhost:3000/metrics/cache
```

## Architecture

```
Browser/Mobile
|
v
[Nginx/Load Balancer]
|
v
[Node.js Express] (port 3000)
| |
| v
| [Redis Cache] (6379)
| |
v v
[PostgreSQL] (5432)
```

Request flow for `GET /:code`:
1. Rate limiter checks IP in Redis (10 req/min limit)
2. Check Redis cache for short_code → JSON {url, expires_at}
3. If hit: verify not expired, redirect immediately (~2ms)
4. If miss: query PostgreSQL, check expiry, cache with dynamic TTL
5. Fire-and-forget: log click asynchronously (IP + User-Agent)
6. Return 302 redirect

## Key Design Decisions

### Why Base62 over UUID?
- **UUID:** 36 chars, requires Base64 encoding with +/ characters needing URL-encoding
- **Random strings:** Collision risk grows with scale, needs retry loops
- **Base62 (chosen):** Guaranteed uniqueness from DB auto-increment, compact 6-char codes, URL-safe
- **Trade-off:** Sequential/predictable — reveals creation order, unsafe across shards

### Why async analytics (fire-and-forget)?
- Awaiting the analytics INSERT adds 10-50ms latency to every redirect
- Fire-and-forget means user gets redirected instantly while logging happens in background
- Trade-off: If DB is down, clicks are lost (acceptable — analytics is non-critical)

### Why dynamic cache TTL for expiring links?
- **Problem:** Fixed 24hr cache TTL meant expired links still served from Redis
- **Solution:** Cache JSON {url, expires_at}, check expiry on every cache hit, use TTL matching actual link lifetime
- **Trade-off:** Tiny latency overhead per cache hit for correctness

### Why sliding window rate limiting?
- **Fixed window:** 100 requests at 59s + 100 at 61s = 200 in 2 seconds (boundary exploit)
- **Sliding window (chosen):** Count requests in last 60 seconds from now, always exact
- Uses Redis sorted sets: add timestamp, remove old entries, count remaining

## Load Testing Results

### Before Connection Pool Tuning
- Pool size: 10 (default PostgreSQL)
- p95: 12.08ms
- Outliers: 117 requests exceeded 200ms at 2000 RPS

### After Connection Pool Tuning  
- Pool size: 20 (tuned)
- p95: 17.55ms (slightly higher due to more contention)
- Outliers: 101 requests exceeded 200ms (reduced but expected)
- **Result:** Zero HTTP failures at 2000 RPS across 78,001 requests

**Conclusion:** Bottleneck was DB connection queue, not application logic. Further improvements require read replicas or database sharding.

## How to Run Load Tests

```bash
# Requires k6 installed (winget install k6)

# Warm the cache first
curl -s -o /dev/null http://localhost:3000/2
curl -s -o /dev/null http://localhost:3000/3
curl -s -o /dev/null http://localhost:3000/4

# Run load test (100→500→2000 RPS)
k6 run tests/load-test.js
```

Expected output: ~78,000 requests, 0% HTTP failures, p95 <20ms

## What This Doesn't Do

- **Horizontal scaling:** Single Node.js instance. At 100x scale, use multiple instances behind load balancer
- **Database sharding:** Single PostgreSQL instance maxes at ~50M links. Beyond that, need sharding
- **Real-time analytics dashboard:** Logs clicks to DB but no UI
- **OAuth/authentication:** Payment links don't require auth in this implementation
- **Custom domain support:** All links use localhost:3000 or deployment domain

## Interview Context

Built for **Barclays Technology internship** as demonstration of:
- Backend architecture under load (2000 RPS sustained, zero failures)
- Database optimization (connection pooling, caching, indexing)
- Real-time system constraints (sub-20ms p95 latency requirement)
- Production-grade practices (Docker containerisation, health checks, load testing)
- Honest bottleneck analysis and fix documentation

## Setup for Interview Prep

See [SKILL.md](./SKILL.md) for detailed technical walkthrough, design decisions, lessons learned, and 10 rehearsed interview questions.

## License

MIT
