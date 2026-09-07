# Stage 1: Build stage
# Use full Node image to install dependencies
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files first (Docker layer caching — only reinstalls
# deps when package.json changes, not on every code change)
COPY package*.json ./

RUN npm ci --only=production

# Stage 2: Production stage
# Use slim Alpine image — much smaller than full Node image
FROM node:22-alpine AS production

WORKDIR /app

# Copy only production dependencies from builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy application source code
COPY src/ ./src/
COPY .env.example ./.env.example

# Create non-root user for security (never run containers as root)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000

# Health check so Docker knows when app is ready
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

CMD ["node", "src/index.js"]
