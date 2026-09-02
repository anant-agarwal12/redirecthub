// Entry point. Express server starts here.
// Phase 1: a bare Express server with three placeholder routes. No DB, no Redis yet.

// Load environment variables from the .env file into process.env.
// Must run before we read any process.env value below.
require('dotenv').config()

// Import the database module so we can run queries and test the connection.
const db = require('./db')

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

// Create-a-short-URL route. Not built yet — for now it just echoes
// what was received so we can see the request body during development.
app.post('/shorten', (req, res) => {
  console.log('POST /shorten hit')
  console.log(req.body)
  res.json({ message: 'not implemented yet' })
})

// Redirect route. ":code" is a URL parameter — a placeholder in the path
// whose actual value is read from req.params.code (e.g. GET /abc123 → code is "abc123").
app.get('/:code', (req, res) => {
  console.log('GET /:code hit, code is: ' + req.params.code)
  res.json({ message: 'redirect not implemented yet', code: req.params.code })
})

// Start server, then immediately test database connection.
// If database is unreachable, we know before any request comes in.
const PORT = process.env.PORT || 3000
app.listen(PORT, async () => {
  console.log('Server running on port ' + PORT)
  await db.testConnection()
})
