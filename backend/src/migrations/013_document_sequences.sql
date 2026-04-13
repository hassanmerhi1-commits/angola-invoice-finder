-- Migration 013: Document sequences for atomic numbering across all document types
CREATE TABLE IF NOT EXISTS document_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type VARCHAR(50) NOT NULL,
  prefix VARCHAR(10) NOT NULL,
  fiscal_year INTEGER NOT NULL,
  current_number INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(document_type, fiscal_year)
);

-- Seed sequences for the current fiscal year
DO $$
DECLARE
  yr INTEGER := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
BEGIN
  INSERT INTO document_sequences (document_type, prefix, fiscal_year, current_number)
  VALUES
    ('invoice', 'INV', yr, COALESCE((SELECT COUNT(*) FROM sales WHERE EXTRACT(YEAR FROM created_at) = yr), 0)),
    ('payment_receipt', 'REC', yr, COALESCE((SELECT COUNT(*) FROM payments WHERE payment_type = 'receipt' AND EXTRACT(YEAR FROM created_at) = yr), 0)),
    ('payment_out', 'PAG', yr, COALESCE((SELECT COUNT(*) FROM payments WHERE payment_type = 'payment' AND EXTRACT(YEAR FROM created_at) = yr), 0)),
    ('purchase_order', 'PO', yr, COALESCE((SELECT COUNT(*) FROM purchase_orders WHERE EXTRACT(YEAR FROM created_at) = yr), 0)),
    ('stock_transfer', 'TRF', yr, COALESCE((SELECT COUNT(*) FROM stock_transfers WHERE EXTRACT(YEAR FROM created_at) = yr), 0)),
    ('journal', 'JE', yr, COALESCE((SELECT COUNT(*) FROM journal_entries WHERE EXTRACT(YEAR FROM created_at) = yr), 0))
  ON CONFLICT (document_type, fiscal_year) DO NOTHING;
END $$;
