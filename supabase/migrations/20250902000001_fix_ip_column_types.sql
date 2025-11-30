/*
  # Fix IP Column Types
  
  Change customer_ip and ip_address columns from inet to text
  to support session identifiers for rate limiting in browser environments.
*/

-- Alter orders table
ALTER TABLE orders 
  ALTER COLUMN customer_ip TYPE text USING customer_ip::text;

-- Alter rate_limit_logs table  
ALTER TABLE rate_limit_logs
  ALTER COLUMN ip_address TYPE text USING ip_address::text;

-- Update function signature
DROP FUNCTION IF EXISTS check_rate_limit(text, text, integer);
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

