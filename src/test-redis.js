const redis = require('redis')

const client = redis.createClient({
  url: 'redis://localhost:6379'
})

client.on('error', (err) => console.error('Error:', err))
client.on('connect', () => console.log('Connected to Redis'))

client.connect()
  .then(() => {
    console.log('Redis connection successful')
    process.exit(0)
  })
  .catch((err) => {
    console.error('Failed to connect:', err)
    process.exit(1)
  })
