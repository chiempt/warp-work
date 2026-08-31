-- GetPasswordCredential is the whole of what a password sign-in needs, in one
-- round trip: the identity, the hash, and the lockout state.
--
-- `subject` for a password identity is the normalised email — it is the login
-- identifier, the same role the `sub` claim plays for Google.
-- name: GetPasswordCredential :one
SELECT p.id   AS provider_id,
       p.user_id,
       p.subject,
       w.hash,
       w.failed_attempts,
       w.locked_until
FROM auth_providers p
JOIN auth_passwords w ON w.auth_provider_id = p.id
WHERE p.kind = 'password' AND p.subject = @email;

-- RecordFailedLogin counts the attempt and locks the credential once the count
-- reaches the threshold. Counted in the database rather than in Redis: a
-- lockout that evaporates when the cache restarts is not a lockout.
-- name: RecordFailedLogin :one
UPDATE auth_passwords
SET failed_attempts = failed_attempts + 1,
    locked_until = CASE
        WHEN failed_attempts + 1 >= @max_attempts::smallint THEN @lock_until::timestamptz
        ELSE locked_until
    END
WHERE auth_provider_id = @provider_id
RETURNING failed_attempts, locked_until;

-- name: ClearFailedLogins :exec
UPDATE auth_passwords
SET failed_attempts = 0, locked_until = NULL
WHERE auth_provider_id = $1;

-- name: CreateAuthSession :one
INSERT INTO auth_sessions (id, user_id, auth_provider_id, token_hash, expires_at, user_agent, ip)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- LiveSessionByTokenHash resolves the cookie on every authenticated request.
-- Expiry and revocation are part of the predicate, so a caller cannot forget to
-- check them.
-- name: LiveSessionByTokenHash :one
SELECT s.*, p.kind AS provider_kind
FROM auth_sessions s
LEFT JOIN auth_providers p ON p.id = s.auth_provider_id
WHERE s.token_hash = $1
  AND s.revoked_at IS NULL
  AND s.expires_at > @now::timestamptz;

-- name: TouchAuthSession :exec
UPDATE auth_sessions SET last_seen_at = $2 WHERE id = $1;

-- name: MarkProviderUsed :exec
UPDATE auth_providers SET last_login_at = $2 WHERE id = $1;

-- name: GetUserProfile :one
SELECT * FROM user_profiles WHERE user_id = $1;

-- name: CreateUser :one
INSERT INTO users (id) VALUES ($1) RETURNING *;

-- Timezone is deliberately absent: the column default is the single place that
-- value is written down.
-- name: CreateUserProfile :one
INSERT INTO user_profiles (user_id, email, display_name)
VALUES ($1, $2, $3)
RETURNING *;

-- name: CreateAuthProvider :one
INSERT INTO auth_providers (id, user_id, kind, subject, email, is_primary)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: CreateAuthPassword :exec
INSERT INTO auth_passwords (auth_provider_id, hash) VALUES ($1, $2);
