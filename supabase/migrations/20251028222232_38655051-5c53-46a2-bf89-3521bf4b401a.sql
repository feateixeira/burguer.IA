-- Allow public read access to products when totem is enabled
CREATE POLICY "Anyone can view products when totem is enabled"
ON products FOR SELECT
USING (
  establishment_id IN (
    SELECT establishment_id 
    FROM app_settings 
    WHERE totem_enabled = true
  )
);

-- Allow public read access to categories when totem is enabled
CREATE POLICY "Anyone can view categories when totem is enabled"
ON categories FOR SELECT
USING (
  establishment_id IN (
    SELECT establishment_id 
    FROM app_settings 
    WHERE totem_enabled = true
  )
);

-- Allow public read access to establishments when totem is enabled
CREATE POLICY "Anyone can view establishments when totem is enabled"
ON establishments FOR SELECT
USING (
  id IN (
    SELECT establishment_id 
    FROM app_settings 
    WHERE totem_enabled = true
  )
);