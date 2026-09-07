// src/middleware/rateLimit.js
// Sliding window rate limiter using Redis sorted sets.
// Allows MAX_REQUESTS per WINDOW_SECONDS per IP address.
// Uses sorted sets where each member is a timestamp,
// so we can count only requests within the sliding window.

const { client } = require('../redis')

const WINDOW_SECONDS = 60        // 60 second window
const MAX_REQUESTS   = 10        // max requests per window per IP

async function rateLimit(req, res, next) {
  // Skip rate limiting during load tests
  if (process.env.DISABLE_RATE_LIMIT === 'true') {
    return next()
  }

  try {
    const ip  = req.ip
    const key = `ratelimit:${ip}`
    const now = Date.now()
    const windowStart = now - (WINDOW_SECONDS * 1000)

    // Step 1: Add current timestamp to this IP's sorted set
    // Score = timestamp, member = timestamp (both same value)
    await client.zAdd(key, { score: now, value: String(now) })

    // Step 2: Remove all timestamps older than the window
    // This is what makes it a SLIDING window — old entries disappear
    await client.zRemRangeByScore(key, 0, windowStart)

    // Step 3: Count remaining timestamps = requests in last 60 seconds
    const requestCount = await client.zCard(key)

    // Step 4: Set expiry so Redis auto-cleans idle IP keys
    await client.expire(key, WINDOW_SECONDS)

    // Step 5: Log for visibility
    console.log(`Rate check: ${ip} → ${requestCount}/${MAX_REQUESTS} requests in window`)

    // Step 6: Block if over limit
    if (requestCount > MAX_REQUESTS) {
      return res.status(429).json({
        error: 'Too many requests',
        message: `Rate limit exceeded. Max ${MAX_REQUESTS} requests per ${WINDOW_SECONDS} seconds.`,
        retryAfter: WINDOW_SECONDS
      })
    }

    // Step 7: Under limit — allow request to continue
    next()
  } catch (err) {
    // If Redis is down, fail open (allow the request)
    // Better to let requests through than to block everyone
    console.error('Rate limiter error:', err)
    next()
  }
}

module.exports = rateLimit
