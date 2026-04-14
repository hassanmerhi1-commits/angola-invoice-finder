-- Add supplier_id and supplier_name columns to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id);
ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_name VARCHAR(255);
