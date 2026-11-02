# DocRequest API and worker (same image; the worker runs `node dist/worker.js`).
# Build from the repo root: docker build -f apps/api/Dockerfile .
FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
# Full install: the root holds TypeScript and other shared build tools.
RUN pnpm install --frozen-lockfile
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @docrequest/shared build && pnpm --filter @docrequest/api build

# One-shot migrations (has the Prisma CLI). Used by the "migrate" service in docker-compose.yml.
FROM build AS migrate
WORKDIR /repo/apps/api
CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]

# Production dependencies only, plus the built code.
FROM build AS deploy
RUN pnpm --filter @docrequest/api deploy --prod --legacy /out

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deploy --chown=node:node /out ./
RUN mkdir -p /app/storage && chown node:node /app/storage
USER node
EXPOSE 8120
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:'+(process.env.API_PORT||8120)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
