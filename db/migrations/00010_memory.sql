-- The Work Graph: accumulated facts, retrieved by similarity.

-- +goose Up

CREATE TYPE memory_subject_type AS ENUM ('person', 'project', 'context', 'self');

-- The Work Graph. Accumulated facts such as "the contact at remote job B needs
-- PDF attachments, not links". Retrieved by similarity and injected into agent
-- prompts. This is the asset a replacement system would take months to rebuild.
CREATE TABLE memory_notes (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          uuid                NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    -- NULL means the note applies everywhere, not to one context.
    context_id       uuid                REFERENCES contexts (id) ON DELETE CASCADE,
    subject_type     memory_subject_type NOT NULL,
    -- Not a foreign key: subject_id points into people, contexts or nothing,
    -- depending on subject_type. Application resolves it.
    subject_id       uuid,
    content          text                NOT NULL,
    source_signal_id uuid                REFERENCES signals (id) ON DELETE SET NULL,
    confidence       numeric(4,3)        NOT NULL DEFAULT 0.800,
    embedding        vector(1536),
    is_pinned        boolean             NOT NULL DEFAULT false,
    use_count        integer             NOT NULL DEFAULT 0,
    last_used_at     timestamptz,
    superseded_by    uuid                REFERENCES memory_notes (id) ON DELETE SET NULL,
    created_at       timestamptz         NOT NULL DEFAULT now(),
    updated_at       timestamptz         NOT NULL DEFAULT now(),

    CONSTRAINT memory_notes_content_not_blank CHECK (length(btrim(content)) > 0),
    CONSTRAINT memory_notes_confidence_range  CHECK (confidence BETWEEN 0 AND 1),
    CONSTRAINT memory_notes_no_self_supersede CHECK (superseded_by IS DISTINCT FROM id),
    -- 'self' notes are about the user and carry no subject_id; the others need one.
    CONSTRAINT memory_notes_subject_present CHECK (
        (subject_type = 'self' AND subject_id IS NULL)
        OR (subject_type <> 'self' AND subject_id IS NOT NULL)
    )
);

-- Similarity search over live notes only. Cosine, matching normalised embeddings.
CREATE INDEX memory_notes_embedding_idx ON memory_notes
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

CREATE INDEX memory_notes_subject_idx ON memory_notes (subject_type, subject_id)
    WHERE superseded_by IS NULL;

CREATE INDEX memory_notes_context_idx ON memory_notes (context_id)
    WHERE superseded_by IS NULL;

CREATE TRIGGER memory_notes_set_updated_at
    BEFORE UPDATE ON memory_notes
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- +goose Down

DROP TABLE IF EXISTS memory_notes;
DROP TYPE IF EXISTS memory_subject_type;
