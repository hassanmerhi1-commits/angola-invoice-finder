-- Migration 013: Document sequences for atomic invoice numbering
CREATE TABLE IF NOT EXISTS document_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type VARCHAR(50) NOT NULL,
  prefix VARCHAR(10) NOT NULL DEFAULT 'INV',
  fiscal_year INTEGER NOT NULL,
  current_number INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(document_type, fiscal_year)
);

-- Seed the current year sequence
INSERT INTO document_sequences (document_type, prefix, fiscal_year, current_number)
VALUES ('invoice', 'INV', EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER, 
        COALESCE((SELECT COUNT(*) FROM sales WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)), 0))
ON CONFLICT (document_type, fiscal_year) DO NOTHING;
