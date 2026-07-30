-- JobMargin MVP Schema
-- Requires: PostgreSQL with pgcrypto extension for gen_random_uuid()

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- USERS
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    name            TEXT NOT NULL,
    company_name    TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- SESSIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS sessions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token       TEXT NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- CLIENTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS clients (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    email       TEXT,
    phone       TEXT,
    address     TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- ESTIMATES
-- =============================================================================
CREATE TABLE IF NOT EXISTS estimates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    status          TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'sent', 'accepted', 'declined')),
    estimate_number TEXT NOT NULL UNIQUE,
    notes           TEXT,
    labor_rate      NUMERIC(10,2) NOT NULL DEFAULT 75.00,
    markup_pct      NUMERIC(5,2) NOT NULL DEFAULT 20.00,
    estimated_total NUMERIC(10,2),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- ESTIMATE LINE ITEMS
-- =============================================================================
CREATE TABLE IF NOT EXISTS estimate_line_items (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    estimate_id   UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
    description   TEXT NOT NULL,
    quantity      NUMERIC(10,2) NOT NULL DEFAULT 1,
    unit_cost     NUMERIC(10,2) NOT NULL DEFAULT 0,
    labor_hours   NUMERIC(10,2) NOT NULL DEFAULT 0,
    materials_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
    markup_pct    NUMERIC(5,2),
    line_total    NUMERIC(10,2) NOT NULL DEFAULT 0,
    sort_order    INTEGER NOT NULL DEFAULT 0
);

-- =============================================================================
-- JOBS
-- =============================================================================
CREATE TABLE IF NOT EXISTS jobs (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    estimate_id           UUID REFERENCES estimates(id) ON DELETE SET NULL,
    client_id             UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    status                TEXT NOT NULL DEFAULT 'not_started'
                              CHECK (status IN ('not_started', 'in_progress', 'complete')),
    job_number            TEXT NOT NULL UNIQUE,
    estimated_total       NUMERIC(10,2),
    actual_materials_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
    actual_labor_cost     NUMERIC(10,2) NOT NULL DEFAULT 0,
    actual_labor_hours    NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- JOB MATERIALS (actual purchases tracked against a job)
-- =============================================================================
CREATE TABLE IF NOT EXISTS job_materials (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id       UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    description  TEXT NOT NULL,
    cost         NUMERIC(10,2) NOT NULL DEFAULT 0,
    purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    receipt_url  TEXT
);

-- =============================================================================
-- JOB TIME ENTRIES (actual labor tracked against a job)
-- =============================================================================
CREATE TABLE IF NOT EXISTS job_time_entries (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id      UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    hours       NUMERIC(10,2) NOT NULL DEFAULT 0,
    hourly_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
    total_cost  NUMERIC(10,2) NOT NULL DEFAULT 0,
    notes       TEXT,
    logged_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- INVOICES
-- =============================================================================
CREATE TABLE IF NOT EXISTS invoices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id          UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    invoice_number  TEXT NOT NULL UNIQUE,
    description     TEXT NOT NULL,
    amount_cents    INTEGER NOT NULL,
    amount_paid_cents INTEGER NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'unpaid'
                    CHECK (status IN ('unpaid', 'paid', 'cancelled')),
    stripe_invoice_id TEXT,
    stripe_payment_link TEXT,
    customer_email  TEXT,
    issued_at       TIMESTAMPTZ,
    paid_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- MIGRATION: user_id columns for multi-tenancy
-- =============================================================================
ALTER TABLE clients    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);
ALTER TABLE estimates  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);
ALTER TABLE jobs       ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);
ALTER TABLE invoices   ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);

-- =============================================================================
-- INDEXES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_estimates_client_id ON estimates(client_id);
CREATE INDEX IF NOT EXISTS idx_estimate_line_items_estimate_id ON estimate_line_items(estimate_id);
CREATE INDEX IF NOT EXISTS idx_jobs_client_id ON jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_jobs_estimate_id ON jobs(estimate_id);
CREATE INDEX IF NOT EXISTS idx_job_materials_job_id ON job_materials(job_id);
CREATE INDEX IF NOT EXISTS idx_job_time_entries_job_id ON job_time_entries(job_id);
CREATE INDEX IF NOT EXISTS idx_invoices_job_id ON invoices(job_id);

-- =============================================================================
-- MIGRATION: Add needs_payment_link to invoices
-- =============================================================================
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS needs_payment_link BOOLEAN NOT NULL DEFAULT true;
