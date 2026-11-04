export const PROJECT_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS projects (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    client_name VARCHAR(128),
    location VARCHAR(255),
    start_date DATE,
    budget NUMERIC(14, 2) CHECK (budget IS NULL OR budget >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS project_people (
    id VARCHAR(64) PRIMARY KEY,
    project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    phone VARCHAR(32),
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS uq_project_people_name ON project_people(project_id, LOWER(name));

  CREATE TABLE IF NOT EXISTS project_heads (
    id VARCHAR(64) PRIMARY KEY,
    project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS uq_project_heads_name ON project_heads(project_id, LOWER(name));

  CREATE TABLE IF NOT EXISTS project_entries (
    id VARCHAR(96) PRIMARY KEY,
    project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    type VARCHAR(10) NOT NULL CHECK (type IN ('FUND', 'EXPENSE')),
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    date DATE NOT NULL,
    person_id VARCHAR(64) REFERENCES project_people(id) ON DELETE RESTRICT,
    head_id VARCHAR(64) REFERENCES project_heads(id) ON DELETE RESTRICT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK ((type = 'EXPENSE' AND head_id IS NOT NULL) OR (type = 'FUND' AND head_id IS NULL))
  );
  CREATE INDEX IF NOT EXISTS idx_project_entries_project ON project_entries(project_id, date DESC, created_at DESC);
`;

