# ParkPulse Production Container Image
FROM node:20-alpine AS base

# Install curl for container health check
RUN apk add --no-cache curl

# Create application directory
WORKDIR /usr/src/app

# Set production environment
ENV NODE_ENV=production
ENV PORT=5000

# Install dependencies with locked versions
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy application source code
COPY . .

# Run as non-root node user for container security
USER node

# Expose default HTTP application port
EXPOSE 5000

# Container liveness check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:${PORT:-5000}/health || exit 1

# Production startup
CMD ["npm", "start"]

