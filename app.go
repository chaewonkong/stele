package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx   context.Context
	store *Store
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	store, err := NewStore()
	if err != nil {
		fmt.Println("store init error:", err)
		return
	}
	a.store = store
}

func (a *App) shutdown(_ context.Context) {
	if a.store != nil {
		a.store.Close()
	}
}

func (a *App) ListNotes(includeTrashed bool) ([]NoteSummary, error) {
	if a.store == nil {
		return nil, fmt.Errorf("store unavailable")
	}
	return a.store.ListNotes(a.ctx, includeTrashed)
}

func (a *App) GetNote(id int64) (Note, error) {
	if a.store == nil {
		return Note{}, fmt.Errorf("store unavailable")
	}
	return a.store.GetNote(a.ctx, id)
}

func (a *App) CreateNote() (Note, error) {
	if a.store == nil {
		return Note{}, fmt.Errorf("store unavailable")
	}
	return a.store.CreateNote(a.ctx)
}

func (a *App) UpdateNote(id int64, body string) (NoteSummary, error) {
	if a.store == nil {
		return NoteSummary{}, fmt.Errorf("store unavailable")
	}
	return a.store.UpdateNote(a.ctx, id, body)
}

func (a *App) TogglePin(id int64, pinned bool) error {
	if a.store == nil {
		return fmt.Errorf("store unavailable")
	}
	return a.store.TogglePin(a.ctx, id, pinned)
}

func (a *App) TrashNote(id int64) error {
	if a.store == nil {
		return fmt.Errorf("store unavailable")
	}
	return a.store.TrashNote(a.ctx, id)
}

func (a *App) RestoreNote(id int64) error {
	if a.store == nil {
		return fmt.Errorf("store unavailable")
	}
	return a.store.RestoreNote(a.ctx, id)
}

func (a *App) PurgeNote(id int64) error {
	if a.store == nil {
		return fmt.Errorf("store unavailable")
	}
	return a.store.PurgeNote(a.ctx, id)
}

func (a *App) ExportNote(id int64) error {
	if a.store == nil {
		return fmt.Errorf("store unavailable")
	}
	note, err := a.store.GetNote(a.ctx, id)
	if err != nil {
		return err
	}
	filename := sanitizeFilename(note.Title)
	if filename == "" {
		filename = fmt.Sprintf("note-%d", id)
	}
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		DefaultFilename: filename + ".md",
		Filters:         []runtime.FileFilter{{DisplayName: "Markdown", Pattern: "*.md"}},
	})
	if err != nil || path == "" {
		return err
	}
	return os.WriteFile(path, []byte(note.Body), 0644)
}

func (a *App) ExportAll() error {
	if a.store == nil {
		return fmt.Errorf("store unavailable")
	}
	dir, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Export all notes",
	})
	if err != nil || dir == "" {
		return err
	}
	notes, err := a.store.ListActiveNotesForExport(a.ctx)
	if err != nil {
		return err
	}
	used := make(map[string]int)
	for _, n := range notes {
		base := sanitizeFilename(n.Title)
		if base == "" {
			base = fmt.Sprintf("note-%d", n.ID)
		}
		name := base
		if cnt := used[base]; cnt > 0 {
			name = fmt.Sprintf("%s-%d", base, cnt)
		}
		used[base]++
		_ = os.WriteFile(filepath.Join(dir, name+".md"), []byte(n.Body), 0644)
	}
	return nil
}

func sanitizeFilename(s string) string {
	s = strings.NewReplacer(
		"/", "-", "\\", "-", ":", "-", "*", "-",
		"?", "-", `"`, "-", "<", "-", ">", "-", "|", "-",
	).Replace(strings.TrimSpace(s))
	if runes := []rune(s); len(runes) > 200 {
		return string(runes[:200])
	}
	return s
}
