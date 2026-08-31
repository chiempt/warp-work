# Warp — developer commands.
#
# Tooling (goose, sqlc, ogen) is pinned in go.mod as tool dependencies,
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

## setup: machine setup — env file, database, migrations. Safe to re-run.
.PHONY: setup
setup: env db-create migrate-up
	@echo
	@echo "ready. next:"
	@echo "  make run-api"
	@echo "  curl -X POST http://localhost:8080/api/v1/auth/register \\"
	@echo "    -H 'content-type: application/json' \\"
	@echo "    -d '{\"email\":\"you@example.com\",\"password\":\"a-long-enough-password\",\"displayName\":\"Your Name\"}'"
	@echo "  make seed"

## env: create infra/.env from the example with a fresh encryption key
#
# Keeping an existing file is the correct outcome, not a failure: overwriting it
# would discard the encryption key, and every stored credential with it. So this
# is a no-op when the file is already there, which is what lets `make setup` be
# re-run safely.
.PHONY: env
env:
	@if [ -f $(ENV_FILE) ]; then \
		echo "$(ENV_FILE) exists; keeping it"; \
	else \
		sed 's|^CREDENTIALS_ENCRYPTION_KEY=.*|CREDENTIALS_ENCRYPTION_KEY='"$$(openssl rand -base64 32)"'|' \
			infra/.env.example > $(ENV_FILE); \
		chmod 600 $(ENV_FILE); \
		echo "wrote $(ENV_FILE) with a generated encryption key"; \
	fi

## tidy: sync go.mod and go.sum
.PHONY: tidy
tidy:
	go mod tidy

# --- code generation -------------------------------------------------------

## generate: regenerate everything derived from the schema and the API contract
.PHONY: generate
generate: sqlc openapi

## sqlc: regenerate internal/store from db/migrations and db/queries
.PHONY: sqlc
sqlc:
	go tool sqlc generate

## openapi: regenerate the API server from docs/api/openapi.yaml
.PHONY: openapi
openapi:
	go tool ogen --clean --target apps/api/internal/api --package api docs/api/openapi.yaml

## openapi-check: fail if the generated API server is stale or uncommitted
.PHONY: openapi-check
openapi-check: openapi
	@dirty="$$(git status --porcelain -- apps/api/internal/api)"; \
	if [ -n "$$dirty" ]; then \
		echo "apps/api/internal/api does not match docs/api/openapi.yaml:"; \
		echo "$$dirty"; \
		echo "run 'make openapi' and commit the result"; \
		exit 1; \
	fi

## plan: rebuild the spreadsheet view from docs/planning/backlog.csv
#
# The CSV is the source of truth — it is what a pull request touches and what
# git can merge. The .xlsx is a generated view; editing it is discarded here.
.PHONY: plan
plan:
	@python3 infra/scripts/build-plan.py

## docs: open the browsable API contract (the api must be running)
.PHONY: docs
docs:
	@open http://localhost:$${API_PORT:-8080}/docs 2>/dev/null \
		|| echo "open http://localhost:$${API_PORT:-8080}/docs"

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

## db-reset: drop the schema and re-apply every migration (development only)
.PHONY: db-reset
db-reset:
	@bash infra/scripts/reset-db.sh
	@$(MAKE) --no-print-directory migrate-up

## seed: load the development fixtures in db/seeds
.PHONY: seed
seed: require-db
	@for f in db/seeds/*.sql; do echo "seeding $$f"; psql "$(DATABASE_URL)" -v ON_ERROR_STOP=1 -q -f "$$f"; done

.PHONY: require-db
require-db:
	@test -n "$(DATABASE_URL)" || { echo "DATABASE_URL is not set; run 'make setup'"; exit 1; }

# --- build and run ---------------------------------------------------------

## build: compile both services into bin/
.PHONY: build
build:
	go build -o bin/api ./apps/api/cmd/api
	go build -o bin/worker ./apps/worker/cmd/worker

# Both services build to a real binary and are exec'd, rather than run under
# `go run`. `go run` starts the service as a *child* and does not forward its
# own death: kill it, close the terminal, or reload the editor window, and the
# service is orphaned still holding its port — so the next start fails to bind
# and the one before it dies at a moment nobody connected to anything. `exec`
# replaces make's shell with the service itself, so there is one process, and
# Ctrl-C reaches the signal handler that drains it.

## dev: run the API and the web app together — Ctrl-C stops both
.PHONY: dev
dev: require-db
	@bash infra/scripts/dev.sh

## dev-all: dev, plus the background worker
.PHONY: dev-all
dev-all: require-db
	@WITH_WORKER=1 bash infra/scripts/dev.sh

## run-api: run the HTTP service
.PHONY: run-api
run-api:
	@go build -o bin/api ./apps/api/cmd/api
	@exec ./bin/api

## run-worker: run the background worker
.PHONY: run-worker
run-worker:
	@go build -o bin/worker ./apps/worker/cmd/worker
	@exec ./bin/worker

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
check: vet test openapi-check

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
