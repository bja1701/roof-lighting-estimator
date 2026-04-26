ALTER TABLE quotes ADD COLUMN IF NOT EXISTS discount_amount numeric;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS discount_type text CHECK (discount_type IN ('percent', 'flat'));
