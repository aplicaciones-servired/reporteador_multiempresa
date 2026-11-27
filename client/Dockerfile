# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS builder

WORKDIR /app

ARG PUBLIC_API_URL=/api
ARG PUBLIC_LOGIN_API_URL=/apilogin
ENV PUBLIC_API_URL=${PUBLIC_API_URL} \
    PUBLIC_LOGIN_API_URL=${PUBLIC_LOGIN_API_URL} \
    ASTRO_TELEMETRY_DISABLED=1

COPY client/package.json client/package-lock.json ./
RUN npm ci

COPY client/ ./
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

COPY --chown=nginx:nginx nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=builder --chown=nginx:nginx /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null 2>&1 || exit 1
