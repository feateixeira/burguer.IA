-- Add API key support to establishments
ALTER TABLE establishments 
ADD COLUMN IF NOT EXISTS api_key text UNIQUE;

-- Create idempotency keys table
CREATE TABLE IF NOT EXISTS idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  establishment_id uuid NOT NULL REFERENCES establishments(id),
  order_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(key, establishment_id)
);

-- Enable RLS
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;

-- RLS policies for idempotency_keys
CREATE POLICY "Service role can manage idempotency keys"
  ON idempotency_keys
  FOR ALL
  USING (true);

-- Add columns to orders table for online integration
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS source_domain text,
ADD COLUMN IF NOT EXISTS external_id text,
ADD COLUMN IF NOT EXISTS channel text DEFAULT 'pdv',
ADD COLUMN IF NOT EXISTS origin text DEFAULT 'balcao';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_lookup 
  ON idempotency_keys(key, establishment_id);

CREATE INDEX IF NOT EXISTS idx_orders_external_id 
  ON orders(external_id) WHERE external_id IS NOT NULL;