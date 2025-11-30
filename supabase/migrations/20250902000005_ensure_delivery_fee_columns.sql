/*
  Ensure the orders table exposes the delivery fee and Lalamove tracking columns.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'delivery_fee'
  ) THEN
    ALTER TABLE orders ADD COLUMN delivery_fee numeric(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'lalamove_quotation_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN lalamove_quotation_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'lalamove_order_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN lalamove_order_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'lalamove_status'
  ) THEN
    ALTER TABLE orders ADD COLUMN lalamove_status text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'lalamove_tracking_url'
  ) THEN
    ALTER TABLE orders ADD COLUMN lalamove_tracking_url text;
  END IF;
END $$;
