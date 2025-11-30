/*
  Seed Lalamove configuration keys for the delivery feature
*/

INSERT INTO site_settings (id, value, type, description) VALUES
  ('lalamove_market', 'PH', 'text', 'Default Lalamove market code'),
  ('lalamove_service_type', 'MOTORCYCLE', 'text', 'Lalamove service type used for delivery orders'),
  ('lalamove_sandbox', 'true', 'text', 'Toggle sandbox mode for Lalamove API calls'),
  ('lalamove_api_key', '', 'text', 'Lalamove API key'),
  ('lalamove_api_secret', '', 'text', 'Lalamove API secret'),
  ('lalamove_store_name', '', 'text', 'Name shown to Lalamove for pickup'),
  ('lalamove_store_phone', '', 'text', 'Phone number for Lalamove pickup contact'),
  ('lalamove_store_address', '', 'text', 'Pickup address for Lalamove quotes'),
  ('lalamove_store_latitude', '', 'text', 'Latitude for the pickup location'),
  ('lalamove_store_longitude', '', 'text', 'Longitude for the pickup location')
ON CONFLICT (id) DO NOTHING;
