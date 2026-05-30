package main

import (
	"context"
	"testing"
)

func newTestStore(t *testing.T) *Store {
	t.Helper()
	s, err := openStore(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	return s
}

func TestCreateAndGetNote(t *testing.T) {
	s := newTestStore(t)
	ctx := context.Background()

	note, err := s.CreateNote(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if note.ID == 0 {
		t.Fatal("expected non-zero ID")
	}

	got, err := s.GetNote(ctx, note.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.ID != note.ID {
		t.Errorf("ID: got %d, want %d", got.ID, note.ID)
	}
}

func TestUpdateNote(t *testing.T) {
	s := newTestStore(t)
	ctx := context.Background()

	note, _ := s.CreateNote(ctx)
	body := "# Hello World\n\nSome preview content here."

	summary, err := s.UpdateNote(ctx, note.ID, body)
	if err != nil {
		t.Fatal(err)
	}
	if summary.Title != "Hello World" {
		t.Errorf("Title: got %q, want %q", summary.Title, "Hello World")
	}
	if summary.Preview == "" {
		t.Error("Preview should not be empty")
	}

	got, _ := s.GetNote(ctx, note.ID)
	if got.Body != body {
		t.Error("Body not persisted correctly")
	}
}

func TestListNotesSorting(t *testing.T) {
	s := newTestStore(t)
	ctx := context.Background()

	n1, _ := s.CreateNote(ctx)
	n2, _ := s.CreateNote(ctx)
	s.UpdateNote(ctx, n1.ID, "first note")
	s.UpdateNote(ctx, n2.ID, "second note")
	s.TogglePin(ctx, n1.ID, true)

	notes, err := s.ListNotes(ctx, false)
	if err != nil {
		t.Fatal(err)
	}
	if len(notes) != 2 {
		t.Fatalf("expected 2 notes, got %d", len(notes))
	}
	if !notes[0].Pinned || notes[0].ID != n1.ID {
		t.Error("pinned note should be first")
	}
}

func TestTrashAndRestore(t *testing.T) {
	s := newTestStore(t)
	ctx := context.Background()

	note, _ := s.CreateNote(ctx)

	if err := s.TrashNote(ctx, note.ID); err != nil {
		t.Fatal(err)
	}
	active, _ := s.ListNotes(ctx, false)
	for _, n := range active {
		if n.ID == note.ID {
			t.Error("trashed note should not appear in active list")
		}
	}
	all, _ := s.ListNotes(ctx, true)
	found := false
	for _, n := range all {
		if n.ID == note.ID {
			found = true
		}
	}
	if !found {
		t.Error("trashed note should appear in includeTrashed list")
	}

	if err := s.RestoreNote(ctx, note.ID); err != nil {
		t.Fatal(err)
	}
	active, _ = s.ListNotes(ctx, false)
	found = false
	for _, n := range active {
		if n.ID == note.ID {
			found = true
		}
	}
	if !found {
		t.Error("restored note should appear in active list")
	}
}

func TestPurgeNote(t *testing.T) {
	s := newTestStore(t)
	ctx := context.Background()

	note, _ := s.CreateNote(ctx)
	s.TrashNote(ctx, note.ID)

	if err := s.PurgeNote(ctx, note.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := s.GetNote(ctx, note.ID); err == nil {
		t.Error("expected error getting purged note")
	}
}

func TestExtractTitle(t *testing.T) {
	cases := []struct {
		body  string
		title string
	}{
		{"# My Title\n\nbody", "My Title"},
		{"## Section\n\nbody", "Section"},
		{"just some text", "just some text"},
		{"", "Untitled"},
		{"   \n\n  ", "Untitled"},
		{"intro line\n# Late Heading", "Late Heading"},
		{"#\n\nno title heading", "no title heading"},
	}
	for _, c := range cases {
		got := extractTitle(c.body)
		if got != c.title {
			t.Errorf("extractTitle(%q) = %q, want %q", c.body, got, c.title)
		}
	}
}

func TestExtractPreview(t *testing.T) {
	body := "# Title\n\nThis is the preview content.\n\n## Section\n\nMore content."
	preview := extractPreview(body)
	if preview == "" {
		t.Error("preview should not be empty")
	}
	// Leading # markers should be stripped
	if len(preview) > 0 && preview[0] == '#' {
		t.Errorf("preview should not start with #, got: %q", preview)
	}
}

func TestExtractPreviewKorean(t *testing.T) {
	// 한글 120자 초과 시 올바르게 잘리는지 확인 (byte가 아닌 rune 기준)
	body := "안녕하세요. 이것은 미리보기 테스트입니다. 한글은 멀티바이트 문자이므로 rune 기준으로 잘려야 합니다. 이 문장은 120자를 넘기기 위한 긴 문장입니다. 더 많은 내용이 있습니다."
	preview := extractPreview(body)
	runes := []rune(preview)
	if len(runes) > 120 {
		t.Errorf("preview exceeds 120 runes: got %d", len(runes))
	}
}
