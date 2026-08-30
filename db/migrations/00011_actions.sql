-- What an agent is allowed to attempt, and the prompts it attempts it with.
--
-- `autonomy_level` is declared here rather than with the autonomy rules because
-- `runs` needs it too, and runs come first.

-- +goose Up

CREATE TYPE action_risk AS ENUM ('low', 'medium', 'high');

CREATE TYPE autonomy_level AS ENUM ('ask', 'draft', 'auto');

-- Catalogue of what an agent is allowed to attempt. Referenced by autonomy
-- rules, runs and proposed actions, so adding a capability is a data change
-- rather than a schema change.
CREATE TABLE action_types (
    code        text PRIMARY KEY,
    label       text        NOT NULL,
    -- true when performing it changes something outside Warp.
    is_outbound boolean     NOT NULL,
    risk        action_risk NOT NULL,
    -- Consecutive clean approvals required before an autonomy upgrade is offered.
    upgrade_threshold smallint NOT NULL DEFAULT 10,
    created_at  timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT action_types_code_format CHECK (code ~ '^[a-z][a-z0-9_]*$'),
    CONSTRAINT action_types_threshold_positive CHECK (upgrade_threshold > 0)
);

-- Prompts live in the database, not in compiled Go. Tuning extraction should
-- not require a rebuild, and every run records which version produced it.
CREATE TABLE prompt_templates (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name       text        NOT NULL,
    version    integer     NOT NULL,
    body       text        NOT NULL,
    variables  jsonb       NOT NULL DEFAULT '[]'::jsonb,
    model      text        NOT NULL,
    max_tokens integer     NOT NULL DEFAULT 4096,
    is_active  boolean     NOT NULL DEFAULT false,
    notes      text,
    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT prompt_templates_unique_version UNIQUE (name, version),
    CONSTRAINT prompt_templates_version_positive CHECK (version > 0),
    CONSTRAINT prompt_templates_body_not_blank CHECK (length(btrim(body)) > 0)
);

-- At most one active version per prompt name.
CREATE UNIQUE INDEX prompt_templates_one_active_idx ON prompt_templates (name)
    WHERE is_active = true;

-- +goose Down

DROP TABLE IF EXISTS prompt_templates;
DROP TABLE IF EXISTS action_types;
DROP TYPE IF EXISTS autonomy_level;
DROP TYPE IF EXISTS action_risk;
