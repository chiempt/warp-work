#!/usr/bin/env bash
# Run the Warp services together, with one Ctrl-C that actually stops them all.
#
# Two things here are deliberate:
#
#   * The Go services are built first and the binaries run directly, rather than
#     `go run`. `go run` starts the compiled binary as a child, so killing it
#     leaves that child holding the port — which is exactly the orphan that
#     keeps eating :8080.
#   * Shutdown walks the process tree. `pnpm` and any wrapper spawn children of
#     their own, and signalling only the process we launched leaves those alive.
set -euo pipefail

WITH_WORKER="${WITH_WORKER:-0}"

if [[ -t 1 ]]; then
    C_API=$'\033[36m'; C_WRK=$'\033[35m'; C_WEB=$'\033[32m'; C_OFF=$'\033[0m'
else
    C_API=''; C_WRK=''; C_WEB=''; C_OFF=''
fi

# --- preflight -------------------------------------------------------------
# Refusing now, with the name of what is holding the port, beats the confusing
# half-start we get otherwise.
port_in_use() {
    local port=$1 holder
    holder="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | head -1)" || true
    [[ -z "$holder" ]] && return 1

    echo "error: port $port is already in use by pid $holder ($(ps -o comm= -p "$holder" 2>/dev/null || echo unknown))" >&2
    echo "       stop it, or: kill $holder" >&2
    return 0
}

busy=0
port_in_use 8080 && busy=1
port_in_use 3000 && busy=1
[[ "$busy" -eq 0 ]] || exit 1

if [[ ! -d apps/web/node_modules ]]; then
    echo "error: apps/web/node_modules is missing; run: pnpm --dir apps/web install" >&2
    exit 1
fi

# --- build before running, so a compile error fails here and not halfway ----
echo "building…"
go build -o bin/api ./apps/api/cmd/api
[[ "$WITH_WORKER" == "1" ]] && go build -o bin/worker ./apps/worker/cmd/worker

# --- run -------------------------------------------------------------------
pids=()

# A file rather than a variable: the reporting subshells fork before shutdown
# begins, so they would keep a stale copy of any variable set later. Its
# presence means "we asked for this", so a child dying from our own SIGTERM is
# not announced as a failure.
STOP_FLAG="$(mktemp -t warp-dev.XXXXXX)"
rm -f "$STOP_FLAG"

kill_tree() {
    local pid=$1 child
    for child in $(pgrep -P "$pid" 2>/dev/null || true); do
        kill_tree "$child"
    done
    kill -TERM "$pid" 2>/dev/null || true
}

cleanup() {
    trap - INT TERM EXIT
    : > "${STOP_FLAG:-/dev/null}"
    echo
    echo "stopping…"
    local pid
    for pid in "${pids[@]:-}"; do
        [[ -n "$pid" ]] && kill_tree "$pid"
    done
    wait 2>/dev/null || true
    rm -f "${STOP_FLAG:-}" 2>/dev/null || true
}
# A deliberate Ctrl-C is not a failure, so it exits 0 — otherwise make prints
# "Error 130" every time you stop the dev server.
trap 'cleanup; exit 0' INT TERM
trap cleanup EXIT

# start <label> <colour> <command...>
#
# The subshell outlives the command it runs so it can report how the command
# died. Without that, bash prints its own job-control notice instead —
# "line 79: 32448 Killed: 9" — which says nothing about which service went, or
# why.
start() {
    local label=$1 colour=$2
    shift 2
    local prefix="${colour}$(printf '%-6s' "$label")${C_OFF} | "

    (
        set +e

        # Bash announces any command killed by a signal on its own stderr —
        # "line 106: 40050 Killed: 9 ..." — which is noise that names a pid
        # instead of a service. Keep the real stderr on fd 3 for our own
        # reporting and silence bash's. The command's stderr is redirected into
        # the prefixer below, so it is unaffected.
        exec 3>&2 2>/dev/null

        # awk rather than `sed -u`: BSD sed on macOS has no unbuffered mode, so
        # the output would arrive in blocks instead of live.
        "$@" > >(awk -v p="$prefix" '{print p $0; fflush()}') 2>&1
        status=$?

        if [[ ! -f "${STOP_FLAG:-}" && $status -ne 0 ]]; then
            printf '%s%s\n' "$prefix" "$(describe_exit "$label" "$status")" >&3
        fi
    ) &
    pids+=("$!")
}

# describe_exit turns an exit status into something worth reading. A status
# above 128 is a signal: 137 is SIGKILL, which is what `kill -9` on the port
# looks like from in here, and is not the same thing as a crash.
describe_exit() {
    local label=$1 status=$2

    case "$status" in
        137) echo "$label was killed (SIGKILL) — something ran 'kill -9', or the OS ran out of memory" ;;
        143) echo "$label was terminated (SIGTERM)" ;;
        130) echo "$label was interrupted" ;;
        1)   echo "$label exited with status 1 — see its output above" ;;
        *)   echo "$label exited with status $status" ;;
    esac
}

start api "$C_API" ./bin/api
[[ "$WITH_WORKER" == "1" ]] && start worker "$C_WRK" ./bin/worker
start web "$C_WEB" pnpm --dir apps/web dev

echo
echo "  api  http://localhost:8080     docs  http://localhost:8080/docs"
echo "  web  http://localhost:3000"
echo "  Ctrl-C stops everything"
echo

# Wait for the first service to exit rather than for all of them: half a stack
# running is worse than none, because the half that is up looks healthy.
wait -n
if [[ ! -f "${STOP_FLAG:-}" ]]; then
    echo
    echo "one service exited — stopping the rest" >&2
fi
