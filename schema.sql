CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id TEXT NOT NULL UNIQUE,
    sender TEXT NOT NULL CHECK(sender IN ('meo', 'mao')),
    recipient TEXT NOT NULL CHECK(recipient IN ('meo', 'mao')),
    text TEXT NOT NULL,
    created_at TEXT NOT NULL,
    read_at TEXT
);

CREATE TABLE IF NOT EXISTS customizations (
    cat TEXT PRIMARY KEY CHECK(cat IN ('meo', 'mao')),
    config TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL
);
