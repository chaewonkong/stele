CREATE TABLE notes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT NOT NULL DEFAULT '',
    body       TEXT NOT NULL DEFAULT '',
    preview    TEXT NOT NULL DEFAULT '',
    pinned     INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER
);

CREATE INDEX idx_notes_updated ON notes(updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_notes_pinned  ON notes(pinned DESC, updated_at DESC) WHERE deleted_at IS NULL;
