# Stage 1: Dependencies and Build
FROM node:20-alpine AS builder

# Install system dependencies required for video processing and Prisma
RUN apk add --no-cache ffmpeg openssl libc6-compat git python3 make g++

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json* ./
COPY prisma ./prisma

# Install dependencies (using clean install)
RUN npm ci

# Copy the rest of the application code
COPY . .

# Generate Prisma Client and build the Next.js app
RUN npx prisma generate
RUN npm run build

# Stage 2: Production Runner
FROM node:20-alpine AS runner
WORKDIR /app

# Re-install runtime system dependencies
RUN apk add --no-cache ffmpeg openssl

ENV NODE_ENV=production

# Copy necessary files from the builder stage
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts

EXPOSE 3000

CMD ["npm", "run", "start"]
