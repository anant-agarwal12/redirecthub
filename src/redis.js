require('dotenv').config()
const redis = require('redis')

const client = redis.createClient({
  url: process.env.REDIS_URL
})

client.on('error', (err) => {
  console.error('Redis error:', err)
})

client.connect().catch(err => {
  console.error('Failed to connect to Redis:', err)
  process.exit(1)
})

const metrics = {
  hits: 0,
  misses: 0
}

async function get(key) {
  try {
    const value = await client.get(key)
    if (value) {
      metrics.hits++
      console.log(`Cache HIT: ${key}`)
      return value
    } else {
      metrics.misses++
      console.log(`Cache MISS: ${key}`)
      return null
    }
  } catch (err) {
    console.error(`Cache get error for ${key}:`, err)
    metrics.misses++
    return null
  }
}

async function setWithTTL(key, value, ttlSeconds) {
  try {
    await client.setEx(key, ttlSeconds, value)
    console.log(`Cache SET: ${key} (TTL: ${ttlSeconds}s)`)
  } catch (err) {
    console.error(`Cache set error for ${key}:`, err)
  }
}

async function del(key) {
  try {
    await client.del(key)
    console.log(`Cache DELETE: ${key}`)
  } catch (err) {
    console.error(`Cache delete error for ${key}:`, err)
  }
}

function getMetrics() {
  const total = metrics.hits + metrics.misses
  const hitRatio = total === 0 ? 0 : ((metrics.hits / total) * 100).toFixed(2)
  return {
    hits: metrics.hits,
    misses: metrics.misses,
    total,
    hitRatio: hitRatio + '%'
  }
}

module.exports = { client, get, setWithTTL, del, getMetrics }
