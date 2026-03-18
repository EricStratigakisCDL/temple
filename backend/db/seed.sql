-- =============================================================
-- Temple — kitchen-sink seed schema
-- =============================================================

-- Auto-update trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================
-- Users
-- =============================================================
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    email         TEXT UNIQUE NOT NULL,
    password      TEXT NOT NULL DEFAULT 'password',
    name          TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'reviewer'
                  CHECK (role IN ('admin', 'manager', 'reviewer')),
    avatar_url    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_users_updated ON users;
CREATE TRIGGER trg_users_updated
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================
-- Items (kitchen-sink CRUD example)
-- =============================================================
CREATE TABLE IF NOT EXISTS items (
    id            SERIAL PRIMARY KEY,
    title         TEXT NOT NULL,
    description   TEXT,
    status        TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'archived', 'draft')),
    owner_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_items_updated ON items;
CREATE TRIGGER trg_items_updated
    BEFORE UPDATE ON items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================
-- Seed data: users
-- =============================================================
INSERT INTO users (email, password, name, role)
VALUES
    ('eric.stratigakis@compassdigital.io',    'password', 'Eric Stratigakis',  'admin'),
    ('saksham.goyal@compassdigital.io',       'password', 'Saksham Goyal',     'admin'),
    ('tom.luo@compassdigital.io',             'password', 'Tom Luo',           'admin'),
    ('henry.le@compassdigital.io',            'password', 'Henry Le',          'admin'),
    ('preet.modi@compassdigital.io',          'password', 'Preet Modi',        'admin'),
    ('nadish.madadi@compassdigital.io',       'password', 'Nadish Madadi',     'admin'),
    ('sahir.bandali@compassdigital.io',       'password', 'Sahir Bandali',     'admin'),
    ('adam.kita@compassdigital.io',           'password', 'Adam Kita',         'admin')
ON CONFLICT (email) DO NOTHING;

-- =============================================================
-- Seed data: sample items
-- =============================================================
INSERT INTO items (title, description, status, owner_id)
VALUES
    ('Welcome to Temple', 'This is a kitchen-sink template demonstrating the fullstack architecture.', 'active', 1),
    ('Set up CI/CD', 'Configure GitHub Actions for automated testing and deployment.', 'draft', 1),
    ('Add dark mode', 'Implement theme toggle with system preference detection.', 'active', 2),
    ('Write API tests', 'Add integration tests for all backend endpoints.', 'draft', 3)
ON CONFLICT DO NOTHING;
