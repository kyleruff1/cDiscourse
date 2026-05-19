# HOST-001 — Cloud Run image for cdiscourse-dev.
#
# Two-stage build:
#   Stage 1 (builder)  : node:22-alpine → runs `expo export --platform web`.
#   Stage 2 (runtime)  : gcr.io/distroless/nodejs22-debian12:nonroot → serves dist/.
#
# Doctrine encoded here:
#   - No `--allow-unauthenticated`. That belongs to the gcloud run deploy command,
#     not to the image. The image is environment-agnostic.
#   - No SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, XAI_API_KEY, X_BEARER_TOKEN,
#     RESEND_API_KEY referenced anywhere. Those NEVER appear in the bundle nor in
#     Cloud Run env. They live in Supabase Function secrets only.
#   - EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY are NOT baked
#     in. Cloud Run binds them at container start via --set-secrets=, and the
#     runtime stage writes them into dist/runtime-env.js for the SPA bootstrap.
#   - Build args carry build-time identity (commit SHA, version, timestamp,
#     deploy env, app URL). These ARE baked in; they identify the image.
#   - Distroless runtime: no shell, no package manager, runs as nonroot.

# Stage 1 — builder ----------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Build args (forwarded by the deploy script; see infra/cloud-run/*.yaml).
ARG BUILD_COMMIT_SHA="unknown"
ARG BUILD_VERSION="unknown"
ARG BUILD_TIMESTAMP="unknown"
ARG EXPO_PUBLIC_DEPLOY_ENV="dev"
ARG EXPO_PUBLIC_APP_URL="https://dev.cdiscourse.com"
ARG EXPO_PUBLIC_REPORT_ISSUE_URL="https://github.com/kyleruff1/cDiscourse/issues"

# Install deps with the lockfile. --ignore-scripts skips native postinstall
# scripts that would not run in this layer anyway.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --legacy-peer-deps

# Source tree (the .dockerignore alongside this file scopes what comes through).
COPY . .

# Bake build-time-only EXPO_PUBLIC_* vars into the bundle. These are immutable
# per image and identify the image. Runtime-specific env (Supabase URL +
# publishable key) is NOT set here.
ENV EXPO_PUBLIC_DEPLOY_ENV=${EXPO_PUBLIC_DEPLOY_ENV}
ENV EXPO_PUBLIC_APP_URL=${EXPO_PUBLIC_APP_URL}
ENV EXPO_PUBLIC_COMMIT_HASH=${BUILD_COMMIT_SHA}
ENV EXPO_PUBLIC_BUILD_VERSION=${BUILD_VERSION}
ENV EXPO_PUBLIC_REPORT_ISSUE_URL=${EXPO_PUBLIC_REPORT_ISSUE_URL}

# Expo Web build. Output goes to ./dist by Expo's default.
RUN npx expo export --platform web --output-dir dist

# Stage 2 — runtime ----------------------------------------------------------
FROM gcr.io/distroless/nodejs22-debian12:nonroot AS runtime

WORKDIR /app

# Vendor serve (pinned in package.json to an exact 14.x.x version) at build
# time. The runtime image must be reproducible — never `npx serve` at start.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY scripts/runtime/server.mjs ./server.mjs

# OCI labels for Artifact Registry traceability.
ARG BUILD_COMMIT_SHA="unknown"
ARG BUILD_VERSION="unknown"
ARG BUILD_TIMESTAMP="unknown"
LABEL org.opencontainers.image.source="https://github.com/kyleruff1/cDiscourse"
LABEL org.opencontainers.image.revision=${BUILD_COMMIT_SHA}
LABEL org.opencontainers.image.version=${BUILD_VERSION}
LABEL org.opencontainers.image.created=${BUILD_TIMESTAMP}
LABEL org.opencontainers.image.title="cdiscourse-web"
LABEL org.opencontainers.image.description="CDiscourse Expo Web static bundle (dev)"
LABEL cdiscourse.card="HOST-001"

# Cloud Run convention: services listen on $PORT (defaults to 8080).
EXPOSE 8080
USER nonroot

# Distroless ENTRYPOINT is `/nodejs/bin/node`; CMD is the script to run.
CMD ["server.mjs"]
