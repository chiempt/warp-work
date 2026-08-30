# Build from the repository root:
#   docker build -f apps/api/Dockerfile .
FROM golang:1.25-alpine AS build

WORKDIR /src

# Dependencies first so a source change does not re-download the module cache.
COPY go.mod go.sum ./
RUN go mod download

COPY . .

# CGO off and a trimmed path: the result is a static binary with no build
# machine paths baked into it.
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/api ./apps/api/cmd/api

FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=build /out/api /api

USER nonroot:nonroot
ENTRYPOINT ["/api"]
