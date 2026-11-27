# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build && npm prune --omit=dev

FROM node:24-bookworm-slim AS runtime

ARG ORACLE_INSTANTCLIENT_URL=https://download.oracle.com/otn_software/linux/instantclient/instantclient-basic-linuxx64.zip

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      libaio1 \
      ca-certificates \
      tzdata \
      curl \
      unzip && \
    mkdir -p /opt/oracle && \
    curl -fsSL -o /tmp/instantclient.zip "${ORACLE_INSTANTCLIENT_URL}" && \
    unzip -q /tmp/instantclient.zip -d /opt/oracle && \
    rm -f /tmp/instantclient.zip && \
    mv /opt/oracle/instantclient_* /opt/oracle/instantclient && \
    echo "/opt/oracle/instantclient" > /etc/ld.so.conf.d/oracle-instantclient.conf && \
    ldconfig && \
    ln -snf /usr/share/zoneinfo/America/Bogota /etc/localtime && \
    echo "America/Bogota" > /etc/timezone && \
    apt-get purge -y --auto-remove curl unzip && \
    rm -rf /var/lib/apt/lists/* /tmp/*

ENV NODE_ENV=production \
    PORT=4000 \
    TZ=America/Bogota \
    ORACLE_CLIENT_LIB_DIR=/opt/oracle/instantclient \
    LD_LIBRARY_PATH=/opt/oracle/instantclient

WORKDIR /app

RUN mkdir -p /app/data && chown -R node:node /app

COPY --from=builder --chown=node:node /app/package.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist

USER node

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/index.js"]
