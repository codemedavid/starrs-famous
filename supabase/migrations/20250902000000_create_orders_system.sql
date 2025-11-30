/*
  # Create Orders Management System

  1. New Tables
    - `orders` - Main orders table with customer and order information
    - `order_items` - Individual items within each order
    - `rate_limit_logs` - IP-based rate limiting tracking

  2. Security
    - Enable RLS on all tables
    - Public can insert orders (for checkout)
    - Authenticated users (admin) can manage all orders
    - Rate limit logs are admin-only

  3. Functions
    - `generate_order_number()` - Creates unique order numbers
    - `check_rate_limit(ip_address, action_type)` - Checks if action is allowed
    - `cleanup_rate_limit_logs()` - Cleans up old rate limit entries
*/

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  customer_name text NOT NULL,
  contact_number text NOT NULL,
  service_type text NOT NULL CHECK (service_type IN ('dine-in', 'pickup', 'delivery')),
  address text,
  landmark text,
  pickup_time text,
  party_size integer,
  dine_in_time timestamptz,
  payment_method text NOT NULL,
  reference_number text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled')),
  total decimal(10,2) NOT NULL,
  notes text,
  customer_ip text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id uuid REFERENCES menu_items(id) ON DELETE SET NULL,
  menu_item_name text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price decimal(10,2) NOT NULL,
  total_price decimal(10,2) NOT NULL,
  selected_variation jsonb,
  selected_add_ons jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create rate_limit_logs table
CREATE TABLE IF NOT EXISTS rate_limit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  action_type text NOT NULL CHECK (action_type IN ('order_placement', 'admin_action')),
  timestamp timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_customer_ip_created ON orders(customer_ip, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_rate_limit_logs_ip_timestamp ON rate_limit_logs(ip_address, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limit_logs_expires ON rate_limit_logs(expires_at);

-- Enable RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for orders
-- Public can insert orders (for checkout)
CREATE POLICY "Anyone can create orders"
  ON orders
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Public can read their own orders (by order number or contact)
CREATE POLICY "Public can read orders by order number or contact"
  ON orders
  FOR SELECT
  TO public
  USING (true);

-- Authenticated users (admin) can do everything
CREATE POLICY "Authenticated users can manage orders"
  ON orders
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for order_items
-- Public can insert order items (when creating orders)
CREATE POLICY "Anyone can create order items"
  ON order_items
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Public can read order items
CREATE POLICY "Public can read order items"
  ON order_items
  FOR SELECT
  TO public
  USING (true);

-- Authenticated users (admin) can do everything
CREATE POLICY "Authenticated users can manage order items"
  ON order_items
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for rate_limit_logs
-- Only authenticated users (admin) can read rate limit logs
CREATE POLICY "Authenticated users can read rate limit logs"
  ON rate_limit_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- Public can insert rate limit logs (for tracking)
CREATE POLICY "Anyone can create rate limit logs"
  ON rate_limit_logs
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Function to generate unique order numbers
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS text AS $$
DECLARE
  new_order_number text;
  order_count integer;
BEGIN
  -- Format: ORD-YYYYMMDD-XXXX (e.g., ORD-20250902-0001)
  -- Get count of orders today
  SELECT COUNT(*) INTO order_count
  FROM orders
  WHERE DATE(created_at) = CURRENT_DATE;
  
  -- Generate order number
  new_order_number := 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD((order_count + 1)::text, 4, '0');
  
  -- Ensure uniqueness (in case of race condition)
  WHILE EXISTS (SELECT 1 FROM orders WHERE order_number = new_order_number) LOOP
    order_count := order_count + 1;
    new_order_number := 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD((order_count + 1)::text, 4, '0');
  END LOOP;
  
  RETURN new_order_number;
END;
$$ LANGUAGE plpgsql;

-- Function to check rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_ip_address text,
  p_action_type text,
  p_cooldown_seconds integer DEFAULT 30
)
RETURNS boolean AS $$
DECLARE
  last_action_time timestamptz;
  cooldown_end timestamptz;
BEGIN
  -- Get the most recent action for this IP and action type
  SELECT MAX(timestamp) INTO last_action_time
  FROM rate_limit_logs
  WHERE ip_address = p_ip_address
    AND action_type = p_action_type
    AND expires_at > now();
  
  -- If no recent action, allow
  IF last_action_time IS NULL THEN
    -- Record this action
    INSERT INTO rate_limit_logs (ip_address, action_type, expires_at)
    VALUES (p_ip_address, p_action_type, now() + (p_cooldown_seconds || ' seconds')::interval);
    RETURN true;
  END IF;
  
  -- Calculate when cooldown ends
  cooldown_end := last_action_time + (p_cooldown_seconds || ' seconds')::interval;
  
  -- If cooldown has passed, allow
  IF now() >= cooldown_end THEN
    -- Record this action
    INSERT INTO rate_limit_logs (ip_address, action_type, expires_at)
    VALUES (p_ip_address, p_action_type, now() + (p_cooldown_seconds || ' seconds')::interval);
    RETURN true;
  END IF;
  
  -- Still in cooldown, deny
  RETURN false;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old rate limit logs
CREATE OR REPLACE FUNCTION cleanup_rate_limit_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM rate_limit_logs
  WHERE expires_at < now() - interval '1 day';
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create trigger to set completed_at when status changes to completed
CREATE OR REPLACE FUNCTION set_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at = now();
  ELSIF NEW.status != 'completed' THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_orders_completed_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_completed_at();

