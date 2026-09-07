// src/db.js
// Manages the PostgreSQL connection pool for the entire app.
// All database queries go through this file.

require('dotenv').config()
const { Pool } = require('pg')

// Create a connection pool.
// A pool keeps several connections open and reuses them.
// Much faster than opening a new connection for every request.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
})

// If the pool encounters an unexpected error on an idle connection,
// log it and exit. Prevents silent failures.
pool.on('error', (err) => {
  console.error('Unexpected database error:', err)
  process.exit(-1)
})

// query() is the single function the rest of the app uses to
// talk to the database.
// text   = the SQL string with $1, $2 placeholders
// params = the actual values that replace $1, $2
// Using $1/$2 instead of string concatenation prevents SQL injection.
async function query(text, params) {
  const start = Date.now()
  const result = await pool.query(text, params)
  const duration = Date.now() - start
  console.log('Query:', { text, duration: duration + 'ms', rows: result.rowCount })
  return result.rows
}

// testConnection() runs once on startup to confirm the database
// is reachable before we start accepting requests.
async function testConnection() {
  const rows = await query('SELECT NOW() as time')
  console.log('Database connected at:', rows[0].time)
}

// createLink inserts a new row and returns the created row.
// RETURNING * tells Postgres to hand back the full inserted row,
// including the auto-generated id and created_at — saves us
// a second query to fetch what we just inserted.
async function createLink(shortCode, originalUrl) {
  const rows = await query(
    'INSERT INTO links (short_code, original_url) VALUES ($1, $2) RETURNING *',
    [shortCode, originalUrl]
  )
  return rows[0]
}

// getLink looks up a link by its short_code.
// Returns undefined if no row matches — the caller checks for that.
async function getLink(shortCode) {
  const rows = await query(
    'SELECT * FROM links WHERE short_code = $1',
    [shortCode]
  )
  return rows[0]
}

// Logs a click event. Called WITHOUT await from the route handler
// so it never blocks the redirect response.
async function logClick(shortCode, ipAddress, userAgent) {
  await query(
    'INSERT INTO clicks (short_code, ip_address, user_agent) VALUES ($1, $2, $3)',
    [shortCode, ipAddress, userAgent]
  )
}

module.exports = { query, testConnection, createLink, getLink, logClick }
