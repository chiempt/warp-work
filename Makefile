# Warp — developer commands.
#
# Tooling (goose, sqlc, oapi-codegen) is pinned in go.mod as tool dependencies,
# so `go tool <name>` runs the same version for everyone. Nothing needs to be
# installed globally except Go, pnpm, and Docker.

SHELL := /bin/bash
ENV_FILE := infra/.env
MIGRATIONS := db/migrations

# Hand-written Go, excluding sqlc output and the frontend's dependencies. Uses
# find rather than `git ls-files` so it works before the first commit.
GO_SOURCES := $(shell find . -name '*.go' -not -path './internal/store/*' -not -path './apps/web/*')

# Load infra/.env when it exists, so make targets see DATABASE_URL.
ifneq (,$(wildcard $(ENV_FILE)))
include $(ENV_FILE)
export
endif

.DEFAULT_GOAL := help

## help: list available targets
.PHONY: help
help:
	@grep -hE '^## ' $(firstword $(MAKEFILE_LIST)) \
		| sed 's/^## //' \
		| awk 'match($$0, /:/) {printf "  \033[36m%-16s\033[0m %s\n", substr($$0, 1, RSTART-1), substr($$0, RSTART+2)}'

# --- setup -----------------------------------------------------------------

## setup: one-time machine setup — env file, database, migrations
.PHONY: setup
setup: env db-create migrate-up
	@echo "ready: make run-api"

## env: create infra/.env from the example with a fresh encryption key
.PHONY: env
env:
	@test ! -f $(ENV_FILE) || { echo "$(ENV_FILE) already exists; not overwriting"; exit 1; }
	@sed 's|^CREDENTIALS_ENCRYPTION_KEY=.*|CREDENTIALS_ENCRYPTION_KEY='"$$(openssl rand -base64 32)"'|' \
		infra/.env.example > $(ENV_FILE)
	@echo "wrote $(ENV_FILE) with a generated encryption key"

## tidy: sync go.mod and go.sum
.PHONY: tidy
tidy:
	go mod tidy

# --- code generation -------------------------------------------------------

## generate: regenerate sqlc queries and the OpenAPI bindings
.PHONY: generate
generate: sqlc

## sqlc: regenerate internal/store from db/migrations and db/queries
.PHONY: sqlc
sqlc:
	go tool sqlc generate

# --- database --------------------------------------------------------------

## migrate-up: apply pending migrations
.PHONY: migrate-up
migrate-up: require-db
	@go tool goose -dir $(MIGRATIONS) postgres "$(DATABASE_URL)" up

## migrate-down: roll back the most recent migration
.PHONY: migrate-down
migrate-down: require-db
	@go tool goose -dir $(MIGRATIONS) postgres "$(DATABASE_URL)" down

## migrate-status: show which migrations have been applied
.PHONY: migrate-status
migrate-status: require-db
	@go tool goose -dir $(MIGRATIONS) postgres "$(DATABASE_URL)" status

## migrate-new: scaffold a migration — make migrate-new name=add_commitments
.PHONY: migrate-new
migrate-new:
	@test -n "$(name)" || { echo "usage: make migrate-new name=short_description"; exit 1; }
	go tool goose -dir $(MIGRATIONS) -s create $(name) sql

## db-create: provision the warp role and database on a local Postgres
.PHONY: db-create
db-create:
	@bash infra/scripts/create-db.sh

.PHONY: require-db
require-db:
	@test -n "$(DATABASE_URL)" || { echo "DATABASE_URL is not set; run 'make setup'"; exit 1; }

# --- build and run ---------------------------------------------------------

## build: compile both services into bin/
.PHONY: build
build:
	go build -o bin/api ./apps/api/cmd/api
	go build -o bin/worker ./apps/worker/cmd/worker

## run-api: run the HTTP service
.PHONY: run-api
run-api:
	go run ./apps/api/cmd/api

## run-worker: run the background worker
.PHONY: run-worker
run-worker:
	go run ./apps/worker/cmd/worker

## run-web: run the Next.js frontend
.PHONY: run-web
run-web:
	cd apps/web && pnpm dev

# --- quality ---------------------------------------------------------------

## test: run the Go test suite
.PHONY: test
test:
	go test ./...

## cover: run tests with a coverage summary
.PHONY: cover
cover:
	go test -coverprofile=coverage.out ./...
	go tool cover -func=coverage.out | tail -1

## fmt: format Go sources
.PHONY: fmt
fmt:
	@gofmt -l -w $(GO_SOURCES)

## vet: run go vet
.PHONY: vet
vet:
	go vet ./...

## lint: run golangci-lint — see https://golangci-lint.run to install
.PHONY: lint
lint:
	golangci-lint run

## check: everything CI runs
.PHONY: check
check: vet test

# --- containers (optional) -------------------------------------------------
#
# Only for machines without a local Postgres and Redis. If you already run them
# — which is the expected setup — skip these entirely and use `make db-create`.
# The container ports deliberately avoid 5432/6379 so they cannot collide with
# a local install.

## docker-up: start containerised Postgres and Redis instead of local ones
.PHONY: docker-up
docker-up:
	docker compose -f infra/docker-compose.yml up -d --wait postgres redis

## docker-down: stop the containers
.PHONY: docker-down
docker-down:
	docker compose -f infra/docker-compose.yml down

## docker-logs: follow the containers' logs
.PHONY: docker-logs
docker-logs:
	docker compose -f infra/docker-compose.yml logs -f
