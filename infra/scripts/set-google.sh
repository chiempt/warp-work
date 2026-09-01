#!/usr/bin/env bash
# Write Google OAuth credentials into infra/.env.
#
# Exists because the values are long, easy to transpose, and the failure when
# one is wrong happens at Google's error page rather than here. This checks the
# shape before writing, and prints the exact redirect URI to register — which is
# the field that actually causes redirect_uri_mismatch.
set -euo pipefail

ENV_FILE="infra/.env"
CALLBACK_PATH="/api/v1/auth/google/callback"

[[ -f "$ENV_FILE" ]] || { echo "error: $ENV_FILE does not exist; run 'make setup' first" >&2; exit 1; }

# The redirect goes to the *web app*, not the API. The browser is navigating,
# apps/web proxies /api/v1 through to the API, and the redirect issued afterwards
# has to land on a page. Pointing this at the API's port lands the user on a 404
# with a valid session they cannot see.
web_base="$(grep -E '^WEB_BASE_URL=' "$ENV_FILE" | cut -d= -f2- || true)"
web_base="${web_base:-http://localhost:3000}"
redirect="${web_base%/}${CALLBACK_PATH}"

if [[ -t 0 ]]; then
    cat <<INSTRUCTIONS

  Create the credentials first, at:
    https://console.cloud.google.com/apis/credentials

    Create credentials -> OAuth client ID -> Web application

  There are two fields, and they take different things:

    Authorised JavaScript origins   LEAVE EMPTY
                                    That field is for flows that run in the
                                    browser with Google's JS library. Warp
                                    exchanges the code server-side with a client
                                    secret, so no origin is needed. Pasting a URL
                                    with a path here is rejected:
                                      "Invalid Origin: URIs must not contain a
                                       path or end with /"

    Authorised redirect URIs        ${redirect}
                                    Exactly that, one line, no trailing slash.

INSTRUCTIONS
fi

client_id="${GOOGLE_CLIENT_ID:-}"
client_secret="${GOOGLE_CLIENT_SECRET:-}"

# Without a terminal there is nobody to prompt. Failing here beats blocking
# forever on a read that will never be answered.
if [[ ! -t 0 ]] && [[ -z "$client_id" || -z "$client_secret" ]]; then
    cat >&2 <<'MSG'
error: no terminal to prompt on, and the credentials were not supplied.

Run this from a shell:
    make google

Or pass them directly (note: not through make, which overrides the environment
with the values already in infra/.env):
    GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... bash infra/scripts/set-google.sh
MSG
    exit 1
fi

if [[ -z "$client_id" ]]; then
    read -r -p "  Client ID:     " client_id
fi
if [[ -z "$client_secret" ]]; then
    # Not echoed: it is a secret, and terminals keep scrollback.
    read -r -s -p "  Client secret: " client_secret
    echo
fi

client_id="$(echo "$client_id" | tr -d '[:space:]')"
client_secret="$(echo "$client_secret" | tr -d '[:space:]')"

[[ -n "$client_id" && -n "$client_secret" ]] || { echo "error: both values are required" >&2; exit 1; }

# Shape checks, not validation — only Google can say whether they are real. But
# these catch the two mistakes that actually happen: pasting the wrong field,
# and pasting one value into both.
if [[ "$client_id" != *.apps.googleusercontent.com ]]; then
    echo "warning: a client ID normally ends in .apps.googleusercontent.com" >&2
fi
if [[ "$client_secret" == *.apps.googleusercontent.com ]]; then
    echo "error: that is the client ID, not the secret" >&2
    exit 1
fi
if [[ "$client_id" == "$client_secret" ]]; then
    echo "error: the ID and the secret are the same value" >&2
    exit 1
fi

CLIENT_ID="$client_id" CLIENT_SECRET="$client_secret" REDIRECT="$redirect" \
python3 - "$ENV_FILE" <<'PY'
import os, pathlib, sys

path = pathlib.Path(sys.argv[1])
values = {
    "GOOGLE_CLIENT_ID": os.environ["CLIENT_ID"],
    "GOOGLE_CLIENT_SECRET": os.environ["CLIENT_SECRET"],
    "GOOGLE_REDIRECT_URL": os.environ["REDIRECT"],
}

# Rewritten line by line so comments, ordering and every other value survive.
lines, seen = [], set()
for line in path.read_text().splitlines():
    key = line.split("=", 1)[0].strip() if "=" in line and not line.lstrip().startswith("#") else None
    if key in values:
        lines.append(f"{key}={values[key]}")
        seen.add(key)
    else:
        lines.append(line)

for key, value in values.items():
    if key not in seen:
        lines.append(f"{key}={value}")

path.write_text("\n".join(lines) + "\n")
path.chmod(0o600)
PY

echo
echo "  written to $ENV_FILE"
echo "  redirect:  $redirect"
echo
echo "  restart the api, then open:"
echo "    ${web_base%/}/api/v1/auth/google/start"
