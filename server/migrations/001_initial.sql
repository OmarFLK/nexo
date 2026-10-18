CREATE TABLE stores (
  id TEXT PRIMARY KEY CHECK (id = 'nexo'),
  name TEXT NOT NULL CHECK (name = 'Nexo')
);
INSERT INTO stores (id, name) VALUES ('nexo', 'Nexo');

CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
INSERT INTO app_settings VALUES ('revision', '0');

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL DEFAULT 'nexo' REFERENCES stores(id),
  sku TEXT NOT NULL COLLATE NOCASE UNIQUE,
  name TEXT NOT NULL,
  cost_cents INTEGER NOT NULL CHECK (cost_cents >= 0),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  stock INTEGER NOT NULL CHECK (stock >= 0),
  reserved INTEGER NOT NULL CHECK (reserved >= 0 AND reserved <= stock),
  data TEXT NOT NULL CHECK (json_valid(data))
);
CREATE TABLE kit_components (
  kit_id TEXT NOT NULL REFERENCES products(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (kit_id, product_id), CHECK (kit_id != product_id)
);
CREATE TABLE contacts (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK (kind IN ('customer','supplier')),
  name TEXT NOT NULL, data TEXT NOT NULL CHECK (json_valid(data))
);
CREATE TABLE orders (
  id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id),
  status TEXT NOT NULL, quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  profit_cents INTEGER NOT NULL, data TEXT NOT NULL CHECK (json_valid(data))
);
CREATE TABLE order_items (
  order_id TEXT NOT NULL REFERENCES orders(id), product_id TEXT NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0), PRIMARY KEY(order_id, product_id)
);
CREATE TABLE stock_movements (
  id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id),
  quantity_delta INTEGER NOT NULL, reserved_delta INTEGER NOT NULL,
  balance INTEGER NOT NULL CHECK (balance >= 0), date TEXT NOT NULL,
  actor TEXT NOT NULL, reason TEXT NOT NULL, data TEXT NOT NULL CHECK (json_valid(data))
);
CREATE INDEX idx_movements_product ON stock_movements(product_id, date);
CREATE TRIGGER stock_movements_immutable_update BEFORE UPDATE ON stock_movements
BEGIN SELECT RAISE(ABORT, 'Movimentações são imutáveis'); END;
CREATE TRIGGER stock_movements_immutable_delete BEFORE DELETE ON stock_movements
BEGIN SELECT RAISE(ABORT, 'Movimentações são imutáveis'); END;

CREATE TABLE purchases (
  id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id),
  supplier_id TEXT NOT NULL REFERENCES contacts(id), quantity INTEGER NOT NULL CHECK (quantity > 0),
  received INTEGER NOT NULL CHECK (received >= 0 AND received <= quantity),
  unit_cost_cents INTEGER NOT NULL CHECK (unit_cost_cents >= 0),
  data TEXT NOT NULL CHECK (json_valid(data))
);
CREATE TABLE finance_entries (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('income','expense')),
  amount_cents INTEGER NOT NULL CHECK(amount_cents >= 0),
  settled INTEGER NOT NULL CHECK(settled IN (0,1)), due TEXT NOT NULL,
  data TEXT NOT NULL CHECK(json_valid(data))
);
CREATE TABLE pricing_scenarios (id TEXT PRIMARY KEY, data TEXT NOT NULL CHECK(json_valid(data)));
CREATE TABLE channel_prices (
  product_id TEXT NOT NULL REFERENCES products(id), channel TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK(price_cents >= 0), PRIMARY KEY(product_id,channel)
);
CREATE TABLE cost_history (
  product_id TEXT NOT NULL REFERENCES products(id), ordinal INTEGER NOT NULL,
  cost_cents INTEGER NOT NULL CHECK(cost_cents >= 0), date TEXT NOT NULL,
  reason TEXT NOT NULL, PRIMARY KEY(product_id,ordinal)
);
CREATE TABLE commands (
  id TEXT PRIMARY KEY, payload_hash TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY REFERENCES commands(id), actor TEXT NOT NULL, date TEXT NOT NULL,
  type TEXT NOT NULL, data TEXT NOT NULL CHECK(json_valid(data))
);
