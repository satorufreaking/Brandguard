# Multi-stage Dockerfile for BrandGuard AI Enterprise Deployment
# Stage 1: Build the React frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Build the Express backend
FROM node:20-alpine AS backend-runner
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server/ ./

# Copy built frontend assets to server public directory for single-origin serving
COPY --from=frontend-builder /app/dist /app/server/public

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

CMD ["node", "index.js"]
