-- name: ListAccountsForContexts :many
SELECT DISTINCT a.*
FROM accounts a
JOIN account_contexts ac ON ac.account_id = a.id
WHERE ac.context_id = ANY (@context_ids::uuid[])
ORDER BY a.display_name;

-- name: GetAccount :one
SELECT * FROM accounts WHERE id = $1;

-- ListAccountsDueForSync drives the worker. Never synced comes first.
-- name: ListAccountsDueForSync :many
SELECT * FROM accounts
WHERE user_id = $1 AND status = 'active'
ORDER BY last_sync_at NULLS FIRST
LIMIT @row_limit;

-- MarkAccountSynced records a successful delta sync and advances the cursor.
-- The cursor is the whole point: without it the next sync would re-fetch the
-- mailbox, which is a defect rather than a fallback.
--
-- updated_at is deliberately absent — a trigger sets it, and passing a value
-- here would be silently overwritten.
-- name: MarkAccountSynced :exec
UPDATE accounts
SET status       = 'active',
    sync_cursor  = @sync_cursor,
    last_sync_at = @synced_at,
    last_error   = NULL
WHERE id = @account_id;

-- MarkAccountFailed stops the account rather than letting it return partial
-- data: a report must never be silently trusted when a source was down.
-- name: MarkAccountFailed :exec
UPDATE accounts
SET status = 'error', last_error = @error
WHERE id = @account_id;

-- MarkAccountNeedsReauth is the distinct case where the provider withdrew our
-- delegated access — a revoked grant, a changed password, an expired refresh
-- token. It is not a failure to retry, and it says nothing about whether the
-- owner is signed in: this is Warp's authorization to read Google, not the
-- owner's authentication to Warp.
-- name: MarkAccountNeedsReauth :exec
UPDATE accounts
SET status = 'needs_reauth', last_error = @error
WHERE id = @account_id;
