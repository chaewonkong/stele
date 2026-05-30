package main

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"stele/db"

	_ "modernc.org/sqlite"
)

type Store struct {
	q    *db.Queries
	conn *sql.DB
}

func NewStore() (*Store, error) {
	dir, err := appDataDir()
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, err
	}
	return openStore(filepath.Join(dir, "notes.db"))
}

func openStore(path string) (*Store, error) {
	conn, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	conn.SetMaxOpenConns(1)

	for _, pragma := range []string{"PRAGMA journal_mode=WAL", "PRAGMA foreign_keys=ON"} {
		if _, err := conn.Exec(pragma); err != nil {
			conn.Close()
			return nil, fmt.Errorf("pragma: %w", err)
		}
	}
	if err := migrate(conn); err != nil {
		conn.Close()
		return nil, err
	}
	return &Store{q: db.New(conn), conn: conn}, nil
}

func (s *Store) Close() error {
	return s.conn.Close()
}

func appDataDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, "Library", "Application Support", "stele"), nil
}

func migrate(conn *sql.DB) error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS notes (
			id         INTEGER PRIMARY KEY AUTOINCREMENT,
			title      TEXT NOT NULL DEFAULT '',
			body       TEXT NOT NULL DEFAULT '',
			preview    TEXT NOT NULL DEFAULT '',
			pinned     INTEGER NOT NULL DEFAULT 0,
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL,
			deleted_at INTEGER
		)`,
		`CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at DESC) WHERE deleted_at IS NULL`,
		`CREATE INDEX IF NOT EXISTS idx_notes_pinned  ON notes(pinned DESC, updated_at DESC) WHERE deleted_at IS NULL`,
	}
	for _, stmt := range stmts {
		if _, err := conn.Exec(stmt); err != nil {
			return fmt.Errorf("migrate: %w", err)
		}
	}
	return nil
}

func (s *Store) ListNotes(ctx context.Context, includeTrashed bool) ([]NoteSummary, error) {
	if includeTrashed {
		rows, err := s.q.ListAllNotes(ctx)
		if err != nil {
			return nil, err
		}
		out := make([]NoteSummary, len(rows))
		for i, r := range rows {
			out[i] = NoteSummary{ID: r.ID, Title: r.Title, Preview: r.Preview, Pinned: r.Pinned == 1, UpdatedAt: r.UpdatedAt}
		}
		return out, nil
	}
	rows, err := s.q.ListActiveNotes(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]NoteSummary, len(rows))
	for i, r := range rows {
		out[i] = NoteSummary{ID: r.ID, Title: r.Title, Preview: r.Preview, Pinned: r.Pinned == 1, UpdatedAt: r.UpdatedAt}
	}
	return out, nil
}

func (s *Store) GetNote(ctx context.Context, id int64) (Note, error) {
	r, err := s.q.GetNote(ctx, id)
	if err != nil {
		return Note{}, err
	}
	return Note{ID: r.ID, Title: r.Title, Body: r.Body, Pinned: r.Pinned == 1, CreatedAt: r.CreatedAt, UpdatedAt: r.UpdatedAt}, nil
}

func (s *Store) CreateNote(ctx context.Context) (Note, error) {
	now := time.Now().UnixMilli()
	r, err := s.q.CreateNote(ctx, db.CreateNoteParams{CreatedAt: now, UpdatedAt: now})
	if err != nil {
		return Note{}, err
	}
	return Note{ID: r.ID, Title: r.Title, Body: r.Body, Pinned: r.Pinned == 1, CreatedAt: r.CreatedAt, UpdatedAt: r.UpdatedAt}, nil
}

func (s *Store) UpdateNote(ctx context.Context, id int64, body string) (NoteSummary, error) {
	r, err := s.q.UpdateNote(ctx, db.UpdateNoteParams{
		ID:        id,
		Body:      body,
		Title:     extractTitle(body),
		Preview:   extractPreview(body),
		UpdatedAt: time.Now().UnixMilli(),
	})
	if err != nil {
		return NoteSummary{}, err
	}
	return NoteSummary{ID: r.ID, Title: r.Title, Preview: r.Preview, Pinned: r.Pinned == 1, UpdatedAt: r.UpdatedAt}, nil
}

func (s *Store) TogglePin(ctx context.Context, id int64, pinned bool) error {
	p := int64(0)
	if pinned {
		p = 1
	}
	return s.q.TogglePin(ctx, db.TogglePinParams{ID: id, Pinned: p})
}

func (s *Store) TrashNote(ctx context.Context, id int64) error {
	return s.q.TrashNote(ctx, db.TrashNoteParams{
		ID:        id,
		DeletedAt: sql.NullInt64{Int64: time.Now().UnixMilli(), Valid: true},
	})
}

func (s *Store) RestoreNote(ctx context.Context, id int64) error {
	return s.q.RestoreNote(ctx, id)
}

func (s *Store) PurgeNote(ctx context.Context, id int64) error {
	return s.q.PurgeNote(ctx, id)
}

func (s *Store) ListActiveNotesForExport(ctx context.Context) ([]db.ListActiveNotesForExportRow, error) {
	return s.q.ListActiveNotesForExport(ctx)
}

// extractTitle extracts a display title from markdown body.
// Priority: first # heading → first non-empty line → "Untitled"
func extractTitle(body string) string {
	var firstNonEmpty string
	for _, line := range strings.Split(body, "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}
		if strings.HasPrefix(trimmed, "#") {
			if title := strings.TrimSpace(strings.TrimLeft(trimmed, "#")); title != "" {
				return title
			}
			// bare # with no content — not a valid heading, skip
			continue
		}
		if firstNonEmpty == "" {
			firstNonEmpty = trimmed
		}
	}
	if firstNonEmpty != "" {
		return firstNonEmpty
	}
	return "Untitled"
}

// extractPreview returns ~120-rune plain-text preview by stripping leading markdown markers per line.
func extractPreview(body string) string {
	var sb strings.Builder
	for _, line := range strings.Split(body, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		line = strings.TrimLeft(line, "#>|`*_-~\t ")
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if sb.Len() > 0 {
			sb.WriteByte(' ')
		}
		sb.WriteString(line)
		if sb.Len() >= 120 {
			break
		}
	}
	preview := sb.String()
	if runes := []rune(preview); len(runes) > 120 {
		return string(runes[:120])
	}
	return preview
}
