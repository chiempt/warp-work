-- Warp development fixtures.
--
-- This does NOT create the owner. Registration does — `POST /api/v1/auth/register`
-- — and it is the only thing that does. A seeded owner would be an account with
-- no sign-in method: `register` would refuse it as an existing owner, and
-- `login` would find no credential. Nobody could get in.
--
-- So: register first, then run this to attach fixture contexts and a manual
-- account to whoever registered.
--
-- Idempotent: safe to run more than once.

BEGIN;

-- +--------------------------------------------------------------------------
-- | Fail loudly rather than silently seeding nothing.
-- +--------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users) THEN
        RAISE EXCEPTION
            'no owner yet — register first, then re-run: POST /api/v1/auth/register';
    END IF;
END
$$;

-- Contexts -----------------------------------------------------------------

INSERT INTO contexts (user_id, parent_id, slug, name, kind, position, active_hours) VALUES
    ((SELECT id FROM users ORDER BY created_at LIMIT 1), NULL, 'company', 'Main company',  'work',     10,
     '{"mon":[["09:00","18:00"]],"tue":[["09:00","18:00"]],"wed":[["09:00","18:00"]],"thu":[["09:00","18:00"]],"fri":[["09:00","18:00"]]}'),
    ((SELECT id FROM users ORDER BY created_at LIMIT 1), NULL, 'job-a',   'Remote job A',  'work',     20,
     '{"mon":[["19:00","22:00"]],"wed":[["19:00","22:00"]],"sat":[["09:00","12:00"]]}'),
    ((SELECT id FROM users ORDER BY created_at LIMIT 1), NULL, 'job-b',   'Remote job B',  'work',     30,
     '{"tue":[["19:00","22:00"]],"thu":[["19:00","22:00"]],"sun":[["09:00","12:00"]]}'),
    ((SELECT id FROM users ORDER BY created_at LIMIT 1), NULL, 'masters', 'Master''s degree', 'study', 40, '{}'),
    ((SELECT id FROM users ORDER BY created_at LIMIT 1), NULL, 'self',    'Self',          'personal', 50, '{}')
ON CONFLICT (user_id, slug) DO NOTHING;

INSERT INTO contexts (user_id, parent_id, slug, name, kind, position)
SELECT
    (SELECT id FROM users ORDER BY created_at LIMIT 1),
    p.id,
    child.slug,
    child.name,
    'personal',
    child.position
FROM contexts p
CROSS JOIN (VALUES
    ('sport',   'Sport',   10),
    ('fitness', 'Fitness', 20)
) AS child(slug, name, position)
WHERE p.user_id = (SELECT id FROM users ORDER BY created_at LIMIT 1)
  AND p.slug = 'self'
ON CONFLICT (user_id, slug) DO NOTHING;

-- Action types -------------------------------------------------------------
-- upgrade_threshold rises with risk: the more damage a mistake does, the more
-- clean approvals the system requires before offering to stop asking.

INSERT INTO action_types (code, label, is_outbound, risk, upgrade_threshold) VALUES
    ('extract_items',   'Extract items from a signal', false, 'low',    5),
    ('summarize_thread','Summarise a thread',          false, 'low',    5),
    ('generate_report', 'Generate a report',           false, 'low',    5),
    ('draft_document',  'Draft a document',            false, 'low',    8),
    ('update_record',   'Update an external record',   true,  'medium', 15),
    ('create_event',    'Create a calendar event',     true,  'medium', 15),
    ('update_event',    'Update a calendar event',     true,  'medium', 15),
    ('reply_email',     'Reply to an email',           true,  'high',   30),
    ('send_message',    'Send a chat message',         true,  'high',   30)
ON CONFLICT (code) DO NOTHING;

-- Autonomy rules -----------------------------------------------------------
-- Every context starts every action at 'draft'. Nothing is ever born on 'auto'.

INSERT INTO autonomy_rules (user_id, context_id, action_type_code, level)
SELECT c.user_id, c.id, a.code, 'draft'
FROM contexts c
CROSS JOIN action_types a
WHERE c.user_id = (SELECT id FROM users ORDER BY created_at LIMIT 1)
ON CONFLICT (context_id, action_type_code) DO NOTHING;

-- Manual fallback account --------------------------------------------------
-- Always present, so every context still works when a connector is down.

INSERT INTO accounts (user_id, provider, reliability, display_name)
SELECT (SELECT id FROM users ORDER BY created_at LIMIT 1), 'manual', 'manual', 'Manual entry'
WHERE NOT EXISTS (
    SELECT 1 FROM accounts
    WHERE user_id = (SELECT id FROM users ORDER BY created_at LIMIT 1)
      AND provider = 'manual'
);

INSERT INTO account_contexts (account_id, context_id)
SELECT a.id, c.id
FROM accounts a
CROSS JOIN contexts c
WHERE a.user_id = (SELECT id FROM users ORDER BY created_at LIMIT 1)
  AND a.provider = 'manual'
  AND c.user_id = (SELECT id FROM users ORDER BY created_at LIMIT 1)
ON CONFLICT DO NOTHING;

COMMIT;
