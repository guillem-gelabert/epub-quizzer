# Build stage
FROM node:22 AS builder

WORKDIR /app

# Install OpenSSL and other dependencies for Prisma
RUN apt-get update && apt-get install -y \
    openssl \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

# Install dependencies
RUN npm ci

# Copy source code (excluding files in .dockerignore)
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# Production stage
FROM node:22 AS runner

WORKDIR /app

# Install wget and OpenSSL for healthcheck and Prisma
RUN apt-get update && apt-get install -y \
    wget \
    openssl \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Install production dependencies only
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --only=production && \
    npx prisma generate

# Copy built application from builder
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/prompts ./prompts

# Create non-root user
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs nuxtjs

# Change ownership
RUN chown -R nuxtjs:nodejs /app

USER nuxtjs

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

CMD ["node", ".output/server/index.mjs"]

