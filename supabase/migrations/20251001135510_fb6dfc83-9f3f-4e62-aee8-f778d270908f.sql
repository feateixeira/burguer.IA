-- Add goals fields to establishments table
ALTER TABLE establishments 
ADD COLUMN IF NOT EXISTS daily_goal NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS weekly_goal NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_goal NUMERIC DEFAULT 0;