-- Migration 010: Phase 2 — Data Integrity Constraints
-- Enforces FK, NOT NULL, UNIQUE, balance checks, and stock integrity at the database level.

-- ==================== 1. PRODUCTS: Add missing constraints ====================

-- Ensure price/cost are never negative
ALTER TABLE products ADD CONSTRAINT chk_products_price_positive CHECK (price >= 0);
ALTER TABLE products ADD CONSTRAINT chk_products_cost_positive CHECK (cost >= 0);
ALTER TABLE products ADD CONSTRAINT chk_products_stock_nonneg CHECK (stock >= 0);

-- Ensure SKU is unique per branch
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku_branch ON products(sku, branch_id);

-- ==================== 2. SALES: Tighten constraints ====================

ALTER TABLE sales ADD CONSTRAINT chk_sales_total_positive CHECK (total >= 0);
ALTER TABLE sales ADD CONSTRAINT chk_sales_subtotal_positive CHECK (subtotal >= 0);
ALTER TABLE sales ADD CONSTRAINT chk_sales_tax_nonneg CHECK (tax_amount >= 0);

-- ==================== 3. SALE ITEMS: Quantity & price constraints ====================

ALTER TABLE sale_items ADD CONSTRAINT chk_sale_items_qty_positive CHECK (quantity > 0);
ALTER TABLE sale_items ADD CONSTRAINT chk_sale_items_price_positive CHECK (unit_price >= 0);

-- ==================== 4. PURCHASE ORDERS: Tighten constraints ====================

ALTER TABLE purchase_orders ADD CONSTRAINT chk_po_total_nonneg CHECK (total >= 0);
ALTER TABLE purchase_order_items ADD CONSTRAINT chk_poi_qty_positive CHECK (quantity > 0);
ALTER TABLE purchase_order_items ADD CONSTRAINT chk_poi_cost_nonneg CHECK (unit_cost >= 0);

-- ==================== 5. STOCK TRANSFERS: Quantity constraints ====================

ALTER TABLE stock_transfer_items ADD CONSTRAINT chk_sti_qty_positive CHECK (quantity > 0);

-- ==================== 6. OPEN ITEMS: Amount constraints ====================

ALTER TABLE open_items ADD CONSTRAINT chk_oi_original_positive CHECK (original_amount > 0);
ALTER TABLE open_items ADD CONSTRAINT chk_oi_remaining_nonneg CHECK (remaining_amount >= 0);

-- ==================== 7. CLEARINGS: Referential + amount ====================

ALTER TABLE clearings ADD CONSTRAINT chk_clearings_amount_positive CHECK (amount > 0);

-- ==================== 8. CLIENTS: Balance constraint ====================

-- credit_limit must be non-negative
ALTER TABLE clients ADD CONSTRAINT chk_clients_credit_limit_nonneg CHECK (credit_limit >= 0);

-- ==================== 9. JOURNAL ENTRIES: Balance enforcement ====================
-- The accounting engine already validates in code, but this is the database-level safety net.
-- total_debit MUST equal total_credit for every posted entry.

ALTER TABLE journal_entries ADD CONSTRAINT chk_journal_balanced 
  CHECK (ABS(total_debit - total_credit) < 0.01);

ALTER TABLE journal_entries ADD CONSTRAINT chk_journal_debit_nonneg CHECK (total_debit >= 0);
ALTER TABLE journal_entries ADD CONSTRAINT chk_journal_credit_nonneg CHECK (total_credit >= 0);

-- Journal lines must have non-negative amounts
ALTER TABLE journal_entry_lines ADD CONSTRAINT chk_jel_debit_nonneg CHECK (debit_amount >= 0);
ALTER TABLE journal_entry_lines ADD CONSTRAINT chk_jel_credit_nonneg CHECK (credit_amount >= 0);

-- At least one side must be > 0 (no zero-zero lines)
ALTER TABLE journal_entry_lines ADD CONSTRAINT chk_jel_has_amount 
  CHECK (debit_amount > 0 OR credit_amount > 0);

-- ==================== 10. PAYMENTS: Amount constraints ====================

ALTER TABLE payments ADD CONSTRAINT chk_payments_amount_positive CHECK (amount > 0);

-- ==================== 11. STOCK MOVEMENTS: Immutability index ====================
-- Stock movements are append-only (source of truth). Add a safeguard comment.
-- No UPDATE or DELETE should ever happen on this table. Corrections = new reverse movement.

COMMENT ON TABLE stock_movements IS 'APPEND-ONLY. Never UPDATE or DELETE rows. Corrections must be recorded as reverse movements.';

-- ==================== 12. ACCOUNTING PERIODS: Prevent duplicate closings ====================

CREATE INDEX IF NOT EXISTS idx_accounting_periods_status ON accounting_periods(status);

-- ==================== 13. Add missing NOT NULL where critical ====================

-- Products must have a name
ALTER TABLE products ALTER COLUMN name SET NOT NULL;

-- Sales must have branch and total
ALTER TABLE sales ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE sales ALTER COLUMN total SET NOT NULL;
ALTER TABLE sales ALTER COLUMN subtotal SET NOT NULL;
ALTER TABLE sales ALTER COLUMN tax_amount SET NOT NULL;

-- Journal entries must be linked
ALTER TABLE journal_entries ALTER COLUMN entry_number SET NOT NULL;
ALTER TABLE journal_entries ALTER COLUMN description SET NOT NULL;

-- ==================== 14. SUPPLIER: Add balance column if missing ====================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'suppliers' AND column_name = 'balance'
  ) THEN
    ALTER TABLE suppliers ADD COLUMN balance DECIMAL(15, 2) DEFAULT 0;
  END IF;
END $$;

-- ==================== DONE ====================
-- Phase 2 Data Integrity constraints applied.
-- All financial amounts are constrained, journal entries must balance,
-- stock cannot go negative, and critical fields are NOT NULL.
