-- Migration 016: Add dedicated freight/transport expense account
-- This separates freight costs from merchandise purchases for monthly tracking

INSERT INTO chart_of_accounts (code, name, account_type, normal_balance, level, is_header, is_active)
VALUES ('6.2.6', 'Transporte sobre Compras', 'expense', 'debit', 3, false, true)
ON CONFLICT (code) DO NOTHING;

-- Update parent children_count
UPDATE chart_of_accounts
SET children_count = (
  SELECT COUNT(*) FROM chart_of_accounts c2 
  WHERE c2.code LIKE '6.2.%' AND c2.level = 3
)
WHERE code = '6.2';
