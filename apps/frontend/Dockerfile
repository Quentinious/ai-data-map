FROM node:20-alpine AS build
WORKDIR /app

# Copy workspace manifests
COPY package.json package-lock.json ./
COPY apps/frontend/package.json ./apps/frontend/
COPY apps/backend/package.json ./apps/backend/
COPY tools/package.json ./tools/

# Install frontend dependencies
RUN npm ci -w apps/frontend

# Copy frontend source
COPY apps/frontend ./apps/frontend

# Build
RUN npm run build -w apps/frontend

# ---- Serve with nginx ----
FROM nginx:alpine AS production
COPY --from=build /app/apps/frontend/dist /usr/share/nginx/html

# Optional: custom nginx config for SPA routing
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 5173

CMD ["nginx", "-g", "daemon off;"]
