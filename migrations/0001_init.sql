-- الجروبات التي أُضيف لها البوت
CREATE TABLE IF NOT EXISTS chat_groups (
  chat_id INTEGER PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'supergroup',
  active INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'member',
  settings TEXT,
  created_at INTEGER NOT NULL
);

-- معلومات المستخدمين التي يلتقطها البوت
CREATE TABLE IF NOT EXISTS users (
  user_id INTEGER PRIMARY KEY,
  username TEXT,
  has_photo INTEGER NOT NULL DEFAULT 0,
  first_seen INTEGER,
  last_seen INTEGER
);

-- القائمة البيضاء: من ضغط زر الموافقة ولا يُعاد كتمه في هذا الجروب
CREATE TABLE IF NOT EXISTS whitelist (
  chat_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT 'self',
  created_at INTEGER NOT NULL,
  PRIMARY KEY (chat_id, user_id)
);

-- في انتظار الضغط على زر الموافقة خلال المهلة
CREATE TABLE IF NOT EXISTS pending (
  chat_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  message_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  deadline INTEGER NOT NULL,
  PRIMARY KEY (chat_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_pending_deadline ON pending(deadline);

-- لائحة سوداء عامة مشتركة بين كل جروبات البوت
CREATE TABLE IF NOT EXISTS blocklist (
  user_id INTEGER PRIMARY KEY,
  reason TEXT,
  created_at INTEGER NOT NULL
);

-- سجل انضمام لرصد موجات الانضمام المفاجئة
CREATE TABLE IF NOT EXISTS joins (
  chat_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_joins_chat_ts ON joins(chat_id, ts);