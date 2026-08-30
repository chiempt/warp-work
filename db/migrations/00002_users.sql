-- The owner, split into an identity root and a profile.
--
-- `users` holds nothing but the identity itself, so the row a hundred foreign
-- keys point at never changes. Everything describing the person — what they are
-- called, where to reach them, what timezone they read in — lives in
-- `user_profiles` and can be rewritten without touching that anchor.
--
-- One row in practice. Present so multi-user is not a rewrite; every table
-- downstream carries user_id for the same reason.

-- +goose Up

CREATE TABLE users (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER users_set_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Exactly one profile per user: user_id is the primary key, so a second row is
-- impossible. A user with *no* profile is still possible — create both in the
-- same transaction, which is what the bootstrap seed does.
--
-- `email` here is the canonical address the owner declares. It is not what
-- authenticates them: sign-in matches on auth_providers.subject, precisely so
-- that changing this address cannot hand the account to whoever inherits it.
CREATE TABLE user_profiles (
    user_id      uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    email        citext      NOT NULL UNIQUE,
    display_name text        NOT NULL,
    -- Presentation only. Everything is stored in UTC.
    timezone     text        NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT user_profiles_display_name_not_blank CHECK (length(btrim(display_name)) > 0),
    CONSTRAINT user_profiles_timezone_not_blank     CHECK (length(btrim(timezone)) > 0)
);

CREATE TRIGGER user_profiles_set_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- +goose Down

DROP TABLE IF EXISTS user_profiles;
DROP TABLE IF EXISTS users;
