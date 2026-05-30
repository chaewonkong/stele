package main

type Note struct {
	ID        int64  `json:"id"`
	Title     string `json:"title"`
	Body      string `json:"body"`
	Pinned    bool   `json:"pinned"`
	CreatedAt int64  `json:"createdAt"`
	UpdatedAt int64  `json:"updatedAt"`
}

type NoteSummary struct {
	ID        int64  `json:"id"`
	Title     string `json:"title"`
	Preview   string `json:"preview"`
	Pinned    bool   `json:"pinned"`
	UpdatedAt int64  `json:"updatedAt"`
}
