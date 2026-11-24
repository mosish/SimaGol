CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'customer'
    CHECK (role IN ('customer','florist','editor','owner')),
  addresses TEXT NOT NULL DEFAULT '[]', prefs TEXT NOT NULL DEFAULT '{}'
) STRICT;
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires INTEGER NOT NULL
) STRICT;
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires);
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY, name TEXT NOT NULL
) STRICT;
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY, category TEXT NOT NULL REFERENCES categories(id),
  name TEXT NOT NULL, description TEXT NOT NULL, image TEXT NOT NULL,
  priceIrr INTEGER NOT NULL CHECK(priceIrr>=0), stock INTEGER NOT NULL CHECK(stock>=0),
  hidden INTEGER NOT NULL DEFAULT 0 CHECK(hidden IN (0,1))
) STRICT;
CREATE TABLE IF NOT EXISTS options (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
CREATE TABLE IF NOT EXISTS slots (
  id TEXT PRIMARY KEY, label TEXT NOT NULL, ends TEXT NOT NULL, capacity INTEGER NOT NULL CHECK(capacity>=0)
) STRICT;
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES users(id), requestKey TEXT NOT NULL,
  fingerprint TEXT NOT NULL, created TEXT NOT NULL, status TEXT NOT NULL
    CHECK(status IN ('placed','preparing','shipped','delivered','cancelled')),
  slot TEXT REFERENCES slots(id), snapshot TEXT NOT NULL, UNIQUE(userId,requestKey)
) STRICT;
CREATE INDEX IF NOT EXISTS order_history ON orders(userId,created DESC);
CREATE INDEX IF NOT EXISTS slot_reservations ON orders(slot,status);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY,
  orderId TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK(status IN ('placed','preparing','shipped','delivered','cancelled')),
  created TEXT NOT NULL,
  seen INTEGER NOT NULL DEFAULT 0 CHECK(seen IN (0,1)),
  UNIQUE(orderId,status)
) STRICT;
CREATE INDEX IF NOT EXISTS notifications_by_user ON notifications(userId,id DESC);
