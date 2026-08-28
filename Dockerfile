FROM node:22-alpine AS frontend
WORKDIR /build
COPY package.json package-lock.json* ./
RUN npm install
COPY frontend ./frontend
COPY vite.config.ts tsconfig.json ./
RUN npm run build

FROM rust:1.88-alpine AS backend
ARG BUILD_SHA=dev
WORKDIR /build
RUN apk add --no-cache musl-dev sqlite-dev
COPY Cargo.toml Cargo.lock* ./
COPY src ./src
RUN cargo build --release

FROM alpine:3.22
ARG BUILD_SHA=dev
ENV BUILD_SHA=$BUILD_SHA PORT=8080 DATA_DIR=/data
RUN apk add --no-cache libgcc sqlite-libs && addgroup -S ledger && adduser -S -G ledger ledger && mkdir -p /data /app && chown -R ledger:ledger /data /app
WORKDIR /app
COPY --from=backend /build/target/release/agent-capacity-ledger /app/server
COPY --from=frontend /build/dist /app/dist
USER ledger
EXPOSE 8080
ENTRYPOINT ["/app/server"]
