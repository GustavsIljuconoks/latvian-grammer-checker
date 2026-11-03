# One image: the API server, which also serves the built web app (CLIENT_DIR).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
RUN npm ci
COPY . .
# Vite bakes the Clerk publishable key into the client while building.
ARG VITE_CLERK_PUBLISHABLE_KEY
RUN test -n "$VITE_CLERK_PUBLISHABLE_KEY" || (echo "VITE_CLERK_PUBLISHABLE_KEY is missing from .env" >&2 && exit 1)
RUN npm run build -w client

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production CLIENT_DIR=/app/client/dist PORT=3001
COPY --from=build /app /app
EXPOSE 3001
CMD ["node_modules/.bin/tsx", "server/src/index.ts"]
