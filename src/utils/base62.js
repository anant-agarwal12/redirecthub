// Converts a number into a Base62 string (0-9, a-z, A-Z).
// Used to turn a database auto-increment ID (e.g. 12345) into
// a short, URL-safe code (e.g. "3d7").
// Base62 is chosen over Base64 because Base64 includes '+' and '/'
// which need URL-encoding. Base62 is always URL-safe.

const CHARS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
const BASE = 62

function encode(num) {
  if (num === 0) return CHARS[0]
  let result = ''
  while (num > 0) {
    result = CHARS[num % BASE] + result
    num = Math.floor(num / BASE)
  }
  return result
}

function decode(str) {
  let num = 0
  for (let i = 0; i < str.length; i++) {
    num = num * BASE + CHARS.indexOf(str[i])
  }
  return num
}

module.exports = { encode, decode }
