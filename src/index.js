// Entry point. Express server starts here.
// Phase 1: a bare Express server with three placeholder routes. No DB, no Redis yet.

// Load environment variables from the .env file into process.env.
// Must run before we read any process.env value below.
require('dotenv').config()

// Import the database module so we can run queries and test the connection.
const db = require('./db')

// Import the Base62 utility to encode numeric IDs into short alphanumeric codes.
const base62 = require('./utils/base62')

// Import the Redis caching module for read-through cache patterns and metrics.
const cache = require('./redis')

// Import the rate limiting middleware for sliding window rate limiting.
const rateLimit = require('./middleware/rateLimit')

// Import the Express library and create an application instance.
// `app` is the object we attach middleware and routes to.
const express = require('express')
const app = express()

// Parse incoming request bodies that have a JSON Content-Type.
// After this line, JSON sent by a client is available as req.body.
app.use(express.json())

// Health check route. Confirms the server is up and responding.
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'RedirectHub is running' })
})

// POST /shorten
// Flow: insert URL with a placeholder short_code first to get an ID,
// then Base62-encode that ID and update the row with the real code.
// This two-step approach guarantees no collisions since IDs are
// always unique (auto-increment).
app.post('/shorten', rateLimit, async (req, res) => {
  try {
    const { url, expiryDays } = req.body
    if (!url) {
      return res.status(400).json({ error: 'url is required' })
    }

    // Insert with a temporary short_code, get back the auto-generated id
    const inserted = await db.createLink('temp', url)
    const shortCode = base62.encode(inserted.id)

    // Update the row with the real short_code and optional expiry
    if (expiryDays) {
      const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000)
      await db.query(
        'UPDATE links SET short_code = $1, expires_at = $2 WHERE id = $3',
        [shortCode, expiresAt, inserted.id]
      )
    } else {
      await db.query(
        'UPDATE links SET short_code = $1 WHERE id = $2',
        [shortCode, inserted.id]
      )
    }

    res.status(201).json({
      short_code: shortCode,
      original_url: url,
      expires_at: expiryDays ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000) : null,
      short_url: `http://localhost:${PORT}/${shortCode}`
    })
  } catch (err) {
    console.error('Error in POST /shorten:', err)
    res.status(500).json({ error: 'Failed to create short link' })
  }
})

app.get('/:code', rateLimit, async (req, res) => {
  try {
    const { code } = req.params

    // Check cache — stored as JSON with url and expires_at
    const cachedData = await cache.get(code)
    if (cachedData) {
      const parsed = JSON.parse(cachedData)

      // Check expiry even on cache hit
      if (parsed.expires_at && new Date(parsed.expires_at) < new Date()) {
        await cache.del(code) // remove stale cache entry
        return res.status(410).json({ error: 'Link has expired' })
      }

      db.logClick(code, req.ip, req.headers['user-agent'])
        .catch(err => console.error('Failed to log click:', err))

      return res.redirect(parsed.url)
    }

    // Cache miss — query database
    const linkData = await db.getLink(code)

    if (linkData && linkData.expired) {
      return res.status(410).json({ error: 'Link has expired' })
    }

    if (!linkData) {
      return res.status(404).json({ error: 'Link not found' })
    }

    // Calculate TTL: use time until expiry or 24 hours default
    let ttlSeconds = 24 * 60 * 60
    if (linkData.expires_at) {
      const msUntilExpiry = new Date(linkData.expires_at) - new Date()
      ttlSeconds = Math.floor(msUntilExpiry / 1000)
    }

    // Cache as JSON so we can check expiry on cache hit
    const cachePayload = JSON.stringify({
      url: linkData.original_url,
      expires_at: linkData.expires_at || null
    })
    await cache.setWithTTL(code, cachePayload, ttlSeconds)

    db.logClick(code, req.ip, req.headers['user-agent'])
      .catch(err => console.error('Failed to log click:', err))

    res.redirect(linkData.original_url)
  } catch (err) {
    console.error('Error in GET /:code:', err)
    res.status(500).json({ error: 'Failed to retrieve link' })
  }
})

app.get('/metrics/cache', (req, res) => {
  const metrics = cache.getMetrics()
  res.json({
    message: 'Cache performance metrics',
    ...metrics
  })
})

// Start server, then immediately test database connection.
// If database is unreachable, we know before any request comes in.
const PORT = process.env.PORT || 3000
app.listen(PORT, async () => {
  console.log('Server running on port ' + PORT)
  await db.testConnection()
})
