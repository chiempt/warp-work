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

-- ProviderByKindSubject resolves a federated identity. Matching is on the
-- provider's immutable subject, never the email.
-- name: ProviderByKindSubject :one
SELECT * FROM auth_providers WHERE kind = $1 AND subject = $2;

-- name: ListAuthProviders :many
SELECT * FROM auth_providers
WHERE user_id = $1
ORDER BY is_primary DESC, linked_at;

-- name: CountAuthProviders :one
SELECT count(*) FROM auth_providers WHERE user_id = $1;

-- DeleteAuthProvider is scoped to the user so an id from elsewhere cannot be
-- used to unlink someone else's. Removing the last one raises
-- restrict_violation from a trigger; the service turns that into a conflict.
-- name: DeleteAuthProvider :execrows
DELETE FROM auth_providers WHERE id = $1 AND user_id = $2;

-- ListLiveSessions is what makes a lost laptop revocable: it exists so the
-- owner can see where they are signed in and end one of them.
-- name: ListLiveSessions :many
SELECT s.*, p.kind AS provider_kind
FROM auth_sessions s
LEFT JOIN auth_providers p ON p.id = s.auth_provider_id
WHERE s.user_id = $1
  AND s.revoked_at IS NULL
  AND s.expires_at > @now::timestamptz
ORDER BY s.last_seen_at DESC;

-- RevokeSessionByID is idempotent for a session that belongs to the caller:
-- COALESCE keeps the original revocation time, so the row still matches and the
-- second call is a no-op rather than a miss. Zero rows therefore means "not
-- yours", which is the only case worth a 404.
-- name: RevokeSessionByID :execrows
UPDATE auth_sessions
SET revoked_at = COALESCE(revoked_at, @revoked_at)
WHERE id = @session_id AND user_id = @user_id;

-- name: RevokeSessionByTokenHash :execrows
UPDATE auth_sessions
SET revoked_at = @revoked_at
WHERE token_hash = @token_hash AND revoked_at IS NULL;

-- SweepExpiredSessions removes rows that can no longer authenticate anything.
-- Revoked rows are kept for a grace period rather than deleted immediately, so
-- "when did I sign out" stays answerable for a while.
-- name: SweepExpiredSessions :execrows
DELETE FROM auth_sessions
WHERE expires_at < @cutoff::timestamptz
   OR (revoked_at IS NOT NULL AND revoked_at < @cutoff::timestamptz);

-- UpdatePasswordHash re-hashes at the current cost. A successful sign-in is the
-- only moment the plaintext is available to do it with.
-- name: UpdatePasswordHash :exec
UPDATE auth_passwords SET hash = $2 WHERE auth_provider_id = $1;

-- UserProfileByEmail supports linking a federated identity to an account that
-- already exists. Only ever called with an email the provider marked verified —
-- matching on an unverified one is an account-takeover route.
-- name: UserProfileByEmail :one
SELECT * FROM user_profiles WHERE email = $1;
