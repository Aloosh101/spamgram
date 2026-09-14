-- تتبع حالة الفحص لكل عضو في كل جروب (لشمول كل من يتفاعل)
CREATE TABLE IF NOT EXISTS scanned (
  chat_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  result TEXT NOT NULL DEFAULT 'ok',
  scanned_at INTEGER NOT NULL,
  PRIMARY KEY (chat_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_scanned_at ON scanned(scanned_at);
CREATE INDEX IF NOT EXISTS idx_scanned_chat_result ON scanned(chat_id, result);