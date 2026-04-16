-- Migration 017: Multi-price levels and cost tracking columns on products
-- Adds price2, price3, price4, first_cost, last_cost, avg_cost

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='price2') THEN
    ALTER TABLE products ADD COLUMN price2 NUMERIC(15,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='price3') THEN
    ALTER TABLE products ADD COLUMN price3 NUMERIC(15,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='price4') THEN
    ALTER TABLE products ADD COLUMN price4 NUMERIC(15,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='first_cost') THEN
    ALTER TABLE products ADD COLUMN first_cost NUMERIC(15,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='last_cost') THEN
    ALTER TABLE products ADD COLUMN last_cost NUMERIC(15,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='avg_cost') THEN
    ALTER TABLE products ADD COLUMN avg_cost NUMERIC(15,2) DEFAULT 0;
  END IF;
END $$;

-- Initialize cost columns from existing cost where they are 0
UPDATE products SET first_cost = cost WHERE first_cost = 0 AND cost > 0;
UPDATE products SET last_cost = cost WHERE last_cost = 0 AND cost > 0;
UPDATE products SET avg_cost = cost WHERE avg_cost = 0 AND cost > 0;
