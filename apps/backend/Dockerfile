FROM node:20-alpine AS base
WORKDIR /app

# Copy workspace manifests
COPY package.json package-lock.json ./
COPY apps/backend/package.json ./apps/backend/
# Stub other workspace manifests so `npm ci -w apps/backend` resolves correctly
COPY apps/frontend/package.json ./apps/frontend/
COPY tools/package.json ./tools/

# Install only backend dependencies (production + dev for build)
RUN npm ci -w apps/backend

# Copy backend source
COPY apps/backend/src ./apps/backend/src
COPY apps/backend/tsconfig.json ./apps/backend/
COPY apps/backend/data ./apps/backend/data

# Build TypeScript
RUN npm run build -w apps/backend

# ---- Production image ----
FROM node:20-alpine AS production
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/
COPY tools/package.json ./tools/

# Install production deps only
RUN npm ci -w apps/backend --omit=dev

COPY --from=base /app/apps/backend/dist ./apps/backend/dist
COPY apps/backend/data ./apps/backend/data

EXPOSE 4000

CMD ["node", "apps/backend/dist/index.js"]
