-- +goose Up

-- Contexts
CREATE TYPE context_kind AS ENUM ('work', 'study', 'personal');

-- Accounts and ingestion
CREATE TYPE account_provider AS ENUM (
    'gmail', 'gcalendar', 'gdrive',
    'zalo_oa', 'facebook_page', 'instagram_business',
    'manual'
);
CREATE TYPE account_reliability AS ENUM ('official', 'unofficial', 'manual');
CREATE TYPE account_status AS ENUM ('active', 'needs_reauth', 'disabled', 'error');

CREATE TYPE routing_match_type AS ENUM ('sender', 'domain', 'keyword', 'subject', 'thread');
CREATE TYPE assignment_source AS ENUM ('rule', 'model', 'manual');

CREATE TYPE signal_kind AS ENUM ('email', 'message', 'calendar_event', 'file', 'note');
CREATE TYPE signal_direction AS ENUM ('inbound', 'outbound', 'internal');

-- People
CREATE TYPE identity_provider AS ENUM ('email', 'phone', 'zalo', 'facebook', 'instagram', 'other');

-- Work items
CREATE TYPE task_status AS ENUM ('open', 'in_progress', 'blocked', 'done', 'dropped');
CREATE TYPE task_owner AS ENUM ('me', 'agent');
CREATE TYPE event_status AS ENUM ('confirmed', 'tentative', 'cancelled');
CREATE TYPE commitment_direction AS ENUM ('i_owe', 'owed_to_me');
CREATE TYPE commitment_status AS ENUM ('open', 'fulfilled', 'waived', 'dropped');
CREATE TYPE reminder_channel AS ENUM ('app', 'email', 'push');
CREATE TYPE reminder_status AS ENUM ('scheduled', 'sent', 'cancelled', 'failed');
CREATE TYPE metric_source AS ENUM ('manual', 'import', 'derived');

-- Memory
CREATE TYPE memory_subject_type AS ENUM ('person', 'project', 'context', 'self');

-- Execution
CREATE TYPE action_risk AS ENUM ('low', 'medium', 'high');
CREATE TYPE autonomy_level AS ENUM ('ask', 'draft', 'auto');
CREATE TYPE run_status AS ENUM ('queued', 'running', 'succeeded', 'failed', 'cancelled');
CREATE TYPE proposed_action_status AS ENUM ('pending', 'approved', 'edited', 'rejected', 'expired');
CREATE TYPE execution_result AS ENUM ('success', 'failed');
CREATE TYPE autonomy_outcome AS ENUM ('approved_unchanged', 'edited', 'rejected');

-- Reporting
CREATE TYPE report_kind AS ENUM ('session', 'daily', 'weekly');
CREATE TYPE audit_actor AS ENUM ('user', 'agent', 'system');

-- +goose Down

DROP TYPE IF EXISTS audit_actor;
DROP TYPE IF EXISTS report_kind;
DROP TYPE IF EXISTS autonomy_outcome;
DROP TYPE IF EXISTS execution_result;
DROP TYPE IF EXISTS proposed_action_status;
DROP TYPE IF EXISTS run_status;
DROP TYPE IF EXISTS autonomy_level;
DROP TYPE IF EXISTS action_risk;
DROP TYPE IF EXISTS memory_subject_type;
DROP TYPE IF EXISTS metric_source;
DROP TYPE IF EXISTS reminder_status;
DROP TYPE IF EXISTS reminder_channel;
DROP TYPE IF EXISTS commitment_status;
DROP TYPE IF EXISTS commitment_direction;
DROP TYPE IF EXISTS event_status;
DROP TYPE IF EXISTS task_owner;
DROP TYPE IF EXISTS task_status;
DROP TYPE IF EXISTS identity_provider;
DROP TYPE IF EXISTS signal_direction;
DROP TYPE IF EXISTS signal_kind;
DROP TYPE IF EXISTS assignment_source;
DROP TYPE IF EXISTS routing_match_type;
DROP TYPE IF EXISTS account_status;
DROP TYPE IF EXISTS account_reliability;
DROP TYPE IF EXISTS account_provider;
DROP TYPE IF EXISTS context_kind;
