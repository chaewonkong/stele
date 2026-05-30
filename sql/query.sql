-- name: ListActiveNotes :many
SELECT id, title, preview, pinned, updated_at
FROM notes
WHERE deleted_at IS NULL
ORDER BY pinned DESC, updated_at DESC;

-- name: ListAllNotes :many
SELECT id, title, preview, pinned, updated_at
FROM notes
ORDER BY pinned DESC, updated_at DESC;

-- name: GetNote :one
SELECT id, title, body, pinned, created_at, updated_at
FROM notes
WHERE id = ? AND deleted_at IS NULL;

-- name: CreateNote :one
INSERT INTO notes (title, body, preview, pinned, created_at, updated_at)
VALUES ('', '', '', 0, ?, ?)
RETURNING id, title, body, pinned, created_at, updated_at;

-- name: UpdateNote :one
UPDATE notes
SET body = ?, title = ?, preview = ?, updated_at = ?
WHERE id = ? AND deleted_at IS NULL
RETURNING id, title, preview, pinned, updated_at;

-- name: TogglePin :exec
UPDATE notes
SET pinned = ?
WHERE id = ? AND deleted_at IS NULL;

-- name: TrashNote :exec
UPDATE notes SET deleted_at = ? WHERE id = ?;

-- name: RestoreNote :exec
UPDATE notes SET deleted_at = NULL WHERE id = ?;

-- name: PurgeNote :exec
DELETE FROM notes WHERE id = ?;

-- name: ListActiveNotesForExport :many
SELECT id, title, body
FROM notes
WHERE deleted_at IS NULL
ORDER BY updated_at DESC;
