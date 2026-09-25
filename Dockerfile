# syntax=docker/dockerfile:1

FROM node:26-slim AS base
# corepack is no longer bundled with the Node 26 images, so it is installed
# rather than just enabled. It stays in the picture because it resolves the
# version pinned in package.json's packageManager field, which keeps that pin
# the single place the pnpm version is written down.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN npm install -g corepack@latest && corepack enable
WORKDIR /app


FROM base AS deps
# This repo is a pnpm workspace and tools/eslint-preset is linked as
# workspace:*. Without pnpm-workspace.yaml and the tools manifests present,
# pnpm cannot resolve that protocol and fails in a way that reads like a
# lockfile problem.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tools/eslint-preset/package.json ./tools/eslint-preset/
RUN pnpm install --frozen-lockfile


FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/tools ./tools
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build


FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Next binds to localhost by default, which is unreachable from outside the
# container — Traefik would get a connection refused on every request.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# The node image ships an unprivileged `node` user; run as that rather than root.
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node
EXPOSE 3000

# Node 26 has a global fetch, so this needs no curl — which the slim image
# does not carry.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
