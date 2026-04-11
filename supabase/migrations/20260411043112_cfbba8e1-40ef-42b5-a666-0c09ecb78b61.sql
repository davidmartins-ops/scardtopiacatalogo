
-- Add display_page column to banners
ALTER TABLE public.banners ADD COLUMN display_page text NOT NULL DEFAULT 'all';

-- Create stock notifications table
CREATE TABLE public.stock_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  inventory_item_id text NOT NULL,
  notified boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.stock_notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own notifications"
  ON public.stock_notifications FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own notifications"
  ON public.stock_notifications FOR DELETE
  USING (user_id = auth.uid());

CREATE UNIQUE INDEX idx_stock_notifications_unique ON public.stock_notifications (user_id, inventory_item_id);
