-- Add foreign key constraint to product_ingredients table
ALTER TABLE public.product_ingredients 
ADD CONSTRAINT fk_product_ingredients_ingredient 
FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id);