# Stage 1: Builder
FROM node:20-alpine AS builder

# Install system dependencies
RUN apk add --no-cache ffmpeg openssl libc6-compat git python3 make g++

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json* ./
COPY prisma ./prisma

# Install dependencies
RUN npm ci

# Copy source code and build
COPY . .
RUN npx prisma generate
RUN npm run build

# Stage 2: Runner
FROM node:20-alpine AS runner
WORKDIR /app

# Re-install runtime system dependencies (ffmpeg is crucial for YumCut)
RUN apk add --no-cache ffmpeg openssl bash

ENV NODE_ENV=production

# Copy built assets and dependencies from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/next.config.* ./

# Create the media directory
RUN mkdir -p /app/media

EXPOSE 3000

CMD ["npm", "run", "start"]
