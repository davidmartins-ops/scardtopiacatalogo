CREATE TABLE public.special_order_attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  special_order_id uuid NOT NULL REFERENCES public.special_orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  item_id uuid REFERENCES public.special_order_items(id) ON DELETE SET NULL,
  description text,
  file_path text,
  file_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_special_order_attachments_order ON public.special_order_attachments(special_order_id);

GRANT SELECT, INSERT, DELETE ON public.special_order_attachments TO authenticated;
GRANT ALL ON public.special_order_attachments TO service_role;

ALTER TABLE public.special_order_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their special order attachments"
ON public.special_order_attachments FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all special order attachments"
ON public.special_order_attachments FOR SELECT TO authenticated
USING (public.is_admin());

CREATE POLICY "Owners can add attachments to their special orders"
ON public.special_order_attachments FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.special_orders so
    WHERE so.id = special_order_id AND so.user_id = auth.uid()
  )
);

CREATE POLICY "Owners can delete their own attachments"
ON public.special_order_attachments FOR DELETE TO authenticated
USING (user_id = auth.uid());