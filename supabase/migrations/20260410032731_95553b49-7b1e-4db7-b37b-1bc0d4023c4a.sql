-- Add drop_description column to inventory
ALTER TABLE public.inventory ADD COLUMN drop_description text DEFAULT '';

-- Create banners table for managing login/catalog banners
CREATE TABLE public.banners (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  image_url text NOT NULL,
  alt text NOT NULL DEFAULT '',
  label text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  subtitle text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active banners" ON public.banners FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert banners" ON public.banners FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update banners" ON public.banners FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete banners" ON public.banners FOR DELETE TO authenticated USING (true);

-- Create drop_singles_images table
CREATE TABLE public.drop_singles_images (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inventory_item_id text NOT NULL,
  image_url text NOT NULL,
  caption text DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.drop_singles_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view drop singles images" ON public.drop_singles_images FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert drop singles images" ON public.drop_singles_images FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update drop singles images" ON public.drop_singles_images FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete drop singles images" ON public.drop_singles_images FOR DELETE TO authenticated USING (true);