-- Add `password` to the sign-in methods.
--
-- Its own migration, and its own transaction, because `ALTER TYPE ... ADD
-- VALUE` cannot run inside one and the new value cannot be referenced until it
-- has committed. The table that uses it is migration 00019.
--
-- This is the documented cost of native enums (docs/conventions.md §3): a value
-- is cheap to add up front and awkward afterwards.

-- +goose NO TRANSACTION

-- +goose Up

ALTER TYPE auth_provider_kind ADD VALUE IF NOT EXISTS 'password';

-- +goose Down

-- Postgres cannot remove a value from an enum. Rolling this back would mean
-- recreating the type and every column using it, which is not something a
-- migration should attempt automatically.
SELECT 1;
