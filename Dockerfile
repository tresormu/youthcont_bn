# syntax = docker/dockerfile:1

ARG NODE_VERSION=18.16.0
FROM node:${NODE_VERSION}-slim as base

LABEL andasy_launch_runtime="NodeJS"

WORKDIR /app


# Build stage
FROM base as build

RUN apt-get update -qq && \
    apt-get install -y python-is-python3 pkg-config build-essential 

COPY --link package.json package-lock.json ./
RUN npm ci

COPY --link . .
RUN npm run build
RUN npm prune --production


# Final stage
FROM base
ENV NODE_ENV=production
COPY --from=build /app /app

EXPOSE 5000
CMD ["node", "dist/server.js"]