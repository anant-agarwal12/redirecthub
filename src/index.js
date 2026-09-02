// Entry point. Express server starts here.
// Phase 1: a bare Express server with three placeholder routes. No DB, no Redis yet.

// Load environment variables from the .env file into process.env.
// Must run before we read any process.env value below.
require('dotenv').config()

// Import the database module so we can run queries and test the connection.
const db = require('./db')

// Import the Base62 utility to encode numeric IDs into short alphanumeric codes.
const base62 = require('./utils/base62')

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
app.post('/shorten', async (req, res) => {
  try {
    const { url } = req.body
    if (!url) {
      return res.status(400).json({ error: 'url is required' })
    }

    // Insert with a temporary short_code, get back the auto-generated id
    const inserted = await db.createLink('temp', url)
    const shortCode = base62.encode(inserted.id)

    // Update the row with the real short_code now that we have the id
    await db.query(
      'UPDATE links SET short_code = $1 WHERE id = $2',
      [shortCode, inserted.id]
    )

    res.status(201).json({
      short_code: shortCode,
      original_url: url,
      short_url: `http://localhost:${PORT}/${shortCode}`
    })
  } catch (err) {
    console.error('Error in POST /shorten:', err)
    res.status(500).json({ error: 'Failed to create short link' })
  }
})

// GET /:code
// Looks up the short code in the database and redirects.
// Returns 404 if no matching link exists.
app.get('/:code', async (req, res) => {
  try {
    const link = await db.getLink(req.params.code)
    if (!link) {
      return res.status(404).json({ error: 'Link not found' })
    }
    res.redirect(link.original_url)
  } catch (err) {
    console.error('Error in GET /:code:', err)
    res.status(500).json({ error: 'Failed to retrieve link' })
  }
})

// Start server, then immediately test database connection.
// If database is unreachable, we know before any request comes in.
const PORT = process.env.PORT || 3000
app.listen(PORT, async () => {
  console.log('Server running on port ' + PORT)
  await db.testConnection()
})
