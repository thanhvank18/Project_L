# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
RUN npm install --global pnpm@11.25.0
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORTAL_API_HOST=0.0.0.0 \
    PORTAL_DB_PATH=/data/portal.sqlite
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json ./
COPY server ./server
COPY shared ./shared
COPY content/starter ./content/starter
# Railway mounts volumes as root. Keep data outside the image; attach /data in
# the hosting dashboard. Never copy a developer's .local directory into an image.
RUN mkdir -p /data
EXPOSE 4003
CMD ["node", "--experimental-strip-types", "server/index.ts"]
