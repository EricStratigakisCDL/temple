-- =============================================================
-- Temple — seed schema
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
    role          TEXT NOT NULL DEFAULT 'new'
                  CHECK (role IN ('admin', 'manager', 'reviewer', 'new')),
    status        TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'disabled')),
    avatar_url    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_users_updated ON users;
CREATE TRIGGER trg_users_updated
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================
-- Seed data: users (passwords hashed by seed_db() at startup)
-- =============================================================
INSERT INTO users (email, password, name, role, status)
VALUES
    ('eric.stratigakis@compassdigital.io',    'password', 'Eric Stratigakis',  'admin', 'active'),
    ('saksham.goyal@compassdigital.io',       'password', 'Saksham Goyal',     'admin', 'active'),
    ('tom.luo@compassdigital.io',             'password', 'Tom Luo',           'admin', 'active'),
    ('henry.le@compassdigital.io',            'password', 'Henry Le',          'admin', 'active'),
    ('preet.modi@compassdigital.io',          'password', 'Preet Modi',        'admin', 'active'),
    ('nadish.madadi@compassdigital.io',       'password', 'Nadish Madadi',     'admin', 'active'),
    ('sahir.bandali@compassdigital.io',       'password', 'Sahir Bandali',     'admin', 'active'),
    ('adam.kita@compassdigital.io',           'password', 'Adam Kita',         'admin', 'active')
ON CONFLICT (email) DO NOTHING;
