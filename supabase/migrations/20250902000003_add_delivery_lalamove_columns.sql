/*
  Add delivery fee and Lalamove metadata tracking fields to orders
*/

ALTER TABLE orders
  ADD COLUMN delivery_fee numeric(10,2) DEFAULT 0,
  ADD COLUMN lalamove_quotation_id text,
  ADD COLUMN lalamove_order_id text,
  ADD COLUMN lalamove_status text,
  ADD COLUMN lalamove_tracking_url text;
