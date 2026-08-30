-- Warp bootstrap seed.
-- Idempotent: safe to run more than once.
-- Replace the email and display name before first run.

BEGIN;

-- The identity root and its profile are created together: user_id is the
-- profile's primary key, so a user without one would be a user nothing can
-- display.
INSERT INTO users (id)
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_profiles (user_id, email, display_name, timezone)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'owner@example.com',
    'Owner',
    'Asia/Ho_Chi_Minh'
)
ON CONFLICT (user_id) DO NOTHING;

-- Contexts -----------------------------------------------------------------

INSERT INTO contexts (user_id, parent_id, slug, name, kind, position, active_hours) VALUES
    ('00000000-0000-0000-0000-000000000001', NULL, 'company', 'Main company',  'work',     10,
     '{"mon":[["09:00","18:00"]],"tue":[["09:00","18:00"]],"wed":[["09:00","18:00"]],"thu":[["09:00","18:00"]],"fri":[["09:00","18:00"]]}'),
    ('00000000-0000-0000-0000-000000000001', NULL, 'job-a',   'Remote job A',  'work',     20,
     '{"mon":[["19:00","22:00"]],"wed":[["19:00","22:00"]],"sat":[["09:00","12:00"]]}'),
    ('00000000-0000-0000-0000-000000000001', NULL, 'job-b',   'Remote job B',  'work',     30,
     '{"tue":[["19:00","22:00"]],"thu":[["19:00","22:00"]],"sun":[["09:00","12:00"]]}'),
    ('00000000-0000-0000-0000-000000000001', NULL, 'masters', 'Master''s degree', 'study', 40, '{}'),
    ('00000000-0000-0000-0000-000000000001', NULL, 'self',    'Self',          'personal', 50, '{}')
ON CONFLICT (user_id, slug) DO NOTHING;

INSERT INTO contexts (user_id, parent_id, slug, name, kind, position)
SELECT
    '00000000-0000-0000-0000-000000000001',
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
WHERE p.user_id = '00000000-0000-0000-0000-000000000001'
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
WHERE c.user_id = '00000000-0000-0000-0000-000000000001'
ON CONFLICT (context_id, action_type_code) DO NOTHING;

-- Manual fallback account --------------------------------------------------
-- Always present, so every context still works when a connector is down.

INSERT INTO accounts (user_id, provider, reliability, display_name)
SELECT '00000000-0000-0000-0000-000000000001', 'manual', 'manual', 'Manual entry'
WHERE NOT EXISTS (
    SELECT 1 FROM accounts
    WHERE user_id = '00000000-0000-0000-0000-000000000001'
      AND provider = 'manual'
);

INSERT INTO account_contexts (account_id, context_id)
SELECT a.id, c.id
FROM accounts a
CROSS JOIN contexts c
WHERE a.user_id = '00000000-0000-0000-0000-000000000001'
  AND a.provider = 'manual'
  AND c.user_id = '00000000-0000-0000-0000-000000000001'
ON CONFLICT DO NOTHING;

COMMIT;
