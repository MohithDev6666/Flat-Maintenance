FROM golang:1.25-alpine AS build

WORKDIR /src
COPY . .
RUN go mod download
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

FROM alpine:3.22

RUN apk add --no-cache ca-certificates \
    && addgroup -S app \
    && adduser -S -G app app \
    && mkdir -p /app/logs \
    && chown -R app:app /app
WORKDIR /app
COPY --from=build --chown=app:app /out/server ./server

USER app
EXPOSE 8080
ENTRYPOINT ["/app/server"]
