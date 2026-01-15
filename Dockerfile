# =============================================================================
# Grow Fortress - Server Dockerfile
# For deployment on Railway
# =============================================================================

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace configuration
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY tsconfig.base.json ./

# Copy package.json files for all packages
COPY packages/protocol/package.json ./packages/protocol/
COPY packages/sim-core/package.json ./packages/sim-core/
COPY apps/server/package.json ./apps/server/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/protocol ./packages/protocol
COPY packages/sim-core ./packages/sim-core
COPY apps/server ./apps/server

# Build packages in dependency order
RUN pnpm --filter @arcade/protocol build
RUN pnpm --filter @arcade/sim-core build

# Generate Prisma client
RUN pnpm --filter @arcade/server exec prisma generate

# Build server
RUN pnpm --filter @arcade/server build

# =============================================================================
# Production stage
# =============================================================================
FROM node:20-alpine AS production

WORKDIR /app

# Install pnpm for running the app
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace configuration
COPY --from=builder /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/package.json ./

# Copy built packages
COPY --from=builder /app/packages/protocol/package.json ./packages/protocol/
COPY --from=builder /app/packages/protocol/dist ./packages/protocol/dist

COPY --from=builder /app/packages/sim-core/package.json ./packages/sim-core/
COPY --from=builder /app/packages/sim-core/dist ./packages/sim-core/dist

COPY --from=builder /app/apps/server/package.json ./apps/server/
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/prisma ./apps/server/prisma

# Copy node_modules (production dependencies)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/protocol/node_modules ./packages/protocol/node_modules
COPY --from=builder /app/packages/sim-core/node_modules ./packages/sim-core/node_modules
COPY --from=builder /app/apps/server/node_modules ./apps/server/node_modules

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start server
WORKDIR /app/apps/server
CMD ["node", "--experimental-specifier-resolution=node", "dist/index.js"]

