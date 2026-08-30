-- name: ListAccountsForContexts :many
SELECT DISTINCT a.*
FROM accounts a
JOIN account_contexts ac ON ac.account_id = a.id
WHERE ac.context_id = ANY (@context_ids::uuid[])
ORDER BY a.display_name;

-- name: GetAccount :one
SELECT * FROM accounts WHERE id = $1;

-- MarkAccountSynced records a successful delta sync.
-- name: MarkAccountSynced :exec
UPDATE accounts
SET status = 'connected', last_sync_at = $2, last_error = '', updated_at = $2
WHERE id = $1;

-- MarkAccountFailed stops the account rather than letting it return partial
-- data: a report must never be silently trusted when a source was down.
-- name: MarkAccountFailed :exec
UPDATE accounts
SET status = 'error', last_error = $2, updated_at = $3
WHERE id = $1;
