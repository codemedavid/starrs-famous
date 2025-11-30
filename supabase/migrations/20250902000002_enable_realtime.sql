/*
  # Enable Real-time for Orders System
  
  Enable Supabase real-time subscriptions for orders and order_items tables
  so that admin dashboard can receive live updates when orders change.
*/

-- Enable real-time for orders table
ALTER PUBLICATION supabase_realtime ADD TABLE orders;

-- Enable real-time for order_items table
ALTER PUBLICATION supabase_realtime ADD TABLE order_items;



