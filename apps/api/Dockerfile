FROM node:22-alpine AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN apk add --no-cache openssl \
  && corepack enable \
  && corepack prepare pnpm@10.12.4 --activate

WORKDIR /workspace

FROM base AS build

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile --filter @fullstack-lab/api...

COPY apps/api apps/api
RUN pnpm --filter @fullstack-lab/api db:generate \
  && pnpm --filter @fullstack-lab/api build

FROM base AS production-dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile --prod --filter @fullstack-lab/api...

COPY apps/api/prisma apps/api/prisma
RUN pnpm --filter @fullstack-lab/api exec prisma generate

FROM node:22-alpine AS runtime

ENV NODE_ENV=production

RUN apk add --no-cache openssl

WORKDIR /workspace

COPY --from=production-dependencies /workspace/node_modules ./node_modules
COPY --from=production-dependencies /workspace/apps/api/node_modules ./apps/api/node_modules
COPY --from=production-dependencies /workspace/apps/api/package.json ./apps/api/package.json
COPY --from=production-dependencies /workspace/apps/api/prisma ./apps/api/prisma
COPY --from=build /workspace/apps/api/dist ./apps/api/dist

WORKDIR /workspace/apps/api
USER node

EXPOSE 3000

CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && exec node dist/main.js"]
