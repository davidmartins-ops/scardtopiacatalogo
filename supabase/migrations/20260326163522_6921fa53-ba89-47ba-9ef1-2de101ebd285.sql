-- Add image_url column to inventory
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS image_url text;

-- Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view product images
CREATE POLICY "Public read access on products bucket"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'products');

-- Allow authenticated users to upload product images
CREATE POLICY "Authenticated users can upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'products');

-- Allow authenticated users to update product images
CREATE POLICY "Authenticated users can update product images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'products');

-- Allow authenticated users to delete product images
CREATE POLICY "Authenticated users can delete product images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'products');